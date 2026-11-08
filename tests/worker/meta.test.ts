import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMetaEvent,
  fbCookieOf,
  GRAPH_VERSION,
  META_EVENTS,
  metaEnabled,
  metaTestCodeOf,
  sendMetaEvents,
  type MetaEventInput,
} from '../../worker/meta';
import {
  captureLogs,
  makeEnv,
  META,
  META_ON,
  META_TOKEN,
  metaBody,
  mockNetwork,
  type CapturedLogs,
} from './helpers';

const HASH = 'a'.repeat(64);
const FBP = 'fb.1.1700000000000.1234567890';
const FBC = 'fb.1.1700000000000.IwAR-click_id.1';
const FULL: MetaEventInput = {
  name: 'Lead',
  eventId: 'conv-1',
  eventAt: 1_700_000_000_999,
  sourceUrl: 'https://lawyerseoexpert.com/',
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0',
  fbp: FBP,
  fbc: FBC,
  externalId: HASH,
  emailHash: HASH,
  phoneHash: HASH,
  firstNameHash: HASH,
  lastNameHash: HASH,
};

describe('buildMetaEvent', () => {
  it('builds exactly the documented payload, with seconds and arrays', () => {
    expect(buildMetaEvent(FULL)).toEqual({
      event_name: 'Lead',
      event_time: 1_700_000_000,
      event_id: 'conv-1',
      action_source: 'website',
      event_source_url: 'https://lawyerseoexpert.com/',
      user_data: {
        client_ip_address: '203.0.113.7',
        client_user_agent: 'Mozilla/5.0',
        fbp: FBP,
        fbc: FBC,
        em: [HASH],
        ph: [HASH],
        fn: [HASH],
        ln: [HASH],
        external_id: [HASH],
      },
    });
  });

  it('omits every optional field that is absent', () => {
    expect(buildMetaEvent({ name: 'PageView', eventId: 'c', eventAt: 5000, ip: null, userAgent: '' })).toEqual({
      event_name: 'PageView',
      event_time: 5,
      event_id: 'c',
      action_source: 'website',
      user_data: {},
    });
  });

  it('adds custom_data.content_category to ViewContent only, and only one of the five values', () => {
    expect(buildMetaEvent({ ...FULL, name: 'ViewContent', contentCategory: 'pricing' }).custom_data).toEqual({
      content_category: 'pricing',
    });
    expect(buildMetaEvent({ ...FULL, name: 'PageView', contentCategory: 'pricing' })).not.toHaveProperty('custom_data');
    expect(buildMetaEvent({ ...FULL, name: 'Lead', contentCategory: 'blog' })).not.toHaveProperty('custom_data');
    for (const bad of ['Pricing', 'home', 'jane@example.com', '', undefined]) {
      expect(buildMetaEvent({ ...FULL, name: 'ViewContent', contentCategory: bad })).not.toHaveProperty('custom_data');
    }
    const noisy = { ...FULL, name: 'ViewContent', contentCategory: 'service', custom_data: { value: 9 } } as MetaEventInput;
    expect(buildMetaEvent(noisy).custom_data).toEqual({ content_category: 'service' });
  });

  it('lets no unknown field through', () => {
    const noisy = { ...FULL, email: 'a@b.co', phone: '555', custom: 1, value: 10 } as MetaEventInput;
    const event = buildMetaEvent(noisy);
    expect(Object.keys(event).sort()).toEqual(
      ['action_source', 'event_id', 'event_name', 'event_source_url', 'event_time', 'user_data'].sort(),
    );
    expect(Object.keys(event.user_data).sort()).toEqual(
      ['client_ip_address', 'client_user_agent', 'em', 'external_id', 'fbc', 'fbp', 'fn', 'ln', 'ph'].sort(),
    );
  });

  it('drops a hash that is not 64 lowercase hex, and a malformed fbp or fbc', () => {
    const event = buildMetaEvent({
      ...FULL,
      emailHash: 'jane@example.com',
      phoneHash: HASH.toUpperCase(),
      externalId: 'abc',
      fbp: 'fb.9.1.x',
      fbc: 'IwAR-raw-fbclid',
    });
    expect(event.user_data).toEqual({
      client_ip_address: '203.0.113.7',
      client_user_agent: 'Mozilla/5.0',
      fn: [HASH],
      ln: [HASH],
    });
  });

  it('maps our names to Meta\'s, with Lead and ExitOfferShown not mapped', () => {
    expect(Object.fromEntries(META_EVENTS)).toEqual({
      PageVisit: 'PageView',
      ViewContent: 'ViewContent',
      SignUp: 'Schedule',
      BookingDialogOpened: 'BookingDialogOpened',
    });
    expect(META_EVENTS.get('constructor')).toBeUndefined();
  });
});

