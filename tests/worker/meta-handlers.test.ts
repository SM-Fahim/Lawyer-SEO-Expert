import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../worker/matchkeys';
import {
  callWorker,
  captureLogs,
  clearTables,
  count,
  db,
  GA4,
  jsonRequest,
  makeEnv,
  META,
  META_ON,
  metaBody,
  mockNetwork,
  REDDIT,
  redditBody,
  validLead,
  VISITOR_IP,
  type NetworkMock,
} from './helpers';

// Meta through /api/activity and /api/lead, and proof that turning Meta on changes nothing that
// goes to Reddit or GA4.

const EVENTS = '/api/activity';
const LEAD = '/api/lead';
const HASH = 'c'.repeat(64);
const VID = 'd'.repeat(64);
const FBP = 'fb.1.1700000000000.1234567890';
const FBC = 'fb.1.1700000000000.IwAR-click';
const GA = { GA4_API_SECRET: 'ga-test-secret', GA4_MEASUREMENT_ID: 'G-V1J07CEE3T' };
const LIVE_ALL = { LIVE: 'true', ...GA, ...META_ON };
const GA_FIELDS = { ga_client_id: '1234567890.1700000000', ga_session_id: '1700000123' };
const META_FIELDS = {
  fbp: FBP,
  fbc: FBC,
  external_id: VID,
  fb_em: HASH,
  fb_ph: HASH,
  fb_fn: HASH,
  fb_ln: HASH,
};

function activity(events: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    page: 'https://lawyerseoexpert.com/seo/?rdt_cid=abc&fbclid=drop',
    click_id: 'abc',
    uuid: '1677712978045.uuid',
    screen_width: 1920,
    screen_height: 1080,
    utm_source: 'reddit',
    utm_campaign: 'launch',
    email_hash: 'b'.repeat(64),
    ...GA_FIELDS,
    events,
    ...extra,
  };
}

const event = (name: string, id: string = crypto.randomUUID()) => ({ name, conversion_id: id });
const metaEvents = (network: NetworkMock) => network.to(META).flatMap((call) => metaBody(call).data);

