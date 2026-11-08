import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../worker/matchkeys';
import {
  brokenDb,
  callWorker,
  captureLogs,
  clearTables,
  count,
  db,
  formRequest,
  GA4,
  jsonRequest,
  makeEnv,
  META,
  META_ON,
  mockNetwork,
  ORIGIN,
  REDDIT,
  redditBody,
  SITEVERIFY,
  validLead,
  VISITOR_IP,
  type CapturedLogs,
} from './helpers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LEAD = '/api/lead';

function sentMessages(env: ReturnType<typeof makeEnv>): Record<string, unknown>[] {
  return env.EMAIL.send.mock.calls.map((call) => call[0] as Record<string, unknown>);
}

let logs: CapturedLogs;

beforeEach(async () => {
  await clearTables();
  logs = captureLogs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the happy path', () => {
  it('answers JSON with ok and the id, and saves every field', async () => {
    mockNetwork();
    const env = makeEnv();
    const conversion = crypto.randomUUID();
    const response = await callWorker(
      jsonRequest(LEAD, validLead({ conversion_id: conversion, budget: '$5k', goals: ['a', 'b'] })),
      env,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; id: string };
    expect(body).toEqual({ ok: true, id: expect.stringMatching(UUID_RE) });

    const row = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(body.id).first();
    expect(row).toMatchObject({
      name: 'Jane Doe',
      email: 'Jane.Doe+site@Example.com',
      phone: '(555) 444-1234',
      website: 'https://janedoelaw.example',
      firm: 'Doe Law',
      practice_area: 'Personal injury',
      message: 'We need more cases.',
      page: '/',
      variant: 'B',
      click_id: 'abc',
      conversion_id: conversion,
      turnstile: 'ok',
      is_test: 1,
    });
    expect(JSON.parse(String(row?.utm_json))).toEqual({ utm_source: 'reddit', utm_campaign: 'launch' });
    expect(JSON.parse(String(row?.extra_json))).toEqual({ budget: '$5k', goals: 'a, b' });
  });

  it("shows a practice page's page, form and practice area in the email", async () => {
    mockNetwork();
    const env = makeEnv();
    await callWorker(
      jsonRequest(
        LEAD,
        validLead({
          page: '/seo-for-personal-injury-lawyers/',
          practice_area: 'Personal Injury',
          source_form: 'SEO for personal injury lawyers page message',
          focus_area: 'All of it',
          format: 'Message first',
        }),
      ),
      env,
    );

    const [message] = sentMessages(env);
    expect(String(message?.subject)).toContain('(/seo-for-personal-injury-lawyers/)');
    const text = String(message?.text);
    expect(text).toContain('Practice area: Personal Injury');
    expect(text).toContain('source form: SEO for personal injury lawyers page message');
    expect(text).toContain('focus area: All of it');
    expect(text).toContain('Page: /seo-for-personal-injury-lawyers/');
  });

  it("puts the contact page's select in the email's practice area, and leaves a blank one out", async () => {
    mockNetwork();
    const env = makeEnv();
    const send = (practiceArea: string) =>
      callWorker(jsonRequest(LEAD, validLead({ conversion_id: crypto.randomUUID(), page: '/contact-us/', practice_area: practiceArea, source_form: 'Contact page message' })), env);

    await send('Family Law');
    const chosen = String(sentMessages(env)[0]?.text);
    expect(chosen).toContain('Practice area: Family Law');
    expect(chosen).toContain('source form: Contact page message');
    expect(chosen).toContain('Page: /contact-us/');
    const row = await db.prepare("SELECT practice_area FROM leads WHERE practice_area = 'Family Law'").first();
    expect(row).not.toBeNull();

    await send('');
    const messages = sentMessages(env);
    const blank = String(messages[messages.length - 1]?.text);
    expect(blank).toContain('Page: /contact-us/');
    expect(blank).not.toContain('Practice area');
  });

  it('never stores the raw IP: ip_hash is SHA-256 of the IP plus the salt', async () => {
    mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv());
    const row = await db.prepare('SELECT * FROM leads').first();
    expect(row?.ip_hash).toBe(await sha256Hex(`${VISITOR_IP}test-salt`));
    expect(JSON.stringify(row)).not.toContain(VISITOR_IP);
  });

  it('stores no hash at all without IP_SALT, and still keeps the lead', async () => {
    mockNetwork();
    const response = await callWorker(
      jsonRequest(LEAD, validLead()),
      makeEnv({ IP_SALT: undefined }),
    );
    expect(response.status).toBe(200);
    const row = await db.prepare('SELECT ip_hash FROM leads').first();
    expect(row?.ip_hash).toBeNull();
  });

  it('answers a form post with no JavaScript with a 303 to the thank-you page', async () => {
    mockNetwork();
    const env = makeEnv();
    const response = await callWorker(
      formRequest(LEAD, { name: 'No Script', email: 'noscript@example.com', page: '/contact/' }),
      env,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/thank-you/');

    // No token because no script ran, so it's kept and marked. The server makes the conversion ID.
    const row = await db.prepare('SELECT * FROM leads').first();
    expect(row).toMatchObject({ name: 'No Script', turnstile: 'unverified', page: '/contact/' });
    expect(row?.conversion_id).toMatch(UUID_RE);
  });

  it('keeps every value of a repeated form field', async () => {
    mockNetwork();
    const params = new URLSearchParams('name=A&email=a%40example.com&goal=x&goal=y');
    const request = new Request(`${ORIGIN}${LEAD}`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    await callWorker(request, makeEnv());
    const row = await db.prepare('SELECT extra_json FROM leads').first();
    expect(JSON.parse(String(row?.extra_json))).toEqual({ goal: 'x, y' });
  });

  it('counts each lead in the events table without contact details', async () => {
    mockNetwork();
    const conversion = crypto.randomUUID();
    await callWorker(jsonRequest(LEAD, validLead({ conversion_id: conversion })), makeEnv());
    const rows = await db.prepare('SELECT * FROM events').all();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]).toMatchObject({
      name: 'Lead',
      page: '/',
      variant: 'B',
      conversion_id: conversion,
      utm_source: 'reddit',
      utm_campaign: 'launch',
      is_test: 1,
    });
  });

  it('marks real leads is_test=0 once LIVE is true', async () => {
    mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv({ LIVE: 'true' }));
    const row = await db.prepare('SELECT is_test FROM leads').first();
    expect(row?.is_test).toBe(0);
  });

  it('treats a retried POST of the same form as one lead', async () => {
    mockNetwork();
    const env = makeEnv();
    const lead = validLead();
    const first = await callWorker(jsonRequest(LEAD, lead), env);
    const second = await callWorker(jsonRequest(LEAD, lead), env);

    expect(await second.json()).toEqual(await first.json());
    expect(await count('leads')).toBe(1);
    expect(await count('outbox')).toBe(1);
    expect(await count('events')).toBe(1);
    expect(env.EMAIL.send).toHaveBeenCalledTimes(2); // two recipients, once each
  });

  it('never logs contact details', async () => {
    mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv({ REDDIT_TEST_ID: 't2' }));
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv({ EMAIL_TO: '', EMAIL_FROM: '' }));
    const logged = logs.all();
    for (const detail of ['Jane', 'Doe', 'Example.com', '555', VISITOR_IP]) {
      expect(logged).not.toContain(detail);
    }
  });
});

