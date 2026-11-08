import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsRetentionJob } from '../../worker/addons/events';
import { buildPayload, fallbackClientId, sendGa4Events } from '../../worker/ga4';
import {
  callWorker,
  captureLogs,
  clearTables,
  count,
  GA4,
  jsonRequest,
  makeEnv,
  mockNetwork,
  validLead,
  type FetchCall,
} from './helpers';

const LIVE = { LIVE: 'true', GA4_API_SECRET: 'ga-test-secret', GA4_MEASUREMENT_ID: 'G-V1J07CEE3T' };
const CID = '1234567890.1700000000';
const SID = '1700000123';
const GA_FIELDS = { ga_client_id: CID, ga_session_id: SID };
const OK = () => new Response(null, { status: 204 });

const sent = (network: ReturnType<typeof mockNetwork>): FetchCall[] => network.to(GA4);
const body = (call: FetchCall | undefined) =>
  JSON.parse(String(call?.init.body)) as {
    client_id: string;
    ip_override?: string;
    events: Array<{ name: string; params: Record<string, unknown> }>;
  };
const lead = (extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  jsonRequest('/api/lead', validLead({ source_form: 'Hero form', ...GA_FIELDS, ...extra }), headers);
const activity = (events: unknown[], extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  jsonRequest('/api/activity', { page: '/seo/?rdt_cid=abc', events, ...GA_FIELDS, ...extra }, headers);

beforeEach(async () => {
  await clearTables();
  captureLogs();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('generate_lead', () => {
  it('sends once after the save, with the session and no personal data', async () => {
    const network = mockNetwork({ [GA4]: OK });
    const response = await callWorker(lead({ conversion_id: 'lead-1', page: '/' }), makeEnv(LIVE));
    expect(response.status).toBe(200);
    expect(sent(network)).toHaveLength(1);
    const payload = body(sent(network)[0]);
    expect(payload.client_id).toBe(CID);
    expect(payload.ip_override).toBe('203.0.113.7');
    expect(payload.events).toEqual([
      {
        name: 'generate_lead',
        params: {
          engagement_time_msec: 100,
          session_id: Number(SID),
          lead_id: 'lead-1',
          source_form: 'Hero form',
          page_location: 'https://lawyerseoexpert.com/',
        },
      },
    ]);
    const wire = String(sent(network)[0]?.init.body);
    for (const text of ['jane', 'Jane', 'Doe', '555', 'We need more cases', 'janedoelaw', 'abc']) {
      expect(wire).not.toContain(text);
    }
  });

  it('does not re-send a retried lead', async () => {
    const network = mockNetwork({ [GA4]: OK });
    const env = makeEnv(LIVE);
    await callWorker(lead({ conversion_id: 'lead-2' }), env);
    await callWorker(lead({ conversion_id: 'lead-2' }), env);
    expect(sent(network)).toHaveLength(1);
    expect(await count('leads')).toBe(1);
  });

  it('sends nothing without the secret', async () => {
    const network = mockNetwork();
    const response = await callWorker(lead(), makeEnv({ ...LIVE, GA4_API_SECRET: undefined }));
    expect(response.status).toBe(200);
    expect(sent(network)).toHaveLength(0);
  });

  it('sends nothing when not live (is_test)', async () => {
    const network = mockNetwork();
    await callWorker(lead(), makeEnv({ ...LIVE, LIVE: 'false' }));
    expect(sent(network)).toHaveLength(0);
  });

  it('sends nothing with the notrack cookie, and the lead is still saved', async () => {
    const network = mockNetwork();
    const response = await callWorker(lead({}, { cookie: 'lse_notrack=1' }), makeEnv(LIVE));
    expect(response.status).toBe(200);
    expect(sent(network)).toHaveLength(0);
    expect(await count('leads')).toBe(1);
  });

  it('sends nothing for a bot', async () => {
    const network = mockNetwork();
    await callWorker(lead({}, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }), makeEnv(LIVE));
    expect(sent(network)).toHaveLength(0);
  });

  it('keeps the lead and its answer when Google fails, and logs without the secret', async () => {
    const logs = captureLogs();
    const network = mockNetwork({ [GA4]: () => new Response('nope', { status: 503 }) });
    const response = await callWorker(lead(), makeEnv(LIVE));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(sent(network)).toHaveLength(2);
    expect(logs.errors.join('\n')).toContain('ga4_failed');
    expect(logs.all()).not.toContain('ga-test-secret');
    expect(await count('leads')).toBe(1);
  });

  it('does not leak the secret when fetch throws with the URL in the message', async () => {
    const logs = captureLogs();
    mockNetwork({
      [GA4]: () => {
        throw new TypeError(`failed to fetch ${GA4}`);
      },
    });
    const response = await callWorker(lead(), makeEnv(LIVE));
    expect(response.status).toBe(200);
    expect(logs.errors.join('\n')).toContain('ga4_failed');
    expect(logs.all()).not.toContain('ga-test-secret');
  });

  it('uses a fallback client ID and the UTM values when there is no _ga cookie', async () => {
    const network = mockNetwork({ [GA4]: OK });
    const request = jsonRequest('/api/lead', validLead({ utm_source: 'reddit', utm_medium: 'paid', utm_campaign: 'launch' }));
    await callWorker(request, makeEnv(LIVE));
    const payload = body(sent(network)[0]);
    expect(payload.client_id).toMatch(/^\d{10}\.\d{10}$/);
    expect(payload.events.map((event) => event.name)).toEqual(['campaign_details', 'generate_lead']);
    expect(payload.events[0]?.params).toMatchObject({ source: 'reddit', medium: 'paid', campaign: 'launch' });
    const session = Number(payload.events[1]?.params.session_id);
    expect(Math.abs(session - Date.now() / 1000)).toBeLessThan(30);
    expect(payload.events[0]?.params.session_id).toBe(session);
  });

  it('drops a source_form or UTM value that holds an @, free text or too much', async () => {
    const network = mockNetwork({ [GA4]: OK });
    const request = jsonRequest(
      '/api/lead',
      validLead({ source_form: 'jane@example.com', utm_source: 'x'.repeat(101), utm_medium: 'a<b>', utm_campaign: 'ok campaign-1' }),
    );
    await callWorker(request, makeEnv(LIVE));
    const payload = body(sent(network)[0]);
    const wire = JSON.stringify(payload);
    expect(wire).not.toContain('@');
    expect(wire).not.toContain('jane');
    expect(payload.events[0]?.params).toMatchObject({ campaign: 'ok campaign-1' });
    expect(payload.events[0]?.params).not.toHaveProperty('source');
    expect(payload.events[0]?.params).not.toHaveProperty('medium');
    expect(payload.events.at(-1)?.params).not.toHaveProperty('source_form');
  });

  it('rejects malformed IDs from the body and falls back', async () => {
    const network = mockNetwork({ [GA4]: OK });
    await callWorker(lead({ ga_client_id: '1.2; DROP', ga_session_id: 'abc' }), makeEnv(LIVE));
    const payload = body(sent(network)[0]);
    expect(payload.client_id).toMatch(/^\d{10}\.\d{10}$/);
    expect(payload.events[0]?.params.session_id).not.toBe(Number(SID));
  });

  it.each([`GS1.1.${SID}.2.1.1700000500.0.0.0`, `GS2.1.s${SID}$o2$g1$t1700000500$j0$l0$h0`])(
    'reads the IDs from the Cookie header when the body has none (%s)',
    async (session) => {
      const network = mockNetwork({ [GA4]: OK });
      const request = jsonRequest('/api/lead', validLead(), { cookie: `_ga=GA1.1.${CID}; _ga_V1J07CEE3T=${session}` });
      await callWorker(request, makeEnv(LIVE));
      const payload = body(sent(network)[0]);
      expect(payload.client_id).toBe(CID);
      expect(payload.events[0]?.params.session_id).toBe(Number(SID));
    },
  );
});

describe('/api/activity', () => {
  const signUp = (id = 'calendly-abc123') => ({ name: 'SignUp', conversion_id: id });

  it('sends schedule_call once, however often the same booking arrives', async () => {
    const network = mockNetwork({ [GA4]: OK });
    const env = makeEnv(LIVE);
    for (let i = 0; i < 3; i++) expect((await callWorker(activity([signUp()]), env)).status).toBe(204);
    expect(sent(network)).toHaveLength(1);
    expect(body(sent(network)[0]).events).toEqual([
      {
        name: 'schedule_call',
        params: {
          engagement_time_msec: 100,
          session_id: Number(SID),
          page_location: 'https://lawyerseoexpert.com/seo/',
          booking_id: 'calendly-abc123',
        },
      },
    ]);
  });

  it('sends the two stored events once per ID, and never page events', async () => {
    const network = mockNetwork({ [GA4]: OK });
    const env = makeEnv(LIVE);
    const items = [
      { name: 'BookingDialogOpened', conversion_id: 'd-1' },
      { name: 'ExitOfferShown', conversion_id: 'e-1' },
      { name: 'PageVisit', conversion_id: 'p-1' },
      { name: 'ViewContent', conversion_id: 'v-1' },
    ];
    await callWorker(activity(items), env);
    await callWorker(activity(items), env);
    const names = sent(network).flatMap((call) => body(call).events.map((event) => event.name));
    expect(names).toEqual(['booking_dialog_open', 'exit_offer_shown']);
  });

  it('sends nothing with no secret, notrack, a bot or when not live', async () => {
    const network = mockNetwork();
    await callWorker(activity([signUp('s1')]), makeEnv({ ...LIVE, GA4_API_SECRET: undefined }));
    await callWorker(activity([signUp('s2')], {}, { cookie: 'lse_notrack=1' }), makeEnv(LIVE));
    await callWorker(activity([signUp('s3')], {}, { 'user-agent': 'Lighthouse' }), makeEnv(LIVE));
    await callWorker(activity([signUp('s4')]), makeEnv({ ...LIVE, LIVE: 'false' }));
    expect(sent(network)).toHaveLength(0);
  });

  it('answers 204 and releases the claim when Google fails, so a later beacon can try again', async () => {
    let status = 503;
    const network = mockNetwork({ [GA4]: () => new Response(null, { status }) });
    const env = makeEnv(LIVE);
    expect((await callWorker(activity([signUp('s5')]), env)).status).toBe(204);
    expect(sent(network)).toHaveLength(2);
    expect(await count('ga4_sent')).toBe(0);
    expect(await count('events')).toBe(1);
    status = 204;
    await callWorker(activity([signUp('s5')]), env);
    expect(sent(network)).toHaveLength(3);
    expect(await count('ga4_sent')).toBe(1);
  });
});

describe('sendGa4Events directly', () => {
  it('sends nothing and does not throw when the table is missing', async () => {
    const logs = captureLogs();
    const network = mockNetwork();
    const db = {
      prepare: () => {
        throw new Error('no such table: ga4_sent');
      },
      batch: async () => [],
    } as unknown as D1Database;
    await sendGa4Events({ ...makeEnv(LIVE), DB: db }, [{ name: 'schedule_call', dedupeId: 'x', params: {} }], { clientId: CID });
    expect(sent(network)).toHaveLength(0);
    expect(logs.errors.join('\n')).toContain('ga4_failed');
  });

  it('makes a stable fallback client ID', async () => {
    expect(await fallbackClientId('abc')).toBe(await fallbackClientId('abc'));
    expect(await fallbackClientId('abc')).not.toBe(await fallbackClientId('abd'));
  });

  it('ignores a session ID that has no client ID of its own', async () => {
    const payload = await buildPayload([{ name: 'schedule_call', params: {} }], { sessionId: SID });
    expect(payload.events[0]?.params.session_id).not.toBe(Number(SID));
  });

  it('releases every earlier claim when a later one throws', async () => {
    mockNetwork();
    const env = makeEnv(LIVE);
    const real = env.DB;
    let claims = 0;
    const db = {
      prepare: (sql: string) => {
        if (sql.startsWith('INSERT OR IGNORE') && ++claims === 2) throw new Error('D1 hiccup');
        return real.prepare(sql);
      },
      batch: (statements: D1PreparedStatement[]) => real.batch(statements),
    } as unknown as D1Database;
    await sendGa4Events(
      { ...env, DB: db },
      [
        { name: 'schedule_call', dedupeId: 'c-1', params: {} },
        { name: 'schedule_call', dedupeId: 'c-2', params: {} },
      ],
      { clientId: CID },
    );
    expect(await count('ga4_sent')).toBe(0);
  });

  it('keeps the claim and does not retry after a timeout', async () => {
    const logs = captureLogs();
    const network = mockNetwork({
      [GA4]: () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
    });
    const env = makeEnv(LIVE);
    const item = [{ name: 'SignUp', conversion_id: 'slow-1' }];
    expect((await callWorker(activity(item), env)).status).toBe(204);
    await callWorker(activity(item), env);
    expect(sent(network)).toHaveLength(1);
    expect(await count('ga4_sent')).toBe(1);
    expect(logs.errors.join('\n')).toContain('ga4_failed');
  });

  it('retries once after a connection failure, then releases the claim', async () => {
    const network = mockNetwork({
      [GA4]: () => {
        throw new TypeError('Network connection lost.');
      },
    });
    await callWorker(activity([{ name: 'SignUp', conversion_id: 'down-1' }]), makeEnv(LIVE));
    expect(sent(network)).toHaveLength(2);
    expect(await count('ga4_sent')).toBe(0);
  });

  it('keeps pruning events when ga4_sent is missing', async () => {
    const env = makeEnv(LIVE);
    await env.DB.prepare("INSERT INTO events (ts, name, is_test) VALUES (1, 'PageVisit', 0)").run();
    const db = {
      prepare: (sql: string) => {
        if (sql.includes('ga4_sent')) throw new Error('no such table: ga4_sent');
        return env.DB.prepare(sql);
      },
    } as unknown as D1Database;
    await expect(eventsRetentionJob.run({ ...env, DB: db })).rejects.toThrow('ga4_sent');
    expect(await count('events')).toBe(0);
  });
});
