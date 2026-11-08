// Every planned page, for the header, the footer and the practice links. A page still goes live by being
// built. Until it is, scripts/check-dist.mjs lets links to the paths below through with a warning, and a launch
// build (STRICT_REDIRECTS=1) fails while any is unbuilt. So a link can be written before its page exists.
import type { NavLink } from './site';

export interface PracticePage extends NavLink {
  /** A real search for this practice area, from research/KEYWORD-MAP.md section 2. Shown as a typed query. */
  query: string;
}

export const practicePages: readonly PracticePage[] = [
  { label: 'Personal injury', href: '/seo-for-personal-injury-lawyers/', query: 'personal injury lawyer seo' },
  { label: 'Criminal defense', href: '/seo-for-criminal-defense-lawyers/', query: 'criminal defense lawyer seo' },
  { label: 'Family law', href: '/seo-for-family-lawyers/', query: 'seo for family law' },
  { label: 'DUI', href: '/seo-for-dui-attorneys/', query: 'seo for dui attorneys' },
  { label: 'Employment', href: '/seo-for-employment-lawyers/', query: 'employment lawyer seo' },
  { label: 'Estate planning', href: '/seo-for-estate-planning-lawyers/', query: 'estate planning seo' },
  { label: 'Bankruptcy', href: '/seo-for-bankruptcy-lawyers/', query: 'bankruptcy attorney seo' },
  { label: 'Immigration', href: '/seo-for-immigration-lawyers/', query: 'immigration law firm marketing' },
  { label: 'Medical malpractice', href: '/seo-for-medical-malpractice-lawyer/', query: 'medical malpractice seo' },
  { label: 'Intellectual property', href: '/seo-for-intellectual-property-lawyers/', query: 'intellectual property seo company' },
  { label: 'Environmental law', href: '/seo-for-environmental-law-attorneys/', query: 'environmental lawyer seo' },
];

export const servicePages: readonly NavLink[] = [
  { label: 'SEO services', href: '/law-firm-seo-services/' },
  { label: 'SEO consultant', href: '/law-firm-seo-consultant/' },
  { label: 'Pricing', href: '/seo-pricing/' },
  { label: 'Web design and development', href: '/lawyer-web-design-development/' },
  { label: 'Google Ads management', href: '/law-firm-ppc/' },
];

export const companyPages: readonly NavLink[] = [
  { label: 'About', href: '/about/' },
  { label: 'S. M. Fahim', href: '/about/sm-fahim/' },
  { label: 'Josh Henderson', href: '/about/josh-henderson/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Contact', href: '/contact-us/' },
];

export const legalPages: readonly NavLink[] = [
  { label: 'Privacy policy', href: '/privacy-policy/' },
  { label: 'Terms', href: '/terms-and-conditions/' },
];

/** Paths that may be linked before they are built. check-dist reads this. */
export const plannedPaths: readonly string[] = [
  ...practicePages,
  ...servicePages,
  ...companyPages,
  ...legalPages,
].map((page) => page.href);
