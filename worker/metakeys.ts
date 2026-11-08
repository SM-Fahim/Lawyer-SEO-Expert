// Meta match keys: normalized the way Meta asks, then SHA-256 to lowercase hex. Separate from
// Reddit's (matchkeys.ts) on purpose: Meta keeps dots and "+" in an email, and wants a phone as
// digits only. The browser (core.ts) and the server (addons/lead.ts) both use this file, so the
// Pixel and the Conversions API hash alike.
//
// Meta's rules (developers.facebook.com, Conversions API customer information parameters):
//   em  trimmed, lowercase
//   ph  digits only, with the country code, no "+" or leading zeros
//   fn, ln  lowercase, no punctuation
import { EMAIL_RE, normalizePhone, sha256Hex } from './matchkeys';

export interface MetaKeys {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
}

const HASH_RE = /^[0-9a-f]{64}$/;
// _fbp and _fbc: fb.<subdomain index>.<creation time in ms>.<random number or fbclid>. Permissive
// on purpose: Meta can change the last part, and a cookie we refuse is a match lost.
export const FB_COOKIE_RE = /^fb\.[0-2]\.\d{10,16}\.[A-Za-z0-9_.-]{1,500}$/;
// The raw fbclid query value. Meta asks for it unchanged, so it's never decoded.
export const FBCLID_RE = /^[A-Za-z0-9_.-]{1,500}$/;
// ?meta_test= on any page sends that visitor's server events to Meta's Test Events tool.
export const META_TEST_RE = /^TEST[A-Za-z0-9]{1,20}$/;

/** Trimmed and lowercase. Empty when it isn't an email. No dot or "+" removal: that's Reddit's rule. */
export function metaEmail(raw: string): string {
  const email = raw.trim();
  return EMAIL_RE.test(email) ? email.toLowerCase() : '';
}

/** Digits only, with the country code (default 1). Empty when no valid number results. */
export function metaPhone(raw: string): string {
  return normalizePhone(raw).replace(/^\+/, '');
}

/** One part of a name: lowercase, with punctuation, symbols and spaces taken out. */
export function metaNamePart(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, '');
}

/** First word is the first name. The last word is the last name, when there are two or more. */
export function splitName(raw: string): { fn: string; ln: string } {
  const words = raw.split(/\s+/).map(metaNamePart).filter(Boolean);
  return { fn: words[0] ?? '', ln: words.length > 1 ? (words[words.length - 1] ?? '') : '' };
}

export async function metaKeysOf(contact: {
  email?: string | null | undefined;
  phone?: string | null | undefined;
  name?: string | null | undefined;
}): Promise<MetaKeys> {
  const { fn, ln } = splitName(contact.name ?? '');
  const plain: MetaKeys = {
    em: metaEmail(contact.email ?? ''),
    ph: metaPhone(contact.phone ?? ''),
    fn,
    ln,
  };
  const keys: MetaKeys = {};
  for (const key of ['em', 'ph', 'fn', 'ln'] as const) {
    const value = plain[key];
    if (value) keys[key] = await sha256Hex(value);
  }
  return keys;
}

/** Only well-formed hashes, so a bad entry can't reach the Pixel or Meta. */
export function cleanMetaKeys(value: unknown): MetaKeys {
  const keys: MetaKeys = {};
  if (value && typeof value === 'object') {
    for (const key of ['em', 'ph', 'fn', 'ln'] as const) {
      const hash = (value as Record<string, unknown>)[key];
      if (typeof hash === 'string' && HASH_RE.test(hash)) keys[key] = hash;
    }
  }
  return keys;
}
