import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brokenDb,
  callWorker,
  captureLogs,
  clearTables,
  count,
  db,
  jsonRequest,
  makeEnv,
  mockNetwork,
  ORIGIN,
  REDDIT,
  redditBody,
  VISITOR_IP,
} from './helpers';

import { pruneBookings } from '../../worker/addons/events';

const EVENTS = '/api/activity';
const LIVE = { LIVE: 'true' };
const HASH = 'b'.repeat(64);

function pageVisit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: 'PageVisit', conversion_id: crypto.randomUUID(), ...overrides };
}

function payload(events: unknown[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    page: 'https://lawyerseoexpert.com/seo/?rdt_cid=abc&fbclid=drop',
    variant: 'A',
    click_id: 'abc',
    uuid: '1677712978045.uuid',
    screen_width: 1920,
    screen_height: 1080,
    utm_source: 'reddit',
    utm_campaign: 'launch',
    events,
    ...overrides,
  };
}

beforeEach(async () => {
  await clearTables();
  captureLogs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the lse_notrack cookie', () => {
  it.each(['PageVisit', 'SignUp', 'BookingDialogOpened', 'ExitOfferShown'])('stores and sends nothing for %s, and still answers 204', async (name) => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(EVENTS, payload([pageVisit({ name })]), { cookie: 'a=b; lse_notrack=1' }),
      makeEnv(LIVE),
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(await count('events')).toBe(0);
    expect(network.to(REDDIT)).toHaveLength(0);
  });

  it('a different cookie value changes nothing', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(EVENTS, payload([pageVisit()]), { cookie: 'lse_notrack=0' }), makeEnv(LIVE));
    expect(await count('events')).toBe(1);
    expect(network.to(REDDIT)).toHaveLength(1);
  });
});

