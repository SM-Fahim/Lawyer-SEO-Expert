import { randomInt } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test as base, expect, type Browser, type BrowserContext, type BrowserContextOptions, type Page, type Request, type Route } from '@playwright/test';

export const PORT = process.env.E2E_PORT ?? '8791';
export const LOCAL = `http://localhost:${PORT}`;
// Answered by route handlers from the local Worker, so the browser sees real HTTPS on the real host.
// The browser can't resolve this name (playwright.config.ts), so nothing reaches the live site.
export const PROD = 'https://lawyerseoexpert.com';
export const PRE_LAUNCH = 'https://lawyerseoexpert-site.fahim-afd.workers.dev';
export const PREVIEW = 'https://phase-3-frontend-lawyerseoexpert-site.fahim-afd.workers.dev';
export const PIXEL_ID = 'a2_hx7ja4uz0lm1';
// Blank while Meta is off (site.ts). fbevents.js is faked in any case, so it never reaches Meta.
export const META_PIXEL_ID = '';
export const FBP = 'fb.1.1700000000000.e2e123';

export const EMAIL_HASH = 'ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976';
export const PHONE_HASH = 'e5b124c58580eb16bd959b8d0cac12b12c952e2ceae0203d416cff94f10b994a';

const FAKE_PIXEL = (setUuid: boolean) => `(function () {
  window.__pixelLoaded = true;
  window.__pixelCalls = [];
  var rdt = window.rdt;
  rdt.sendEvent = function () { window.__pixelCalls.push(Array.prototype.slice.call(arguments)); };
  (rdt.callQueue || []).forEach(function (args) { rdt.sendEvent.apply(rdt, args); });
  ${setUuid ? `setTimeout(function () { document.cookie = '_rdt_uuid=1700000000000.e2e-uuid; path=/'; }, 100);` : ''}
})();`;

// Takes over Meta's queue the way fbevents.js does, then records every call.
const FAKE_META = (setFbp: boolean) => `(function () {
  window.__metaLoaded = true;
  window.__metaCalls = [];
  var fbq = window.fbq;
  var queued = fbq.queue || [];
  fbq.queue = [];
  fbq.callMethod = function () { window.__metaCalls.push(Array.prototype.slice.call(arguments)); };
  queued.forEach(function (args) { fbq.callMethod.apply(fbq, args); });
  ${setFbp ? `setTimeout(function () { document.cookie = '_fbp=${FBP}; path=/'; }, 100);` : ''}
})();`;

const FAKE_TURNSTILE = `(function () {
  window.__ts = { renders: [], resets: [] };
  var box = null;
  function setToken() {
    var input = box.querySelector('input[name="cf-turnstile-response"]');
    if (!input) { input = document.createElement('input'); input.type = 'hidden'; input.name = 'cf-turnstile-response'; box.appendChild(input); }
    input.value = window.__tsTokens && window.__tsTokens.length ? window.__tsTokens.shift() : 'e2e-token';
  }
  window.turnstile = {
    render: function (el, options) { box = el; window.__ts.renders.push(options); setToken(); return 'e2e-widget'; },
    reset: function (id) { window.__ts.resets.push(id); setToken(); },
  };
  window[new URL(document.currentScript.src).searchParams.get('onload')]();
})();`;

export interface Calls {
  /** Every /api/activity body sent by the page. */
  events: Array<Record<string, any>>;
  /** Every /api/lead request sent by the page. */
  leads: Array<Record<string, any>>;
  /** Hosts we refused: anything off this PC that a test didn't plan for. */
  escaped: string[];
  pixelRequests: string[];
  /** Requests for Meta's fbevents.js. */
  metaRequests: string[];
  turnstileRequests: string[];
  pageErrors: string[];
  consoleErrors: string[];
}

function recordApi(request: Request, calls: Calls): void {
  const { pathname } = new URL(request.url());
  if (request.method() !== 'POST') return;
  if (pathname === '/api/activity') calls.events.push(JSON.parse(request.postData() ?? '{}'));
  if (pathname === '/api/lead') {
    const raw = request.postData() ?? '';
    calls.leads.push(raw.startsWith('{') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw)));
  }
}

