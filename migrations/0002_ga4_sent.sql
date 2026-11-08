-- One row per conversion already sent to GA4, so a retried lead or a repeated beacon is never counted
-- twice (GA4's Measurement Protocol does not dedupe). The key is "<event>:<conversion id>".
-- The cron deletes rows after 30 days.
CREATE TABLE ga4_sent (
  key TEXT PRIMARY KEY,
  ts  INTEGER NOT NULL
);
CREATE INDEX ga4_sent_ts ON ga4_sent (ts);