beforeEach(async () => {
  await clearTables();
  captureLogs();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Meta from /api/activity', () => {
  it('sends PageView with the Pixel\'s ID, the IDs and the hashes, in parallel with Reddit', async () => {
    const network = mockNetwork({ [GA4]: () => new Response(null, { status: 204 }) });
    const id = crypto.randomUUID();
    await callWorker(jsonRequest(EVENTS, activity([event('PageVisit', id)], META_FIELDS)), makeEnv(LIVE_ALL));

    const [call] = network.to(META);
    const body = metaBody(call);
    expect(body).not.toHaveProperty('test_event_code');
    expect(body.data).toEqual([
      {
        event_name: 'PageView',
        event_time: expect.any(Number),
        event_id: id,
        action_source: 'website',
        event_source_url: 'https://lawyerseoexpert.com/seo/?rdt_cid=abc',
        user_data: {
          client_ip_address: VISITOR_IP,
          client_user_agent: 'Mozilla/5.0 (test browser)',
          fbp: FBP,
          fbc: FBC,
          em: [HASH],
          ph: [HASH],
          fn: [HASH],
          ln: [HASH],
          external_id: [VID],
        },
      },
    ]);
    expect(redditBody(network.to(REDDIT)[0]).data.events[0]?.metadata.conversion_id).toBe(id);
  });

  it('sends the page type as content_category on ViewContent only, and drops anything but the five values', async () => {
    const network = mockNetwork();
    const env = makeEnv({ LIVE: 'true', ...META_ON });
    await callWorker(
      jsonRequest(EVENTS, activity([event('PageVisit', 'pv-1'), event('ViewContent', 'vc-1')], { content_category: 'booking' })),
      env,
    );
    await callWorker(jsonRequest(EVENTS, activity([event('ViewContent', 'vc-2')], { content_category: 'home' })), env);
    const [visit, view, unknown] = metaEvents(network);
    expect(visit).not.toHaveProperty('custom_data');
    expect(view?.custom_data).toEqual({ content_category: 'booking' });
    expect(unknown?.event_id).toBe('vc-2');
    expect(unknown).not.toHaveProperty('custom_data');
  });

  it('maps every event, sends BookingDialogOpened server only, and leaves ExitOfferShown out', async () => {
    const network = mockNetwork({ [GA4]: () => new Response(null, { status: 204 }) });
    const ids = { visit: 'v-1', view: 'v-2', signup: 'calendly-abc123', dialog: 'd-1', exit: 'e-1' };
    await callWorker(
      jsonRequest(
        EVENTS,
        activity([
          event('PageVisit', ids.visit),
          event('ViewContent', ids.view),
          event('SignUp', ids.signup),
          event('BookingDialogOpened', ids.dialog),
          event('ExitOfferShown', ids.exit),
          event('Lead', 'l-1'),
        ]),
      ),
      makeEnv(LIVE_ALL),
    );
    expect(metaEvents(network).map((e) => [e.event_name, e.event_id])).toEqual([
      ['PageView', ids.visit],
      ['ViewContent', ids.view],
      ['Schedule', ids.signup],
      ['BookingDialogOpened', ids.dialog],
    ]);
    expect(network.to(META)).toHaveLength(1);
  });

  it('needs the conversion ID, like Reddit', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(EVENTS, activity([{ name: 'PageVisit' }])), makeEnv({ LIVE: 'true', ...META_ON }));
    expect(network.to(META)).toHaveLength(0);
  });

  it('prefers the _fbp and _fbc cookies over the body, and drops malformed ones', async () => {
    const network = mockNetwork();
    const cookieFbp = 'fb.1.1700000000001.555';
    await callWorker(
      jsonRequest(EVENTS, activity([event('PageVisit')], { fbp: FBP, fbc: 'IwAR-raw', fb_em: 'jane@example.com', external_id: 'x' }), {
        cookie: `_fbp=${cookieFbp}; _fbc=junk`,
      }),
      makeEnv({ LIVE: 'true', ...META_ON }),
    );
    const [sent] = metaEvents(network);
    expect(sent?.user_data.fbp).toBe(cookieFbp);
    expect(sent?.user_data).not.toHaveProperty('fbc');
    expect(sent?.user_data).not.toHaveProperty('em');
    expect(sent?.user_data).not.toHaveProperty('external_id');
  });

  it('carries meta_test as test_event_code, even before launch', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(EVENTS, activity([event('PageVisit')], { meta_test: 'TEST12345' })), makeEnv({ ...META_ON }));
    expect(metaBody(network.to(META)[0]).test_event_code).toBe('TEST12345');
    // Reddit isn't turned on by Meta's test code.
    expect(network.to(REDDIT)).toHaveLength(0);
  });

  it('ignores a malformed test code', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(EVENTS, activity([event('PageVisit')], { meta_test: 'nope' })), makeEnv({ ...META_ON }));
    expect(network.to(META)).toHaveLength(0);
  });

  // A test code is sent in each case where it can't turn Meta on, to prove it doesn't.
  it.each([
    ['the pixel ID is empty', { LIVE: 'true', ...META_ON, META_PIXEL_ID: '' }, { meta_test: 'TEST1' }, {}],
    ['there is no token', { LIVE: 'true', ...META_ON, META_CAPI_TOKEN: '' }, { meta_test: 'TEST1' }, {}],
    ['it is not live and has no test code', { ...META_ON }, {}, {}],
    ['the notrack cookie is set', { LIVE: 'true', ...META_ON }, { meta_test: 'TEST1' }, { cookie: 'lse_notrack=1' }],
    ['it is a bot', { LIVE: 'true', ...META_ON }, { meta_test: 'TEST1' }, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }],
  ])('sends nothing to Meta when %s', async (_label, env, extra, headers) => {
    const network = mockNetwork();
    await callWorker(jsonRequest(EVENTS, activity([event('PageVisit')], extra), headers), makeEnv(env));
    expect(network.to(META)).toHaveLength(0);
  });

  it('a Meta outage does not stop Reddit, GA4 or the D1 row', async () => {
    const network = mockNetwork({
      [META]: () => {
        throw new Error('Meta is down');
      },
      [GA4]: () => new Response(null, { status: 204 }),
    });
    await callWorker(jsonRequest(EVENTS, activity([event('SignUp', 'calendly-xyz789')])), makeEnv(LIVE_ALL));
    expect(network.to(META)).toHaveLength(2);
    expect(network.to(REDDIT)).toHaveLength(1);
    expect(network.to(GA4)).toHaveLength(1);
    expect(await count('events')).toBe(1);
  });

  it('a Reddit and GA4 outage does not stop Meta', async () => {
    const network = mockNetwork({
      [REDDIT]: () => {
        throw new Error('Reddit is down');
      },
      [GA4]: () => {
        throw new Error('Google is down');
      },
    });
    await callWorker(jsonRequest(EVENTS, activity([event('SignUp', 'calendly-xyz790')])), makeEnv(LIVE_ALL));
    expect(metaEvents(network).map((e) => e.event_name)).toEqual(['Schedule']);
  });
});

