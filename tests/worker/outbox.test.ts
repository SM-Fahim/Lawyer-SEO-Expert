import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index';
import { emailEnabled, recipientsOf, renderLeadEmail, type LeadRecord } from '../../worker/email';
import { deliverLead, drainOutbox, outboxStuck } from '../../worker/outbox';
import { pruneEvents } from '../../worker/addons/events';
import { pruneLeads } from '../../worker/addons/lead';
import {
  brokenDb,
  callWorker,
  captureLogs,
  clearTables,
  db,
  jsonRequest,
  makeEnv,
  mockNetwork,
  ORIGIN,
  validLead,
  type CapturedLogs,
} from './helpers';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const T0 = 1_800_000_000_000;

function leadRecord(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead-1',
    created_at: T0,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-444-1234',
    website: 'https://jane.example',
    firm: 'Doe Law',
    practice_area: 'Injury',
    message: 'Hello',
    extra_json: JSON.stringify({ monthly_budget: '$5k' }),
    page: '/contact/',
    variant: 'B',
    utm_json: JSON.stringify({ utm_source: 'reddit', utm_campaign: 'launch' }),
    click_id: 'abc',
    conversion_id: 'conv-1',
    ip_hash: 'hash',
    country: 'US',
    turnstile: 'ok',
    is_test: 0,
    ...overrides,
  };
}

