import { errorText, logError, logInfo, scrub } from './log';

// Reddit Conversions API v3. The schema is strict: one unknown field returns 400 and fails the
// whole request. So events are only ever built field by field in buildRedditEvent, and a caller's
// extra properties can't reach the wire.

const API_BASE = 'https://ads-api.reddit.com/api/v3/pixels';
const USER_AGENT = 'cloudflare-worker:lawyerseoexpert-site.lawyerseoexpert.com:v1';
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 500;

const TRACKING_TYPES = {
  PageVisit: 'PAGE_VISIT',
  ViewContent: 'VIEW_CONTENT',
  Lead: 'LEAD',
  SignUp: 'SIGN_UP',
} as const;

export type RedditEventName = keyof typeof TRACKING_TYPES;

export interface RedditEventInput {
  name: RedditEventName;
  conversionId: string;
  eventAt: number;
  clickId?: string | undefined;
  sourceUrl?: string | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  uuid?: string | undefined;
  screen?: { width: number; height: number } | undefined;
  emailHash?: string | undefined;
  phoneHash?: string | undefined;
  value?: unknown;
  currency?: unknown;
}

export interface RedditEvent {
  event_at: number;
  action_source: 'WEBSITE';
  type: { tracking_type: (typeof TRACKING_TYPES)[RedditEventName] };
  click_id?: string;
  event_source_url?: string;
  user: {
    ip_address?: string;
    user_agent?: string;
    uuid?: string;
    screen_dimensions?: { width: number; height: number };
    email?: string;
    phone_number?: string;
  };
  metadata: { conversion_id: string; value?: number; currency?: string };
}

export function buildRedditEvent(input: RedditEventInput): RedditEvent {
  const user: RedditEvent['user'] = {};
  if (input.ip) user.ip_address = input.ip;
  if (input.userAgent) user.user_agent = input.userAgent.slice(0, 512);
  if (input.uuid) user.uuid = input.uuid;
  if (input.screen) {
    user.screen_dimensions = { width: input.screen.width, height: input.screen.height };
  }
  if (input.emailHash) user.email = input.emailHash;
  if (input.phoneHash) user.phone_number = input.phoneHash;

  const event: RedditEvent = {
    event_at: input.eventAt,
    action_source: 'WEBSITE',
    type: { tracking_type: TRACKING_TYPES[input.name] },
    user,
    metadata: { conversion_id: input.conversionId },
  };
  if (input.clickId) event.click_id = input.clickId;
  if (input.sourceUrl) event.event_source_url = input.sourceUrl;

  // Together or not at all.
  const { value, currency } = input;
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    typeof currency === 'string' &&
    /^[A-Za-z]{3}$/.test(currency)
  ) {
    event.metadata.value = value;
    event.metadata.currency = currency.toUpperCase();
  }
  return event;
}

/** Real events only when live. Before launch they need REDDIT_TEST_ID, or nothing is sent. */
export function redditEnabled(env: Env): boolean {
  if (!env.REDDIT_CAPI_TOKEN || !env.REDDIT_PIXEL_ID) return false;
  return env.LIVE === 'true' || Boolean(env.REDDIT_TEST_ID);
}

/** Never throws: nothing Reddit does can affect the visitor. */
export async function sendRedditEvents(env: Env, events: RedditEvent[]): Promise<void> {
  if (!events.length) return;
  if (!redditEnabled(env)) {
    if (env.LIVE === 'true') logError('reddit_not_configured');
    return;
  }
  // Live events are always real, even if a test ID was left set by mistake.
  const testId = env.LIVE === 'true' ? '' : env.REDDIT_TEST_ID;
  // Event Testing shows only one event per request.
  const batches = testId ? events.map((event) => [event]) : [events];
  for (const batch of batches) {
    await postBatch(env, batch, testId);
  }
}

async function postBatch(env: Env, events: RedditEvent[], testId: string): Promise<void> {
  const data = testId ? { test_id: testId, events } : { events };
  const url = `${API_BASE}/${encodeURIComponent(env.REDDIT_PIXEL_ID)}/conversion_events`;
  const init = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.REDDIT_CAPI_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify({ data }),
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const lastTry = attempt === 2;
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) {
        // Test mode only, so an empty Event Testing page can be told apart from a refused send.
        if (testId) {
          logInfo('reddit_test_sent', {
            status: response.status,
            type: events[0]?.type.tracking_type,
            detail: scrub(await response.text()),
          });
        }
        return;
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (lastTry || !retryable) {
        logError('reddit_failed', {
          status: response.status,
          events: events.length,
          detail: scrub(await response.text()),
        });
        return;
      }
    } catch (error) {
      if (lastTry) {
        logError('reddit_failed', { events: events.length, error: errorText(error) });
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}
