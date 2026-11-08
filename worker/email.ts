// The lead notification. Plain text, sent to the owner's addresses only, never to the lead.
// The binding's allowlists in wrangler.jsonc enforce that as well.

export interface LeadRecord {
  id: string;
  created_at: number;
  name: string;
  email: string;
  phone: string | null;
  website: string | null;
  firm: string | null;
  practice_area: string | null;
  message: string | null;
  extra_json: string | null;
  page: string | null;
  variant: string | null;
  utm_json: string | null;
  click_id: string | null;
  conversion_id: string;
  ip_hash: string | null;
  country: string | null;
  turnstile: 'ok' | 'unverified';
  is_test: number;
}

export interface LeadEmail {
  subject: string;
  text: string;
}

/**
 * False on Previews, where EMAIL_TO and EMAIL_FROM are blank and there is no binding: leads are
 * logged and nothing is sent. A missing binding with EMAIL_TO still set is a real fault, so it
 * fails the send and retries rather than passing as logged-only.
 */
export function emailEnabled(env: Env): boolean {
  return Boolean(env.EMAIL_FROM) && recipientsOf(env).length > 0;
}

/** Lowercased and de-duplicated, because the binding's allowlist compares literally. */
export function recipientsOf(env: Env): string[] {
  const addresses = (env.EMAIL_TO ?? '').split(',').map((part) => part.trim().toLowerCase());
  return [...new Set(addresses.filter(Boolean))];
}

export function renderLeadEmail(
  env: Env,
  lead: LeadRecord,
  options: { notSaved?: boolean } = {},
): LeadEmail {
  const flags = [
    env.LIVE === 'true' ? '' : '[PRE-LAUNCH]',
    options.notSaved ? '[NOT SAVED]' : '',
    lead.turnstile === 'unverified' ? '[POSSIBLE SPAM]' : '',
  ].filter(Boolean);
  // One line: the name comes from the POST body, and a newline would end the Subject header.
  const subject = [...flags, `New lead: ${lead.name} (${lead.page ?? 'unknown page'})`]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  const facts: [string, string | null][] = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Website', lead.website],
    ['Firm', lead.firm],
    ['Practice area', lead.practice_area],
    ...parsedEntries(lead.extra_json).map(([key, value]): [string, string] => [
      key.replace(/[_-]+/g, ' '),
      value,
    ]),
    ['Message', lead.message],
    ['Page', lead.page],
    ['A/B variant', lead.variant],
    ...parsedEntries(lead.utm_json),
    ['Reddit click ID present', lead.click_id ? 'yes' : 'no'],
    ['Turnstile', lead.turnstile],
    ['Country', lead.country],
    ['Time (UTC)', new Date(lead.created_at).toISOString().replace('T', ' ').replace(/\..*/, '')],
    ['Lead ID', lead.id],
  ];

  const lines = facts
    .filter((fact): fact is [string, string] => Boolean(fact[1]))
    .map(([key, value]) => `${key}: ${value}`);
  if (lead.turnstile === 'unverified') {
    lines.unshift(
      "Possible spam: this didn't pass Cloudflare's bot check. That usually means a bot sent it, so check the details before you reply.",
      '',
    );
  }
  if (options.notSaved) {
    lines.unshift('The database was unavailable. This email is the only copy of this lead.', '');
  }
  return { subject, text: lines.join('\n') };
}

function parsedEntries(json: string | null): [string, string][] {
  if (!json) return [];
  try {
    return Object.entries(JSON.parse(json) as Record<string, unknown>).map(([key, value]) => [
      key,
      String(value),
    ]);
  } catch {
    return [];
  }
}

/** One message per recipient, so one bad address can't block the other. Throws on failure. */
export async function sendTo(
  env: Env,
  recipient: string,
  lead: LeadRecord,
  message: LeadEmail,
): Promise<void> {
  if (!env.EMAIL) throw new Error('send_email binding is missing');
  await env.EMAIL.send({
    from: env.EMAIL_FROM,
    to: recipient,
    replyTo: lead.email,
    subject: message.subject,
    text: message.text,
  });
}