async function seedLead(overrides: Partial<LeadRecord> = {}): Promise<string> {
  const lead = leadRecord(overrides);
  await db.batch([
    db
      .prepare(
        `INSERT INTO leads (id, created_at, name, email, conversion_id, turnstile, page)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(lead.id, lead.created_at, lead.name, lead.email, lead.conversion_id, lead.turnstile, lead.page),
    db.prepare('INSERT INTO outbox (lead_id) VALUES (?)').bind(lead.id),
  ]);
  return lead.id;
}

interface OutboxRow {
  attempts: number;
  lease: number;
  sent_at: number | null;
  sent_to: string;
  last_error: string | null;
}

function outboxRow(id = 'lead-1'): Promise<OutboxRow | null> {
  return db.prepare('SELECT * FROM outbox WHERE lead_id = ?').bind(id).first<OutboxRow>();
}

let logs: CapturedLogs;

beforeEach(async () => {
  await clearTables();
  logs = captureLogs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the email itself', () => {
  it('has the plan subject, once live', () => {
    const { subject } = renderLeadEmail(makeEnv({ LIVE: 'true' }), leadRecord());
    expect(subject).toBe('New lead: Jane Doe (/contact/)');
  });

  it('starts [PRE-LAUNCH] when LIVE is not "true"', () => {
    for (const LIVE of ['false', '', undefined]) {
      const { subject } = renderLeadEmail(makeEnv({ LIVE }), leadRecord());
      expect(subject).toBe('[PRE-LAUNCH] New lead: Jane Doe (/contact/)');
    }
  });

  it('flags an unverified lead in the subject', () => {
    const { subject } = renderLeadEmail(
      makeEnv({ LIVE: 'true' }),
      leadRecord({ turnstile: 'unverified' }),
    );
    expect(subject).toBe('[POSSIBLE SPAM] New lead: Jane Doe (/contact/)');
  });

  it('keeps the subject to one line, whatever the name holds', () => {
    const { subject } = renderLeadEmail(
      makeEnv({ LIVE: 'true' }),
      leadRecord({ name: 'Jane\r\nBcc: victim@example.com' }),
    );
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain('Jane Bcc: victim@example.com');
  });

  it('has all fields, page, variant, UTM, click ID presence and UTC time in plain text', () => {
    const { text } = renderLeadEmail(makeEnv(), leadRecord());
    for (const line of [
      'Name: Jane Doe',
      'Email: jane@example.com',
      'Phone: 555-444-1234',
      'Website: https://jane.example',
      'Firm: Doe Law',
      'Practice area: Injury',
      'monthly budget: $5k',
      'Message: Hello',
      'Page: /contact/',
      'A/B variant: B',
      'utm_source: reddit',
      'utm_campaign: launch',
      'Reddit click ID present: yes',
      `Time (UTC): ${new Date(T0).toISOString().replace('T', ' ').slice(0, 19)}`,
    ]) {
      expect(text).toContain(line);
    }
    // Presence only, not the value.
    expect(text).not.toContain('abc');
  });

  it('says no when there is no click ID, and leaves out empty fields', () => {
    const { text } = renderLeadEmail(makeEnv(), leadRecord({ click_id: null, firm: null }));
    expect(text).toContain('Reddit click ID present: no');
    expect(text).not.toContain('Firm:');
  });

  it('cleans up the recipient list', () => {
    expect(recipientsOf(makeEnv({ EMAIL_TO: ' A@x.test, b@x.test ,a@x.test,, ' }))).toEqual([
      'a@x.test',
      'b@x.test',
    ]);
  });

  it('is off with a blank EMAIL_TO or EMAIL_FROM, which is how Previews are set up', () => {
    expect(emailEnabled(makeEnv())).toBe(true);
    expect(emailEnabled(makeEnv({ EMAIL_TO: '' }))).toBe(false);
    expect(emailEnabled(makeEnv({ EMAIL_FROM: '' }))).toBe(false);
  });
});

describe('sending', () => {
  it('sends one message per recipient, from EMAIL_FROM, with Reply-To set to the lead', async () => {
    await seedLead();
    const env = makeEnv();
    await deliverLead(env, 'lead-1', T0);

    const messages = env.EMAIL.send.mock.calls.map((call) => call[0] as Record<string, string>);
    expect(messages.map((message) => message.to)).toEqual(['one@example.test', 'two@example.test']);
    for (const message of messages) {
      expect(message.from).toBe('leads@notify.lawyerseoexpert.com');
      expect(message.replyTo).toBe('jane@example.com');
      expect(message.subject).toBe('[PRE-LAUNCH] New lead: Jane Doe (/contact/)');
      expect(message.text).toContain('Name: Jane Doe');
    }

    const row = await outboxRow();
    expect(row).toMatchObject({ sent_at: T0, lease: 0, attempts: 0, last_error: null });
    expect(JSON.parse(String(row?.sent_to))).toEqual(['one@example.test', 'two@example.test']);
  });

  it('on a Preview logs only: no send, and the row is closed so health stays clear', async () => {
    await seedLead();
    // Exactly how wrangler.jsonc's previews block looks: blank addresses and no binding at all.
    const env = makeEnv({ EMAIL_TO: '', EMAIL_FROM: '', EMAIL: undefined });
    await deliverLead(env, 'lead-1', T0);

    const row = await outboxRow();
    expect(row).toMatchObject({ sent_at: T0, last_error: 'logged only, email is off here' });
    expect(row?.sent_to).toBe('[]');
    expect(logs.infos.join()).toContain('lead_email_logged_only');
    expect(logs.all()).not.toContain('jane@example.com');
  });

  it('treats a missing binding with recipients set as a fault to retry, not as logged-only', async () => {
    await seedLead();
    await deliverLead(makeEnv({ EMAIL: undefined }), 'lead-1', T0);
    const row = await outboxRow();
    expect(row).toMatchObject({ sent_at: null, attempts: 1 });
    expect(row?.last_error).toContain('binding is missing');
  });

  it('keeps contact details out of the logs when an error message echoes them', async () => {
    await seedLead();
    const env = makeEnv();
    env.EMAIL.send.mockRejectedValue(new Error('rejected reply_to jane@example.com'));
    await deliverLead(env, 'lead-1', T0);
    expect(logs.errors.join()).toContain('lead_email_failed');
    expect(logs.all()).not.toContain('jane@example.com');
    expect((await outboxRow())?.last_error).not.toContain('jane@example.com');
  });
});

describe('the lease', () => {
  it('stops the cron double-sending while the request holds the lease', async () => {
    await seedLead();
    const env = makeEnv();
    let cronHandled = -1;
    env.EMAIL.send.mockImplementation(async () => {
      if (cronHandled === -1) cronHandled = await drainOutbox(env, T0);
      return { messageId: 'm' };
    });

    await deliverLead(env, 'lead-1', T0);

    expect(cronHandled).toBe(0);
    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
  });

  it('stops the request double-sending while the cron holds the lease', async () => {
    await seedLead();
    const env = makeEnv();
    let requested = false;
    env.EMAIL.send.mockImplementation(async () => {
      if (!requested) {
        requested = true;
        await deliverLead(env, 'lead-1', T0);
      }
      return { messageId: 'm' };
    });

    expect(await drainOutbox(env, T0)).toBe(1);
    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
  });

  it('sends once when the request and cron race', async () => {
    await seedLead();
    const env = makeEnv();
    await Promise.all([
      deliverLead(env, 'lead-1', T0),
      drainOutbox(env, T0),
      deliverLead(env, 'lead-1', T0),
      drainOutbox(env, T0),
    ]);
    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
  });

  it('never sends a finished lead again', async () => {
    await seedLead();
    const env = makeEnv();
    await deliverLead(env, 'lead-1', T0);
    await deliverLead(env, 'lead-1', T0 + DAY);
    expect(await drainOutbox(env, T0 + DAY)).toBe(0);
    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
  });

  it('gives a row back when a Worker died mid-send and its lease lapsed', async () => {
    await seedLead();
    const env = makeEnv();
    await db.prepare('UPDATE outbox SET lease = ? WHERE lead_id = ?').bind(T0 + 2 * MINUTE, 'lead-1').run();

    expect(await drainOutbox(env, T0 + MINUTE)).toBe(0);
    expect(env.EMAIL.send).not.toHaveBeenCalled();

    expect(await drainOutbox(env, T0 + 2 * MINUTE)).toBe(1);
    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
  });
});

describe('retries', () => {
  it('backs off, retries from the cron, then finishes', async () => {
    await seedLead();
    const env = makeEnv();
    env.EMAIL.send.mockRejectedValue(new Error('binding down'));

    await deliverLead(env, 'lead-1', T0);
    let row = await outboxRow();
    expect(row).toMatchObject({ attempts: 1, sent_at: null, lease: T0 + MINUTE });
    expect(row?.last_error).toContain('binding down');

    // Not due yet.
    expect(await drainOutbox(env, T0 + 30_000)).toBe(0);

    // Due, still failing, and the wait doubles.
    expect(await drainOutbox(env, T0 + MINUTE)).toBe(1);
    row = await outboxRow();
    expect(row).toMatchObject({ attempts: 2, lease: T0 + MINUTE + 2 * MINUTE });

    // The binding comes back.
    env.EMAIL.send.mockResolvedValue({ messageId: 'm' });
    expect(await drainOutbox(env, T0 + 3 * MINUTE)).toBe(1);
    row = await outboxRow();
    expect(row).toMatchObject({ attempts: 2, sent_at: T0 + 3 * MINUTE, lease: 0, last_error: null });
  });

  it('caps the wait at an hour', async () => {
    await seedLead();
    const env = makeEnv();
    env.EMAIL.send.mockRejectedValue(new Error('down'));
    await db.prepare('UPDATE outbox SET attempts = 20').run();
    await deliverLead(env, 'lead-1', T0);
    expect((await outboxRow())?.lease).toBe(T0 + 60 * MINUTE);
  });

  it('does not re-send to whoever already got it after a partial failure', async () => {
    await seedLead();
    const env = makeEnv();
    env.EMAIL.send.mockImplementation(async (message: { to: string }) => {
      if (message.to === 'two@example.test') throw new Error('not verified');
      return { messageId: 'm' };
    });

    await deliverLead(env, 'lead-1', T0);
    let row = await outboxRow();
    expect(row?.sent_at).toBeNull();
    expect(JSON.parse(String(row?.sent_to))).toEqual(['one@example.test']);

    env.EMAIL.send.mockClear();
    env.EMAIL.send.mockResolvedValue({ messageId: 'm' });
    await drainOutbox(env, T0 + MINUTE);

    expect(env.EMAIL.send.mock.calls.map((call) => (call[0] as { to: string }).to)).toEqual([
      'two@example.test',
    ]);
    row = await outboxRow();
    expect(row?.sent_at).toBe(T0 + MINUTE);
  });

  it('one failing lead does not block the next', async () => {
    await seedLead({ id: 'bad', conversion_id: 'c1', email: 'bad@example.com' });
    await seedLead({ id: 'good', conversion_id: 'c2', email: 'good@example.com' });
    const env = makeEnv();
    env.EMAIL.send.mockImplementation(async (message: { replyTo: string }) => {
      if (message.replyTo === 'bad@example.com') throw new Error('rejected');
      return { messageId: 'm' };
    });

    expect(await drainOutbox(env, T0)).toBe(2);
    expect((await outboxRow('good'))?.sent_at).toBe(T0);
    expect((await outboxRow('bad'))?.sent_at).toBeNull();
  });

  it('caps each run, and picks the rest up on the next', async () => {
    for (let i = 0; i < 30; i++) await seedLead({ id: `l${i}`, conversion_id: `c${i}` });
    const env = makeEnv();
    expect(await drainOutbox(env, T0)).toBe(25);
    expect(await drainOutbox(env, T0)).toBe(5);
  });

  it('stops trying after 80 attempts, but the row stays unsent so health keeps reporting it', async () => {
    await seedLead();
    const env = makeEnv();
    await db.prepare('UPDATE outbox SET attempts = 80').run();
    expect(await drainOutbox(env, T0)).toBe(0);
    expect(env.EMAIL.send).not.toHaveBeenCalled();
    expect(await outboxStuck(db, T0 + 16 * MINUTE)).toBe(true);
  });

  it('never throws out of the request, even with D1 down', async () => {
    const env = makeEnv({ DB: brokenDb() });
    await expect(deliverLead(env, 'lead-1', T0)).resolves.toBeUndefined();
  });
});

describe('/api/health', () => {
  const health = (env: Env) => callWorker(new Request(`${ORIGIN}/api/health`), env);

  it('returns ok and outboxStuck and nothing more', async () => {
    const response = await health(makeEnv());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, outboxStuck: false });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('is not stuck for an unsent lead under 15 minutes old', async () => {
    await seedLead({ created_at: Date.now() - 14 * MINUTE });
    expect(await (await health(makeEnv())).json()).toEqual({ ok: true, outboxStuck: false });
  });

  it('is stuck for an unsent lead over 15 minutes old', async () => {
    await seedLead({ created_at: Date.now() - 16 * MINUTE });
    const response = await health(makeEnv());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, outboxStuck: true });
  });

  it('is not stuck once that lead is sent', async () => {
    await seedLead({ created_at: Date.now() - 16 * MINUTE });
    await deliverLead(makeEnv(), 'lead-1');
    expect(await (await health(makeEnv())).json()).toEqual({ ok: true, outboxStuck: false });
  });

  it('says not ok, with no detail, when D1 is down', async () => {
    const response = await health(makeEnv({ DB: brokenDb() }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, outboxStuck: false });
  });

  it('rejects other methods', async () => {
    const response = await callWorker(
      new Request(`${ORIGIN}/api/health`, { method: 'POST' }),
      makeEnv(),
    );
    expect(response.status).toBe(405);
  });
});

describe('the cron', () => {
  const runCron = (env: Env) => worker.scheduled({} as ScheduledController, env);

  it('retries unsent leads and deletes events older than 180 days', async () => {
    await seedLead();
    const now = Date.now();
    await db.batch([
      db.prepare("INSERT INTO events (ts, name) VALUES (?, 'PageVisit')").bind(now - 181 * DAY),
      db.prepare("INSERT INTO events (ts, name) VALUES (?, 'PageVisit')").bind(now - 179 * DAY),
    ]);
    const env = makeEnv();

    await runCron(env);

    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
    const left = await db.prepare('SELECT ts FROM events').all<{ ts: number }>();
    expect(left.results.map((row) => row.ts)).toEqual([now - 179 * DAY]);
  });

  it('keeps an event exactly 180 days old, and deletes one a moment older', async () => {
    await db.batch([
      db.prepare("INSERT INTO events (ts, name) VALUES (?, 'a')").bind(T0 - 180 * DAY),
      db.prepare("INSERT INTO events (ts, name) VALUES (?, 'b')").bind(T0 - 180 * DAY - 1),
    ]);
    await pruneEvents(db, T0);
    const left = await db.prepare('SELECT name FROM events').all<{ name: string }>();
    expect(left.results.map((row) => row.name)).toEqual(['a']);
  });

  it('keeps a lead exactly 730 days old, and deletes an older one with its outbox row', async () => {
    await seedLead({ id: 'kept', conversion_id: 'conv-kept', created_at: T0 - 730 * DAY });
    await seedLead({ id: 'gone', conversion_id: 'conv-gone', created_at: T0 - 730 * DAY - 1 });
    await pruneLeads(db, T0);
    const leads = await db.prepare('SELECT id FROM leads').all<{ id: string }>();
    const outbox = await db.prepare('SELECT lead_id FROM outbox').all<{ lead_id: string }>();
    expect(leads.results.map((row) => row.id)).toEqual(['kept']);
    expect(outbox.results.map((row) => row.lead_id)).toEqual(['kept']);
  });

  it('one failing job does not stop the other, and the cron itself does not throw', async () => {
    const env = makeEnv({ DB: brokenDb() });
    await expect(runCron(env)).resolves.toBeUndefined();
    const errors = logs.errors.join();
    expect(errors).toContain('"job":"outbox"');
    expect(errors).toContain('"job":"events-retention"');
  });
});

describe('end to end through the Worker', () => {
  it('a lead whose email failed in the request is delivered by the next cron run', async () => {
    mockNetwork();
    const env = makeEnv();
    env.EMAIL.send.mockRejectedValue(new Error('binding down'));
    const response = await callWorker(jsonRequest('/api/lead', validLead()), env);
    expect(response.status).toBe(200);
    expect((await db.prepare('SELECT * FROM outbox').first<OutboxRow>())?.sent_at).toBeNull();

    env.EMAIL.send.mockClear();
    env.EMAIL.send.mockResolvedValue({ messageId: 'm' });
    await db.prepare('UPDATE outbox SET lease = 0').run();
    await worker.scheduled({} as ScheduledController, env);

    expect(env.EMAIL.send).toHaveBeenCalledTimes(2);
    expect((await db.prepare('SELECT * FROM outbox').first<OutboxRow>())?.sent_at).toEqual(
      expect.any(Number),
    );
  });
});
