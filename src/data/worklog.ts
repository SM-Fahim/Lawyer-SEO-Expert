// This site's own work log: real tasks done on lawyerseoexpert.com in the rebuild. The homepage shows it as the
// sample of what a client gets each month (content/home.md section 3, judge's ruling 2026-11-08).
//
// Rules: only work that is true on launch day. No invented numbers. Every row is checked by the judge before
// launch (verifyAtLaunch). If a task did not happen by launch, delete its row; never fake one.
// `date` is ISO. null means "done on launch day" and shows as a placeholder until the date is known.

export interface WorkLogRow {
  date: string | null;
  task: string;
  where: string;
  why: string;
  /** Where a reader can check it. A path on this site, or a full URL. */
  href: string;
  /** Link text in the "Check it" column. */
  check: string;
  verifyAtLaunch: true;
}

export const worklog: readonly WorkLogRow[] = [
  {
    date: '2026-11-08',
    task: 'Rewrote the homepage from the first line to the last',
    where: 'Homepage',
    why: 'The old page made claims we could not show proof for',
    href: '/',
    check: 'Read it',
    verifyAtLaunch: true,
  },
  {
    date: '2026-11-08',
    task: 'Fixed the search snippet that showed "+1 +44 +33"',
    where: 'Homepage title and description',
    why: 'Google was quoting phone codes from the old page under our name',
    href: 'https://www.google.com/search?q=lawyer+seo+expert&gl=us&hl=en',
    check: 'Search it',
    verifyAtLaunch: true,
  },
  {
    date: '2026-11-08',
    task: 'Redirected the old page addresses to their new pages',
    where: 'Old WordPress URLs',
    why: 'Links and bookmarks to old pages still land on the right page',
    href: '/seo-pricing-page/',
    check: 'Try an old URL',
    verifyAtLaunch: true,
  },
  {
    date: '2026-11-08',
    task: 'Replaced the old seal logo with a new mark',
    where: 'Every page, and the browser tab',
    why: 'The scales-of-justice seal looked like a law firm, not an SEO specialist',
    href: '/favicon.svg',
    check: 'See the mark',
    verifyAtLaunch: true,
  },
  {
    date: null,
    task: 'Moved the site off WordPress to plain built pages',
    where: 'The whole site',
    why: 'No plugins to patch, and nothing to rebuild on each visit',
    href: '/',
    check: 'View the site',
    verifyAtLaunch: true,
  },
  {
    date: null,
    task: 'Published a sitemap that lists only live pages',
    where: 'sitemap-index.xml',
    why: 'Search engines find every page and nothing that is gone',
    href: '/sitemap-index.xml',
    check: 'Open the sitemap',
    verifyAtLaunch: true,
  },
];
