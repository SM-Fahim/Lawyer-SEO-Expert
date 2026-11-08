import { errorText, logError } from './log';
import { sha256Hex } from './matchkeys';

export const MAX_BODY_BYTES = 32 * 1024;

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 5000;
const MAX_TURNSTILE_TOKEN = 2048;

// These say something is wrong on our side or Cloudflare's, or that a real visitor's token
// expired while they typed. None of them means the visitor failed a challenge.
const NOT_A_VERDICT = new Set([
  'missing-input-secret',
  'invalid-input-secret',
  'bad-request',
  'internal-error',
  'timeout-or-duplicate',
]);

export const BOT_RE =
  /(bot\/|bot;|crawler|spider|slurp|headlesschrome|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|facebookexternalhit|bytespider)/i;

export function isBot(request: Request): boolean {
  return BOT_RE.test(request.headers.get('user-agent') ?? '');
}

export function clientIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip');
}

/**
 * True when the request came from one of our pages: the production host, or the host this
 * Worker is answering on, which covers workers.dev, Previews and local dev. Falls back to
 * Referer because a form POST under a strict referrer policy can send `Origin: null`.
 */
export function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin');
  const source = origin && origin !== 'null' ? origin : request.headers.get('referer');
  if (!source) return false;
  try {
    const host = new URL(source).host;
    return (
      host === new URL(request.url).host ||
      host === env.SITE_HOST ||
      host === `www.${env.SITE_HOST}`
    );
  } catch {
    return false;
  }
}

/** Reads the body with a hard cap, whatever Content-Length claims. Null means too large. */
export async function readCapped(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return null;
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

/** Null when IP_SALT isn't set: an unsalted IP hash is reversible, so we store nothing. */
export async function hashIp(ip: string | null, env: Env): Promise<string | null> {
  if (!ip) return null;
  if (!env.IP_SALT) {
    logError('ip_salt_missing');
    return null;
  }
  return sha256Hex(`${ip}${env.IP_SALT}`);
}

export type TurnstileResult = 'ok' | 'unverified' | 'failed';

/**
 * Only an actively failed token returns 'failed'. No token means the script was blocked or the
 * visitor has no JavaScript, and an outage means we couldn't ask. Both keep the lead.
 */
export async function verifyTurnstile(
  env: Env,
  token: string,
  ip: string | null,
): Promise<TurnstileResult> {
  if (!token) return 'unverified';
  // A real token is at most 2048 characters, so this one is forged. Refusing it here also stops
  // a bot from provoking an error from siteverify to get treated as an outage.
  if (token.length > MAX_TURNSTILE_TOKEN) return 'failed';
  if (!env.TURNSTILE_SECRET) {
    logError('turnstile_secret_missing');
    return 'unverified';
  }

  try {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const response = await fetch(SITEVERIFY, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`siteverify ${response.status}`);

    const data = (await response.json()) as { success?: unknown; 'error-codes'?: unknown };
    if (data.success === true) return 'ok';
    if (data.success !== false) throw new Error('siteverify returned no verdict');

    const codes = Array.isArray(data['error-codes']) ? data['error-codes'].map(String) : [];
    const problem = codes.find((code) => NOT_A_VERDICT.has(code));
    if (problem) {
      logError('turnstile_no_verdict', { code: problem });
      return 'unverified';
    }
    // The only path that turns a lead away, so it must be visible if real people ever hit it.
    logError('turnstile_rejected', { codes });
    return 'failed';
  } catch (error) {
    logError('turnstile_unavailable', { error: errorText(error) });
    return 'unverified';
  }
}
