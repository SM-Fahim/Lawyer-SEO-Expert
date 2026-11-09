// Calendly widget.js, loaded once and only when a calendar is near the screen or a dialog opens.
// Use widget.js embeds only: plain iframes never send booking events (plan section 8).
// The tracker counts the booking itself. This only tells other features, such as exit intent.

import { bookingSource, widgetUtm } from './booking-source';

declare global {
  interface Window {
    Calendly?: { initInlineWidget(options: { url: string; parentElement: HTMLElement; utm?: Record<string, string> }): void };
  }
}

// On a slow phone the message came first. On desktop the frame's load came up to 2.4 s before it.
const READY_FALLBACK_MS = 4000;
// Calendly says it's showing before it has fetched the free days. That fetch finished 0.6 to 1 s later on desktop,
// and no message marks it, so the placeholder stays this long to cover it.
const FREE_DAYS_MS = 1000;
// Counted from the mount, not from page load: the slowest phone measured took about 4 s, so 8 s is a real delay.
// Then the placeholder offers Calendly's own page.
const SLOW_MS = 8000;

/** The placeholder's new-tab link books on Calendly, out of this page's sight, so at least Calendly gets the source. */
export function tagFallbackLink(box: HTMLElement): void {
  const link = box.querySelector<HTMLAnchorElement>('.lse-cal__out a');
  if (!link) return;
  try {
    const url = new URL(link.href);
    for (const [key, value] of Object.entries(bookingSource())) url.searchParams.set(key, value);
    link.href = url.href;
  } catch {
    // The untagged link still works.
  }
}

const slowTimers = new WeakMap<Element, number>();

/** Calendly is showing: the placeholder fades out. */
const reveal = (box: Element): void => {
  window.clearTimeout(slowTimers.get(box));
  box.classList.remove('is-loading', 'is-slow');
  box.classList.add('is-ready');
};

/** The words line changes its text, not its node, so a screen reader hears the new state (role="status"). */
function say(box: Element, key: 'slow' | 'off'): void {
  const line = box.querySelector<HTMLElement>('.lse-cal__say');
  const text = line?.dataset[key];
  const strong = line?.querySelector('strong');
  if (text && strong) strong.textContent = text;
}

let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
let queue: Array<() => void> = [];
let failQueue: Array<() => void> = [];

/** widget.js was blocked (an ad blocker, a privacy browser): at once, the message, the Calendly link and the form. */
const fail = (box: Element): void => {
  window.clearTimeout(slowTimers.get(box));
  box.classList.remove('is-loading', 'is-slow');
  box.classList.add('is-failed');
  say(box, 'off');
};

function withCalendly(fn: () => void, onFail: () => void): void {
  if (state === 'ready') {
    fn();
    return;
  }
  if (state === 'failed') {
    onFail();
    return;
  }
  failQueue.push(onFail);
  queue.push(fn);
  if (state === 'loading') return;
  state = 'loading';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://assets.calendly.com/assets/external/widget.css';
  document.head.appendChild(css);
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://assets.calendly.com/assets/external/widget.js';
  script.onload = () => {
    state = 'ready';
    queue.forEach((f) => {
      try {
        f();
      } catch {
        // One failed mount shouldn't stop the others. The placeholder link stays usable.
      }
    });
    queue = [];
    failQueue = [];
  };
  script.onerror = () => {
    state = 'failed';
    failQueue.forEach((f) => f());
    queue = [];
    failQueue = [];
  };
  document.head.appendChild(script);
}

export function mountCalendar(box: HTMLElement | null): void {
  if (!box || box.getAttribute('data-mounted')) return;
  box.setAttribute('data-mounted', '1');
  // The slow timer starts here, at the mount (a dialog's at the click). data-mounted keeps a reopened dialog from
  // starting it again.
  box.classList.add('is-loading');
  slowTimers.set(
    box,
    window.setTimeout(() => {
      if (box.classList.contains('is-ready') || box.classList.contains('is-failed')) return;
      box.classList.add('is-slow');
      say(box, 'slow');
    }, SLOW_MS),
  );
  withCalendly(() => {
    window.Calendly?.initInlineWidget({ url: box.getAttribute('data-calendly') ?? '', parentElement: box, utm: widgetUtm(bookingSource()) });
    box.classList.add('is-loaded');
    // The frame is blank for seconds after it's created, so the placeholder waits for Calendly to say it's showing.
    // If that message never comes, the frame's load event still clears it.
    box.querySelector('iframe')?.addEventListener('load', () => setTimeout(() => reveal(box), READY_FALLBACK_MS), { once: true });
  }, () => fail(box));
}

window.addEventListener('message', (e) => {
  if (e.origin !== 'https://calendly.com') return;
  if (e.data?.event === 'calendly.event_scheduled') {
    document.dispatchEvent(new CustomEvent('lse:call-booked'));
  } else if (e.data?.event === 'calendly.event_type_viewed' || e.data?.event === 'calendly.profile_page_viewed') {
    document.querySelectorAll('[data-calendly]').forEach((box) => {
      if (box.querySelector('iframe')?.contentWindow === e.source) setTimeout(() => reveal(box), FREE_DAYS_MS);
    });
  }
});
