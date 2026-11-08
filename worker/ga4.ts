import { gaClientIdOf, gaIdsFromCookie, gaSessionIdOf } from './gacookie';
import { errorText, logError, logInfo, scrub } from './log';
import { sha256Hex } from './matchkeys';

// GA4 Measurement Protocol, from the Worker. This is the only source of these events: the browser
// never sends them, because GA4 doesn't dedupe event IDs. So each conversion is claimed in D1
// (ga4_sent) before it is sent, and released again only if Google couldn't be reached.
//
// Docs relied on (developers.google.com/analytics/devguides/collection/protocol/ga4):
//   /sending-events      endpoint, api_secret and measurement_id in the query, client_id, session_id
//   /reference           ip_override, device, timestamp_micros ("only to record events that happened in
//                        the past"), 25 events and 25 params per request, 100 characters per value
//   /validating-events   /debug/mp/collect
//   /reference/events    campaign_details
// user_agent is not a documented field, so it is not sent.

const COLLECT = 'https://www.google-analytics.com/mp/collect';
const DEBUG_COLLECT = 'https://www.google-analytics.com/debug/mp/collect';
const TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 500;
const RETENTION_MS = 30 * 24 * 60 * 60_000;
// Google asks for engagement time on every event so it joins the session. 100 is its own example.
const ENGAGEMENT_MS = 100;
const MAX_VALUE = 100;
const PARAM_KEY = /^[a-z][a-z0-9_]{0,39}$/;

export type Ga4EventName =
  | 'generate_lead'
  | 'schedule_call'
  | 'booking_dialog_open'
  | 'exit_offer_shown';

export interface Ga4Utm {
  source?: string | undefined;
  medium?: string | undefined;
  campaign?: string | undefined;
  term?: string | undefined;
  content?: string | undefined;
}

export interface Ga4Event {
  name: Ga4EventName;
  /** The conversion ID. Without one the event can't be de-duplicated, but it is still sent. */
  dedupeId?: string | null | undefined;
  /** Non-personal values only. Built by the caller field by field. */
  params: Record<string, string>;
}

export interface Ga4Visitor {
  /** From the browser's payload or the Cookie header, already format-checked. */
  clientId?: string | undefined;
  sessionId?: string | undefined;
  /** Only used to make a stable stand-in client ID when the browser has no _ga cookie. */
  seed?: string | null | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  utm?: Ga4Utm | undefined;
}

/** Live only, and only with the secret. Anything else is a silent no-op. */
export function ga4Enabled(env: Env): boolean {
  return env.LIVE === 'true' && Boolean(env.GA4_API_SECRET) && Boolean(env.GA4_MEASUREMENT_ID);
}

/**
 * Client and session IDs from the body the browser sent, else from the Cookie header. Each must
 * match Google's format, or it is ignored and the caller falls back.
 */
export function ga4IdsOf(request: Request, env: Env, body: Record<string, unknown>): Pick<Ga4Visitor, 'clientId' | 'sessionId'> {
  const fromCookie = gaIdsFromCookie(request.headers.get('cookie') ?? '', env.GA4_MEASUREMENT_ID);
  const clientId = gaClientIdOf(body.ga_client_id) ?? fromCookie.clientId;
  // A session ID only means something with the client ID it belongs to.
  const sessionId = clientId ? (gaSessionIdOf(body.ga_session_id) ?? fromCookie.sessionId) : undefined;
  return { clientId, sessionId };
}

