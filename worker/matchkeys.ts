// Reddit match keys: normalize exactly as Reddit's Pixel does, then SHA-256 to lowercase hex.
// The browser's track.ts must produce the same strings, or the Pixel and server hashes differ.

export const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PHONE_EXTENSION = /ext|x|anexo|#|poste|int/;
const E164 = /^\+[1-9]\d{6,14}$/;
const DEFAULT_COUNTRY_CODE = '1';

/** Lowercase, dots out of the local part, nothing after "+". Empty when it isn't an email. */
export function normalizeEmail(raw: string): string {
  const email = raw.trim();
  if (!EMAIL_RE.test(email)) return '';
  const [local = '', domain = ''] = email.toLowerCase().split('@');
  const canonical = local.replace(/\./g, '').split('+')[0];
  return canonical ? `${canonical}@${domain}` : '';
}

/** E.164 with default country code 1 and no extension. Empty when no valid number results. */
export function normalizePhone(raw: string): string {
  const phone = raw.trim().toLowerCase();
  const extension = phone.search(PHONE_EXTENSION);
  const digits = (extension === -1 ? phone : phone.slice(0, extension)).replace(/\D+/g, '');
  if (!digits) return '';

  let e164: string;
  if (phone.startsWith('+')) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('00')) {
    e164 = `+${digits.slice(2)}`;
  } else {
    const national = digits.replace(/^0+/, '');
    e164 =
      national.length === 11 && national.startsWith(DEFAULT_COUNTRY_CODE)
        ? `+${national}`
        : `+${DEFAULT_COUNTRY_CODE}${national}`;
  }
  return E164.test(e164) ? e164 : '';
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashEmail(raw: string | null | undefined): Promise<string | undefined> {
  const normalized = normalizeEmail(raw ?? '');
  return normalized ? sha256Hex(normalized) : undefined;
}

export async function hashPhone(raw: string | null | undefined): Promise<string | undefined> {
  const normalized = normalizePhone(raw ?? '');
  return normalized ? sha256Hex(normalized) : undefined;
}
