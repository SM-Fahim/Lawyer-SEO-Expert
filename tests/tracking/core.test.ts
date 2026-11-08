import { describe, expect, it } from 'vitest';
import {
  BOT_RE,
  calendlyConversionId,
  cleanKeys,
  CLICK_STORE,
  isProductionHost,
  matchKeysOf,
  newConversionId,
  rawQueryParam,
  externalReferrer,
  rememberClickId,
  rememberTouch,
  rememberUtm,
  storeGet,
  storeSet,
  trackingAllowed,
  UTM_STORE,
  type StoreLike,
} from '../../src/features/tracking/core';
import { hasNoTrackCookie } from '../../worker/notrack';
import { BOT_RE as SERVER_BOT_RE } from '../../worker/security';

// The same vectors the live WordPress plugin passes, so a stored rct_mk means the same thing on both.
const EMAIL_HASH = 'ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976';
const PHONE_HASH = 'e5b124c58580eb16bd959b8d0cac12b12c952e2ceae0203d416cff94f10b994a';

const DAY = 864e5;
const NOW = 1_800_000_000_000;
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

function memoryStore(initial: Record<string, string> = {}): StoreLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('match keys', () => {
  it.each([
    ['alice@example.com', EMAIL_HASH],
    ['Al.ice+Apple@Example.Com', EMAIL_HASH],
    ['  ALICE@EXAMPLE.COM ', EMAIL_HASH],
  ])('hashes email %j as the plugin does', async (email, hash) => {
    expect(await matchKeysOf({ email })).toEqual({ email: hash });
  });

  it.each([
    ['(555) 444-1234', PHONE_HASH],
    ['1 555 444 1234', PHONE_HASH],
    ['+1 (555) 444-1234', PHONE_HASH],
    ['555-444-1234 ext 99', PHONE_HASH],
  ])('hashes phone %j as the plugin does', async (phone, hash) => {
    expect(await matchKeysOf({ phone })).toEqual({ phoneNumber: hash });
  });

  it('leaves out what is empty or not valid', async () => {
    expect(await matchKeysOf({ email: 'not-an-email', phone: '' })).toEqual({});
    expect(await matchKeysOf({})).toEqual({});
  });

  it('only keeps well-formed hashes from storage', () => {
    expect(cleanKeys({ email: EMAIL_HASH, phoneNumber: 'alice@example.com', externalId: EMAIL_HASH })).toEqual({ email: EMAIL_HASH });
    expect(cleanKeys(null)).toEqual({});
    expect(cleanKeys('x')).toEqual({});
    expect(cleanKeys({ email: EMAIL_HASH.toUpperCase() })).toEqual({});
  });
});