// Plain label characters only. Anything else (an "@", a long string, odd symbols) is dropped, not cleaned,
// because a form label or a campaign tag has no business holding an email address or free text.
const SAFE_VALUE = /^[A-Za-z0-9 _.,:;/+()&#%-]{1,100}$/;

/** The value if it is safe to send to Google, else undefined. */
export function ga4Value(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return SAFE_VALUE.test(text) ? text : undefined;
}

/** A GA-shaped client ID that is the same every time for the same seed. */
export async function fallbackClientId(seed: string): Promise<string> {
  const hex = await sha256Hex(`ga4-fallback:${seed}`);
  const part = (start: number) => String(Number.parseInt(hex.slice(start, start + 8), 16) % 1_000_000_000 + 1_000_000_000);
  return `${part(0)}.${part(8)}`;
}

function deviceCategory(userAgent: string | null | undefined): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent ?? '';
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

interface Payload {
  client_id: string;
  ip_override?: string;
  device: { category: string };
  events: Array<{ name: string; params: Record<string, string | number> }>;
}

export async function buildPayload(events: Ga4Event[], visitor: Ga4Visitor): Promise<Payload> {
  const clientId =
    visitor.clientId ?? (await fallbackClientId(visitor.seed || events[0]?.dedupeId || 'anonymous'));
  // Google's session_id is Unix seconds. A visitor with no _ga cookie gets one for this event alone.
  const cookieSession = visitor.clientId ? visitor.sessionId : undefined;
  const sessionId = cookieSession ?? String(Math.floor(Date.now() / 1000));

  const list: Payload['events'] = events.map((event) => {
    const params: Record<string, string | number> = { engagement_time_msec: ENGAGEMENT_MS };
    if (sessionId) params.session_id = Number(sessionId);
    for (const [key, value] of Object.entries(event.params)) {
      const safe = ga4Value(value);
      if (PARAM_KEY.test(key) && safe) params[key] = safe;
    }
    return { name: event.name, params };
  });

  // Without a session to join, say where the visitor came from on the event itself.
  const utm = visitor.utm;
  if (!cookieSession && utm) {
    const campaign: Record<string, string | number> = { engagement_time_msec: ENGAGEMENT_MS, session_id: Number(sessionId) };
    for (const key of ['source', 'medium', 'campaign', 'term', 'content'] as const) {
      const value = ga4Value(utm[key]);
      if (value) campaign[key] = value;
    }
    if (Object.keys(campaign).length > 2) list.unshift({ name: 'campaign_details', params: campaign });
  }

  const payload: Payload = { client_id: clientId, device: { category: deviceCategory(visitor.userAgent) }, events: list };
  if (visitor.ip) payload.ip_override = visitor.ip;
  return payload;
}

/**
 * Never throws and never delays the caller's response: call it inside waitUntil. Each event with
 * a dedupe ID is sent once, however many times this is called with it.
 */
export async function sendGa4Events(env: Env, events: Ga4Event[], visitor: Ga4Visitor): Promise<void> {
  if (!events.length || !ga4Enabled(env)) return;
  const secret = env.GA4_API_SECRET ?? '';
  let claimed: string[] = [];
  try {
    const fresh: Ga4Event[] = [];
    const keys = new Set<string>();
    for (const event of events) {
      const key = event.dedupeId ? `${event.name}:${event.dedupeId}` : null;
      if (key) {
        if (keys.has(key) || !(await claim(env.DB, key))) continue;
        keys.add(key);
        // Recorded as it happens, so a later failure still releases what was already claimed.
        claimed.push(key);
      }
      fresh.push(event);
    }
    if (!fresh.length) return;

    const payload = await buildPayload(fresh, visitor);
    // Only a clear failure releases the claim. After a timeout Google may have the event.
    if ((await post(env, secret, payload, fresh.length)) === 'failed') await release(env.DB, claimed);
  } catch (error) {
    // Includes a missing ga4_sent table. Fail closed: a lost event is better than a double count.
    logError('ga4_failed', { error: redact(errorText(error), secret) });
    await release(env.DB, claimed);
  }
}

/** True if this call won the right to send, false if it was already sent (or is being sent). */
async function claim(db: D1Database, key: string): Promise<boolean> {
  const result = await db
    .prepare('INSERT OR IGNORE INTO ga4_sent (key, ts) VALUES (?, ?)')
    .bind(key, Date.now())
    .run();
  return result.meta.changes > 0;
}

async function release(db: D1Database, keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    await db.batch(keys.map((key) => db.prepare('DELETE FROM ga4_sent WHERE key = ?').bind(key)));
  } catch {
    // The claim stays, so this event is lost rather than risked twice.
  }
}

/** The secret is in the URL Google needs, so it must never reach an error message or a log. */
function redact(text: string, secret: string): string {
  const clean = text.replace(/api_secret=[^&\s"']*/gi, 'api_secret=[secret]');
  return secret ? clean.replaceAll(secret, '[secret]') : clean;
}

type PostResult = 'sent' | 'failed' | 'unknown';

/**
 * 'sent': Google took it, or refused it for a reason a retry can't fix. 'failed': it clearly didn't
 * arrive. 'unknown': a timeout, so Google may have it. That is never retried, or it could count twice.
 */
async function post(env: Env, secret: string, payload: Payload, count: number): Promise<PostResult> {
  const debug = env.GA4_DEBUG === 'true';
  const url = `${debug ? DEBUG_COLLECT : COLLECT}?measurement_id=${encodeURIComponent(env.GA4_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(secret)}`;
  const init = { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const lastTry = attempt === 2;
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) {
        if (debug) logInfo('ga4_debug', { events: count, detail: scrub(await response.text(), 600) });
        return 'sent';
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) {
        logError('ga4_failed', { status: response.status, events: count });
        return 'sent';
      }
      if (lastTry) {
        logError('ga4_failed', { status: response.status, events: count });
        return 'failed';
      }
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (timedOut || lastTry) {
        logError('ga4_failed', { events: count, timeout: timedOut, error: redact(errorText(error), secret) });
        return timedOut ? 'unknown' : 'failed';
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  return 'failed';
}

export function pruneGa4Sent(db: D1Database, now = Date.now()): Promise<D1Result> {
  return db.prepare('DELETE FROM ga4_sent WHERE ts < ?').bind(now - RETENTION_MS).run();
}
