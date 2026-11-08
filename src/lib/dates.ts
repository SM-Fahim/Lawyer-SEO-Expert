// Dates as the site shows them. Every date is a calendar day, read in UTC so a build anywhere gives the same day.

const dayMonthYearFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-11-08" from a Date or a "YYYY-MM-DD" string. Throws on anything else, so a bad date fails the build. */
export function isoDay(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : value;
  if (Number.isNaN(date.getTime()) || (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(value))) {
    throw new Error(`Not a calendar date: ${String(value)}`);
  }
  return date.toISOString().slice(0, 10);
}

/** "8 November 2026": day, month, year, as on the homepage and in the depth zone's byline. */
export function dayMonthYear(value: Date | string): string {
  return dayMonthYearFmt.format(new Date(`${isoDay(value)}T00:00:00Z`));
}
