// The source each Calendly booking carries, so the meeting in Calendly shows where it came from.
// No side effects on import, so the tests can load it without a page.

import { currentTouch } from '../features/tracking/track';

// Calendly ignores a value of 255 characters or more.
const MAX_UTM = 254;
const UTM_NAMES: Record<string, string> = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
};
// LSE and LCME share one Calendly event, so a booking needs a mark saying which site it came from. It goes in
// utm_content, the one tag a visitor almost never brings, and only when they bring none, so their own tags win.
const SITE_TAG = 'lawyerseoexpert.com';

/** The visitor's tags, or the site that sent them as utm_source, plus the site mark. */
export function bookingSource(): Record<string, string> {
  const touch = currentTouch();
  const utm: Record<string, string> = {};
  for (const from of Object.keys(UTM_NAMES)) {
    const value = touch[from] || (from === 'utm_source' ? touch.referrer : '');
    if (value) utm[from] = value.slice(0, MAX_UTM);
  }
  utm.utm_content ??= SITE_TAG;
  return utm;
}

/** The widget's option names for the same values. */
export function widgetUtm(source: Record<string, string>): Record<string, string> {
  const utm: Record<string, string> = {};
  for (const [from, value] of Object.entries(source)) {
    const to = UTM_NAMES[from];
    if (to) utm[to] = value;
  }
  return utm;
}
