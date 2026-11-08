// Reads Google's two cookies. Used by the browser tracker and by the Worker, and the Worker treats
// whatever it gets as untrusted, so each value must match a strict pattern or it is dropped.
//
// _ga:            GA1.1.<random>.<first visit time>        client ID is the last two numbers
// _ga_<ID>, old:  GS1.1.<session>.<count>.<engaged>.<last>.<...>
// _ga_<ID>, new:  GS2.1.s<session>$o<count>$g<engaged>$t<last>$j<...>   ($ may arrive as %24)

const CLIENT_ID_RE = /^\d{1,12}\.\d{1,12}$/;
const SESSION_ID_RE = /^\d{9,11}$/;
const CLIENT_COOKIE_RE = /^GA\d\.\d{1,2}\.(\d{1,12}\.\d{1,12})$/;
const SESSION_COOKIE_V1_RE = /^GS1\.\d{1,2}\.(\d{9,11})\.\d{1,6}(?:\.|$)/;
const SESSION_COOKIE_V2_RE = /^GS2\.\d{1,2}\.s(\d{9,11})\$o\d{1,6}(?:\$|$)/;
const MEASUREMENT_ID_RE = /^G-[A-Z0-9]{4,20}$/;

/** A client ID such as 1234567890.1700000000, or undefined. */
export const gaClientIdOf = (value: unknown): string | undefined =>
  typeof value === 'string' && CLIENT_ID_RE.test(value) ? value : undefined;

/** A session ID (Unix seconds, as digits), or undefined. */
export const gaSessionIdOf = (value: unknown): string | undefined =>
  typeof value === 'string' && SESSION_ID_RE.test(value) ? value : undefined;

export const gaClientIdFromCookie = (value: string): string | undefined =>
  CLIENT_COOKIE_RE.exec(value)?.[1];

export function gaSessionIdFromCookie(value: string): string | undefined {
  const plain = value.replace(/%24/g, '$');
  return (SESSION_COOKIE_V1_RE.exec(plain) ?? SESSION_COOKIE_V2_RE.exec(plain))?.[1];
}

/** `_ga_V1J07CEE3T` for `G-V1J07CEE3T`, or undefined if the ID is malformed. */
export const sessionCookieName = (measurementId: string): string | undefined =>
  MEASUREMENT_ID_RE.test(measurementId) ? `_ga_${measurementId.slice(2)}` : undefined;

function cookieValue(cookie: string, name: string): string {
  for (const part of cookie.split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return '';
}

export interface GaIds {
  clientId?: string;
  sessionId?: string;
}

/** Both IDs from a cookie string (document.cookie or the Cookie header). */
export function gaIdsFromCookie(cookie: string, measurementId: string): GaIds {
  const ids: GaIds = {};
  const clientId = gaClientIdFromCookie(cookieValue(cookie, '_ga'));
  const name = sessionCookieName(measurementId);
  const sessionId = name ? gaSessionIdFromCookie(cookieValue(cookie, name)) : undefined;
  if (clientId) ids.clientId = clientId;
  if (sessionId) ids.sessionId = sessionId;
  return ids;
}