describe('the Meta Lead', () => {
  it('hashes the raw lead with Meta\'s rules and shares the conversion ID', async () => {
    const network = mockNetwork();
    const id = crypto.randomUUID();
    await callWorker(
      jsonRequest(LEAD, validLead({ conversion_id: id, fbp: FBP, fbc: FBC, external_id: VID, fb_em: HASH }), {
        cookie: 'a=b',
      }),
      makeEnv({ LIVE: 'true', ...META_ON }),
    );
    const [sent] = metaEvents(network);
    expect(sent).toEqual({
      event_name: 'Lead',
      event_time: expect.any(Number),
      event_id: id,
      action_source: 'website',
      event_source_url: 'https://lawyerseoexpert.com/?rdt_cid=abc&utm_source=reddit',
      user_data: {
        client_ip_address: VISITOR_IP,
        client_user_agent: 'Mozilla/5.0 (test browser)',
        fbp: FBP,
        fbc: FBC,
        // From the raw fields, not the browser's fb_em.
        em: [await sha256Hex('jane.doe+site@example.com')],
        ph: [await sha256Hex('15554441234')],
        fn: [await sha256Hex('jane')],
        ln: [await sha256Hex('doe')],
        external_id: [VID],
      },
    });
  });

  it('keeps the Meta fields out of extra_json, so they never reach the lead email', async () => {
    mockNetwork();
    await callWorker(
      jsonRequest(LEAD, validLead({ ...META_FIELDS, meta_test: 'TEST1', focus_area: 'SEO' })),
      makeEnv({ LIVE: 'true', ...META_ON }),
    );
    const row = await db.prepare('SELECT extra_json FROM leads').first<{ extra_json: string }>();
    expect(JSON.parse(String(row?.extra_json))).toEqual({ focus_area: 'SEO' });
  });

  it('carries meta_test as test_event_code, even before launch', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead({ meta_test: 'TEST777' })), makeEnv({ ...META_ON }));
    expect(metaBody(network.to(META)[0]).test_event_code).toBe('TEST777');
  });

  it('sends nothing with the notrack cookie, and the lead is still saved', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead(), { cookie: 'lse_notrack=1' }), makeEnv({ LIVE: 'true', ...META_ON }));
    expect(network.to(META)).toHaveLength(0);
    expect(await count('leads')).toBe(1);
  });

  it('sends nothing when the pixel ID is empty or it is not live', async () => {
    const network = mockNetwork();
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv({ LIVE: 'true', ...META_ON, META_PIXEL_ID: '' }));
    await callWorker(jsonRequest(LEAD, validLead()), makeEnv({ ...META_ON }));
    expect(network.to(META)).toHaveLength(0);
    expect(await count('leads')).toBe(2);
  });

  it('a Meta outage does not affect the response, the email or Reddit', async () => {
    const network = mockNetwork({ [META]: () => new Response('down', { status: 500 }) });
    const env = makeEnv({ LIVE: 'true', ...META_ON });
    const response = await callWorker(jsonRequest(LEAD, validLead()), env);
    expect(response.status).toBe(200);
    expect(network.to(META)).toHaveLength(2);
    expect(network.to(REDDIT)).toHaveLength(1);
    expect(env.EMAIL.send).toHaveBeenCalled();
  });
});