describe('POST /api/activity', () => {
  it('answers 204 with no body, then records the event and sends it to Reddit', async () => {
    const network = mockNetwork();
    const conversion = crypto.randomUUID();
    const response = await callWorker(
      jsonRequest(EVENTS, payload([pageVisit({ conversion_id: conversion })])),
      makeEnv(LIVE),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');

    const row = await db.prepare('SELECT * FROM events').first();
    expect(row).toMatchObject({
      name: 'PageVisit',
      page: '/seo/',
      variant: 'A',
      conversion_id: conversion,
      utm_source: 'reddit',
      utm_campaign: 'launch',
      is_test: 0,
    });

    const { data } = redditBody(network.to(REDDIT)[0]);
    expect(data.events[0]).toEqual({
      event_at: expect.any(Number),
      action_source: 'WEBSITE',
      type: { tracking_type: 'PAGE_VISIT' },
      click_id: 'abc',
      event_source_url: 'https://lawyerseoexpert.com/seo/?rdt_cid=abc',
      user: {
        ip_address: VISITOR_IP,
        user_agent: 'Mozilla/5.0 (test browser)',
        uuid: '1677712978045.uuid',
        screen_dimensions: { width: 1920, height: 1080 },
      },
      metadata: { conversion_id: conversion },
    });
  });

  it('stores no IP, user agent or click ID in the events table', async () => {
    mockNetwork();
    await callWorker(jsonRequest(EVENTS, payload([pageVisit()], { click_id: 'click-secret' })), makeEnv(LIVE));
    const row = await db.prepare('SELECT * FROM events').first();
    const stored = JSON.stringify(row);
    for (const value of [VISITOR_IP, 'Mozilla', 'click-secret']) expect(stored).not.toContain(value);
  });

  it('forwards valid hashed match keys and drops anything else, so raw contacts never leave', async () => {
    const network = mockNetwork();
    const env = makeEnv(LIVE);
    await callWorker(
      jsonRequest(EVENTS, payload([pageVisit()], { email_hash: HASH, phone_hash: HASH })),
      env,
    );
    await callWorker(
      jsonRequest(
        EVENTS,
        payload([pageVisit()], { email_hash: 'jane@example.com', phone_hash: '5554441234' }),
      ),
      env,
    );

    const hashed = redditBody(network.to(REDDIT)[0]).data.events[0];
    expect(hashed?.user).toMatchObject({ email: HASH, phone_number: HASH });
    const raw = redditBody(network.to(REDDIT)[1]).data.events[0];
    expect(raw?.user).not.toHaveProperty('email');
    expect(raw?.user).not.toHaveProperty('phone_number');
  });

  it('passes value and currency together, and neither alone', async () => {
    const network = mockNetwork();
    await callWorker(
      jsonRequest(
        EVENTS,
        payload([
          pageVisit({ name: 'SignUp', conversion_id: 'calendly-INV-1', value: 150, currency: 'USD' }),
          pageVisit({ value: 150 }),
        ]),
      ),
      makeEnv(LIVE),
    );
    const { events } = redditBody(network.to(REDDIT)[0]).data;
    expect(events[0]?.metadata).toEqual({ conversion_id: 'calendly-INV-1', value: 150, currency: 'USD' });
    expect(events[1]?.metadata).not.toHaveProperty('value');
  });

  describe('bookings', () => {
    const TOUCH = {
      touch: {
        utm_source: 'linkedin',
        utm_medium: 'social',
        utm_campaign: 'nov',
        utm_content: 'post-1',
        utm_term: 'seo',
        referrer: 'www.linkedin.com',
        landing: '/book/',
        extra: 'dropped',
      },
      first_touch: { utm_source: 'reddit', utm_content: 'ad-1', extra: 'dropped' },
    };
    const signUp = (id = 'calendly-INV-1') => pageVisit({ name: 'SignUp', conversion_id: id });
    const row = (env: Env) => env.DB.prepare('SELECT * FROM bookings').first<Record<string, unknown>>();

    it('saves one row with where the booking came from', async () => {
      mockNetwork();
      const env = makeEnv(LIVE);
      await callWorker(jsonRequest(EVENTS, payload([signUp()], TOUCH)), env);
      expect(await row(env)).toMatchObject({
        conversion_id: 'calendly-INV-1',
        page: '/seo/',
        utm_source: 'linkedin',
        utm_medium: 'social',
        utm_campaign: 'nov',
        utm_content: 'post-1',
        utm_term: 'seo',
        referrer: 'www.linkedin.com',
        landing: '/book/',
        first_utm_json: JSON.stringify({ utm_source: 'reddit', utm_content: 'ad-1' }),
        reddit_click: 1,
        is_test: 0,
      });
    });

    it('a repeated beacon does not add a second row or replace the first', async () => {
      mockNetwork();
      const env = makeEnv(LIVE);
      await callWorker(jsonRequest(EVENTS, payload([signUp()], TOUCH)), env);
      await callWorker(jsonRequest(EVENTS, payload([signUp()], { touch: { utm_source: 'later' } })), env);
      expect(await count('bookings')).toBe(1);
      expect((await row(env))?.utm_source).toBe('linkedin');
    });

    it('other events add no row', async () => {
      mockNetwork();
      await callWorker(jsonRequest(EVENTS, payload([pageVisit()], TOUCH)), makeEnv(LIVE));
      expect(await count('bookings')).toBe(0);
    });

    it('a direct booking still gets a row, and bad values are dropped', async () => {
      mockNetwork();
      const env = makeEnv(LIVE);
      await callWorker(
        jsonRequest(EVENTS, payload([signUp()], { click_id: undefined, touch: { referrer: 'https://x.com/a b', landing: 'javascript:1', utm_source: { a: 1 } }, first_touch: 'nope' })),
        env,
      );
      expect(await row(env)).toMatchObject({ utm_source: null, referrer: null, landing: null, first_utm_json: null, reddit_click: 0 });
    });

    it('events still save when the bookings table is missing', async () => {
      mockNetwork();
      const env = makeEnv(LIVE);
      await env.DB.exec('ALTER TABLE bookings RENAME TO bookings_away');
      try {
        await callWorker(jsonRequest(EVENTS, payload([signUp()], TOUCH)), env);
        expect(await count('events')).toBe(1);
      } finally {
        await env.DB.exec('ALTER TABLE bookings_away RENAME TO bookings');
      }
    });

    it('the cron deletes rows after 180 days', async () => {
      const env = makeEnv(LIVE);
      await env.DB.prepare("INSERT INTO bookings (conversion_id, ts) VALUES ('old', 1)").run();
      await env.DB.prepare("INSERT INTO bookings (conversion_id, ts) VALUES ('new', ?)").bind(Date.now()).run();
      await pruneBookings(env.DB);
      expect(await count('bookings')).toBe(1);
    });
  });

  it('in test mode sends one event per request', async () => {
    const network = mockNetwork();
    await callWorker(
      jsonRequest(EVENTS, payload([pageVisit(), pageVisit({ name: 'ViewContent' })])),
      makeEnv({ REDDIT_TEST_ID: 't2_test' }),
    );
    expect(network.to(REDDIT)).toHaveLength(2);
    for (const call of network.calls) {
      expect(redditBody(call).data.events).toHaveLength(1);
      expect(redditBody(call).data.test_id).toBe('t2_test');
    }
  });

  it('marks rows is_test before launch, and sends nothing to Reddit without a test ID', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(EVENTS, payload([pageVisit()])), makeEnv());
    expect(network.calls).toHaveLength(0);
    const row = await db.prepare('SELECT is_test FROM events').first();
    expect(row?.is_test).toBe(1);
  });
});

