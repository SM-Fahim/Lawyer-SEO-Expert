// Everything that arrives in a POST body is untrusted. These turn it into safe values, and a bad
// optional value becomes "absent" rather than an error: a stray field must never cost a lead.

export type Fields = Record<string, unknown>;

const HASH_RE = /^[0-9a-f]{64}$/;
const CONVERSION_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const RDT_UUID_RE = /^[\w.-]{1,128}$/;
const CLICK_ID_RE = /^[\x21-\x7e]{1,512}$/;
const KEPT_QUERY = /^(rdt_cid$|utm_)/;

export function clip(value: unknown, max: number): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, max);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function clipOrNull(value: unknown, max: number): string | null {
  return clip(value, max) || null;
}

export const conversionIdOf = (value: unknown): string | null =>
  typeof value === 'string' && CONVERSION_ID_RE.test(value) ? value : null;

export const clickIdOf = (value: unknown): string | undefined =>
  typeof value === 'string' && CLICK_ID_RE.test(value) ? value : undefined;

export const hashOf = (value: unknown): string | undefined =>
  typeof value === 'string' && HASH_RE.test(value) ? value : undefined;

/** The `_rdt_uuid` cookie, or the value the browser sent when the cookie isn't readable. */
export function rdtUuidOf(request: Request, bodyValue: unknown): string | undefined {
  const cookie = /(?:^|;\s*)_rdt_uuid=([^;]*)/.exec(request.headers.get('cookie') ?? '')?.[1];
  if (cookie && RDT_UUID_RE.test(cookie)) return cookie;
  return typeof bodyValue === 'string' && RDT_UUID_RE.test(bodyValue) ? bodyValue : undefined;
}

export function screenOf(
  width: unknown,
  height: unknown,
): { width: number; height: number } | undefined {
  const w = Number(width);
  const h = Number(height);
  const fits = (n: number) => Number.isInteger(n) && n > 0 && n <= 100_000;
  return fits(w) && fits(h) ? { width: w, height: h } : undefined;
}

const REFERRER_HOST_RE = /^[a-z0-9.-]{1,253}$/;
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type UtmValues = Partial<Record<(typeof UTM_FIELDS)[number], string>>;

/** The five UTM values from an untrusted object. Anything else in it is dropped. */
export function utmOf(value: unknown): UtmValues {
  const utm: UtmValues = {};
  if (!value || typeof value !== 'object') return utm;
  for (const key of UTM_FIELDS) {
    const clean = clip((value as Fields)[key], 200);
    if (clean) utm[key] = clean;
  }
  return utm;
}

export const referrerHostOf = (value: unknown): string | null =>
  typeof value === 'string' && REFERRER_HOST_RE.test(value) ? value : null;

export const pathOf = (value: unknown): string | null =>
  typeof value === 'string' && value.startsWith('/') ? value.slice(0, 300) : null;

export interface PageRef {
  /** Path only, for D1 and the email. */
  path: string;
  /** Full URL on the production host, keeping only rdt_cid and utm_* in the query. */
  sourceUrl: string;
}

/**
 * Accepts a path or a full URL. A URL on a host we don't own is ignored and falls back to the
 * Referer, so Reddit only ever sees pages on our host.
 */
export function pageOf(value: unknown, request: Request, env: Env): PageRef | null {
  return parsePage(value, request, env) ?? parsePage(request.headers.get('referer'), request, env);
}

function parsePage(value: unknown, request: Request, env: Env): PageRef | null {
  const raw = clip(value, 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw, `https://${env.SITE_HOST}`);
    const ours = [env.SITE_HOST, `www.${env.SITE_HOST}`, new URL(request.url).host];
    if (!ours.includes(url.host)) return null;

    const query = new URLSearchParams();
    for (const [key, val] of url.searchParams) {
      if (KEPT_QUERY.test(key)) query.append(key, val);
    }
    const search = query.size ? `?${query}` : '';
    const path = url.pathname.slice(0, 300);
    return { path, sourceUrl: `https://${env.SITE_HOST}${path}${search}` };
  } catch {
    return null;
  }
}