describe('Reddit and GA4 are unchanged when Meta is on', () => {
  const NOW = new Date('2026-11-07T12:00:00Z');

  async function capture(
    send: () => Promise<unknown>,
  ): Promise<{ reddit: string[]; ga4: string[]; meta: number; metaBodies: string[] }> {
    await clearTables();
    const network = mockNetwork({ [GA4]: () => new Response(null, { status: 204 }) });
    await send();
    const result = {
      reddit: network.to(REDDIT).map((call) => String(call.init.body)),
      ga4: network.to(GA4).map((call) => `${call.url} ${String(call.init.body)}`),
      meta: network.to(META).length,
      metaBodies: network.to(META).map((call) => String(call.init.body)),
    };
    vi.restoreAllMocks();
    return result;
  }

  it('/api/activity sends the same bytes to Reddit and GA4', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const events = [
      event('PageVisit', 'p-1'),
      event('ViewContent', 'v-1'),
      event('SignUp', 'calendly-same1'),
      event('BookingDialogOpened', 'd-1'),
    ];
    const off = await capture(() =>
      callWorker(jsonRequest(EVENTS, activity(events)), makeEnv({ LIVE: 'true', ...GA })),
    );
    const on = await capture(() =>
      callWorker(
        jsonRequest(EVENTS, activity(events, { ...META_FIELDS, meta_test: 'TEST1', content_category: 'pricing' }), {
          cookie: `_fbp=${FBP}`,
        }),
        makeEnv(LIVE_ALL),
      ),
    );
    expect(off.meta).toBe(0);
    expect(on.meta).toBe(1);
    expect(on.metaBodies[0]).toContain('"custom_data":{"content_category":"pricing"}');
    expect(off.reddit).toHaveLength(1);
    expect(off.ga4).toHaveLength(1);
    expect(off.reddit[0]).not.toContain('content_category');
    expect(off.ga4[0]).not.toContain('content_category');
    expect(off.ga4[0]).toContain('schedule_call');
    expect(off.ga4[0]).toContain('booking_dialog_open');
    expect(on.reddit).toEqual(off.reddit);
    expect(on.ga4).toEqual(off.ga4);
  });

  it('/api/lead sends the same bytes to Reddit and GA4', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const lead = validLead({ conversion_id: 'lead-same-1', source_form: 'Hero form', ...GA_FIELDS });
    const off = await capture(() => callWorker(jsonRequest(LEAD, lead), makeEnv({ LIVE: 'true', ...GA })));
    const on = await capture(() =>
      callWorker(
        jsonRequest(LEAD, { ...lead, ...META_FIELDS, meta_test: 'TEST1' }, { cookie: `_fbp=${FBP}` }),
        makeEnv(LIVE_ALL),
      ),
    );
    expect(off.meta).toBe(0);
    expect(on.meta).toBe(1);
    expect(off.reddit).toHaveLength(1);
    expect(off.ga4).toHaveLength(1);
    expect(on.reddit).toEqual(off.reddit);
    expect(on.ga4).toEqual(off.ga4);
  });
});
