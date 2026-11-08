import { createExecutionContext, env as bindings, waitOnExecutionContext } from 'cloudflare:test';
import { vi } from 'vitest';
import worker from '../../worker/index';
import type { MetaEvent } from '../../worker/meta';
import type { RedditEvent } from '../../worker/reddit';

export const ORIGIN = 'https://lawyerseoexpert.com';
export const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const REDDIT = 'https://ads-api.reddit.com/api/v3/pixels/a2_test/conversion_events';
export const GA4 = 'https://www.google-analytics.com/mp/collect?measurement_id=G-V1J07CEE3T&api_secret=ga-test-secret';
export const VISITOR_IP = '203.0.113.7';
// A made-up pixel ID: tests never use the real one, and every call to Meta is mocked.
export const META_PIXEL = '1111222233334444';
export const META = `https://graph.facebook.com/v27.0/${META_PIXEL}/events`;
export const META_TOKEN = 'meta-test-token';
/** Turns Meta on in makeEnv. Off by default, as vitest.config.ts pins it. */
export const META_ON = { META_PIXEL_ID: META_PIXEL, META_CAPI_TOKEN: META_TOKEN };

export interface MockEmail {
  send: ReturnType<typeof vi.fn>;
}

/** A pre-launch env with secrets set. Every outside service is a mock, never the real thing. */
export function makeEnv(overrides: Record<string, unknown> = {}): Env & { EMAIL: MockEmail } {
  return {
    ...bindings,
    LIVE: 'false',
    SITE_HOST: 'lawyerseoexpert.com',
    REDDIT_PIXEL_ID: 'a2_test',
    REDDIT_TEST_ID: '',
    REDDIT_CAPI_TOKEN: 'test-token',
    TURNSTILE_SECRET: 'test-secret',
    IP_SALT: 'test-salt',
    EMAIL_FROM: 'leads@notify.lawyerseoexpert.com',
    EMAIL_TO: 'one@example.test,two@example.test',
    EMAIL: { send: vi.fn(async () => ({ messageId: 'm1' })) },
    ASSETS: { fetch: vi.fn(async () => new Response('static file')) },
    ...overrides,
  } as unknown as Env & { EMAIL: MockEmail };
}

export interface FetchCall {
  url: string;
  init: RequestInit;
}

export interface NetworkMock {
  calls: FetchCall[];
  to(url: string): FetchCall[];
}

type Responder = (url: string, init: RequestInit) => Response | Promise<Response>;

/**
 * Replaces global fetch. Any URL without a responder throws, so a test can't reach the network
 * by accident. By default Turnstile passes and Reddit accepts.
 */
export function mockNetwork(responders: Record<string, Responder> = {}): NetworkMock {
  const calls: FetchCall[] = [];
  const all: Record<string, Responder> = {
    [SITEVERIFY]: () => Response.json({ success: true }),
    [REDDIT]: () => Response.json({ message: 'ok' }),
    [META]: () => Response.json({ events_received: 1 }),
    ...responders,
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, init: init ?? {} });
    const responder = all[url];
    if (!responder) throw new Error(`Unexpected network call: ${url}`);
    return responder(url, init ?? {});
  });
  return { calls, to: (url) => calls.filter((call) => call.url === url) };
}

/** Calls the Worker and waits for everything it passed to waitUntil. */
export async function callWorker(request: Request, env: Env): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request as never, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export function validLead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Jane Doe',
    email: 'Jane.Doe+site@Example.com',
    phone: '(555) 444-1234',
    website: 'https://janedoelaw.example',
    firm: 'Doe Law',
    practice_area: 'Personal injury',
    message: 'We need more cases.',
    page: '/?rdt_cid=abc&utm_source=reddit&secret=x',
    variant: 'B',
    utm_source: 'reddit',
    utm_campaign: 'launch',
    click_id: 'abc',
    conversion_id: crypto.randomUUID(),
    uuid: '1677712978045.b8f7eb7d-b357-437b-8bd3-e1c8166c7132',
    screen_width: 390,
    screen_height: 844,
    elapsed_ms: 12_000,
    'cf-turnstile-response': 'good-token',
    ...overrides,
  };
}

function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    origin: ORIGIN,
    'cf-connecting-ip': VISITOR_IP,
    'user-agent': 'Mozilla/5.0 (test browser)',
    ...extra,
  };
}

export function jsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: apiHeaders({ 'content-type': 'application/json', ...headers }),
    body: JSON.stringify(body),
  });
}

export function formRequest(
  path: string,
  body: Record<string, string>,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: apiHeaders({ 'content-type': 'application/x-www-form-urlencoded', ...headers }),
    body: new URLSearchParams(body).toString(),
  });
}

export async function clearTables(): Promise<void> {
  await bindings.DB.batch(
    ['outbox', 'leads', 'events', 'broken_urls', 'ga4_sent', 'bookings'].map((table) =>
      bindings.DB.prepare(`DELETE FROM ${table}`),
    ),
  );
}

export async function count(table: string): Promise<number> {
  const row = await bindings.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

/** A D1 stand-in whose every call fails, for the failure drills. */
export function brokenDb(): D1Database {
  const fail = () => Promise.reject(new Error('D1 is down'));
  const statement = { bind: () => statement, first: fail, run: fail, all: fail, raw: fail };
  return { prepare: () => statement, batch: fail, exec: fail } as unknown as D1Database;
}

export function redditBody(call: FetchCall | undefined): {
  data: { test_id?: string; events: RedditEvent[] };
} {
  return JSON.parse(String(call?.init.body));
}

export function metaBody(call: FetchCall | undefined): {
  data: MetaEvent[];
  access_token: string;
  test_event_code?: string;
} {
  return JSON.parse(String(call?.init.body));
}

export const db = bindings.DB;

export interface CapturedLogs {
  errors: string[];
  infos: string[];
  /** Everything logged, for checks that contact details never appear. */
  all(): string;
}

/** Replaces console for one test. Pair with vi.unstubAllGlobals() in afterEach. */
export function captureLogs(): CapturedLogs {
  const errors: string[] = [];
  const infos: string[] = [];
  vi.stubGlobal('console', {
    ...console,
    error: (...args: unknown[]) => errors.push(args.join(' ')),
    log: (...args: unknown[]) => infos.push(args.join(' ')),
  });
  return { errors, infos, all: () => [...errors, ...infos].join('\n') };
}
