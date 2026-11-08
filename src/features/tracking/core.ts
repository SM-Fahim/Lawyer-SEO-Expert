// The tracker's plain logic, with no page state, so it can be tested on its own (tests/tracking/).
// Used by tracker.ts, which is inlined in <head>, and by the form script.
import { hashEmail, hashPhone } from '../../../worker/matchkeys';
import { FBCLID_RE, META_TEST_RE } from '../../../worker/metakeys';
import { hasNoTrackCookie } from '../../../worker/notrack';

// Same pattern as worker/security.ts and the WordPress plugin's tracker.js. A test checks they match.
export const BOT_RE =
  /(bot\/|bot;|crawler|spider|slurp|headlesschrome|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|facebookexternalhit|bytespider)/i;

// Exact hosts only: a subdomain such as next.lawyerseoexpert.com is not production.
const PRODUCTION_HOSTS = ['lawyerseoexpert.com', 'www.lawyerseoexpert.com'];
// The one host where ?pixeltest=1 works. Branch Previews are <branch>-lawyerseoexpert-site..., and
// must not match: the build has only the real pixel ID, so a Preview could only fire that.
const PRE_LAUNCH_HOST = 'lawyerseoexpert-site.fahim-afd.workers.dev';

// The WordPress plugin reads these two on pages not moved yet, so their names and format can't change.
// Short system pages aren't content, so they get PageVisit only.
export const NO_VIEW_CONTENT_PAGES = ['/404/', '/thank-you/'];

export const CLICK_STORE = 'rct_cid';
export const KEYS_STORE = 'rct_mk';
export const UTM_STORE = 'lse_utm';
export const TOUCH_STORE = 'lse_touch';
// Meta's own keys. Never shared with Reddit's, because Meta hashes differently.
export const META_KEYS_STORE = 'lse_fbmk';
export const VISITOR_STORE = 'lse_vid';
export const FBC_STORE = 'lse_fbc';
// Session storage, plain string: a test code lasts until the tab closes.
export const META_TEST_STORE = 'lse_meta_test';
export const KEEP_DAYS = 90;

const DAY_MS = 864e5;
const HASH_RE = /^[a-f0-9]{64}$/;
const INVITEE_RE = /\/invitees\/([A-Za-z0-9-]{6,64})\/?$/;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export type Utm = Record<string, string>;
/** UTM values, plus `referrer` (a host) and `landing` (a path). */
export type Touch = Record<string, string>;
export type MatchKeys = { email?: string; phoneNumber?: string };
export interface StoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const isProductionHost = (host: string): boolean => PRODUCTION_HOSTS.includes(host.toLowerCase());

// The pre-launch host is on the real Turnstile widget's hostname list and the Worker holds the real secret,
// so it needs the real key. Previews and localhost use Cloudflare's test key.
export const usesRealTurnstile = (host: string): boolean =>
  isProductionHost(host) || host.toLowerCase() === PRE_LAUNCH_HOST;

/** The raw query value, not decoded, which is how Reddit's Pixel reads rdt_cid. */
export function rawQueryParam(search: string, name: string): string {
  for (const pair of search.replace(/^\?/, '').split('&')) {
    const [key, value] = pair.split('=');
    if (key === name && value) return value;
  }
  return '';
}

export function trackingAllowed(page: { userAgent: string; host: string; search: string; cookie: string }): boolean {
  if (BOT_RE.test(page.userAgent) || hasNoTrackCookie(page.cookie)) return false;
  if (isProductionHost(page.host)) return true;
  return page.host.toLowerCase() === PRE_LAUNCH_HOST && rawQueryParam(page.search, 'pixeltest') === '1';
}

/** Null when absent, expired or unreadable. Same `{ v, exp }` entries as the plugin. */
export function storeGet(store: StoreLike | null, key: string, now = Date.now()): unknown {
  try {
    const raw = store?.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw) as { v?: unknown; exp?: unknown } | null;
    if (!item || typeof item !== 'object' || typeof item.exp !== 'number' || item.exp < now) {
      store?.removeItem(key);
      return null;
    }
    return item.v ?? null;
  } catch {
    return null;
  }
}

export function storeSet(store: StoreLike | null, key: string, value: unknown, now = Date.now()): void {
  try {
    store?.setItem(key, JSON.stringify({ v: value, exp: now + KEEP_DAYS * DAY_MS }));
  } catch {
    // Storage blocked or full. The value still works for this page.
  }
}

/** A click ID in the URL wins and is stored for 90 days. Otherwise, the stored one. */
export function rememberClickId(store: StoreLike | null, search: string, now = Date.now()): string {
  const fromUrl = rawQueryParam(search, 'rdt_cid');
  if (fromUrl) {
    storeSet(store, CLICK_STORE, fromUrl, now);
    return fromUrl;
  }
  const stored = storeGet(store, CLICK_STORE, now);
  return typeof stored === 'string' ? stored : '';
}

function utmInUrl(search: string): Utm {
  const params = new URLSearchParams(search);
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }
  return utm;
}