describe('who gets tracked', () => {
  const page = { userAgent: CHROME, host: 'lawyerseoexpert.com', search: '', cookie: '' };

  it('uses the same bot pattern as the server', () => {
    expect(BOT_RE.source).toBe(SERVER_BOT_RE.source);
    expect(BOT_RE.flags).toBe(SERVER_BOT_RE.flags);
  });

  it('tracks a real visitor on production', () => {
    expect(trackingAllowed(page)).toBe(true);
    expect(trackingAllowed({ ...page, host: 'www.lawyerseoexpert.com' })).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/141.0 Safari/537.36',
    'facebookexternalhit/1.1',
    'Chrome-Lighthouse',
  ])('skips %s', (userAgent) => {
    expect(trackingAllowed({ ...page, userAgent })).toBe(false);
    expect(trackingAllowed({ ...page, userAgent, search: '?pixeltest=1' })).toBe(false);
  });

  it('only counts exact production hosts', () => {
    expect(isProductionHost('LawyerSEOExpert.com')).toBe(true);
    for (const host of ['next.lawyerseoexpert.com', 'lawyerseoexpert.com.evil.test', 'lawyerseoexpert-site.fahim-afd.workers.dev', 'localhost']) {
      expect(isProductionHost(host)).toBe(false);
      expect(trackingAllowed({ ...page, host })).toBe(false);
    }
  });

  it.each([
    'phase-3-frontend-lawyerseoexpert-site.fahim-afd.workers.dev',
    'abc123-lawyerseoexpert-site.fahim-afd.workers.dev',
    'xlawyerseoexpert-site.fahim-afd.workers.dev',
    'lawyerseoexpert-site.fahim-afd.workers.dev.evil.test',
    'next.lawyerseoexpert.com',
    'localhost',
  ])('ignores pixeltest=1 on %s', (host) => {
    expect(trackingAllowed({ ...page, host, search: '?pixeltest=1' })).toBe(false);
  });

  it('turns on the pre-launch host only with pixeltest=1', () => {
    const host = 'lawyerseoexpert-site.fahim-afd.workers.dev';
    expect(trackingAllowed({ ...page, host })).toBe(false);
    expect(trackingAllowed({ ...page, host, search: '?pixeltest=1' })).toBe(true);
    expect(trackingAllowed({ ...page, host, search: '?a=1&pixeltest=1' })).toBe(true);
    expect(trackingAllowed({ ...page, host, search: '?pixeltest=0' })).toBe(false);
    expect(trackingAllowed({ ...page, host, search: '?xpixeltest=1' })).toBe(false);
  });

  it('respects the notrack cookie everywhere', () => {
    expect(hasNoTrackCookie('a=b; lse_notrack=1; c=d')).toBe(true);
    expect(hasNoTrackCookie('lse_notrack=1')).toBe(true);
    expect(hasNoTrackCookie('lse_notrack=0')).toBe(false);
    expect(hasNoTrackCookie('xlse_notrack=1')).toBe(false);
    expect(trackingAllowed({ ...page, cookie: 'lse_notrack=1' })).toBe(false);
    expect(trackingAllowed({ ...page, host: 'lawyerseoexpert-site.fahim-afd.workers.dev', search: '?pixeltest=1', cookie: 'lse_notrack=1' })).toBe(false);
  });
});

describe('query values', () => {
  it('reads rdt_cid raw, as the Pixel does', () => {
    expect(rawQueryParam('?rdt_cid=abc%2Fdef&x=1', 'rdt_cid')).toBe('abc%2Fdef');
    expect(rawQueryParam('?x=1&rdt_cid=a+b', 'rdt_cid')).toBe('a+b');
    expect(rawQueryParam('?rdt_cid=', 'rdt_cid')).toBe('');
    expect(rawQueryParam('', 'rdt_cid')).toBe('');
  });
});

