import { emailEnabled, recipientsOf, renderLeadEmail, sendTo, type LeadRecord } from '../email';
import {
  clickIdOf,
  clip,
  clipOrNull,
  conversionIdOf,
  hashOf,
  pageOf,
  rdtUuidOf,
  screenOf,
  type Fields,
} from '../fields';
import { ga4IdsOf, ga4Value, sendGa4Events } from '../ga4';
import { emptyResponse, jsonResponse, methodNotAllowed } from '../http';
import { errorText, logError, logInfo } from '../log';
import { EMAIL_RE, hashEmail, hashPhone } from '../matchkeys';
import { buildMetaEvent, fbCookieOf, metaTestCodeOf, sendMetaEvents } from '../meta';
import { metaKeysOf } from '../metakeys';
import { hasNoTrackCookie } from '../notrack';
import { deliverLead, drainOutbox } from '../outbox';
import { buildRedditEvent, sendRedditEvents } from '../reddit';
import { clientIp, hashIp, isBot, originAllowed, readCapped, verifyTurnstile } from '../security';
import type { CronJob, RouteAddon } from './types';

// POST /api/lead, as JSON (from script) or form-encoded (no JavaScript). The same field names work
// for both.
//
// Required: name, email. Optional: phone, website, firm, practice_area, message.
// Any other simple field is kept in extra_json and shown in the email (multi-step answers).
// Tracking, all optional:
//   conversion_id   made before the POST and shared with the Pixel; new for each separate lead,
//                   the same on a retry of one lead (letters, digits, _ and -, up to 100)
//   click_id        the stored rdt_cid
//   uuid            the _rdt_uuid value, if the cookie isn't sent
//   page            path or full URL of this page
//   variant, utm_source, utm_medium, utm_campaign, utm_term, utm_content
//   screen_width, screen_height
//   ga_client_id, ga_session_id   the _ga and _ga_<ID> cookie values; checked, and only used for GA4
//   fbp, fbc        Meta's _fbp value and the fbc from lse_fbc; the cookies win. Only used for Meta
//   external_id     64 hex, the random visitor ID in lse_vid. Only used for Meta
//   meta_test       TEST..., from ?meta_test=; sent as Meta's test_event_code
// Spam checks:
//   hp                      honeypot: hidden, always empty
//   elapsed_ms              ms since the page loaded, from a timer rather than a clock
//   cf-turnstile-response   the widget's own field name
//
// JSON answers: 200 { ok: true, id }. Failures are { ok: false, error }, where error is one of
// forbidden_origin 403, too_large 413, bad_body 400, turnstile_failed 403, rate_limited 429,
// invalid 400 (with fields: ['name', 'email']), or save_failed 503 (show the contact fallback).
// Form answers: 303 to /thank-you/, or an HTML page with the contact address on any failure.
//
// With the lse_notrack=1 cookie the lead is still checked, saved and emailed, but it's marked
// is_test=1 and nothing goes to Reddit or Meta, so an owner's test can't count as a conversion.
//
// A lead with no Turnstile token is saved and emailed, flagged as possible spam, but nothing goes
// to Reddit, GA4 or Meta. Our script waits for the token, so a post without one is nearly always a
// bot posting here directly, and counting it would teach the ad platforms to find more bots.

const MIN_FORM_MS = 3000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60_000;
const TURNSTILE_FIELD = 'cf-turnstile-response';
const THANK_YOU_PATH = '/thank-you/';
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const MAX_EXTRA_FIELDS = 30;
const EXTRA_KEY = /^[A-Za-z0-9_-]{1,40}$/;
const KNOWN_FIELDS = new Set([
  'name', 'email', 'phone', 'website', 'firm', 'practice_area', 'message', 'page', 'variant',
  'click_id', 'conversion_id', 'uuid', 'ga_client_id', 'ga_session_id', 'screen_width', 'screen_height', 'hp', 'elapsed_ms',
  'fbp', 'fbc', 'external_id', 'meta_test', 'fb_em', 'fb_ph', 'fb_fn', 'fb_ln',
  TURNSTILE_FIELD, 'g-recaptcha-response', ...UTM_FIELDS,
]);

export const leadRoute: RouteAddon = { path: '/api/lead', handle: handleLead };

export const outboxJob: CronJob = { name: 'outbox', run: (env) => drainOutbox(env) };

