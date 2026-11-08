import { describe, expect, it } from 'vitest';
import {
  FBC_STORE,
  META_TEST_STORE,
  metaPixelEvent,
  rememberFbc,
  rememberMetaTest,
  rememberVisitorId,
  storeGet,
  storeSet,
  VISITOR_STORE,
  type StoreLike,
} from '../../src/features/tracking/core';

// The browser side of Meta: its own storage keys, never Reddit's.

const DAY = 864e5;
const NOW = 1_800_000_000_000;

function memoryStore(initial: Record<string, string> = {}): StoreLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const throwing: StoreLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('Meta storage keys', () => {
  it('are separate from Reddit and the plugin', () => {
    expect([FBC_STORE, VISITOR_STORE, META_TEST_STORE]).toEqual(['lse_fbc', 'lse_vid', 'lse_meta_test']);
  });
});

describe('rememberFbc', () => {
  it('stores fb.1.<ms first seen>.<raw fbclid> for 90 days', () => {
    const store = memoryStore();
    expect(rememberFbc(store, '?fbclid=IwAR2-abc_1.x&utm_source=fb', NOW)).toBe(`fb.1.${NOW}.IwAR2-abc_1.x`);
    expect(JSON.parse(store.data.get(FBC_STORE) ?? '{}')).toEqual({ v: `fb.1.${NOW}.IwAR2-abc_1.x`, exp: NOW + 90 * DAY });
    expect(store.data.has('rct_cid')).toBe(false);
  });

  it('keeps the first time when the same fbclid comes again', () => {
    const store = memoryStore();
    rememberFbc(store, '?fbclid=abc', NOW);
    expect(rememberFbc(store, '?fbclid=abc', NOW + 5000)).toBe(`fb.1.${NOW}.abc`);
  });

  it('replaces the stored one with a new fbclid', () => {
    const store = memoryStore();
    rememberFbc(store, '?fbclid=old', NOW);
    expect(rememberFbc(store, '?fbclid=new', NOW + 5000)).toBe(`fb.1.${NOW + 5000}.new`);
  });

  it('returns the stored one with no fbclid, and nothing once expired', () => {
    const store = memoryStore();
    rememberFbc(store, '?fbclid=abc', NOW);
    expect(rememberFbc(store, '', NOW + DAY)).toBe(`fb.1.${NOW}.abc`);
    expect(rememberFbc(store, '', NOW + 91 * DAY)).toBe('');
  });

  it('ignores an fbclid with characters Meta never uses', () => {
    const store = memoryStore();
    expect(rememberFbc(store, '?fbclid=a%20b', NOW)).toBe('');
    expect(store.data.size).toBe(0);
  });

  it('works with storage blocked', () => {
    expect(rememberFbc(throwing, '?fbclid=abc', NOW)).toBe(`fb.1.${NOW}.abc`);
    expect(rememberFbc(null, '', NOW)).toBe('');
  });
});

describe('rememberVisitorId', () => {
  it('makes a random 64-hex ID and keeps it, refreshing its 90 days each visit', () => {
    const store = memoryStore();
    const id = rememberVisitorId(store, NOW);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(rememberVisitorId(store, NOW + 30 * DAY)).toBe(id);
    expect(JSON.parse(store.data.get(VISITOR_STORE) ?? '{}').exp).toBe(NOW + 120 * DAY);
    expect(rememberVisitorId(memoryStore(), NOW)).not.toBe(id);
  });

  it('replaces a malformed stored value', () => {
    const store = memoryStore();
    storeSet(store, VISITOR_STORE, 'jane@example.com', NOW);
    expect(rememberVisitorId(store, NOW)).toMatch(/^[0-9a-f]{64}$/);
    expect(storeGet(store, VISITOR_STORE, NOW)).not.toBe('jane@example.com');
  });
});

describe('rememberMetaTest', () => {
  it('keeps a valid code for the tab, as a plain string', () => {
    const session = memoryStore();
    expect(rememberMetaTest(session, '?meta_test=TEST12345')).toBe('TEST12345');
    expect(session.data.get(META_TEST_STORE)).toBe('TEST12345');
    expect(rememberMetaTest(session, '')).toBe('TEST12345');
  });

  it('ignores a malformed code, in the URL or in storage', () => {
    expect(rememberMetaTest(memoryStore(), '?meta_test=hello')).toBe('');
    expect(rememberMetaTest(memoryStore({ [META_TEST_STORE]: '<script>' }), '')).toBe('');
  });

  it('works with storage blocked', () => {
    expect(rememberMetaTest(throwing, '?meta_test=TEST1')).toBe('TEST1');
    expect(rememberMetaTest(throwing, '')).toBe('');
    expect(rememberMetaTest(null, '?meta_test=TEST1')).toBe('TEST1');
  });
});

describe('metaPixelEvent', () => {
  it.each([
    ['PageVisit', 'PageView'],
    ['ViewContent', 'ViewContent'],
    ['SignUp', 'Schedule'],
    ['Lead', ''],
    ['BookingDialogOpened', ''],
    ['constructor', ''],
  ])('%s becomes %j', (name, meta) => {
    expect(metaPixelEvent(name)).toBe(meta);
  });
});
