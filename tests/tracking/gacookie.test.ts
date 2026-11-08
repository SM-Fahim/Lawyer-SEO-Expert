import { describe, expect, it } from 'vitest';
import { gaClientIdOf, gaIdsFromCookie, gaSessionIdOf, sessionCookieName } from '../../worker/gacookie';

const ID = 'G-V1J07CEE3T';

describe('Google cookies', () => {
  it('reads the client ID from _ga', () => {
    expect(gaIdsFromCookie('a=b; _ga=GA1.1.1234567890.1700000000', ID).clientId).toBe('1234567890.1700000000');
    expect(gaIdsFromCookie('_ga=GA1.2.1234567890.1700000000', ID).clientId).toBe('1234567890.1700000000');
  });

  it('reads the session from the old GS1 format', () => {
    expect(gaIdsFromCookie('_ga_V1J07CEE3T=GS1.1.1700000123.2.1.1700000500.0.0.0', ID).sessionId).toBe('1700000123');
  });

  it('reads the session from the new GS2 format, with $ raw or encoded', () => {
    expect(gaIdsFromCookie('_ga_V1J07CEE3T=GS2.1.s1700000123$o2$g1$t1700000500$j0$l0$h0', ID).sessionId).toBe('1700000123');
    expect(gaIdsFromCookie('_ga_V1J07CEE3T=GS2.1.s1700000123%24o2%24g1', ID).sessionId).toBe('1700000123');
  });

  it('ignores another property, junk and look-alikes', () => {
    expect(gaIdsFromCookie('_ga_OTHER12345=GS2.1.s1700000123$o1', ID)).toEqual({});
    expect(gaIdsFromCookie('_ga=hello; _ga_V1J07CEE3T=GS9.1.x', ID)).toEqual({});
    expect(gaIdsFromCookie('x_ga=GA1.1.1234567890.1700000000', ID)).toEqual({});
    expect(gaIdsFromCookie('_ga=GA1.1.1234567890.1700000000', 'bad id')).toEqual({ clientId: '1234567890.1700000000' });
  });

  it('checks body values strictly', () => {
    expect(gaClientIdOf('1.2')).toBe('1.2');
    for (const bad of ['', 'a.b', '1.2.3', '1234567890123.1', 5, null, '1.2\n']) expect(gaClientIdOf(bad)).toBeUndefined();
    expect(gaSessionIdOf('1700000123')).toBe('1700000123');
    for (const bad of ['12', '17000001234567', 'x1700000123', 1700000123]) expect(gaSessionIdOf(bad)).toBeUndefined();
    expect(sessionCookieName(ID)).toBe('_ga_V1J07CEE3T');
    expect(sessionCookieName('UA-1')).toBeUndefined();
  });
});