/**
 * Answers a request on a pretend host from the local Worker. Playwright doesn't route the target of
 * a redirect, so a test that follows one uses localhost instead. On a pretend host it would hit the
 * resolver lock and fail, which is the safe way round.
 */
export async function forward(route: Route, ip: string): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const headers = await request.allHeaders();
  for (const name of Object.keys(headers)) {
    if (name.startsWith(':') || name === 'host' || name === 'content-length' || name === 'connection') delete headers[name];
  }
  headers['cf-connecting-ip'] = ip;
  // The Worker accepts its own host. Locally that's localhost, whichever host the page pretends to be on.
  if (headers.origin && headers.origin !== PROD) headers.origin = LOCAL;
  const body = request.postDataBuffer();
  const response = await fetch(`${LOCAL}${url.pathname}${url.search}`, {
    method: request.method(),
    headers,
    body: body ? new Uint8Array(body) : undefined,
    redirect: 'manual',
  });
  const out: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    out[name] = value;
  });
  delete out['content-encoding'];
  delete out['content-length'];
  await route.fulfill({ status: response.status, headers: out, body: Buffer.from(await response.arrayBuffer()) });
}

export interface WireOptions {
  /** How the fake pixel.js behaves. `none` never answers with a cookie, `blocked` fails to load. */
  pixel?: 'cookie' | 'none' | 'blocked';
  /** How the fake fbevents.js behaves, the same way. */
  meta?: 'cookie' | 'none' | 'blocked';
  turnstile?: 'fake' | 'blocked';
}

/** Blocks the outside world, fakes pixel.js and Turnstile, and pretends some hosts are this Worker. */
export async function wire(context: BrowserContext, calls: Calls, options: WireOptions = {}): Promise<void> {
  const { pixel = 'cookie', meta = 'cookie', turnstile = 'fake' } = options;
  // Each test is its own visitor, so one test's leads can't use up another's rate limit.
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

  // Later routes win, so this catch-all runs only for what nothing below claims.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    calls.escaped.push(url.hostname);
    return route.abort();
  });
  // Calendly's embed is lazy-loaded on scroll. It's expected, and isn't one of the tracked services.
  await context.route('https://assets.calendly.com/**', (route) => route.abort());
  // The video on the two custom software pages, kept from WordPress. Expected too.
  await context.route('https://player.vimeo.com/**', (route) => route.abort());
  await context.route('https://www.redditstatic.com/**', (route) => {
    calls.pixelRequests.push(route.request().url());
    if (pixel === 'blocked') return route.abort();
    return route.fulfill({ contentType: 'text/javascript', body: FAKE_PIXEL(pixel === 'cookie') });
  });
  await context.route('https://connect.facebook.net/**', (route) => {
    calls.metaRequests.push(route.request().url());
    if (meta === 'blocked') return route.abort();
    return route.fulfill({ contentType: 'text/javascript', body: FAKE_META(meta === 'cookie') });
  });
  await context.route('https://challenges.cloudflare.com/**', (route) => {
    calls.turnstileRequests.push(route.request().url());
    if (turnstile === 'blocked') return route.abort();
    return route.fulfill({ contentType: 'text/javascript', body: FAKE_TURNSTILE });
  });
  for (const host of [PROD, PRE_LAUNCH, PREVIEW, 'https://next.lawyerseoexpert.com']) {
    await context.route(`${host}/**`, (route) => forward(route, ip));
  }
}

export function watch(page: Page, calls: Calls): void {
  page.on('request', (request) => recordApi(request, calls));
  page.on('pageerror', (error) => calls.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // A blocked outside script logs a network failure. That's the browser reporting our test's block,
    // not our code failing. Our own origin's failures still count.
    const where = message.location().url;
    const ours = where.startsWith(LOCAL) || where.startsWith(PROD) || where === '';
    if (ours && !message.text().includes('Failed to load resource')) calls.consoleErrors.push(message.text());
  });
}