// The numbered steps are plan section 7's order of operations. Don't reorder them.
async function handleLead(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const contentType = request.headers.get('content-type') ?? '';
  const isForm = contentType.includes('application/x-www-form-urlencoded');

  // 1. Origin host, then body size.
  if (!originAllowed(request, env)) return fail(isForm, 403, 'forbidden_origin');
  const raw = await readCapped(request);
  if (raw === null) return fail(isForm, 413, 'too_large');
  const body = isForm ? parseForm(raw) : parseJson(raw);
  if (!body) return fail(isForm, 400, 'bad_body');

  // 2. Honeypot or too fast: look like success and store nothing.
  if (isSpamSignal(body)) {
    logInfo('lead_dropped_spam');
    return success(isForm, crypto.randomUUID());
  }

  // 3. Turnstile. Only an actively failed token stops here.
  const ip = clientIp(request);
  const token = clip(body[TURNSTILE_FIELD], 4096);
  const turnstile = await verifyTurnstile(env, token, ip);
  if (turnstile === 'failed') return fail(isForm, 403, 'turnstile_failed');
  // Not the same as unverified: a token that siteverify couldn't check still came from the widget.
  const countable = Boolean(token);

  // 4. Rate limit.
  const ipHash = await hashIp(ip, env);
  if (await overRateLimit(env.DB, ipHash)) {
    return fail(isForm, 429, 'rate_limited', { 'retry-after': '3600' });
  }

  // 5. Validate.
  const name = clip(body.name, 200);
  const email = clip(body.email, 254);
  const invalid = [...(name ? [] : ['name']), ...(EMAIL_RE.test(email) ? [] : ['email'])];
  if (invalid.length) return fail(isForm, 400, 'invalid', {}, invalid);

  const noTrack = hasNoTrackCookie(request.headers.get('cookie'));
  const lead = buildLead(request, env, body, { name, email, ipHash, turnstile, noTrack });

  // 6. Save to D1 first. Only a failure here returns an error, and then the email still goes.
  let saved: { id: string; duplicate: boolean };
  try {
    saved = await saveLead(env.DB, lead);
  } catch (error) {
    logError('lead_save_failed', { error: errorText(error) });
    ctx.waitUntil(emailWithoutD1(env, lead));
    return fail(isForm, 503, 'save_failed');
  }

  // A retried POST of a form we already have: same answer, and nothing is sent twice.
  if (saved.duplicate) return success(isForm, saved.id);

  // 7. After the response: the email, then Reddit, GA4 and Meta, each on its own. None can affect
  // the visitor, and none can delay or stop another. A lead with no token is emailed only.
  if (!countable) logInfo('lead_not_counted_no_token', { lead_id: lead.id });
  const track = countable && !noTrack;
  ctx.waitUntil(
    Promise.all([
      deliverLead(env, lead.id),
      track ? sendRedditLead(request, env, body, lead) : undefined,
      track ? sendMetaLead(request, env, body, lead) : undefined,
      track && !lead.is_test && !isBot(request) ? sendGa4Lead(request, env, body, lead) : undefined,
    ]),
  );

  // 8. Respond.
  return success(isForm, lead.id);
}

function parseJson(raw: string): Fields | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Fields) : null;
  } catch {
    return null;
  }
}

/** A repeated key, such as a group of checkboxes, keeps every value. */
function parseForm(raw: string): Fields {
  const fields = Object.create(null) as Fields;
  const params = new URLSearchParams(raw);
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    fields[key] = values.length > 1 ? values : values[0];
  }
  return fields;
}

function isSpamSignal(body: Fields): boolean {
  if (clip(body.hp, 100)) return true;
  // Reported by the browser's script. A form posted without JavaScript has no value to judge,
  // and a value that isn't a number proves nothing, so neither can cost a real lead.
  const elapsed = typeof body.elapsed_ms === 'string' ? Number(body.elapsed_ms) : body.elapsed_ms;
  return typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed < MIN_FORM_MS;
}

/** Fails open: if D1 can't answer this, the save step is what reports it. */
async function overRateLimit(db: D1Database, ipHash: string | null): Promise<boolean> {
  if (!ipHash) return false;
  try {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM leads WHERE ip_hash = ? AND created_at > ?')
      .bind(ipHash, Date.now() - RATE_WINDOW_MS)
      .first<{ n: number }>();
    return (row?.n ?? 0) >= RATE_LIMIT;
  } catch (error) {
    logError('rate_limit_check_failed', { error: errorText(error) });
    return false;
  }
}