describe('the allowlist', () => {
  it.each(['PageVisit', 'ViewContent', 'SignUp'])('allows %s through to Reddit', async (name) => {
    const network = mockNetwork();
    await callWorker(jsonRequest(EVENTS, payload([pageVisit({ name })])), makeEnv(LIVE));
    expect(network.to(REDDIT)).toHaveLength(1);
    expect(await count('events')).toBe(1);
  });

  it.each(['Lead', 'Purchase', 'AddToCart', 'pagevisit', '', null, 42])(
    'drops %j everywhere',
    async (name) => {
      const network = mockNetwork();
      const response = await callWorker(
        jsonRequest(EVENTS, payload([pageVisit({ name })])),
        makeEnv(LIVE),
      );
      expect(response.status).toBe(204);
      expect(network.calls).toHaveLength(0);
      expect(await count('events')).toBe(0);
    },
  );

  it.each(['BookingDialogOpened', 'ExitOfferShown'])(
    'counts %s in D1 and never sends it to Reddit',
    async (name) => {
      const network = mockNetwork();
      await callWorker(
        jsonRequest(EVENTS, payload([{ name }])),
        makeEnv(LIVE),
      );
      expect(network.calls).toHaveLength(0);
      const row = await db.prepare('SELECT name, conversion_id FROM events').first();
      expect(row).toEqual({ name, conversion_id: null });
    },
  );

  it('keeps the good events when a batch also holds bad ones', async () => {
    const network = mockNetwork();
    await callWorker(
      jsonRequest(
        EVENTS,
        payload([pageVisit({ name: 'Lead' }), pageVisit(), 'junk', null, pageVisit({ name: 'Nope' })]),
      ),
      makeEnv(LIVE),
    );
    expect(redditBody(network.to(REDDIT)[0]).data.events).toHaveLength(1);
    expect(await count('events')).toBe(1);
  });

  it.each([[undefined], [''], ['has spaces'], ['x'.repeat(101)], [123]])(
    'drops a Reddit event with conversion_id %j, because it could not de-duplicate',
    async (conversion) => {
      const network = mockNetwork();
      await callWorker(
        jsonRequest(EVENTS, payload([pageVisit({ conversion_id: conversion })])),
        makeEnv(LIVE),
      );
      expect(network.calls).toHaveLength(0);
      expect(await count('events')).toBe(0);
    },
  );

  it('accepts the calendly-<invitee id> form of conversion ID', async () => {
    const network = mockNetwork();
    await callWorker(
      jsonRequest(EVENTS, payload([pageVisit({ name: 'SignUp', conversion_id: 'calendly-INV-1234567' })])),
      makeEnv(LIVE),
    );
    expect(network.to(REDDIT)).toHaveLength(1);
  });
});