describe('metaEnabled and inputs', () => {
  it('needs the token and the pixel ID, then LIVE or a test code', () => {
    expect(metaEnabled(makeEnv({ ...META_ON, LIVE: 'true' }))).toBe(true);
    expect(metaEnabled(makeEnv({ ...META_ON }))).toBe(false);
    expect(metaEnabled(makeEnv({ ...META_ON }), 'TEST1')).toBe(true);
    expect(metaEnabled(makeEnv({ ...META_ON, META_PIXEL_ID: '', LIVE: 'true' }), 'TEST1')).toBe(false);
    expect(metaEnabled(makeEnv({ ...META_ON, META_CAPI_TOKEN: undefined, LIVE: 'true' }), 'TEST1')).toBe(false);
  });

  it('accepts only a well-formed test code', () => {
    expect(metaTestCodeOf('TEST12345')).toBe('TEST12345');
    expect(metaTestCodeOf('TEST<x>')).toBeUndefined();
    expect(metaTestCodeOf(12345)).toBeUndefined();
  });

  it('prefers the cookie, falls back to the body, and checks both', () => {
    const withCookie = new Request('https://lawyerseoexpert.com/', {
      headers: { cookie: `a=b; _fbp=${FBP}; _fbc=${FBC}` },
    });
    expect(fbCookieOf(withCookie, '_fbp', 'fb.1.1700000000001.999')).toBe(FBP);
    expect(fbCookieOf(withCookie, '_fbc', 'fb.1.1700000000001.999')).toBe(FBC);
    const badCookie = new Request('https://lawyerseoexpert.com/', { headers: { cookie: '_fbp=junk' } });
    expect(fbCookieOf(badCookie, '_fbp', 'fb.1.1700000000001.999')).toBe('fb.1.1700000000001.999');
    expect(fbCookieOf(badCookie, '_fbp', 'junk')).toBeUndefined();
    expect(fbCookieOf(badCookie, '_fbc', undefined)).toBeUndefined();
  });
});

describe('sending', () => {
  let logs: CapturedLogs;
  beforeEach(() => {
    logs = captureLogs();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const event = buildMetaEvent(FULL);

  it('posts JSON to the versioned endpoint, with the token in the body only', async () => {
    const network = mockNetwork();
    await sendMetaEvents(makeEnv({ ...META_ON, LIVE: 'true' }), [event, event]);
    const [call] = network.to(META);
    expect(call?.url).toBe(`https://graph.facebook.com/${GRAPH_VERSION}/1111222233334444/events`);
    expect(call?.url).not.toContain(META_TOKEN);
    expect(call?.init.method).toBe('POST');
    expect(new Headers(call?.init.headers).get('content-type')).toBe('application/json');
    expect(metaBody(call)).toEqual({ data: [event, event], access_token: META_TOKEN });
  });

  it('adds test_event_code when given, live or not', async () => {
    const network = mockNetwork();
    await sendMetaEvents(makeEnv({ ...META_ON }), [event], 'TEST12345');
    await sendMetaEvents(makeEnv({ ...META_ON, LIVE: 'true' }), [event], 'TEST999');
    expect(network.to(META).map((call) => metaBody(call).test_event_code)).toEqual(['TEST12345', 'TEST999']);
    expect(logs.infos.join('\n')).toContain('meta_test_sent');
  });

  it.each([
    ['no pixel ID', { ...META_ON, META_PIXEL_ID: '', LIVE: 'true' }],
    ['no token', { ...META_ON, META_CAPI_TOKEN: '', LIVE: 'true' }],
    ['not live and no test code', { ...META_ON }],
  ])('sends nothing with %s', async (_label, overrides) => {
    const network = mockNetwork();
    await sendMetaEvents(makeEnv(overrides), [event]);
    expect(network.calls).toHaveLength(0);
  });

  it('sends nothing for an empty list', async () => {
    const network = mockNetwork();
    await sendMetaEvents(makeEnv({ ...META_ON, LIVE: 'true' }), []);
    expect(network.calls).toHaveLength(0);
  });

  it('retries once on a 5xx, then logs meta_failed without the token', async () => {
    const network = mockNetwork({
      [META]: () => new Response(`bad token ${META_TOKEN} for jane@example.com`, { status: 503 }),
    });
    await sendMetaEvents(makeEnv({ ...META_ON, LIVE: 'true' }), [event]);
    expect(network.to(META)).toHaveLength(2);
    const all = logs.all();
    expect(all).toContain('meta_failed');
    expect(all).not.toContain(META_TOKEN);
    expect(all).not.toContain('jane@example.com');
  });

  it('retries once on a network failure, and never throws', async () => {
    const network = mockNetwork({
      [META]: () => {
        throw new Error('connection reset');
      },
    });
    await expect(sendMetaEvents(makeEnv({ ...META_ON, LIVE: 'true' }), [event])).resolves.toBeUndefined();
    expect(network.to(META)).toHaveLength(2);
    expect(logs.errors.join('\n')).toContain('meta_failed');
  });

  it('does not retry a 400', async () => {
    const network = mockNetwork({ [META]: () => Response.json({ error: { message: 'Invalid parameter' } }, { status: 400 }) });
    await sendMetaEvents(makeEnv({ ...META_ON, LIVE: 'true' }), [event]);
    expect(network.to(META)).toHaveLength(1);
    expect(logs.errors.join('\n')).toContain('Invalid parameter');
  });
});
