-- One row per Calendly booking, with where it came from. No IP and no contact details: the name
-- and email stay in Calendly. A separate table, so that if it's missing, only this list is lost and
-- events still save. The cron deletes rows after 180 days, like events.
--
-- utm_* and referrer are the last touch: the latest tagged link, or the latest other site that sent
-- this visitor. landing is the page that visit started on. first_utm_json is the first touch.
-- reddit_click is 1 when a Reddit click ID from the last 90 days was present.
CREATE TABLE bookings (
  conversion_id  TEXT PRIMARY KEY,
  ts             INTEGER NOT NULL,
  page           TEXT,
  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  utm_content    TEXT,
  utm_term       TEXT,
  referrer       TEXT,
  landing        TEXT,
  first_utm_json TEXT,
  reddit_click   INTEGER NOT NULL DEFAULT 0,
  is_test        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX bookings_ts ON bookings (ts);
