// The browser tracker (plan section 8). Tracking.astro compiles this and inlines it early in <head>.
// One ID per event: the Pixels and /api/activity all get it, so Reddit and Meta each count one conversion.
// Reddit and Meta are kept apart: their own storage keys, hashes and calls, each in its own try,
// so a failure or a blocked script in one never stops the other, the page or a lead.
import {
  calendlyConversionId,
  cleanKeys,
  KEYS_STORE,
  META_KEYS_STORE,
  matchKeysOf,
  metaPixelEvent,
  newConversionId,
  rawQueryParam,
  rememberClickId,
  rememberFbc,
  rememberMetaTest,
  rememberVisitorId,
  rememberTouch,
  rememberUtm,
  storeGet,
  storeSet,
  trackingAllowed,
  type MatchKeys,
  type StoreLike,
} from './core';
import { gaIdsFromCookie } from '../../../worker/gacookie';
import { cleanMetaKeys, metaKeysOf, type MetaKeys } from '../../../worker/metakeys';
import { pageTypeOf } from '../../../worker/pagetype';
import { hasNoTrackCookie } from '../../../worker/notrack';
import type { LeadContact, Tracker, TrackOptions } from './track';

declare const __PIXEL_ID__: string;
declare const __GA4_ID__: string;
// Empty turns Meta off: fbevents.js isn't loaded and nothing Meta-only is sent.
declare const __META_PIXEL_ID__: string;

type Rdt = ((...args: unknown[]) => void) & {
  callQueue?: unknown[][];
  sendEvent?: (...args: unknown[]) => void;
};
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};
type QueuedEvent = { name: string; conversion_id?: string; value?: number; currency?: string };

const ENDPOINT = '/api/activity';
const PAGE_WAIT_MS = 1500;
const POLL_MS = 100;
const MAX_BATCH = 10;
const NOTRACK_MAX_AGE = 60 * 60 * 24 * 365;

const w = window as unknown as Window & { rdt?: Rdt; fbq?: Fbq; _fbq?: Fbq; lse?: Tracker };
const d = document;
// Read now: currentScript is only set while this script first runs, and start() may run later.
const viewContent = !d.currentScript?.hasAttribute('data-no-view-content');
// The page's type from Base.astro, for Meta's content_category. Meta only.
const pageType = __META_PIXEL_ID__ ? pageTypeOf(d.documentElement.getAttribute('data-page-type')) : undefined;

function setNoTrackCookie(): void {
  const flag = rawQueryParam(location.search, 'notrack');
  if (flag !== '1' && flag !== '0') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  const value = flag === '1' ? `1; Max-Age=${NOTRACK_MAX_AGE}` : '; Max-Age=0';
  d.cookie = `lse_notrack=${value}; Path=/; SameSite=Lax${secure}`;
}

function readCookie(name: string): string {
  for (const part of d.cookie.split(';')) {
    const [key, value] = part.trim().split('=');
    if (key === name && value) return value;
  }
  return '';
}

function storage(): StoreLike | null {
  try {
    return w.localStorage;
  } catch {
    return null;
  }
}

/** Reddit's standard snippet, then init with any stored match keys. */
function loadPixel(keys: MatchKeys): void {
  if (!w.rdt) {
    const rdt: Rdt = (...args) => {
      if (rdt.sendEvent) rdt.sendEvent(...args);
      else rdt.callQueue?.push(args);
    };
    rdt.callQueue = [];
    w.rdt = rdt;
    const script = d.createElement('script');
    script.src = `https://www.redditstatic.com/ads/pixel.js?pixel_id=${encodeURIComponent(__PIXEL_ID__)}`;
    script.async = true;
    const first = d.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  }
  w.rdt('init', __PIXEL_ID__, keys);
}

/**
 * Meta's standard base code, then init with any stored Meta match keys and the visitor ID.
 * autoConfig is off, so the Pixel sends no automatic button or page-data events.
 */
