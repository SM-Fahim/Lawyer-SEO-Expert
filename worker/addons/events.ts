import {
  clickIdOf,
  clipOrNull,
  conversionIdOf,
  hashOf,
  pageOf,
  pathOf,
  rdtUuidOf,
  referrerHostOf,
  screenOf,
  utmOf,
  type Fields,
} from '../fields';
import { emptyResponse, methodNotAllowed } from '../http';
import { ga4IdsOf, pruneGa4Sent, sendGa4Events, ga4Value, type Ga4Event, type Ga4EventName } from '../ga4';
import { errorText, logError } from '../log';
import { hasNoTrackCookie } from '../notrack';
import { pageTypeOf } from '../pagetype';
import { buildMetaEvent, fbCookieOf, META_EVENTS, metaTestCodeOf, sendMetaEvents, type MetaEvent } from '../meta';
import { buildRedditEvent, sendRedditEvents, type RedditEvent, type RedditEventName } from '../reddit';
import { clientIp, isBot, originAllowed, readCapped } from '../security';
import type { CronJob, RouteAddon } from './types';

// POST /api/activity, JSON in any content type, so sendBeacon works. Answers 204 with no body.
// Not /api/events: EasyPrivacy blocks that exact path. Check any new name with npm run check-blocklists.
//
// {
//   events: [{ name, conversion_id, value?, currency? }],   // at most 10
//   page, variant, utm_source, utm_campaign, click_id, uuid,
//   screen_width, screen_height, ga_client_id, ga_session_id,   // the _ga and _ga_<ID> cookie values, checked here
//   email_hash, phone_hash,                                 // SHA-256 hex only, from rct_mk (Reddit only)
//   fb_em, fb_ph, fb_fn, fb_ln,                             // SHA-256 hex only, from lse_fbmk (Meta only)
//   external_id,                                            // 64 hex, the random visitor ID in lse_vid (Meta only)
//   fbp, fbc,                                               // Meta's _fbp value and the fbc from lse_fbc; the cookies win
//   meta_test,                                              // TEST..., from ?meta_test=; sent as Meta's test_event_code
//   content_category,                                       // the page's type from <html data-page-type>; Meta's ViewContent only
//   touch, first_touch                                      // with SignUp only: where the booking came from
// }
//
// touch is { utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing }, from
// lse_touch. first_touch is the UTM values from lse_utm. A SignUp also gets a row in bookings.
//
// name is PageVisit, ViewContent or SignUp (conversion_id required, sent to Reddit and to Meta as
// PageView, ViewContent and Schedule), or BookingDialogOpened or ExitOfferShown (counted in D1).
// BookingDialogOpened also goes to Meta, server only, for retargeting audiences. Anything else is
// dropped silently. GA4 gets its own events, below. Each platform is sent separately: one failing
// can't delay or stop the others.
// Other answers: 403 wrong origin, 413 over 32 KB or over 10 events, 400 bad body, 405 not a POST.
// With the lse_notrack=1 cookie it answers 204 and does nothing, as it does for bots.

const MAX_EVENTS = 10;
const RETENTION_MS = 180 * 24 * 60 * 60_000;

// Lead is missing on purpose: it only goes through /api/lead.
const REDDIT_EVENTS = new Set<string>(['PageVisit', 'ViewContent', 'SignUp']);
// Plan section 8's events table: counted in D1, never sent to Reddit.
const FIRST_PARTY_EVENTS = new Set<string>(['BookingDialogOpened', 'ExitOfferShown']);
// What GA4 gets, by event name (worker/ga4.ts). Page events stay with the browser tag.
const GA4_EVENTS: Record<string, Ga4EventName> = {
  SignUp: 'schedule_call',
  BookingDialogOpened: 'booking_dialog_open',
  ExitOfferShown: 'exit_offer_shown',
};

export const eventsRoute: RouteAddon = {
  path: '/api/activity',
  async handle(request, env, ctx) {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    if (!originAllowed(request, env)) return emptyResponse(403);
    if (isBot(request) || hasNoTrackCookie(request.headers.get('cookie'))) return emptyResponse(204);

    const raw = await readCapped(request);
    if (raw === null) return emptyResponse(413);

    const body = parseBody(raw);
    if (!body || !Array.isArray(body.events)) return emptyResponse(400);
    if (body.events.length > MAX_EVENTS) return emptyResponse(413);

    ctx.waitUntil(
      recordEvents(request, env, body, body.events).catch((error: unknown) => {
        logError('events_failed', { error: errorText(error) });
      }),
    );
    return emptyResponse(204);
  },
};

export const eventsRetentionJob: CronJob = {
  name: 'events-retention',
  // Events first: ga4_sent and bookings only exist after migrations 0002 and 0003, and their absence must not stop this.
  run: async (env) => {
    const result = await pruneEvents(env.DB);
    await pruneGa4Sent(env.DB);
    await pruneBookings(env.DB);
    return result;
  },
};

export function pruneEvents(db: D1Database, now = Date.now()): Promise<D1Result> {
  return db.prepare('DELETE FROM events WHERE ts < ?').bind(now - RETENTION_MS).run();
}

export function pruneBookings(db: D1Database, now = Date.now()): Promise<D1Result> {
  return db.prepare('DELETE FROM bookings WHERE ts < ?').bind(now - RETENTION_MS).run();
}

function parseBody(raw: string): Fields | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Fields) : null;
  } catch {
    return null;
  }
}

