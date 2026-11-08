import { emailEnabled, recipientsOf, renderLeadEmail, sendTo, type LeadRecord } from './email';
import { errorText, logError, logInfo } from './log';

// The lead is already safe in D1 when any of this runs, so a failure here costs only time.
//
// Every send starts with a claim: one atomic UPDATE that only succeeds while the lease has
// lapsed. The request and the cron can both try, but only one wins, and a Worker that dies
// mid-send gets its row back when the lease runs out.

// Longer than the 30 seconds a waitUntil can run, so a lease can't lapse during a live send.
const LEASE_MS = 2 * 60_000;
const MAX_PER_RUN = 25;
// Hourly once the backoff tops out, so about three days. A row past this stays unsent, and
// /api/health keeps reporting it, so it can't vanish quietly.
const MAX_ATTEMPTS = 80;
const STUCK_AFTER_MS = 15 * 60_000;

interface Claim {
  lead_id: string;
  attempts: number;
  sent_to: string;
}

function retryDelayMs(attempts: number): number {
  return Math.min(60_000 * 2 ** (attempts - 1), 60 * 60_000);
}

/** Claims one specific lead, for the request that just saved it. */
function claimLead(db: D1Database, leadId: string, now: number): Promise<Claim | null> {
  return db
    .prepare(
      `UPDATE outbox SET lease = ?1
        WHERE lead_id = ?2 AND sent_at IS NULL AND lease <= ?3 AND attempts < ?4
        RETURNING lead_id, attempts, sent_to`,
    )
    .bind(now + LEASE_MS, leadId, now, MAX_ATTEMPTS)
    .first<Claim>();
}

/** Claims the oldest due row, for the cron. One at a time, so each lease stays fresh. */
function claimNext(db: D1Database, now: number): Promise<Claim | null> {
  return db
    .prepare(
      `UPDATE outbox SET lease = ?1
        WHERE lead_id = (
          SELECT lead_id FROM outbox
           WHERE sent_at IS NULL AND lease <= ?2 AND attempts < ?3
           ORDER BY lease LIMIT 1
        )
        RETURNING lead_id, attempts, sent_to`,
    )
    .bind(now + LEASE_MS, now, MAX_ATTEMPTS)
    .first<Claim>();
}

async function deliver(env: Env, claim: Claim, now: number): Promise<void> {
  try {
    const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?')
      .bind(claim.lead_id)
      .first<LeadRecord>();
    if (!lead) throw new Error('lead row is missing');

    if (!emailEnabled(env)) {
      logInfo('lead_email_logged_only', { lead_id: claim.lead_id, page: lead.page });
      await markDone(env.DB, claim.lead_id, [], now, 'logged only, email is off here');
      return;
    }

    const delivered = new Set<string>(JSON.parse(claim.sent_to) as string[]);
    const message = renderLeadEmail(env, lead);
    const errors: string[] = [];
    for (const recipient of recipientsOf(env)) {
      if (delivered.has(recipient)) continue;
      try {
        await sendTo(env, recipient, lead, message);
        delivered.add(recipient);
      } catch (error) {
        errors.push(errorText(error));
      }
    }

    if (errors.length) {
      await markFailed(env.DB, claim, [...delivered], errors.join('; ').slice(0, 500), now);
      return;
    }
    await markDone(env.DB, claim.lead_id, [...delivered], now, null);
  } catch (error) {
    await markFailed(env.DB, claim, JSON.parse(claim.sent_to) as string[], errorText(error), now);
  }
}

async function markDone(
  db: D1Database,
  leadId: string,
  sentTo: string[],
  now: number,
  note: string | null,
): Promise<void> {
  await db
    .prepare('UPDATE outbox SET sent_at = ?, lease = 0, sent_to = ?, last_error = ? WHERE lead_id = ?')
    .bind(now, JSON.stringify(sentTo), note, leadId)
    .run();
}

async function markFailed(
  db: D1Database,
  claim: Claim,
  sentTo: string[],
  message: string,
  now: number,
): Promise<void> {
  const attempts = claim.attempts + 1;
  logError('lead_email_failed', { lead_id: claim.lead_id, attempts, error: message });
  await db
    .prepare('UPDATE outbox SET attempts = ?, lease = ?, sent_to = ?, last_error = ? WHERE lead_id = ?')
    .bind(attempts, now + retryDelayMs(attempts), JSON.stringify(sentTo), message, claim.lead_id)
    .run();
}

/** The request's own attempt, inside waitUntil. Never throws: the cron is the safety net. */
export async function deliverLead(env: Env, leadId: string, now = Date.now()): Promise<void> {
  try {
    const claim = await claimLead(env.DB, leadId, now);
    if (claim) await deliver(env, claim, now);
  } catch (error) {
    logError('lead_email_deliver_failed', { lead_id: leadId, error: errorText(error) });
  }
}

/** The cron's retry pass. */
export async function drainOutbox(env: Env, now = Date.now()): Promise<number> {
  let handled = 0;
  while (handled < MAX_PER_RUN) {
    const claim = await claimNext(env.DB, now);
    if (!claim) break;
    await deliver(env, claim, now);
    handled++;
  }
  return handled;
}

/** Stuck means a lead with no email sent, older than 15 minutes. */
export async function outboxStuck(db: D1Database, now = Date.now()): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM outbox o JOIN leads l ON l.id = o.lead_id
        WHERE o.sent_at IS NULL AND l.created_at < ? LIMIT 1`,
    )
    .bind(now - STUCK_AFTER_MS)
    .first();
  return row !== null;
}