function buildLead(
  request: Request,
  env: Env,
  body: Fields,
  checked: { name: string; email: string; ipHash: string | null; turnstile: 'ok' | 'unverified'; noTrack: boolean },
): LeadRecord {
  const utm = Object.fromEntries(
    UTM_FIELDS.map((key) => [key, clip(body[key], 200)]).filter(([, value]) => value),
  ) as Record<string, string>;
  const country = request.cf?.country;

  return {
    id: crypto.randomUUID(),
    created_at: Date.now(),
    name: checked.name,
    email: checked.email,
    phone: clipOrNull(body.phone, 40),
    website: clipOrNull(body.website, 500),
    firm: clipOrNull(body.firm, 200),
    practice_area: clipOrNull(body.practice_area, 200),
    message: clipOrNull(body.message, 5000),
    extra_json: extraJson(body),
    page: pageOf(body.page, request, env)?.path ?? null,
    variant: clipOrNull(body.variant, 64),
    utm_json: Object.keys(utm).length ? JSON.stringify(utm) : null,
    click_id: clickIdOf(body.click_id) ?? null,
    // Normally made by the browser, so the Pixel can share it. A form posted without JavaScript
    // has no Pixel to match, so one made here is just as good.
    conversion_id: conversionIdOf(body.conversion_id) ?? crypto.randomUUID(),
    ip_hash: checked.ipHash,
    country: typeof country === 'string' ? country : null,
    turnstile: checked.turnstile,
    is_test: env.LIVE === 'true' && !checked.noTrack ? 0 : 1,
  };
}

/** Any field the plan doesn't name, such as a multi-step form's answers. */
function extraJson(body: Fields): string | null {
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (KNOWN_FIELDS.has(key) || !EXTRA_KEY.test(key)) continue;
    const text = Array.isArray(value)
      ? value.map((item) => clip(item, 500)).filter(Boolean).join(', ').slice(0, 2000)
      : clip(value, 2000);
    if (text) extra[key] = text;
    if (Object.keys(extra).length >= MAX_EXTRA_FIELDS) break;
  }
  return Object.keys(extra).length ? JSON.stringify(extra) : null;
}

/** The lead, its outbox row and its counted event go in together or not at all. */
async function saveLead(db: D1Database, lead: LeadRecord): Promise<{ id: string; duplicate: boolean }> {
  const utm = lead.utm_json ? (JSON.parse(lead.utm_json) as Record<string, string>) : {};
  const [insert] = await db.batch([
    db
      .prepare(
        `INSERT INTO leads (id, created_at, name, email, phone, website, firm, practice_area,
           message, extra_json, page, variant, utm_json, click_id, conversion_id, ip_hash, country,
           turnstile, is_test)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (conversion_id) DO NOTHING`,
      )
      .bind(
        lead.id, lead.created_at, lead.name, lead.email, lead.phone, lead.website, lead.firm,
        lead.practice_area, lead.message, lead.extra_json, lead.page, lead.variant, lead.utm_json,
        lead.click_id, lead.conversion_id, lead.ip_hash, lead.country, lead.turnstile, lead.is_test,
      ),
    db.prepare('INSERT INTO outbox (lead_id) SELECT id FROM leads WHERE id = ?').bind(lead.id),
    db
      .prepare(
        `INSERT INTO events (ts, name, page, variant, conversion_id, utm_source, utm_campaign, is_test)
         SELECT ?, 'Lead', ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM leads WHERE id = ?)`,
      )
      .bind(
        lead.created_at, lead.page, lead.variant, lead.conversion_id,
        utm.utm_source ?? null, utm.utm_campaign ?? null, lead.is_test, lead.id,
      ),
  ]);

  if (insert?.meta.changes) return { id: lead.id, duplicate: false };
  const existing = await db
    .prepare('SELECT id FROM leads WHERE conversion_id = ?')
    .bind(lead.conversion_id)
    .first<{ id: string }>();
  return { id: existing?.id ?? lead.id, duplicate: true };
}

/** D1 is down, so there's no outbox to retry from. One direct try per address. */
async function emailWithoutD1(env: Env, lead: LeadRecord): Promise<void> {
  if (!emailEnabled(env)) {
    logInfo('lead_email_logged_only', { lead_id: lead.id, page: lead.page, saved: false });
    return;
  }
  const message = renderLeadEmail(env, lead, { notSaved: true });
  await Promise.all(
    recipientsOf(env).map(async (recipient) => {
      try {
        await sendTo(env, recipient, lead, message);
      } catch (error) {
        logError('lead_email_failed_without_d1', { lead_id: lead.id, error: errorText(error) });
      }
    }),
  );
}