/** Runs after the response. D1, Reddit, GA4 and Meta fail separately, and none reaches the visitor. */
async function recordEvents(
  request: Request,
  env: Env,
  body: Fields,
  items: unknown[],
): Promise<void> {
  const now = Date.now();
  const page = pageOf(body.page, request, env);
  const variant = clipOrNull(body.variant, 64);
  const utmSource = clipOrNull(body.utm_source, 200);
  const utmCampaign = clipOrNull(body.utm_campaign, 200);
  const isTest = env.LIVE === 'true' ? 0 : 1;
  const insert = env.DB.prepare(
    `INSERT INTO events (ts, name, page, variant, conversion_id, utm_source, utm_campaign, is_test)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const rows: D1PreparedStatement[] = [];
  const bookings: D1PreparedStatement[] = [];
  const reddit: RedditEvent[] = [];
  const ga4: Ga4Event[] = [];
  const meta: MetaEvent[] = [];
  const pageLocation = page ? ga4Value(`https://${env.SITE_HOST}${page.path}`) : undefined;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const { name, conversion_id: rawId, value, currency } = item as Fields;
    const conversionId = conversionIdOf(rawId);

    if (typeof name === 'string' && REDDIT_EVENTS.has(name)) {
      // Without the Pixel's ID Reddit would count this event twice, so it can't be sent at all.
      if (!conversionId) continue;
      reddit.push(
        buildRedditEvent({
          name: name as RedditEventName,
          conversionId,
          eventAt: now,
          clickId: clickIdOf(body.click_id),
          sourceUrl: page?.sourceUrl,
          ip: clientIp(request),
          userAgent: request.headers.get('user-agent'),
          uuid: rdtUuidOf(request, body.uuid),
          screen: screenOf(body.screen_width, body.screen_height),
          emailHash: hashOf(body.email_hash),
          phoneHash: hashOf(body.phone_hash),
          value,
          currency,
        }),
      );
    } else if (typeof name !== 'string' || !FIRST_PARTY_EVENTS.has(name)) {
      continue;
    }
    const metaName = typeof name === 'string' ? META_EVENTS.get(name) : undefined;
    // Same rule as Reddit: without the Pixel's ID Meta can't remove the duplicate.
    if (metaName && conversionId) {
      meta.push(
        buildMetaEvent({
          name: metaName,
          eventId: conversionId,
          eventAt: now,
          sourceUrl: page?.sourceUrl,
          ip: clientIp(request),
          userAgent: request.headers.get('user-agent'),
          fbp: fbCookieOf(request, '_fbp', body.fbp),
          fbc: fbCookieOf(request, '_fbc', body.fbc),
          externalId: hashOf(body.external_id),
          emailHash: hashOf(body.fb_em),
          phoneHash: hashOf(body.fb_ph),
          firstNameHash: hashOf(body.fb_fn),
          lastNameHash: hashOf(body.fb_ln),
          contentCategory: pageTypeOf(body.content_category),
        }),
      );
    }
    const ga4Name = typeof name === 'string' ? GA4_EVENTS[name] : undefined;
    if (ga4Name) {
      ga4.push({
        name: ga4Name,
        dedupeId: conversionId,
        params: {
          ...(pageLocation ? { page_location: pageLocation } : {}),
          ...(ga4Name === 'schedule_call' && conversionId ? { booking_id: conversionId } : {}),
        },
      });
    }
    rows.push(
      insert.bind(now, name, page?.path ?? null, variant, conversionId, utmSource, utmCampaign, isTest),
    );
    if (name === 'SignUp' && conversionId) {
      bookings.push(bookingRow(env, body, { conversionId, now, page: page?.path ?? null, isTest }));
    }
  }

  const visitor = {
    ...ga4IdsOf(request, env, body),
    seed: rdtUuidOf(request, body.uuid),
    ip: clientIp(request),
    userAgent: request.headers.get('user-agent'),
    utm: { source: utmSource ?? undefined, campaign: utmCampaign ?? undefined },
  };
  await Promise.all([
    saveRows(env, rows, 'events_save_failed'),
    saveRows(env, bookings, 'bookings_save_failed'),
    sendRedditEvents(env, reddit),
    sendGa4Events(env, ga4, visitor),
    sendMetaEvents(env, meta, metaTestCodeOf(body.meta_test)),
  ]);
}

/** OR IGNORE, because the tracker can send the same booking again as a beacon. */
function bookingRow(
  env: Env,
  body: Fields,
  booking: { conversionId: string; now: number; page: string | null; isTest: number },
): D1PreparedStatement {
  const touch = (body.touch && typeof body.touch === 'object' ? body.touch : {}) as Fields;
  const utm = utmOf(touch);
  const first = utmOf(body.first_touch);
  return env.DB.prepare(
    `INSERT OR IGNORE INTO bookings
       (conversion_id, ts, page, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing, first_utm_json, reddit_click, is_test)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    booking.conversionId,
    booking.now,
    booking.page,
    utm.utm_source ?? null,
    utm.utm_medium ?? null,
    utm.utm_campaign ?? null,
    utm.utm_content ?? null,
    utm.utm_term ?? null,
    referrerHostOf(touch.referrer),
    pathOf(touch.landing),
    Object.keys(first).length ? JSON.stringify(first) : null,
    clickIdOf(body.click_id) ? 1 : 0,
    booking.isTest,
  );
}

async function saveRows(env: Env, rows: D1PreparedStatement[], failure: string): Promise<void> {
  if (!rows.length) return;
  try {
    await env.DB.batch(rows);
  } catch (error) {
    logError(failure, { error: errorText(error) });
  }
}