describe('the lse_notrack cookie', () => {
  const cookie = { cookie: 'a=b; lse_notrack=1; c=d' };

  it('saves and emails the lead, marks it is_test=1 and sends nothing to Reddit', async () => {
    const network = mockNetwork();
    const env = makeEnv({ LIVE: 'true' });
    const response = await callWorker(jsonRequest(LEAD, validLead(), cookie), env);

    expect(response.status).toBe(200);
    expect((await response.json()) as object).toMatchObject({ ok: true });
    const row = await db.prepare('SELECT is_test FROM leads').first();
    expect(row?.is_test).toBe(1);
    const counted = await db.prepare("SELECT is_test FROM events WHERE name = 'Lead'").first();
    expect(counted?.is_test).toBe(1);
    expect(sentMessages(env)).toHaveLength(2);
    expect(network.to(REDDIT)).toHaveLength(0);
  });

  it('also covers a form posted with no JavaScript', async () => {
    const network = mockNetwork();
    const env = makeEnv({ LIVE: 'true' });
    const { email, name } = validLead() as { email: string; name: string };
    const response = await callWorker(formRequest(LEAD, { name, email }, cookie), env);

    expect(response.status).toBe(303);
    const row = await db.prepare('SELECT is_test FROM leads').first();
    expect(row?.is_test).toBe(1);
    expect(sentMessages(env)).toHaveLength(2);
    expect(network.to(REDDIT)).toHaveLength(0);
  });

  it('still validates', async () => {
    mockNetwork();
    const response = await callWorker(jsonRequest(LEAD, validLead({ email: 'nope' }), cookie), makeEnv({ LIVE: 'true' }));
    expect(response.status).toBe(400);
    expect(await count('leads')).toBe(0);
  });

  it.each(['lse_notrack=0', 'xlse_notrack=1', 'lse_notrack=10', 'other=lse_notrack=1'])(
    'ignores %s, so a real lead still counts',
    async (value) => {
      const network = mockNetwork();
      await callWorker(jsonRequest(LEAD, validLead(), { cookie: value }), makeEnv({ LIVE: 'true' }));
      const row = await db.prepare('SELECT is_test FROM leads').first();
      expect(row?.is_test).toBe(0);
      expect(network.to(REDDIT)).toHaveLength(1);
    },
  );
});

