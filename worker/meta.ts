import { FB_COOKIE_RE, META_TEST_RE } from './metakeys';
import { pageTypeOf, type PageType } from './pagetype';
import { errorText, logError, logInfo, scrub } from './log';

// Meta Conversions API. Built like reddit.ts: each event is made field by field in buildMetaEvent,
// so a caller's extra properties can't reach the wire. Meta and Reddit never share a request, a
// timeout or an error: each sender catches its own failures.
//
// Docs relied on (developers.facebook.com/docs/marketing-api/conversions-api):
//   /using-the-api            POST /<version>/<pixel id>/events, data[], test_event_code
//   /parameters               event_name, event_time in seconds, event_id, action_source, event_source_url
//   /parameters/customer-information-parameters   em, ph, fn, ln, external_id as arrays; fbp, fbc
//   /deduplicate-pixel-and-server-events          same event_id and event_name as the Pixel's eventID
// The token goes in the JSON body as access_token, so it is never in a URL that could be logged.

// Current version on developers.facebook.com/docs/graph-api/changelog, checked 2026-11-07.
export const GRAPH_VERSION = 'v27.0';
const API_BASE = 'https://graph.facebook.com';
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 500;
const HASH_RE = /^[0-9a-f]{64}$/;

export type MetaEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Schedule'
  | 'Lead'
  // Server only, for retargeting audiences. The Pixel never sends it.
  | 'BookingDialogOpened';

/** Our event names to Meta's. Lead only comes from /api/lead. A Map, so no name can match a prototype key. */
export const META_EVENTS = new Map<string, MetaEventName>([
  ['PageVisit', 'PageView'],
  ['ViewContent', 'ViewContent'],
  ['SignUp', 'Schedule'],
  ['BookingDialogOpened', 'BookingDialogOpened'],
]);

export interface MetaEventInput {
  name: MetaEventName;
  eventId: string;
  /** Milliseconds, like Date.now(). Sent to Meta in seconds. */
  eventAt: number;
  sourceUrl?: string | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  fbp?: string | undefined;
  fbc?: string | undefined;
  externalId?: string | undefined;
  emailHash?: string | undefined;
  phoneHash?: string | undefined;
  firstNameHash?: string | undefined;
  lastNameHash?: string | undefined;
  /** The page's type, for ViewContent only. Anything but the five values is dropped. */
  contentCategory?: string | undefined;
}

export interface MetaEvent {
  event_name: MetaEventName;
  event_time: number;
  event_id: string;
  action_source: 'website';
  event_source_url?: string;
  user_data: {
    client_ip_address?: string;
    client_user_agent?: string;
    fbp?: string;
    fbc?: string;
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    external_id?: string[];
  };
  custom_data?: { content_category: PageType };
}

const hashOrUndefined = (value: string | undefined): string | undefined =>
  value && HASH_RE.test(value) ? value : undefined;

const cookieOrUndefined = (value: string | undefined): string | undefined =>
  value && FB_COOKIE_RE.test(value) ? value : undefined;

export function buildMetaEvent(input: MetaEventInput): MetaEvent {
  const user: MetaEvent['user_data'] = {};
  if (input.ip) user.client_ip_address = input.ip;
  if (input.userAgent) user.client_user_agent = input.userAgent.slice(0, 512);
  const fbp = cookieOrUndefined(input.fbp);
  const fbc = cookieOrUndefined(input.fbc);
  if (fbp) user.fbp = fbp;
  if (fbc) user.fbc = fbc;
  const hashes = [
    ['em', input.emailHash],
    ['ph', input.phoneHash],
    ['fn', input.firstNameHash],
    ['ln', input.lastNameHash],
    ['external_id', input.externalId],
  ] as const;
  for (const [key, value] of hashes) {
    const hash = hashOrUndefined(value);
    if (hash) user[key] = [hash];
  }

  const event: MetaEvent = {
    event_name: input.name,
    event_time: Math.floor(input.eventAt / 1000),
    event_id: input.eventId,
    action_source: 'website',
    user_data: user,
  };
  if (input.sourceUrl) event.event_source_url = input.sourceUrl;
  const category = input.name === 'ViewContent' ? pageTypeOf(input.contentCategory) : undefined;
  if (category) event.custom_data = { content_category: category };
  return event;
}

/** A test code from the browser, or undefined when it's missing or malformed. */
export const metaTestCodeOf = (value: unknown): string | undefined =>
  typeof value === 'string' && META_TEST_RE.test(value) ? value : undefined;

/**
 * Real events only when live. Off production, only events with a test code go, and those only
 * reach Meta's Test Events tool. No token or no pixel ID means Meta is off.
 */
export function metaEnabled(env: Env, testCode?: string): boolean {
  if (!env.META_CAPI_TOKEN || !env.META_PIXEL_ID) return false;
  return env.LIVE === 'true' || Boolean(testCode);
}

/**
 * The _fbp or _fbc cookie from the Cookie header, else the value the browser sent. Either must
 * look like Meta's format, or it's dropped.
 */
export function fbCookieOf(request: Request, name: '_fbp' | '_fbc', bodyValue: unknown): string | undefined {
  const pattern = name === '_fbp' ? /(?:^|;\s*)_fbp=([^;]*)/ : /(?:^|;\s*)_fbc=([^;]*)/;
  const cookie = pattern.exec(request.headers.get('cookie') ?? '')?.[1];
  if (cookie && FB_COOKIE_RE.test(cookie)) return cookie;
  return typeof bodyValue === 'string' && FB_COOKIE_RE.test(bodyValue) ? bodyValue : undefined;
}

/** Never throws: nothing Meta does can affect the visitor, Reddit or GA4. */
export async function sendMetaEvents(env: Env, events: MetaEvent[], testCode?: string): Promise<void> {
  try {
    if (!events.length || !metaEnabled(env, testCode)) return;
    await postBatch(env, events, testCode);
  } catch (error) {
    logError('meta_failed', { events: events.length, error: errorText(error) });
  }
}

async function postBatch(env: Env, events: MetaEvent[], testCode: string | undefined): Promise<void> {
  const url = `${API_BASE}/${GRAPH_VERSION}/${encodeURIComponent(env.META_PIXEL_ID)}/events`;
  const body: Record<string, unknown> = { data: events, access_token: env.META_CAPI_TOKEN };
  if (testCode) body.test_event_code = testCode;
  const init = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const lastTry = attempt === 2;
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) {
        // Test mode only, so an empty Test Events page can be told apart from a refused send.
        if (testCode) {
          logInfo('meta_test_sent', {
            status: response.status,
            names: events.map((event) => event.event_name),
            detail: scrubToken(env, await response.text()),
          });
        }
        return;
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (lastTry || !retryable) {
        logError('meta_failed', {
          status: response.status,
          events: events.length,
          detail: scrubToken(env, await response.text()),
        });
        return;
      }
    } catch (error) {
      if (lastTry) {
        logError('meta_failed', { events: events.length, error: scrubToken(env, errorText(error)) });
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}

/** Meta's error text could echo the token back. It never reaches the logs. */
function scrubToken(env: Env, text: string): string {
  const token = env.META_CAPI_TOKEN ?? '';
  const clean = token ? text.split(token).join('[token]') : text;
  return scrub(clean);
}
