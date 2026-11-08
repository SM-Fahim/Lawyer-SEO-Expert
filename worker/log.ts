// Structured logs. Nothing here may carry contact details, so anything that came from outside
// (a third party's error text, say) goes through scrub() first.

const EMAIL = /[^\s"'<>@]+@[^\s"'<>@]+\.[^\s"'<>@]+/g;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f:]*\b/gi;
const HASH = /\b[0-9a-f]{64}\b/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

export function scrub(text: unknown, max = 300): string {
  return String(text ?? '')
    .replace(EMAIL, '[email]')
    .replace(HASH, '[hash]')
    .replace(IPV4, '[ip]')
    .replace(IPV6, '[ip]')
    .replace(PHONE, '[number]')
    .slice(0, max);
}

export function logInfo(evt: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ evt, ...fields }));
}

export function logError(evt: string, fields: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ evt, ...fields }));
}

export function errorText(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return scrub(code ? `${String(code)}: ${error.message}` : error.message);
  }
  return scrub(error);
}