export const emptyCalls = (): Calls => ({
  events: [],
  leads: [],
  escaped: [],
  pixelRequests: [],
  metaRequests: [],
  turnstileRequests: [],
  pageErrors: [],
  consoleErrors: [],
});

/** For a test that needs its own settings: a different user agent, a blocked script, no JavaScript. */
export async function openPage(
  browser: Browser,
  wireOptions: WireOptions = {},
  contextOptions: BrowserContextOptions = {},
): Promise<{ context: BrowserContext; page: Page; calls: Calls }> {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const calls = emptyCalls();
  await wire(context, calls, wireOptions);
  watch(page, calls);
  return { context, page, calls };
}

/** Every test gets these, and fails if our code errored or something tried to leave the PC. */
export const test = base.extend<{ calls: Calls }>({
  calls: [
    async ({ context, page }, use) => {
      const calls = emptyCalls();
      await wire(context, calls);
      watch(page, calls);
      await use(calls);
      expect(calls.pageErrors, 'uncaught errors').toEqual([]);
      expect(calls.consoleErrors, 'console errors').toEqual([]);
      expect(calls.escaped, 'requests to outside hosts').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Pixel calls so far. */
export const pixelCalls = (page: Page): Promise<unknown[][]> =>
  page.evaluate(() => (window as unknown as { __pixelCalls?: unknown[][] }).__pixelCalls ?? []);

export async function pixelTrack(page: Page, name: string): Promise<Array<Record<string, any>>> {
  const all = await pixelCalls(page);
  return all.filter((call) => call[0] === 'track' && call[1] === name).map((call) => call[2] as Record<string, any>);
}

/** Meta Pixel calls so far. */
export const metaCalls = (page: Page): Promise<unknown[][]> =>
  page.evaluate(() => (window as unknown as { __metaCalls?: unknown[][] }).__metaCalls ?? []);

/** Meta track calls for one event: [params, { eventID }]. */
export async function metaTrack(page: Page, name: string): Promise<Array<[Record<string, any>, Record<string, any>]>> {
  const all = await metaCalls(page);
  return all
    .filter((call) => call[0] === 'track' && call[1] === name)
    .map((call) => [call[2] as Record<string, any>, call[3] as Record<string, any>]);
}

export const eventsNamed = (calls: Calls, name: string): Array<Record<string, any>> =>
  calls.events.flatMap((body) => (body.events as Array<Record<string, any>>).filter((event) => event.name === name));

/** Rows in the local D1 the Worker is writing to. Read only. */
export function dbRows<T = Record<string, any>>(sql: string, ...params: Array<string | number>): T[] {
  const dir = join(process.cwd(), '.wrangler/e2e/v3/d1/miniflare-D1DatabaseObject');
  const file = readdirSync(dir).find((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite');
  if (!file) throw new Error('no local D1 file');
  const db = new DatabaseSync(join(dir, file), { readOnly: true });
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

/** The Worker saves events after it answers, so give it a moment. */
export async function waitForRow<T = Record<string, any>>(sql: string, ...params: Array<string | number>): Promise<T> {
  let rows: T[] = [];
  await expect
    .poll(() => {
      rows = dbRows<T>(sql, ...params);
      return rows.length;
    }, { timeout: 10_000 })
    .toBeGreaterThan(0);
  return rows[0] as T;
}

export interface LeadInput {
  website?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export async function fillForm(page: Page, input: LeadInput = {}): Promise<void> {
  await page.locator('input[name="website"]').fill(input.website ?? 'examplefirm.com');
  await page.locator('input[name="name"]').fill(input.name ?? 'TEST - ignore');
  await page.locator('input[name="email"]').fill(input.email ?? 'Al.ice+Apple@Example.Com');
  await page.locator('input[name="phone"]').fill(input.phone ?? '(555) 444-1234');
}

export const submitForm = (page: Page): Promise<void> =>
  page.locator('form[data-lead-form] button[type="submit"]').click();