describe('order of operations', () => {
  it('step 1: rejects another site before reading anything else', async () => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(LEAD, validLead(), { origin: 'https://evil.example' }),
      makeEnv(),
    );
    expect(response.status).toBe(403);
    expect(network.calls).toHaveLength(0);
    expect(await count('leads')).toBe(0);
  });

  it('step 1: rejects a request with no Origin and no Referer', async () => {
    mockNetwork();
    const request = new Request(`${ORIGIN}${LEAD}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validLead()),
    });
    expect((await callWorker(request, makeEnv())).status).toBe(403);
  });

  it.each([
    ['the production host', { origin: 'https://lawyerseoexpert.com' }],
    ['www', { origin: 'https://www.lawyerseoexpert.com' }],
    ['Referer when Origin is null', { origin: 'null', referer: 'https://lawyerseoexpert.com/' }],
  ])('step 1: accepts %s', async (_label, headers) => {
    mockNetwork();
    const response = await callWorker(jsonRequest(LEAD, validLead(), headers), makeEnv());
    expect(response.status).toBe(200);
  });

  it('step 1: accepts the host the Worker answers on, for workers.dev and Previews', async () => {
    mockNetwork();
    const host = 'https://phase-3-lawyerseoexpert-site.fahim-afd.workers.dev';
    const request = new Request(`${host}${LEAD}`, {
      method: 'POST',
      headers: { origin: host, 'content-type': 'application/json' },
      body: JSON.stringify(validLead()),
    });
    expect((await callWorker(request, makeEnv())).status).toBe(200);
  });

  it('step 1: rejects a look-alike host', async () => {
    mockNetwork();
    const response = await callWorker(
      jsonRequest(LEAD, validLead(), { origin: 'https://lawyerseoexpert.com.evil.example' }),
      makeEnv(),
    );
    expect(response.status).toBe(403);
  });

  it('step 1: rejects a body over 32 KB, by header or by actual size', async () => {
    const network = mockNetwork();
    const env = makeEnv();
    const huge = validLead({ message: 'x'.repeat(33 * 1024) });
    expect((await callWorker(jsonRequest(LEAD, huge), env)).status).toBe(413);

    // A stream has no Content-Length, so only the real byte count can catch it.
    const stream = new Blob([JSON.stringify(huge)]).stream();
    const request = new Request(`${ORIGIN}${LEAD}`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: stream,
    });
    expect(request.headers.get('content-length')).toBeNull();
    expect((await callWorker(request, env)).status).toBe(413);

    expect(network.calls).toHaveLength(0);
    expect(await count('leads')).toBe(0);
  });

  it('accepts a body just under the cap', async () => {
    mockNetwork();
    const response = await callWorker(
      jsonRequest(LEAD, validLead({ message: 'x'.repeat(30 * 1024) })),
      makeEnv(),
    );
    expect(response.status).toBe(200);
    const row = await db.prepare('SELECT message FROM leads').first();
    expect(String(row?.message)).toHaveLength(5000);
  });

  it('step 2: a filled honeypot looks like success and stores nothing, with no Turnstile call', async () => {
    const network = mockNetwork();
    const env = makeEnv();
    const response = await callWorker(jsonRequest(LEAD, validLead({ hp: 'spam' })), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: expect.stringMatching(UUID_RE) });
    expect(network.calls).toHaveLength(0);
    expect(env.EMAIL.send).not.toHaveBeenCalled();
    expect(await count('leads')).toBe(0);
    expect(await count('outbox')).toBe(0);
    expect(await count('events')).toBe(0);
  });

  it('step 2: a form-encoded bot gets the same 303', async () => {
    mockNetwork();
    const response = await callWorker(
      formRequest(LEAD, { name: 'B', email: 'b@example.com', hp: 'spam' }),
      makeEnv(),
    );
    expect(response.status).toBe(303);
    expect(await count('leads')).toBe(0);
  });

  it.each([[0], [2999], ['2999']])('step 2: elapsed_ms of %j is too fast', async (elapsed) => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(LEAD, validLead({ elapsed_ms: elapsed })),
      makeEnv(),
    );
    expect(response.status).toBe(200);
    expect(network.calls).toHaveLength(0);
    expect(await count('leads')).toBe(0);
  });

  it.each([[3000], ['3000'], ['garbage'], [undefined], [null]])(
    'step 2: elapsed_ms of %j keeps the lead',
    async (elapsed) => {
      mockNetwork();
      await callWorker(jsonRequest(LEAD, validLead({ elapsed_ms: elapsed })), makeEnv());
      expect(await count('leads')).toBe(1);
    },
  );

  it('step 3: an actively failed token is rejected and stores nothing', async () => {
    mockNetwork({
      [SITEVERIFY]: () =>
        Response.json({ success: false, 'error-codes': ['invalid-input-response'] }),
    });
    const env = makeEnv();
    const response = await callWorker(jsonRequest(LEAD, validLead()), env);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: 'turnstile_failed' });
    expect(env.EMAIL.send).not.toHaveBeenCalled();
    expect(await count('leads')).toBe(0);
  });

  it('step 3: sends the secret, the token and the IP to siteverify', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv());
    const form = network.to(SITEVERIFY)[0]?.init.body as FormData;
    expect(form.get('secret')).toBe('test-secret');
    expect(form.get('response')).toBe('good-token');
    expect(form.get('remoteip')).toBe(VISITOR_IP);
  });

  it('step 3: refuses a forged oversized token without asking siteverify', async () => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(LEAD, validLead({ 'cf-turnstile-response': 'x'.repeat(2049) })),
      makeEnv(),
    );
    expect(response.status).toBe(403);
    expect(network.to(SITEVERIFY)).toHaveLength(0);
  });

  it('step 3 comes before step 4: a failed token gets 403 even when over the rate limit', async () => {
    mockNetwork();
    const env = makeEnv();
    for (let i = 0; i < 5; i++) await callWorker(jsonRequest(LEAD, validLead()), env);
    mockNetwork({
      [SITEVERIFY]: () =>
        Response.json({ success: false, 'error-codes': ['invalid-input-response'] }),
    });
    expect((await callWorker(jsonRequest(LEAD, validLead()), env)).status).toBe(403);
  });

  it('step 4: the sixth lead in an hour from one IP gets a 429', async () => {
    mockNetwork();
    const env = makeEnv();
    for (let i = 0; i < 5; i++) {
      expect((await callWorker(jsonRequest(LEAD, validLead()), env)).status).toBe(200);
    }

    const response = await callWorker(jsonRequest(LEAD, validLead()), env);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ ok: false, error: 'rate_limited' });
    expect(response.headers.get('retry-after')).toBe('3600');
    expect(await count('leads')).toBe(5);

    // Another visitor isn't affected.
    const other = await callWorker(
      jsonRequest(LEAD, validLead(), { 'cf-connecting-ip': '203.0.113.8' }),
      env,
    );
    expect(other.status).toBe(200);
  });

  it('step 4: the limit is per hour, so older leads no longer count', async () => {
    mockNetwork();
    const env = makeEnv();
    for (let i = 0; i < 5; i++) await callWorker(jsonRequest(LEAD, validLead()), env);
    await db.prepare('UPDATE leads SET created_at = created_at - ?').bind(61 * 60_000).run();
    expect((await callWorker(jsonRequest(LEAD, validLead()), env)).status).toBe(200);
  });

  it('step 4 comes before step 5: an invalid lead over the limit gets 429, not 400', async () => {
    mockNetwork();
    const env = makeEnv();
    for (let i = 0; i < 5; i++) await callWorker(jsonRequest(LEAD, validLead()), env);
    const response = await callWorker(jsonRequest(LEAD, validLead({ email: 'nope' })), env);
    expect(response.status).toBe(429);
  });

  it.each([
    ['a missing name', { name: '' }, ['name']],
    ['a blank name', { name: '   ' }, ['name']],
    ['a missing email', { email: '' }, ['email']],
    ['a bad email', { email: 'not-an-email' }, ['email']],
    ['both', { name: '', email: 'x' }, ['name', 'email']],
  ])('step 5: rejects %s and names the field', async (_label, overrides, fields) => {
    mockNetwork();
    const env = makeEnv();
    const response = await callWorker(jsonRequest(LEAD, validLead(overrides)), env);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'invalid', fields });
    expect(await count('leads')).toBe(0);
    expect(env.EMAIL.send).not.toHaveBeenCalled();
  });

  it('step 5: phone is optional, and a bad one still keeps the lead', async () => {
    const network = mockNetwork();
    const env = makeEnv({ LIVE: 'true' });
    expect((await callWorker(jsonRequest(LEAD, validLead({ phone: '' })), env)).status).toBe(200);
    expect((await callWorker(jsonRequest(LEAD, validLead({ phone: 'n/a' })), env)).status).toBe(200);
    expect(await count('leads')).toBe(2);
    const event = redditBody(network.to(REDDIT)[1]).data.events[0];
    expect(event?.user).not.toHaveProperty('phone_number');
  });

  it('step 6 comes before step 7: the lead is in D1 by the time the email goes', async () => {
    mockNetwork();
    let rowsWhenSending = -1;
    const env = makeEnv({
      EMAIL: {
        send: vi.fn(async () => {
          rowsWhenSending = await count('leads');
          return { messageId: 'm' };
        }),
      },
    });
    await callWorker(jsonRequest(LEAD, validLead()), env);
    expect(rowsWhenSending).toBe(1);
  });

  it('rejects other methods and a body that is not an object', async () => {
    mockNetwork();
    const env = makeEnv();
    const get = await callWorker(new Request(`${ORIGIN}${LEAD}`), env);
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');

    const notJson = new Request(`${ORIGIN}${LEAD}`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: 'not json',
    });
    expect((await callWorker(notJson, env)).status).toBe(400);
    expect((await callWorker(jsonRequest(LEAD, [1, 2]), env)).status).toBe(400);
  });

  it('shows a contact fallback page to a form post that fails', async () => {
    mockNetwork();
    const response = await callWorker(
      formRequest(LEAD, { name: '', email: 'a@example.com' }),
      makeEnv(),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('hello@lawyerseoexpert.com');
  });
});

describe('the Reddit Lead', () => {
  it('sends the hashed lead with the shared conversion ID', async () => {
    const network = mockNetwork();
    const conversion = crypto.randomUUID();
    await callWorker(
      jsonRequest(LEAD, validLead({ conversion_id: conversion }), {
        cookie: 'a=b; _rdt_uuid=1677712978045.cookie-value; c=d',
      }),
      makeEnv({ LIVE: 'true' }),
    );

    const { data } = redditBody(network.to(REDDIT)[0]);
    expect(data).not.toHaveProperty('test_id');
    expect(data.events[0]).toEqual({
      event_at: expect.any(Number),
      action_source: 'WEBSITE',
      type: { tracking_type: 'LEAD' },
      click_id: 'abc',
      // Our host, and only the query values that matter for attribution.
      event_source_url: 'https://lawyerseoexpert.com/?rdt_cid=abc&utm_source=reddit',
      user: {
        ip_address: VISITOR_IP,
        user_agent: 'Mozilla/5.0 (test browser)',
        uuid: '1677712978045.cookie-value',
        screen_dimensions: { width: 390, height: 844 },
        email: await sha256Hex('janedoe@example.com'),
        phone_number: await sha256Hex('+15554441234'),
      },
      metadata: { conversion_id: conversion },
    });
  });

  it('falls back to the uuid in the body when there is no cookie', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv({ LIVE: 'true' }));
    const event = redditBody(network.to(REDDIT)[0]).data.events[0];
    expect(event?.user.uuid).toBe('1677712978045.b8f7eb7d-b357-437b-8bd3-e1c8166c7132');
  });

  it('never reports a page on someone else’s host', async () => {
    const network = mockNetwork();
    await callWorker(
      jsonRequest(LEAD, validLead({ page: 'https://evil.example/landing/' })),
      makeEnv({ LIVE: 'true' }),
    );
    const event = redditBody(network.to(REDDIT)[0]).data.events[0];
    expect(event).not.toHaveProperty('event_source_url');
    const row = await db.prepare('SELECT page FROM leads').first();
    expect(row?.page).toBeNull();
  });

  it('sends nothing before launch without a test ID', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv());
    expect(network.to(REDDIT)).toHaveLength(0);
  });

  it('carries test_id while testing', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv({ REDDIT_TEST_ID: 't2_test' }));
    expect(redditBody(network.to(REDDIT)[0]).data.test_id).toBe('t2_test');
  });
});

describe('failure drills', () => {
  it('email binding failing leaves the lead in D1, and the visitor sees success', async () => {
    mockNetwork();
    const env = makeEnv();
    env.EMAIL.send.mockRejectedValue(new Error('binding down'));

    const response = await callWorker(jsonRequest(LEAD, validLead()), env);
    expect(response.status).toBe(200);
    expect(await count('leads')).toBe(1);

    const row = await db.prepare('SELECT * FROM outbox').first();
    expect(row).toMatchObject({ attempts: 1, sent_at: null, last_error: expect.stringContaining('binding down') });
  });

  it.each([
    ['siteverify returning 500', () => new Response('oops', { status: 500 })],
    ['siteverify returning junk', () => new Response('<html>', { status: 200 })],
    ['siteverify with no verdict', () => Response.json({ hello: 'world' })],
    [
      'siteverify unreachable',
      () => {
        throw new Error('connection refused');
      },
    ],
    [
      'our secret being wrong',
      () => Response.json({ success: false, 'error-codes': ['invalid-input-secret'] }),
    ],
    [
      'an expired token',
      () => Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
    ],
    [
      'Cloudflare internal error',
      () => Response.json({ success: false, 'error-codes': ['internal-error'] }),
    ],
  ])('Turnstile blocked by %s keeps the lead as unverified and flags the email', async (_label, siteverify) => {
    mockNetwork({ [SITEVERIFY]: siteverify });
    const env = makeEnv();
    const response = await callWorker(jsonRequest(LEAD, validLead()), env);

    expect(response.status).toBe(200);
    const row = await db.prepare('SELECT turnstile FROM leads').first();
    expect(row?.turnstile).toBe('unverified');
    expect(String(sentMessages(env)[0]?.subject)).toContain('[POSSIBLE SPAM]');
    expect(String(sentMessages(env)[0]?.text)).toMatch(/^Possible spam:/);
  });

  it('a blocked Turnstile script (no token) keeps the lead without asking siteverify', async () => {
    const network = mockNetwork();
    const env = makeEnv();
    const lead = validLead();
    delete lead['cf-turnstile-response'];
    const response = await callWorker(jsonRequest(LEAD, lead), env);

    expect(response.status).toBe(200);
    expect(network.to(SITEVERIFY)).toHaveLength(0);
    const row = await db.prepare('SELECT turnstile FROM leads').first();
    expect(row?.turnstile).toBe('unverified');
    expect(String(sentMessages(env)[0]?.subject)).toContain('[POSSIBLE SPAM]');
  });

  describe('ad conversions and the Turnstile token', () => {
    const TRACKING = { LIVE: 'true', ...META_ON, GA4_API_SECRET: 'ga-test-secret', GA4_MEASUREMENT_ID: 'G-V1J07CEE3T' };
    const GA_FIELDS = { ga_client_id: '1234567890.1700000000', ga_session_id: '1700000123' };
    const OK = () => new Response(null, { status: 204 });
    const network = () => mockNetwork({ [GA4]: OK, [META]: () => Response.json({ events_received: 1 }) });

    it('with a token, the lead goes to Reddit, Meta and GA4', async () => {
      const calls = network();
      const response = await callWorker(jsonRequest(LEAD, validLead(GA_FIELDS)), makeEnv(TRACKING));
      expect(response.status).toBe(200);
      expect(calls.to(REDDIT)).toHaveLength(1);
      expect(calls.to(META)).toHaveLength(1);
      expect(calls.to(GA4)).toHaveLength(1);
    });

    it('with no token, the lead is saved and emailed but sent to none of them', async () => {
      const calls = network();
      const env = makeEnv(TRACKING);
      const lead = validLead(GA_FIELDS);
      delete lead['cf-turnstile-response'];
      const response = await callWorker(jsonRequest(LEAD, lead), env);

      expect(response.status).toBe(200);
      expect(await count('leads')).toBe(1);
      expect(sentMessages(env)).toHaveLength(2);
      expect(String(sentMessages(env)[0]?.subject)).toMatch(/^\[POSSIBLE SPAM\] New lead:/);
      expect(calls.to(REDDIT)).toHaveLength(0);
      expect(calls.to(META)).toHaveLength(0);
      expect(calls.to(GA4)).toHaveLength(0);
    });

    it('a form posted straight here with no token is not counted either', async () => {
      const calls = network();
      const env = makeEnv(TRACKING);
      const { email, name } = validLead() as { email: string; name: string };
      const response = await callWorker(formRequest(LEAD, { name, email, website: 'https://cedar54.com' }), env);

      expect(response.status).toBe(303);
      expect(sentMessages(env)).toHaveLength(2);
      expect(calls.to(REDDIT)).toHaveLength(0);
      expect(calls.to(META)).toHaveLength(0);
      expect(calls.to(GA4)).toHaveLength(0);
    });

    it('a token siteverify could not check still counts, because the widget made it', async () => {
      const calls = mockNetwork({
        [SITEVERIFY]: () => new Response('oops', { status: 500 }),
        [GA4]: OK,
        [META]: () => Response.json({ events_received: 1 }),
      });
      const response = await callWorker(jsonRequest(LEAD, validLead(GA_FIELDS)), makeEnv(TRACKING));
      expect(response.status).toBe(200);
      expect(calls.to(REDDIT)).toHaveLength(1);
      expect(calls.to(META)).toHaveLength(1);
      expect(calls.to(GA4)).toHaveLength(1);
    });
  });

  it('a missing Turnstile secret keeps the lead as unverified', async () => {
    const network = mockNetwork();
    const response = await callWorker(
      jsonRequest(LEAD, validLead()),
      makeEnv({ TURNSTILE_SECRET: undefined }),
    );
    expect(response.status).toBe(200);
    expect(network.to(SITEVERIFY)).toHaveLength(0);
    const row = await db.prepare('SELECT turnstile FROM leads').first();
    expect(row?.turnstile).toBe('unverified');
  });

  it.each([[500], [429], [400]])('Reddit returning %i does not affect the response', async (status) => {
    const network = mockNetwork({ [REDDIT]: () => new Response('nope', { status }) });
    const env = makeEnv({ LIVE: 'true' });
    const response = await callWorker(jsonRequest(LEAD, validLead()), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(network.to(REDDIT).length).toBeGreaterThan(0);
    expect(await count('leads')).toBe(1);
    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
  });

  it('Reddit unreachable does not affect the response or the email', async () => {
    mockNetwork({
      [REDDIT]: () => {
        throw new Error('network down');
      },
    });
    const env = makeEnv({ LIVE: 'true' });
    const response = await callWorker(jsonRequest(LEAD, validLead()), env);
    expect(response.status).toBe(200);
    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
  });

  it('D1 failing returns an error, and still tries the email', async () => {
    const network = mockNetwork();
    const env = makeEnv({ DB: brokenDb() });
    const response = await callWorker(jsonRequest(LEAD, validLead()), env);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'save_failed' });

    const messages = sentMessages(env);
    expect(messages.map((message) => message.to)).toEqual(['one@example.test', 'two@example.test']);
    expect(String(messages[0]?.subject)).toContain('[NOT SAVED]');
    expect(String(messages[0]?.text)).toContain('only copy');
    expect(messages[0]?.replyTo).toBe('Jane.Doe+site@Example.com');
    expect(network.to(REDDIT)).toHaveLength(0);
  });

  it('D1 failing on a form post shows the contact fallback, not the thank-you page', async () => {
    mockNetwork();
    const env = makeEnv({ DB: brokenDb() });
    const response = await callWorker(
      formRequest(LEAD, { name: 'A', email: 'a@example.com' }),
      env,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('hello@lawyerseoexpert.com');
    expect(env.EMAIL.send).toHaveBeenCalled();
  });

  it('D1 and email both failing still answers cleanly', async () => {
    mockNetwork();
    const env = makeEnv({ DB: brokenDb() });
    env.EMAIL.send.mockRejectedValue(new Error('binding down'));
    const response = await callWorker(jsonRequest(LEAD, validLead()), env);
    expect(response.status).toBe(503);
    expect(logs.errors.join()).toContain('lead_email_failed_without_d1');
  });
});
