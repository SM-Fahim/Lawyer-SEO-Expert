-- Phase 3 schema. All timestamps are integer milliseconds since the epoch (UTC).

-- ids are random UUIDs because the id goes back to the browser, so it must not be guessable.
-- conversion_id is UNIQUE so a retried POST of the same form can't create a second lead.
CREATE TABLE leads (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  website       TEXT,
  firm          TEXT,
  practice_area TEXT,
  message       TEXT,
  extra_json    TEXT,
  page          TEXT,
  variant       TEXT,
  utm_json      TEXT,
  click_id      TEXT,
  conversion_id TEXT NOT NULL UNIQUE,
  ip_hash       TEXT,
  country       TEXT,
  turnstile     TEXT NOT NULL CHECK (turnstile IN ('ok', 'unverified')),
  is_test       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX leads_ip_hash_created_at ON leads (ip_hash, created_at);

-- One row per lead. lease is the time until which nobody else may touch the row: a running
-- send holds it for two minutes, and a failed one sets it to the next retry time.
-- sent_to records who already got the email, so a retry never re-sends to them.
CREATE TABLE outbox (
  lead_id    TEXT PRIMARY KEY REFERENCES leads (id),
  attempts   INTEGER NOT NULL DEFAULT 0,
  lease      INTEGER NOT NULL DEFAULT 0,
  sent_at    INTEGER,
  sent_to    TEXT NOT NULL DEFAULT '[]',
  last_error TEXT
);
CREATE INDEX outbox_unsent_lease ON outbox (lease) WHERE sent_at IS NULL;

-- First-party counts only: no IP and no contact details. The cron deletes rows after 180 days.
CREATE TABLE events (
  id            INTEGER PRIMARY KEY,
  ts            INTEGER NOT NULL,
  name          TEXT NOT NULL,
  page          TEXT,
  variant       TEXT,
  conversion_id TEXT,
  utm_source    TEXT,
  utm_campaign  TEXT,
  is_test       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX events_ts ON events (ts);

-- Every 404 or 5xx page (plan section 5). Written by the Phase 4 router.
CREATE TABLE broken_urls (
  path       TEXT NOT NULL,
  status     INTEGER NOT NULL,
  referrer   TEXT,
  count      INTEGER NOT NULL DEFAULT 1,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  PRIMARY KEY (path, status)
);
