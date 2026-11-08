// Lead forms. They post to /api/lead (the contract is at the top of worker/addons/lead.ts).
// Only an explicit { ok: true } shows success. Anything else shows a message and a way to reach us.
import { isProductionHost, newConversionId, usesRealTurnstile } from '../features/tracking/core';
import { leadAttribution, trackLead } from '../features/tracking/track';

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, options: Record<string, unknown>): string;
      reset(id: string): void;
    };
    lseTsReady?: () => void;
  }
}

type Field = HTMLInputElement | HTMLSelectElement;
type LeadReply = { ok?: boolean; error?: string; fields?: string[] };

// The server silently drops a post under 3 seconds. So a fast visitor's post waits until it's safe.
const MIN_FORM_MS = 3000;
// A post without a Turnstile token is kept, but flagged as possible spam and not counted as an ad
// conversion. So a fast visitor's post waits this long for the token before it goes without one.
const TOKEN_WAIT_MS = 6000;
const TOKEN_FIELD = 'cf-turnstile-response';

const LIVE = isProductionHost(location.hostname);
// ?demo previews the success state, but never on the production host.
const DEMO = !LIVE && /[?&]demo\b/.test(location.search);

const RULES: Record<string, (v: string) => boolean> = {
  url: (v) => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v.trim()),
  name: (v) => v.trim().length >= 2,
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  phone: (v) => {
    const n = v.replace(/\D/g, '').length;
    return n === 0 || (n >= 7 && n <= 15);
  },
};

const fieldOf = (el: Element) => el.closest('.lse-field');

function markBad(el: Element, bad: boolean): void {
  el.setAttribute('aria-invalid', bad ? 'true' : 'false');
  fieldOf(el)?.classList.toggle('is-bad', bad);
}

function check(el: Field): boolean {
  const rule = RULES[el.getAttribute('data-rule') ?? ''];
  let ok = !rule || rule(el.value || '');
  if (el.required && !el.value.trim()) ok = false;
  markBad(el, !ok);
  return ok;
}

const normUrl = (v: string) => {
  const t = v.trim();
  return t && !/^https?:\/\//i.test(t) ? `https://${t}` : t;
};

let tsQueue: Array<() => void> = [];
/** Loads Cloudflare's script once. Rendering a widget is a separate step, in startTurnstile. */
function loadTurnstile(): void {
  if (document.getElementById('lse-ts-js')) return;
  window.lseTsReady = () => {
    tsQueue.forEach((fn) => fn());
    tsQueue = [];
  };
  const s = document.createElement('script');
  s.id = 'lse-ts-js';
  s.async = true;
  s.defer = true;
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=lseTsReady';
  document.head.appendChild(s);
}

function startTurnstile(form: HTMLFormElement): void {
  const box = form.querySelector<HTMLElement>('[data-ts]');
  if (!box || box.getAttribute('data-started')) return;
  box.setAttribute('data-started', '1');
  const sitekey = box.getAttribute(usesRealTurnstile(location.hostname) ? 'data-sitekey' : 'data-test-sitekey') ?? '';
  const render = () => {
    try {
      const id = window.turnstile?.render(box, {
        sitekey,
        theme: 'light',
        size: 'flexible',
        action: 'lead',
        // Handled: with no token the form still posts, and the server keeps the lead as unverified.
        'error-callback': () => true,
      });
      if (id) box.setAttribute('data-wid', id);
    } catch {
      // Same: the lead is kept without a token.
    }
  };
  if (window.turnstile) {
    render();
    return;
  }
  tsQueue.push(render);
  loadTurnstile();
}

const tokenOf = (form: HTMLFormElement) =>
  (form.querySelector<HTMLInputElement>(`input[name="${TOKEN_FIELD}"]`)?.value ?? '').trim();

/** Resolves when the form has a token, or after maxMs without one. */
function waitForToken(form: HTMLFormElement, maxMs: number): Promise<void> {
  const deadline = performance.now() + maxMs;
  return new Promise((resolve) => {
    const tick = () => {
      if (tokenOf(form) || performance.now() >= deadline) resolve();
      else setTimeout(tick, 150);
    };
    tick();
  });
}

