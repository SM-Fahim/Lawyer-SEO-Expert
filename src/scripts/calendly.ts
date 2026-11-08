// Calendly widget.js, loaded once and only when a calendar is near the screen or a dialog opens.
// Use widget.js embeds only: plain iframes never send booking events (plan section 8).
// The tracker counts the booking itself. This only tells other features, such as exit intent.

import { currentTouch } from '../features/tracking/track';

declare global {
  interface Window {
    Calendly?: { initInlineWidget(options: { url: string; parentElement: HTMLElement; utm?: Record<string, string> }): void };
  }
}

// Calendly ignores a value of 255 characters or more.
const MAX_UTM = 254;
// On a slow phone the message came first. On desktop the frame's load came up to 2.4 s before it.
const READY_FALLBACK_MS = 4000;
// Calendly says it's showing before it has fetched the free days. That fetch finished 0.6 to 1 s later on desktop,
// and no message marks it, so the placeholder stays this long to cover it.
const FREE_DAYS_MS = 1000;
const UTM_NAMES: Record<string, string> = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
};

/** So each meeting in Calendly shows where it came from. A link with no tags shows the site that sent the visitor. */
function bookingSource(): Record<string, string> {
  const touch = currentTouch();
  const utm: Record<string, string> = {};
  for (const from of Object.keys(UTM_NAMES)) {
    const value = touch[from] || (from === 'utm_source' ? touch.referrer : '');
    if (value) utm[from] = value.slice(0, MAX_UTM);
  }
  return utm;
}

/** The widget's option names for the same values. */
function widgetUtm(source: Record<string, string>): Record<string, string> {
  const utm: Record<string, string> = {};
  for (const [from, value] of Object.entries(source)) {
    const to = UTM_NAMES[from];
    if (to) utm[to] = value;
  }
  return utm;
}

/** The placeholder's new-tab link books on Calendly, out of this page's sight, so at least Calendly gets the source. */
export function tagFallbackLink(box: HTMLElement): void {
  const link = box.querySelector<HTMLAnchorElement>('.lse-cal__ph a');
  if (!link) return;
  try {
    const url = new URL(link.href);
    for (const [key, value] of Object.entries(bookingSource())) url.searchParams.set(key, value);
    link.href = url.href;
  } catch {
    // The untagged link still works.
  }
}

const reveal = (box: Element): void => box.classList.add('is-ready');

let state: 'idle' | 'loading' | 'ready' = 'idle';
let queue: Array<() => void> = [];

function withCalendly(fn: () => void): void {
  if (state === 'ready') {
    fn();
    return;
  }
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
  };
  document.head.appendChild(script);
}

export function mountCalendar(box: HTMLElement | null): void {
  if (!box || box.getAttribute('data-mounted')) return;
  box.setAttribute('data-mounted', '1');
  withCalendly(() => {
    window.Calendly?.initInlineWidget({ url: box.getAttribute('data-calendly') ?? '', parentElement: box, utm: widgetUtm(bookingSource()) });
    box.classList.add('is-loaded');
    // The frame is blank for seconds after it's created, so the placeholder waits for Calendly to say it's showing.
    // If that message never comes, the frame's load event still clears it.
    box.querySelector('iframe')?.addEventListener('load', () => setTimeout(() => reveal(box), READY_FALLBACK_MS), { once: true });
  });
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