function loadMeta(keys: MetaKeys, externalId: string, onFail: () => void): void {
  if (!w.fbq) {
    const fbq: Fbq = (...args) => {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
      else fbq.queue?.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    w.fbq = fbq;
    if (!w._fbq) w._fbq = fbq;
    const script = d.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.async = true;
    script.onerror = onFail;
    const first = d.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  }
  w.fbq('set', 'autoConfig', false, __META_PIXEL_ID__);
  w.fbq('init', __META_PIXEL_ID__, { ...keys, ...(externalId ? { external_id: externalId } : {}) });
}

function sessionStore(): StoreLike | null {
  try {
    return w.sessionStorage;
  } catch {
    return null;
  }
}

function start(): void {
  const store = storage();
  const startedAt = Date.now();
  const clickId = rememberClickId(store, location.search);
  const utm = rememberUtm(store, location.search);
  const touch = rememberTouch(store, {
    search: location.search,
    referrer: d.referrer,
    host: location.hostname,
    path: location.pathname,
  });
  let keys = cleanKeys(storeGet(store, KEYS_STORE));
  // Meta only. Read on its own, so a problem here can't stop Reddit's tracking.
  let metaKeys: MetaKeys = {};
  let visitorId = '';
  let fbc = '';
  let metaTest = '';
  // Set when fbevents.js fails to load, so page events stop waiting for _fbp.
  let metaFailed = false;
  if (__META_PIXEL_ID__) {
    try {
      metaKeys = cleanMetaKeys(storeGet(store, META_KEYS_STORE));
      visitorId = rememberVisitorId(store);
      fbc = rememberFbc(store, location.search);
      metaTest = rememberMetaTest(sessionStore(), location.search);
    } catch {
      // Meta goes without these.
    }
  }
  const queue: QueuedEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** The page URL, keeping only the query values the server keeps. */
  const pageUrl = (): string => {
    const kept = location.search
      .replace(/^\?/, '')
      .split('&')
      .filter((pair) => /^(rdt_cid|utm_[a-z]+)=/.test(pair));
    return location.pathname + (kept.length ? `?${kept.join('&')}` : '');
  };

  /** What both /api/activity and /api/lead want to know about this visit. */
  const shared = (): Record<string, string | number> => {
    const fields: Record<string, string | number> = { page: pageUrl() };
    const width = Math.round(w.screen?.width ?? 0);
    const height = Math.round(w.screen?.height ?? 0);
    if (width > 0 && height > 0) {
      fields.screen_width = width;
      fields.screen_height = height;
    }
    const variant = d.documentElement.getAttribute('data-variant');
    const uuid = readCookie('_rdt_uuid');
    if (variant) fields.variant = variant;
    if (clickId) fields.click_id = clickId;
    if (uuid) fields.uuid = uuid;
    // Google's own cookies, so the server can attach a conversion to this visitor's GA4 session.
    // The server checks the format again and never trusts these.
    try {
      const ga = gaIdsFromCookie(d.cookie, __GA4_ID__);
      if (ga.clientId) fields.ga_client_id = ga.clientId;
      if (ga.sessionId) fields.ga_session_id = ga.sessionId;
    } catch {
      // The event still goes, without the Google IDs.
    }
    // Meta's IDs. Only set when Meta is on, and never read by the Reddit or GA4 code on the server.
    if (__META_PIXEL_ID__) {
      const fbp = readCookie('_fbp');
      if (fbp) fields.fbp = fbp;
      if (fbc) fields.fbc = fbc;
      if (visitorId) fields.external_id = visitorId;
      if (metaTest) fields.meta_test = metaTest;
    }
    return fields;
  };

  const send = (events: QueuedEvent[]): void => {
    let common: Record<string, string | number> = {};
    try {
      common = shared();
    } catch {
      // The events still go, without the page details.
    }
    const body = JSON.stringify({
      events,
      ...common,
      ...(utm.utm_source ? { utm_source: utm.utm_source } : {}),
      ...(utm.utm_campaign ? { utm_campaign: utm.utm_campaign } : {}),
      ...(keys.email ? { email_hash: keys.email } : {}),
      ...(keys.phoneNumber ? { phone_hash: keys.phoneNumber } : {}),
      ...(metaKeys.em ? { fb_em: metaKeys.em } : {}),
      ...(metaKeys.ph ? { fb_ph: metaKeys.ph } : {}),
      ...(metaKeys.fn ? { fb_fn: metaKeys.fn } : {}),
      ...(metaKeys.ln ? { fb_ln: metaKeys.ln } : {}),
      ...(pageType ? { content_category: pageType } : {}),
      ...(events.some((event) => event.name === 'SignUp') ? { touch, first_touch: utm } : {}),
    });
    // Fetch goes first because it reports a block, and sendBeacon can't. The beacon is a different
    // request type, so some ad blocker rules that stop one let the other through.
    const beacon = (): void => {
      try {
        navigator.sendBeacon?.(ENDPOINT, body);
      } catch {
        // Tracking never reaches the visitor.
      }
    };
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
    }).catch(beacon);
  };

  const flush = (): void => {
    clearTimeout(timer);
    timer = undefined;
    while (queue.length) send(queue.splice(0, MAX_BATCH));
  };

  // Page events give the Pixels a moment to set _rdt_uuid (and _fbp, when Meta is on), so the server
  // can match the visitor. Never longer than 1.5 s, and a Meta script that failed isn't waited for.
  const pixelsReady = (): boolean =>
    Boolean(readCookie('_rdt_uuid')) && (!__META_PIXEL_ID__ || metaFailed || Boolean(readCookie('_fbp')));
  const flushWhenPixelReady = (): void => {
    if (timer !== undefined) return;
    const check = (): void => {
      timer = undefined;
      if (pixelsReady() || Date.now() - startedAt >= PAGE_WAIT_MS) flush();
      else timer = setTimeout(check, POLL_MS);
    };
    check();
  };

  const trackEvent = (name: string, options: TrackOptions = {}): string => {
    const conversionId = options.conversionId || newConversionId();
    const money =
      typeof options.value === 'number' && options.currency
        ? { value: options.value, currency: options.currency }
        : {};
    try {
      w.rdt?.('track', name, { conversionId, ...keys, ...money });
    } catch {
      // A Reddit failure stays with Reddit.
    }
    const metaName = __META_PIXEL_ID__ ? metaPixelEvent(name) : '';
    if (metaName) {
      try {
        const category = metaName === 'ViewContent' && pageType ? { content_category: pageType } : {};
        w.fbq?.('track', metaName, { ...money, ...category }, { eventID: conversionId });
      } catch {
        // A Meta failure stays with Meta.
      }
    }
    queue.push({ name, conversion_id: conversionId, ...money });
    if (name === 'PageVisit' || name === 'ViewContent') flushWhenPixelReady();
    else flush();
    return conversionId;
  };

  w.lse = {
    track: trackEvent,

    // Counted in D1 only. Never sent to Reddit, so the Pixel isn't called and no ID is needed.
    // It still gets an ID, so a repeated beacon of the same event is counted once in GA4.
    store(name) {
      queue.push({ name, conversion_id: newConversionId() });
      flush();
    },

    // The server sends its own Lead from /api/lead, so this one only fires the Pixels.
    async lead(contact: LeadContact) {
      let fresh: MatchKeys = {};
      try {
        fresh = await matchKeysOf(contact);
      } catch {
        // No crypto.subtle: the Pixel event still goes, without new match keys.
      }
      keys = { ...keys, ...fresh };
      if (fresh.email || fresh.phoneNumber) storeSet(store, KEYS_STORE, keys);
      try {
        w.rdt?.('track', 'Lead', { conversionId: contact.conversionId, ...keys });
      } catch {
        // A Reddit failure stays with Reddit.
      }
      if (!__META_PIXEL_ID__) return;
      try {
        // Kept for later pages' init. This page's init has already run.
        const freshMeta = await metaKeysOf(contact);
        metaKeys = { ...metaKeys, ...freshMeta };
        if (Object.keys(freshMeta).length) storeSet(store, META_KEYS_STORE, metaKeys);
      } catch {
        // The Pixel event still goes, without new match keys.
      }
      try {
        w.fbq?.('track', 'Lead', {}, { eventID: contact.conversionId });
      } catch {
        // A Meta failure stays with Meta.
      }
    },

    fields() {
      return { ...shared(), ...utm };
    },

    touch() {
      return touch;
    },
  };

  w.addEventListener('pagehide', flush);
  d.addEventListener('visibilitychange', () => {
    if (d.visibilityState === 'hidden') flush();
  });

  const seenBookings = new Set<string>();
  w.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { event?: unknown; payload?: { invitee?: { uri?: unknown } } } | null;
    if (event.origin !== 'https://calendly.com' || !data || typeof data !== 'object') return;
    if (data.event !== 'calendly.event_scheduled') return;
    const uri = data.payload?.invitee?.uri;
    const invitee = typeof uri === 'string' ? uri : '';
    if (seenBookings.has(invitee)) return;
    seenBookings.add(invitee);
    trackEvent('SignUp', { conversionId: calendlyConversionId(invitee) });
  });

  loadPixel(keys);
  if (__META_PIXEL_ID__) {
    try {
      loadMeta(metaKeys, visitorId, () => {
        metaFailed = true;
      });
    } catch {
      metaFailed = true;
    }
  }
  trackEvent('PageVisit');
  if (viewContent) trackEvent('ViewContent');
}

setNoTrackCookie();
// Google's documented off switch for the Google tag. It reads this flag whenever it sends, so it
// works even though the tag is added at the edge. Set on every page, with or without our tracker.
if (hasNoTrackCookie(d.cookie)) (w as unknown as Record<string, unknown>)[`ga-disable-${__GA4_ID__}`] = true;
if (
  trackingAllowed({
    userAgent: navigator.userAgent,
    host: location.hostname,
    search: location.search,
    cookie: d.cookie,
  })
) {
  // A prerendered page the visitor never opens must count for nothing.
  if ((d as Document & { prerendering?: boolean }).prerendering) {
    d.addEventListener('prerenderingchange', start, { once: true });
  } else {
    start();
  }
}
