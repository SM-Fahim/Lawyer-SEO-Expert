import { describe, expect, it } from 'vitest';
import { hashEmail, hashPhone } from '../../worker/matchkeys';
import {
  cleanMetaKeys,
  FB_COOKIE_RE,
  metaEmail,
  metaKeysOf,
  metaNamePart,
  metaPhone,
  META_TEST_RE,
  splitName,
} from '../../worker/metakeys';

// SHA-256 of the normalized strings, worked out separately with Node's crypto.
const EMAIL_HASH = '63a77c7878c524ab1809a2f852d3022011544af01ee14f41345750695555d70c'; // al.ice+apple@example.com
const PHONE_HASH = '5e0e5aa7d521589a79e6de0d18a65fa43456cb4cda554fb69667691a34f3e2c0'; // 15554441234
const TEST_HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'; // test
const IGNORE_HASH = '5f0af516936c6ab13dfce52362f84a3c0aa8d87aca8f2bcaf55ad4e1e0178034'; // ignore
const MARYJANE_HASH = 'f08f448a5e7a9dc3619bb7c129f6a7d5fc6af002cea17ad71dfdc1c68f4d4e0e';
const ONEIL_HASH = '67a42a846e98e3c1a96cd6ba14883a5ea05990cd93964ce8b832aa9497ca785c';

describe("Meta's email rule", () => {
  it.each([
    ['Al.ice+Apple@Example.Com', 'al.ice+apple@example.com'],
    ['  ALICE@EXAMPLE.COM ', 'alice@example.com'],
    ['first.last@sub.example.com', 'first.last@sub.example.com'],
  ])('%s becomes %s, keeping dots and "+"', (raw, expected) => {
    expect(metaEmail(raw)).toBe(expected);
  });

  it.each(['', 'not-an-email', 'a@b', 'a b@example.com'])('rejects %j', (raw) => {
    expect(metaEmail(raw)).toBe('');
  });
});

describe("Meta's phone rule", () => {
  it.each([
    ['(555) 444-1234', '15554441234'],
    ['+1 (555) 444-1234', '15554441234'],
    ['1 555 444 1234', '15554441234'],
    ['+44 20 7946 0958', '442079460958'],
    ['555-444-1234 ext 9', '15554441234'],
  ])('%s becomes %s', (raw, expected) => {
    expect(metaPhone(raw)).toBe(expected);
  });

  it.each(['', 'none', '12'])('rejects %j', (raw) => {
    expect(metaPhone(raw)).toBe('');
  });
});

describe("Meta's name rule", () => {
  it.each([
    ['  Jane ', 'jane'],
    ["O'Neil", 'oneil'],
    ['Mary-Jane', 'maryjane'],
    ['Dr.', 'dr'],
    ['-', ''],
    ['José', 'josé'],
  ])('%j becomes %j', (raw, expected) => {
    expect(metaNamePart(raw)).toBe(expected);
  });

  it.each([
    ['Jane', { fn: 'jane', ln: '' }],
    ['Jane Doe', { fn: 'jane', ln: 'doe' }],
    ['Jane  Q.  Doe', { fn: 'jane', ln: 'doe' }],
    ['TEST - ignore', { fn: 'test', ln: 'ignore' }],
    ["Mary-Jane O'Neil", { fn: 'maryjane', ln: 'oneil' }],
    ['   ', { fn: '', ln: '' }],
  ])('splits %j', (raw, expected) => {
    expect(splitName(raw)).toEqual(expected);
  });
});

describe('metaKeysOf', () => {
  it('hashes each normalized value with SHA-256', async () => {
    expect(await metaKeysOf({ email: 'Al.ice+Apple@Example.Com', phone: '(555) 444-1234', name: 'TEST - ignore' })).toEqual({
      em: EMAIL_HASH,
      ph: PHONE_HASH,
      fn: TEST_HASH,
      ln: IGNORE_HASH,
    });
    expect(await metaKeysOf({ name: "Mary-Jane O'Neil" })).toEqual({ fn: MARYJANE_HASH, ln: ONEIL_HASH });
  });

  it('leaves out what is missing or invalid', async () => {
    expect(await metaKeysOf({ email: 'nope', phone: '', name: undefined })).toEqual({});
    expect(await metaKeysOf({})).toEqual({});
  });

  it("never matches Reddit's hashes, because Reddit's email and phone rules differ", async () => {
    const meta = await metaKeysOf({ email: 'Al.ice+Apple@Example.Com', phone: '(555) 444-1234' });
    expect(meta.em).not.toBe(await hashEmail('Al.ice+Apple@Example.Com'));
    expect(meta.ph).not.toBe(await hashPhone('(555) 444-1234'));
  });
});

describe('cleanMetaKeys', () => {
  it('keeps only 64-hex values under the four keys', () => {
    expect(
      cleanMetaKeys({ em: EMAIL_HASH, ph: 'not-a-hash', fn: EMAIL_HASH.toUpperCase(), ln: PHONE_HASH, email: EMAIL_HASH }),
    ).toEqual({ em: EMAIL_HASH, ln: PHONE_HASH });
    expect(cleanMetaKeys(null)).toEqual({});
    expect(cleanMetaKeys('x')).toEqual({});
  });
});

describe('formats', () => {
  it.each([
    ['fb.1.1700000000000.1234567890', true],
    ['fb.1.1700000000000.IwAR2abc-_.x', true],
    ['fb.0.1700000000.abc', true],
    ['fb.3.1700000000000.abc', false],
    ['fb.1.17.abc', false],
    ['fb.1.1700000000000.', false],
    ['fb.1.1700000000000.a b', false],
    ['xx.1.1700000000000.abc', false],
  ])('cookie %j valid: %s', (value, ok) => {
    expect(FB_COOKIE_RE.test(value)).toBe(ok);
  });

  it.each([
    ['TEST12345', true],
    ['TESTabc', true],
    ['TEST', false],
    ['test12345', false],
    ['TEST123456789012345678901', false],
    ['TEST12-34', false],
  ])('test code %j valid: %s', (value, ok) => {
    expect(META_TEST_RE.test(value)).toBe(ok);
  });
});
