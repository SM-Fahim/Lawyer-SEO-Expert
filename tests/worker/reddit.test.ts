import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRedditEvent,
  redditEnabled,
  sendRedditEvents,
  type RedditEventInput,
} from '../../worker/reddit';
import {
  captureLogs,
  makeEnv,
  mockNetwork,
  REDDIT,
  redditBody,
  type CapturedLogs,
} from './helpers';

const HASH = 'a'.repeat(64);
const FULL: RedditEventInput = {
  name: 'Lead',
  conversionId: 'conv-1',
  eventAt: 1_700_000_000_000,
  clickId: 'click-1',
  sourceUrl: 'https://lawyerseoexpert.com/',
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0',
  uuid: 'uuid-1',
  screen: { width: 390, height: 844 },
  emailHash: HASH,
  phoneHash: HASH,
};

describe('buildRedditEvent', () => {
  it('builds exactly the plan payload', () => {
    expect(buildRedditEvent(FULL)).toEqual({
      event_at: 1_700_000_000_000,
      action_source: 'WEBSITE',
      type: { tracking_type: 'LEAD' },
      click_id: 'click-1',
      event_source_url: 'https://lawyerseoexpert.com/',
      user: {
        ip_address: '203.0.113.7',
        user_agent: 'Mozilla/5.0',
        uuid: 'uuid-1',
        screen_dimensions: { width: 390, height: 844 },
        email: HASH,
        phone_number: HASH,
      },
      metadata: { conversion_id: 'conv-1' },
    });
  });

  it.each([
    ['PageVisit', 'PAGE_VISIT'],
    ['ViewContent', 'VIEW_CONTENT'],
    ['Lead', 'LEAD'],
    ['SignUp', 'SIGN_UP'],
  ] as const)('maps %s to %s', (name, tracking) => {
    expect(buildRedditEvent({ ...FULL, name }).type).toEqual({ tracking_type: tracking });
  });

  it('omits every optional field that is absent, with no nulls or empty strings', () => {
    const event = buildRedditEvent({
      name: 'PageVisit',
      conversionId: 'c',
      eventAt: 1,
      clickId: undefined,
      ip: null,
      userAgent: '',
    });
    expect(event).toEqual({
      event_at: 1,
      action_source: 'WEBSITE',
      type: { tracking_type: 'PAGE_VISIT' },
      user: {},
      metadata: { conversion_id: 'c' },
    });
  });

  it('lets no unknown field through, because the schema answers 400 to one', () => {
    const noisy = {
      ...FULL,
      phone: '555',
      screen_width: 390,
      external_id: 'x',
      custom: { a: 1 },
      screen: { width: 1, height: 2, depth: 24 },
    } as RedditEventInput;
    const event = buildRedditEvent(noisy);
    expect(Object.keys(event).sort()).toEqual(
      ['action_source', 'click_id', 'event_at', 'event_source_url', 'metadata', 'type', 'user'].sort(),
    );
    expect(Object.keys(event.user).sort()).toEqual(
      ['email', 'ip_address', 'phone_number', 'screen_dimensions', 'user_agent', 'uuid'].sort(),
    );
    expect(event.user.screen_dimensions).toEqual({ width: 1, height: 2 });
    expect(Object.keys(event.metadata)).toEqual(['conversion_id']);
  });

  it('sends value and currency together', () => {
    const { metadata } = buildRedditEvent({ ...FULL, value: 150, currency: 'usd' });
    expect(metadata).toEqual({ conversion_id: 'conv-1', value: 150, currency: 'USD' });
  });

  it.each([
    ['value only', { value: 150 }],
    ['currency only', { currency: 'USD' }],
    ['value not a number', { value: '150', currency: 'USD' }],
    ['value not finite', { value: Number.POSITIVE_INFINITY, currency: 'USD' }],
    ['negative value', { value: -1, currency: 'USD' }],
    ['bad currency', { value: 150, currency: 'dollars' }],
  ])('sends neither with %s', (_label, extra) => {
    expect(buildRedditEvent({ ...FULL, ...extra }).metadata).toEqual({ conversion_id: 'conv-1' });
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

  const events = [
    buildRedditEvent({ ...FULL, conversionId: 'a' }),
    buildRedditEvent({ ...FULL, conversionId: 'b' }),
  ];

  it('sends the plan headers and a live batch in one request', async () => {
    const network = mockNetwork();
    await sendRedditEvents(makeEnv({ LIVE: 'true' }), events);

    expect(network.calls).toHaveLength(1);
    const call = network.to(REDDIT)[0];
    expect(call?.init.method).toBe('POST');
    expect(call?.init.headers).toEqual({
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
      'user-agent': 'cloudflare-worker:lawyerseoexpert-site.lawyerseoexpert.com:v1',
    });
    const body = redditBody(call);
    expect(Object.keys(body.data)).toEqual(['events']);
    expect(body.data.events).toHaveLength(2);
  });

  it('in test mode sends one event per request, each with test_id', async () => {
    const network = mockNetwork();
    await sendRedditEvents(makeEnv({ REDDIT_TEST_ID: 't2_test' }), events);

    expect(network.calls).toHaveLength(2);
    for (const call of network.calls) {
      const body = redditBody(call);
      expect(body.data.test_id).toBe('t2_test');
      expect(body.data.events).toHaveLength(1);
    }
  });

  it('once live ignores a test ID left set by mistake, so conversions stay real', async () => {
    const network = mockNetwork();
    await sendRedditEvents(makeEnv({ LIVE: 'true', REDDIT_TEST_ID: 't2_test' }), events);
    expect(network.calls).toHaveLength(1);
    expect(redditBody(network.calls[0]).data).not.toHaveProperty('test_id');
  });

  it('logs when live with no token, because conversions would vanish silently', async () => {
    const network = mockNetwork();
    await sendRedditEvents(makeEnv({ LIVE: 'true', REDDIT_CAPI_TOKEN: undefined }), events);
    expect(network.calls).toHaveLength(0);
    expect(logs.errors.join()).toContain('reddit_not_configured');
  });

  it.each([429, 500, 503])('retries once on %i', async (status) => {
    let tries = 0;
    const network = mockNetwork({
      [REDDIT]: () => new Response('busy', { status: ++tries === 1 ? status : 200 }),
    });
    await sendRedditEvents(makeEnv({ LIVE: 'true' }), events);
    expect(network.calls).toHaveLength(2);
    expect(logs.errors).toHaveLength(0);
  });

  it('gives up after one retry and logs it', async () => {
    const network = mockNetwork({ [REDDIT]: () => new Response('down', { status: 500 }) });
    await sendRedditEvents(makeEnv({ LIVE: 'true' }), events);
    expect(network.calls).toHaveLength(2);
    expect(logs.errors).toHaveLength(1);
  });

  it('does not retry a 400, because the same payload would fail again', async () => {
    const network = mockNetwork({ [REDDIT]: () => new Response('unknown field', { status: 400 }) });
    await sendRedditEvents(makeEnv({ LIVE: 'true' }), events);
    expect(network.calls).toHaveLength(1);
  });

  it('retries once on a network error, and never throws', async () => {
    const network = mockNetwork({
      [REDDIT]: () => {
        throw new Error('connection reset');
      },
    });
    await expect(sendRedditEvents(makeEnv({ LIVE: 'true' }), events)).resolves.toBeUndefined();
    expect(network.calls).toHaveLength(2);
  });

  it('never logs contact details, even when Reddit echoes them', async () => {
    const echo = `bad jane@example.com ${HASH} 203.0.113.7 +15554441234`;
    mockNetwork({ [REDDIT]: () => new Response(echo, { status: 400 }) });
    await sendRedditEvents(makeEnv({ LIVE: 'true' }), events);

    const logged = logs.all();
    expect(logged).toContain('reddit_failed');
    for (const secret of ['jane@example.com', HASH, '203.0.113.7', '15554441234', 'test-token']) {
      expect(logged).not.toContain(secret);
    }
  });
});

describe('when Reddit is switched on', () => {
  it.each([
    ['production', { LIVE: 'true' }, true],
    ['pre-launch with a test ID', { REDDIT_TEST_ID: 't2' }, true],
    ['pre-launch without a test ID', {}, false],
    ['no token', { LIVE: 'true', REDDIT_CAPI_TOKEN: undefined }, false],
    ['a Preview with a blank pixel', { REDDIT_PIXEL_ID: '', REDDIT_TEST_ID: 't2' }, false],
  ])('%s: %s', (_label, overrides, expected) => {
    expect(redditEnabled(makeEnv(overrides))).toBe(expected);
  });

  it('sends nothing when off', async () => {
    const network = mockNetwork();
    await sendRedditEvents(makeEnv(), [buildRedditEvent(FULL)]);
    expect(network.calls).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