async function sendRedditLead(
  request: Request,
  env: Env,
  body: Fields,
  lead: LeadRecord,
): Promise<void> {
  try {
    await sendRedditEvents(env, [
      buildRedditEvent({
        name: 'Lead',
        conversionId: lead.conversion_id,
        eventAt: lead.created_at,
        clickId: lead.click_id ?? undefined,
        sourceUrl: pageOf(body.page, request, env)?.sourceUrl,
        ip: clientIp(request),
        userAgent: request.headers.get('user-agent'),
        uuid: rdtUuidOf(request, body.uuid),
        screen: screenOf(body.screen_width, body.screen_height),
        emailHash: await hashEmail(lead.email),
        phoneHash: await hashPhone(lead.phone),
      }),
    ]);
  } catch (error) {
    logError('reddit_lead_failed', { error: errorText(error) });
  }
}

/** Meta's Lead, with the same ID as the Pixel's eventID. Hashed here with Meta's own rules. */
async function sendMetaLead(request: Request, env: Env, body: Fields, lead: LeadRecord): Promise<void> {
  try {
    const keys = await metaKeysOf({ email: lead.email, phone: lead.phone, name: lead.name });
    await sendMetaEvents(
      env,
      [
        buildMetaEvent({
          name: 'Lead',
          eventId: lead.conversion_id,
          eventAt: lead.created_at,
          sourceUrl: pageOf(body.page, request, env)?.sourceUrl,
          ip: clientIp(request),
          userAgent: request.headers.get('user-agent'),
          fbp: fbCookieOf(request, '_fbp', body.fbp),
          fbc: fbCookieOf(request, '_fbc', body.fbc),
          externalId: hashOf(body.external_id),
          emailHash: keys.em,
          phoneHash: keys.ph,
          firstNameHash: keys.fn,
          lastNameHash: keys.ln,
        }),
      ],
      metaTestCodeOf(body.meta_test),
    );
  } catch (error) {
    logError('meta_failed', { error: errorText(error) });
  }
}

/** GA4's generate_lead, after the lead is saved. Non-personal values only, built field by field. */
async function sendGa4Lead(request: Request, env: Env, body: Fields, lead: LeadRecord): Promise<void> {
  try {
    const utm = lead.utm_json ? (JSON.parse(lead.utm_json) as Record<string, string>) : {};
    const pageLocation = lead.page ? ga4Value(`https://${env.SITE_HOST}${lead.page}`) : undefined;
    const sourceForm = ga4Value(body.source_form);
    await sendGa4Events(
      env,
      [
        {
          name: 'generate_lead',
          dedupeId: lead.conversion_id,
          params: {
            lead_id: lead.conversion_id,
            ...(sourceForm ? { source_form: sourceForm } : {}),
            ...(pageLocation ? { page_location: pageLocation } : {}),
          },
        },
      ],
      {
        ...ga4IdsOf(request, env, body),
        seed: rdtUuidOf(request, body.uuid),
        ip: clientIp(request),
        userAgent: request.headers.get('user-agent'),
        utm: {
          source: utm.utm_source,
          medium: utm.utm_medium,
          campaign: utm.utm_campaign,
          term: utm.utm_term,
          content: utm.utm_content,
        },
      },
    );
  } catch (error) {
    logError('ga4_failed', { error: errorText(error) });
  }
}

function success(isForm: boolean, id: string): Response {
  return isForm
    ? emptyResponse(303, { location: THANK_YOU_PATH })
    : jsonResponse({ ok: true, id });
}

function fail(
  isForm: boolean,
  status: number,
  error: string,
  headers: HeadersInit = {},
  fields?: string[],
): Response {
  if (!isForm) return jsonResponse({ ok: false, error, ...(fields ? { fields } : {}) }, status, headers);
  const response = new Response(FALLBACK_PAGE, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
  new Headers(headers).forEach((value, key) => response.headers.set(key, value));
  return response;
}

// Only a visitor without JavaScript sees this. Everyone else gets the page's own fallback.
const FALLBACK_PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Your message did not go through</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>Your message did not go through</h1>
<p>Please check the form and try again, or email <a href="mailto:hello@lawyerseoexpert.com">hello@lawyerseoexpert.com</a>. We will reply as soon as we can.</p>
<p><a href="/">Back to the site</a></p>
</body>
</html>
`;