describe('caps and rejections', () => {
  it('accepts exactly 10 events', async () => {
    mockNetwork();
    const events = Array.from({ length: 10 }, () => pageVisit());
    const response = await callWorker(jsonRequest(EVENTS, payload(events)), makeEnv(LIVE));
    expect(response.status).toBe(204);
    expect(await count('events')).toBe(10);
  });

  it('rejects 11 events outright', async () => {
    const network = mockNetwork();
    const events = Array.from({ length: 11 }, () => pageVisit());
    const response = await callWorker(jsonRequest(EVENTS, payload(events)), makeEnv(LIVE));
    expect(response.status).toBe(413);
    expect(network.calls).toHaveLength(0);
    expect(await count('events')).toBe(0);
  });

  it('rejects a body over 32 KB', async () => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(EVENTS, payload([pageVisit()], { padding: 'x'.repeat(33 * 1024) })),
      makeEnv(LIVE),
    );
    expect(response.status).toBe(413);
    expect(network.calls).toHaveLength(0);
  });

  it('rejects another site', async () => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(EVENTS, payload([pageVisit()]), { origin: 'https://evil.example' }),
      makeEnv(LIVE),
    );
    expect(response.status).toBe(403);
    expect(network.calls).toHaveLength(0);
    expect(await count('events')).toBe(0);
  });

  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 HeadlessChrome/120.0',
    'Mozilla/5.0 Chrome-Lighthouse',
    'facebookexternalhit/1.1',
  ])('skips the bot %s with a 204', async (userAgent) => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(EVENTS, payload([pageVisit()]), { 'user-agent': userAgent }),
      makeEnv(LIVE),
    );
    expect(response.status).toBe(204);
    expect(network.calls).toHaveLength(0);
    expect(await count('events')).toBe(0);
  });

  it('rejects other methods and malformed bodies', async () => {
    mockNetwork();
    const env = makeEnv(LIVE);
    expect((await callWorker(new Request(`${ORIGIN}${EVENTS}`), env)).status).toBe(405);
    expect((await callWorker(jsonRequest(EVENTS, { events: 'nope' }), env)).status).toBe(400);
    expect((await callWorker(jsonRequest(EVENTS, ['nope']), env)).status).toBe(400);

    const notJson = new Request(`${ORIGIN}${EVENTS}`, {
      method: 'POST',
      headers: { origin: ORIGIN },
      body: 'not json',
    });
    expect((await callWorker(notJson, env)).status).toBe(400);
  });

  it('accepts JSON sent by sendBeacon as text/plain', async () => {
    mockNetwork();
    const beacon = new Request(`${ORIGIN}${EVENTS}`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload([pageVisit()])),
    });
    expect((await callWorker(beacon, makeEnv(LIVE))).status).toBe(204);
    expect(await count('events')).toBe(1);
  });
});

describe('failure drills', () => {
  it.each([[500], [429], [400]])('Reddit returning %i does not affect the 204', async (status) => {
    mockNetwork({ [REDDIT]: () => new Response('nope', { status }) });
    const response = await callWorker(jsonRequest(EVENTS, payload([pageVisit()])), makeEnv(LIVE));
    expect(response.status).toBe(204);
    expect(await count('events')).toBe(1);
  });

  it('D1 failing still answers 204, and Reddit still gets the event', async () => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(EVENTS, payload([pageVisit()])),
      makeEnv({ ...LIVE, DB: brokenDb() }),
    );
    expect(response.status).toBe(204);
    expect(network.to(REDDIT)).toHaveLength(1);
  });
});

describe('falling through', () => {
  it('sends anything that is not an add-on path to the static files', async () => {
    const env = makeEnv();
    const response = await callWorker(new Request(`${ORIGIN}/some/page/`), env);
    expect(await response.text()).toBe('static file');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
  });

  it('leaves robots alone once live', async () => {
    const response = await callWorker(new Request(`${ORIGIN}/`), makeEnv(LIVE));
    expect(response.headers.get('x-robots-tag')).toBeNull();
  });

  it('keeps a 204 intact through the noindex wrapper', async () => {
    mockNetwork();
    const env = makeEnv();
    const events = await callWorker(jsonRequest(EVENTS, payload([])), env);
    expect(events.status).toBe(204);
    expect(events.headers.get('x-robots-tag')).toBe('noindex');
  });
});
