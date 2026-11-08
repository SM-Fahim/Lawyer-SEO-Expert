import { describe, expect, it } from 'vitest';
import {
  hashEmail,
  hashPhone,
  normalizeEmail,
  normalizePhone,
  sha256Hex,
} from '../../worker/matchkeys';

// The same vectors the live WordPress plugin passes, so old and new trackers hash alike.
const EMAIL_HASH = 'ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976';
const PHONE_HASH = 'e5b124c58580eb16bd959b8d0cac12b12c952e2ceae0203d416cff94f10b994a';

describe('email normalization', () => {
  it.each([
    ['Al.ice+Apple@Example.Com', 'alice@example.com'],
    ['  ALICE@EXAMPLE.COM ', 'alice@example.com'],
    ['a.l.i.c.e@example.com', 'alice@example.com'],
    ['alice+one+two@example.com', 'alice@example.com'],
    ['alice@mail.example.co.uk', 'alice@mail.example.co.uk'],
    // Dots come out of the local part only.
    ['first.last@sub.example.com', 'firstlast@sub.example.com'],
  ])('%s becomes %s', (raw, expected) => {
    expect(normalizeEmail(raw)).toBe(expected);
  });

  it.each(['', 'not-an-email', 'a@b', '+tag@example.com', '.+x@example.com', 'a b@example.com'])(
    'rejects %j',
    (raw) => {
      expect(normalizeEmail(raw)).toBe('');
    },
  );
});

describe('phone normalization', () => {
  it.each([
    ['(555) 444-1234', '+15554441234'],
    ['555.444.1234', '+15554441234'],
    ['1 555 444 1234', '+15554441234'],
    ['+1 (555) 444-1234', '+15554441234'],
    ['+44 20 7946 0958', '+442079460958'],
    ['0044 20 7946 0958', '+442079460958'],
    ['0555 444 1234', '+15554441234'],
    // Extensions removed.
    ['555-444-1234 ext 99', '+15554441234'],
    ['555-444-1234 x99', '+15554441234'],
    ['555-444-1234 EXT. 99', '+15554441234'],
    ['555-444-1234 #99', '+15554441234'],
    ['555-444-1234 int 99', '+15554441234'],
  ])('%s becomes %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(['', 'call me', '123', '+0 555 444 1234', '+1234567890123456789'])('rejects %j', (raw) => {
    expect(normalizePhone(raw)).toBe('');
  });
});

describe('hashing', () => {
  it('produces lowercase SHA-256 hex against a published vector', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes the normalized email', async () => {
    expect(await sha256Hex('alice@example.com')).toBe(EMAIL_HASH);
    expect(await hashEmail('Al.ice+Apple@Example.Com')).toBe(EMAIL_HASH);
  });

  it('hashes the normalized phone', async () => {
    expect(await sha256Hex('+15554441234')).toBe(PHONE_HASH);
    expect(await hashPhone('(555) 444-1234')).toBe(PHONE_HASH);
  });

  it('returns nothing for absent or invalid contact details', async () => {
    expect(await hashEmail(null)).toBeUndefined();
    expect(await hashEmail('nope')).toBeUndefined();
    expect(await hashPhone(undefined)).toBeUndefined();
    expect(await hashPhone('nope')).toBeUndefined();
  });
});