/**
 * Meta's fbc, `fb.1.<ms first seen>.<fbclid>`. A new fbclid in the URL replaces the stored one.
 * The same fbclid again (a reload) keeps its first time. Otherwise, the stored one.
 */
export function rememberFbc(store: StoreLike | null, search: string, now = Date.now()): string {
  const stored = storeGet(store, FBC_STORE, now);
  const current = typeof stored === 'string' ? stored : '';
  const fbclid = rawQueryParam(search, 'fbclid');
  if (fbclid && FBCLID_RE.test(fbclid) && !current.endsWith(`.${fbclid}`)) {
    const fbc = `fb.1.${now}.${fbclid}`;
    storeSet(store, FBC_STORE, fbc, now);
    return fbc;
  }
  return current;
}

/** A random 64-hex visitor ID for Meta's external_id, kept 90 days from the latest visit. */
export function rememberVisitorId(store: StoreLike | null, now = Date.now()): string {
  const stored = storeGet(store, VISITOR_STORE, now);
  const id =
    typeof stored === 'string' && HASH_RE.test(stored)
      ? stored
      : Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  storeSet(store, VISITOR_STORE, id, now);
  return id;
}

/** ?meta_test=TEST... is kept for this tab. Empty when there's none. */
export function rememberMetaTest(session: StoreLike | null, search: string): string {
  const fromUrl = rawQueryParam(search, 'meta_test');
  try {
    if (META_TEST_RE.test(fromUrl)) {
      session?.setItem(META_TEST_STORE, fromUrl);
      return fromUrl;
    }
    const stored = session?.getItem(META_TEST_STORE) ?? '';
    return META_TEST_RE.test(stored) ? stored : '';
  } catch {
    // Storage blocked: the code still works for this page.
    return META_TEST_RE.test(fromUrl) ? fromUrl : '';
  }
}

/** Our event name to the Pixel's. Empty for anything else, which the Pixel doesn't get. */
export function metaPixelEvent(name: string): string {
  if (name === 'PageVisit') return 'PageView';
  if (name === 'ViewContent') return 'ViewContent';
  return name === 'SignUp' ? 'Schedule' : '';
}

/** First touch: UTM values already stored win over the ones in this URL. */
export function rememberUtm(store: StoreLike | null, search: string, now = Date.now()): Utm {
  const stored = storeGet(store, UTM_STORE, now);
  if (stored && typeof stored === 'object') return stored as Utm;
  const utm = utmInUrl(search);
  if (Object.keys(utm).length) storeSet(store, UTM_STORE, utm, now);
  return utm;
}

/** The referring site's host, or empty when there's none or it's this site. */
export function externalReferrer(referrer: string, ownHost: string): string {
  const bare = (host: string): string => host.toLowerCase().replace(/^www\./, '');
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host && bare(host) !== bare(ownHost) ? host : '';
  } catch {
    return '';
  }
}

/**
 * Last touch: the latest link with UTM values, or the latest other site that sent this visitor.
 * A direct visit or a click within the site keeps the one already stored. A booking's source comes
 * from here, because someone first seen through an old ad may book from a new post.
 */
export function rememberTouch(
  store: StoreLike | null,
  page: { search: string; referrer: string; host: string; path: string },
  now = Date.now(),
): Touch {
  const utm = utmInUrl(page.search);
  const referrer = externalReferrer(page.referrer, page.host);
  if (Object.keys(utm).length || referrer) {
    const touch: Touch = { ...utm, ...(referrer ? { referrer } : {}), landing: page.path };
    storeSet(store, TOUCH_STORE, touch, now);
    return touch;
  }
  const stored = storeGet(store, TOUCH_STORE, now);
  return stored && typeof stored === 'object' ? (stored as Touch) : {};
}

/** Only well-formed hashes, so a bad entry can't reach the Pixel or the server. */
export function cleanKeys(value: unknown): MatchKeys {
  const keys: MatchKeys = {};
  if (value && typeof value === 'object') {
    const { email, phoneNumber } = value as Record<string, unknown>;
    if (typeof email === 'string' && HASH_RE.test(email)) keys.email = email;
    if (typeof phoneNumber === 'string' && HASH_RE.test(phoneNumber)) keys.phoneNumber = phoneNumber;
  }
  return keys;
}

/** Normalized and hashed exactly as the server does it, because both use worker/matchkeys.ts. */
export async function matchKeysOf(contact: { email?: string | undefined; phone?: string | undefined }): Promise<MatchKeys> {
  const [email, phoneNumber] = await Promise.all([hashEmail(contact.email), hashPhone(contact.phone)]);
  return { ...(email ? { email } : {}), ...(phoneNumber ? { phoneNumber } : {}) };
}

/** `calendly-<invitee id>`, or empty when the URI has no invitee ID. */
export function calendlyConversionId(inviteeUri: string): string {
  const id = INVITEE_RE.exec(inviteeUri)?.[1];
  return id ? `calendly-${id}` : '';
}

export function newConversionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