describe('storage', () => {
  it('writes the plugin format: { v, exp } with exp 90 days out, in milliseconds', () => {
    const store = memoryStore();
    storeSet(store, 'rct_cid', 'abc', NOW);
    expect(JSON.parse(store.data.get('rct_cid') ?? '')).toEqual({ v: 'abc', exp: NOW + 90 * DAY });
  });

  it('reads an entry the plugin wrote', () => {
    const store = memoryStore({ rct_cid: JSON.stringify({ v: 'from-plugin', exp: NOW + DAY }) });
    expect(storeGet(store, 'rct_cid', NOW)).toBe('from-plugin');
  });

  it('removes an expired entry and survives junk', () => {
    const store = memoryStore({ old: JSON.stringify({ v: 'x', exp: NOW - 1 }), junk: '{not json', bare: '"text"' });
    expect(storeGet(store, 'old', NOW)).toBeNull();
    expect(store.data.has('old')).toBe(false);
    expect(storeGet(store, 'junk', NOW)).toBeNull();
    expect(storeGet(store, 'bare', NOW)).toBeNull();
    expect(storeGet(null, 'old', NOW)).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken: StoreLike = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(storeGet(broken, 'rct_cid', NOW)).toBeNull();
    expect(() => storeSet(broken, 'rct_cid', 'x', NOW)).not.toThrow();
    expect(rememberClickId(broken, '?rdt_cid=keep', NOW)).toBe('keep');
  });

  it('a click ID in the URL wins and restarts the 90 days', () => {
    const store = memoryStore({ rct_cid: JSON.stringify({ v: 'old', exp: NOW + DAY }) });
    expect(rememberClickId(store, '?rdt_cid=new', NOW)).toBe('new');
    expect(JSON.parse(store.data.get(CLICK_STORE) ?? '')).toEqual({ v: 'new', exp: NOW + 90 * DAY });
    expect(rememberClickId(store, '', NOW + DAY)).toBe('new');
    expect(rememberClickId(store, '', NOW + 91 * DAY)).toBe('');
  });

  it('keeps first-touch UTMs', () => {
    const store = memoryStore();
    expect(rememberUtm(store, '?x=1', NOW)).toEqual({});
    expect(store.data.has(UTM_STORE)).toBe(false);
    expect(rememberUtm(store, '?utm_source=reddit&utm_campaign=a%20b&utm_foo=z', NOW)).toEqual({ utm_source: 'reddit', utm_campaign: 'a b' });
    expect(rememberUtm(store, '?utm_source=later', NOW + DAY)).toEqual({ utm_source: 'reddit', utm_campaign: 'a b' });
    expect(rememberUtm(store, '?utm_source=later', NOW + 91 * DAY)).toEqual({ utm_source: 'later' });
  });

  describe('last touch', () => {
    const visit = (search: string, referrer = '', path = '/book/') => ({ search, referrer, host: 'lawyerseoexpert.com', path });

    it('a newer tagged link replaces an older one, all five values and the landing page', () => {
      const store = memoryStore();
      rememberTouch(store, visit('?utm_source=reddit&utm_content=ad-1'), NOW);
      const url = '?utm_source=linkedin&utm_medium=social&utm_campaign=c&utm_content=post&utm_term=t&utm_foo=z';
      expect(rememberTouch(store, visit(url), NOW + DAY)).toEqual({
        utm_source: 'linkedin',
        utm_medium: 'social',
        utm_campaign: 'c',
        utm_content: 'post',
        utm_term: 't',
        landing: '/book/',
      });
    });

    it('a direct visit or a click within the site keeps it', () => {
      const store = memoryStore();
      const first = rememberTouch(store, visit('?utm_source=reddit'), NOW);
      expect(rememberTouch(store, visit('', '', '/pricing/'), NOW + DAY)).toEqual(first);
      expect(rememberTouch(store, visit('', 'https://lawyerseoexpert.com/', '/pricing/'), NOW + DAY)).toEqual(first);
      expect(rememberTouch(store, visit('', 'https://www.lawyerseoexpert.com/', '/pricing/'), NOW + DAY)).toEqual(first);
    });

    it('another site with no tags replaces it, as a host only', () => {
      const store = memoryStore();
      rememberTouch(store, visit('?utm_source=reddit'), NOW);
      expect(rememberTouch(store, visit('', 'https://www.linkedin.com/feed/?secret=1'), NOW + DAY)).toEqual({
        referrer: 'www.linkedin.com',
        landing: '/book/',
      });
    });

    it('expires after 90 days, and a first direct visit has nothing', () => {
      const store = memoryStore();
      expect(rememberTouch(store, visit(''), NOW)).toEqual({});
      expect(store.data.size).toBe(0);
      rememberTouch(store, visit('?utm_source=reddit'), NOW);
      expect(rememberTouch(store, visit(''), NOW + 91 * DAY)).toEqual({});
    });

    it('ignores a referrer it cannot read', () => {
      expect(externalReferrer('', 'lawyerseoexpert.com')).toBe('');
      expect(externalReferrer('not a url', 'lawyerseoexpert.com')).toBe('');
    });
  });
});

describe('conversion IDs', () => {
  const serverRule = /^[A-Za-z0-9_-]{1,100}$/;

  it('takes the invitee ID from the URI', () => {
    const uri = 'https://api.calendly.com/scheduled_events/EV1/invitees/2f6c1f6e-aaaa-bbbb-cccc-1234567890ab';
    expect(calendlyConversionId(uri)).toBe('calendly-2f6c1f6e-aaaa-bbbb-cccc-1234567890ab');
    expect(calendlyConversionId(`${uri}/`)).toBe('calendly-2f6c1f6e-aaaa-bbbb-cccc-1234567890ab');
    expect(calendlyConversionId(uri)).toMatch(serverRule);
  });

  it('is empty when there is no invitee ID', () => {
    expect(calendlyConversionId('')).toBe('');
    expect(calendlyConversionId('https://api.calendly.com/scheduled_events/EV1')).toBe('');
    expect(calendlyConversionId('https://api.calendly.com/invitees/bad id!')).toBe('');
  });

  it('makes a new UUID each time, in a form the server accepts', () => {
    const a = newConversionId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).toMatch(serverRule);
    expect(newConversionId()).not.toBe(a);
  });
});