document.querySelectorAll<HTMLFormElement>('form[data-lead-form]').forEach((form) => {
  const card = form.closest<HTMLElement>('[data-form-card]')!;
  const alertBox = card.querySelector<HTMLElement>('[data-alert]')!;
  const done = card.querySelector<HTMLElement>('[data-done]')!;
  const rules = () => Array.from(form.querySelectorAll<Field>('[data-rule]'));
  const named = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;
  const email = form.getAttribute('data-fallback-email') ?? '';
  const booking = form.getAttribute('data-fallback-booking') ?? '';
  const contact = `Email <a href="mailto:${email}">${email}</a> or <a href="${booking}" target="_blank" rel="noopener">book a call</a> and we'll take it from there.`;
  let submitting = false;

  // One ID for one lead, however many tries it takes. The server ignores a second save of the same ID.
  let conversionId = '';
  // After a lost reply the lead may be saved. If the visitor then changes their details, that's new
  // information, and reusing the ID would make the server throw it away.
  let outcomeUnknown = false;
  let lastDetails = '';

  const hideAlert = () => {
    alertBox.classList.remove('is-on');
    alertBox.textContent = '';
  };
  const showAlert = (html: string) => {
    alertBox.innerHTML = html;
    alertBox.classList.add('is-on');
    alertBox.focus();
  };

  // A token works once, so every failed try needs a new one.
  const resetTurnstile = () => {
    const widget = form.querySelector('[data-ts]')?.getAttribute('data-wid');
    if (widget) window.turnstile?.reset(widget);
  };

  form.addEventListener('focusin', () => startTurnstile(form), { once: true });

  rules().forEach((el) => {
    el.addEventListener('blur', () => {
      if (el.value) check(el);
    });
    el.addEventListener('input', () => {
      if (el.getAttribute('aria-invalid') === 'true') check(el);
    });
  });

  const busy = (on: boolean) => {
    submitting = on;
    form.querySelectorAll<HTMLButtonElement>('[type=submit]').forEach((b) => {
      b.disabled = on;
      if (on) b.setAttribute('aria-busy', 'true');
      else b.removeAttribute('aria-busy');
    });
  };

  const finish = () => {
    card.classList.add('is-done');
    done.classList.add('is-on');
    const h = done.querySelector('h3');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus();
    }
  };

  const showFailure = (reply: LeadReply | null) => {
    resetTurnstile();
    if (reply?.error === 'invalid') {
      const bad = (reply.fields ?? [])
        .map((name) => named(name))
        .filter((el): el is HTMLInputElement => !!el && el.type !== 'hidden' && !!fieldOf(el));
      if (bad.length) {
        bad.forEach((el) => markBad(el, true));
        showAlert('Please check the highlighted fields.');
        bad[0]?.focus();
        return;
      }
    }
    if (reply?.error === 'turnstile_failed') {
      showAlert(`We couldn't verify your browser. Please send it again. Still stuck? ${contact}`);
    } else if (reply?.error === 'rate_limited') {
      showAlert(`You've sent several messages in the last hour. ${contact}`);
    } else {
      showAlert(`We could not send that just now. ${contact}`);
    }
  };

  const post = () => {
    // Read here, not earlier: a Turnstile token may have landed in the form while this post waited.
    const fields = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const body = {
      page: location.pathname,
      ...leadAttribution(),
      ...fields,
      conversion_id: conversionId,
      elapsed_ms: Math.round(performance.now()),
    };
    fetch(form.getAttribute('action') ?? '/api/lead', {
      method: 'POST',
      body: JSON.stringify(body),
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    })
      .then(async (r) => ({ httpOk: r.ok, reply: (await r.json()) as LeadReply | null }))
      .then(({ httpOk, reply }) => {
        busy(false);
        outcomeUnknown = false;
        if (httpOk && reply?.ok === true) {
          finish();
          trackLead({ conversionId, email: fields.email, phone: fields.phone, name: fields.name });
          conversionId = '';
          return;
        }
        showFailure(reply);
      })
      .catch(() => {
        // A network failure, or a reply that isn't JSON. Preview without tables answers save_failed, not this.
        busy(false);
        showFailure(null);
      });
  };

  form.addEventListener('submit', (e) => {
    if (submitting) {
      e.preventDefault();
      return;
    }
    hideAlert();

    // Honeypot filled: act as if it worked, and send nothing.
    if (named('hp')?.value) {
      e.preventDefault();
      finish();
      return;
    }

    const bad = rules().filter((el) => !check(el));
    if (bad.length) {
      e.preventDefault();
      bad[0]?.focus();
      return;
    }

    const website = named('website');
    if (website) website.value = normUrl(website.value);
    const name = named('name');
    if (name) name.value = name.value.trim().replace(/\s+/g, ' ');

    if (DEMO) {
      e.preventDefault();
      busy(true);
      setTimeout(() => {
        busy(false);
        finish();
      }, 600);
      return;
    }

    if (!window.fetch || !window.FormData) return; // Native POST, for browsers without fetch.
    e.preventDefault();
    busy(true);

    const details = JSON.stringify(['name', 'email', 'phone', 'website'].map((key) => named(key)?.value ?? ''));
    if (!conversionId || (outcomeUnknown && details !== lastDetails)) conversionId = newConversionId();
    lastDetails = details;
    outcomeUnknown = true;

    // Wait for both: the 3 second floor, and the token (or up to TOKEN_WAIT_MS without it).
    startTurnstile(form);
    const floor = new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, MIN_FORM_MS - performance.now())));
    void Promise.all([floor, waitForToken(form, TOKEN_WAIT_MS)]).then(post);
  });
});
