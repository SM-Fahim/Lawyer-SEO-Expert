import { env } from 'cloudflare:workers';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index';
import { envWith, send, SITE } from './router-helpers';

// A copy of the table in migrations/0001_init.sql, which is on the phase-3-server branch.
const CREATE_TABLE = `CREATE TABLE broken_urls (
  path       TEXT NOT NULL,
  status     INTEGER NOT NULL,
  referrer   TEXT,
  count      INTEGER NOT NULL DEFAULT 1,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  PRIMARY KEY (path, status)
)`;

interface Row {
  path: string;
  status: number;
  referrer: string | null;
  count: number;
  first_seen: number;
  last_seen: number;
}

async function rows(): Promise<Row[]> {
  const { results } = await env.DB.prepare('SELECT * FROM broken_urls ORDER BY path, status').all<Row>();
  return results;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('with the table in place', () => {
  beforeEach(async () => {
    await env.DB.prepare('DROP TABLE IF EXISTS broken_urls').run();
    await env.DB.prepare(CREATE_TABLE).run();
  });

  it('records a 404, with referrer, count and dates', async () => {
    await send(`${SITE}/gone/?secret=1`, {
      init: { headers: { referer: 'https://example.com/post/?email=jane@example.com' } },
    });
    const [row, ...others] = await rows();
    expect(others).toHaveLength(0);
    expect(row).toMatchObject({
      path: '/gone/',
      status: 404,
      referrer: 'https://example.com/post/',
      count: 1,
    });
    expect(row?.first_seen).toBe(row?.last_seen);
    expect(row?.first_seen).toBeGreaterThan(1_700_000_000_000);
  });

  it('skips scripts/verify-live.mjs, which asks for missing pages on purpose', async () => {
    const response = await send(`${SITE}/gone/`, { init: { headers: { 'user-agent': 'lse-verify-live/1.0' } } });
    expect(response.status).toBe(404);
    expect(await rows()).toEqual([]);
  });

  it('counts repeat hits on one row and keeps the last real referrer', async () => {
    await send(`${SITE}/gone/`, { init: { headers: { referer: 'https://example.com/a' } } });
    await send(`${SITE}/gone/`);
    const [row, ...others] = await rows();
    expect(others).toHaveLength(0);
    expect(row?.count).toBe(2);
    expect(row?.referrer).toBe('https://example.com/a');
  });

  it('records a 404 and a 5xx', async () => {
    const broken = { fetch: async () => new Response('x', { status: 500 }) } as unknown as Fetcher;
    await send(`${SITE}/server-error/`, { env: envWith({ ASSETS: broken }) });
    await send(`${SITE}/old-page/`);
    expect((await rows()).map(({ path, status }) => [path, status])).toEqual([
      ['/old-page/', 404],
      ['/server-error/', 500],
    ]);
  });

  it('records 404s on a Preview too', async () => {
    await send(`${SITE}/old-page/`, { env: envWith({ LIVE: 'false' }) });
    expect((await rows())[0]).toMatchObject({ path: '/old-page/', status: 404 });
  });

  it.each([
    '/wp-content/uploads/x.pdf',
    '/wp-login.php',
    '/style.css',
    '/app.js',
    '/photo.JPG',
    '/other-icon.ico',
    '/font.woff2',
    '/img/x',
    '/fonts/x',
    '/_astro/x',
    '/api/nothing',
  ])('skips %s', async (path) => {
    const response = await send(`${SITE}${path}`);
    expect(response.status).toBe(404);
    expect(await rows()).toHaveLength(0);
  });

  it('ignores healthy responses and redirects', async () => {
    await send(`${SITE}/new-page/`);
    await send(`${SITE}/new-page`);
    await send(`${SITE}/law-firm-ppc/`);
    await send(`${SITE}/`);
    expect(await rows()).toHaveLength(0);
  });

  it('caps a very long path', async () => {
    await send(`${SITE}/${'a'.repeat(2000)}`);
    expect((await rows())[0]?.path).toHaveLength(500);
  });

  it('does the work inside ctx.waitUntil', async () => {
    const ctx = createExecutionContext();
    const waitUntil = vi.spyOn(ctx, 'waitUntil');
    await worker.fetch(new Request(`${SITE}/gone/`), envWith(), ctx);
    expect(waitUntil).toHaveBeenCalledOnce();
    await waitOnExecutionContext(ctx);
  });

  it('does not block the response on a slow database', async () => {
    let release = (): void => {};
    const stuck = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slowDb = { prepare: () => ({ bind: () => ({ run: () => stuck }) }) } as unknown as D1Database;
    const ctx = createExecutionContext();
    const response = await worker.fetch(new Request(`${SITE}/gone/`), envWith({ DB: slowDb }), ctx);
    expect(response.status).toBe(404);
    release();
    await waitOnExecutionContext(ctx);
  });
});

describe('when logging fails, the response is the same', () => {
  const failures: [string, () => D1Database | undefined][] = [
    ['the DB binding is missing', () => undefined],
    [
      'prepare throws',
      () =>
        ({
          prepare: () => {
            throw new Error('prepare failed');
          },
        }) as unknown as D1Database,
    ],
    [
      'the write rejects',
      () =>
        ({
          prepare: () => ({ bind: () => ({ run: () => Promise.reject(new Error('D1 down')) }) }),
        }) as unknown as D1Database,
    ],
  ];

  it('when the table is missing, silently', async () => {
    await env.DB.prepare('DROP TABLE IF EXISTS broken_urls').run();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await send(`${SITE}/gone/`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('new 404 page');
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(failures)('when %s', async (_name, db) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await send(`${SITE}/gone/`, { env: envWith({ DB: db() as D1Database }) });
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('new 404 page');
  });
});
