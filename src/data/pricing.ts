// The price, and what it replaces. One source for every page that shows it (/, /seo-pricing/,
// /law-firm-seo-services/ and the kit). Never retype these values in a page.
//
// `included`: what the monthly price includes, and what each part typically costs a month when a firm hires it
// separately. Proposals the owner confirms (2026-11-08). check-dist allows a dollar amount only on the pages
// listed for it in PRICES_BY_PAGE (scripts/check-dist.mjs): a page that shows these rows needs every amount
// below, and `separateTotal`, in its PRICES_BY_PAGE entry, or the build fails.

export interface PriceRow {
  item: string;
  cost: string;
}

export const included: readonly PriceRow[] = [
  { item: 'Practice and location pages, written for you', cost: '$1,200+' },
  { item: 'Links from relevant sites', cost: '$1,000+' },
  { item: 'Website design and content improvements', cost: '$750+' },
  { item: 'Website maintenance and security', cost: '$500+' },
  { item: 'Google Business Profile and reviews', cost: '$125+' },
  { item: 'Call and form tracking', cost: '$300+' },
  { item: 'Rank tracking and AI answer checks', cost: '$150+' },
];

/** What the rows above add up to a month, hired one by one. */
export const separateTotal = '$4,000+';

/** The two approved prices (research/FACTS.md section 1). check-dist allows $2,000 everywhere. */
export const price = {
  seo: 'from $2,000 a month',
  seoAmount: '$2,000',
  website: 'from $2,000',
} as const;
