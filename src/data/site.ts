// Sitewide facts: name, contact, booking link, tracking IDs, schema, header navigation.

export interface NavLink {
  label: string;
  href: string;
}

// The one place the booking link lives. Everything else (the dialog, the form's fallback, the embed) reads it.
// LSE shares this Calendly event with LCME for now (docs/MANUAL-REVIEW.md).
const calendly = 'https://calendly.com/connect-with-fahim/schedule-call';

export const site = {
  name: 'Lawyer SEO Expert',
  url: 'https://lawyerseoexpert.com',
  // 1200x630, made from the brand (docs/design-system.md says how to remake it).
  ogImage: '/img/og-default.png',
  logo: '/favicon.svg',
  // The one CTA, everywhere (research/FACTS.md section 1). It opens the booking dialog.
  cta: {
    label: 'Book a ranking review',
    sub: "Free, 30 minutes. Fahim pulls up your firm's real rankings while you watch.",
    href: '/#book',
  },
  contact: {
    email: 'hello@lawyerseoexpert.com',
  },
  calendly: {
    url: calendly,
    // Calendly's own accent set to LSE's evergreen ink.
    embedUrl: `${calendly}?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=12372a`,
  },
  prices: {
    seo: 'from $2,000/month',
    website: 'from $2,000',
  },
  tracking: {
    // Public ID, and the only copy for the browser. The tracker is compiled with it (features/tracking/inline.ts).
    // LSE's existing pixel from the old Reddit account. WordPress's plugin sends for it too until retired.
    redditPixelId: 'a2_hx7ja4uz0lm1',
    // Public. Blank turns GA4 off in the browser. The Worker has its own copy in wrangler.jsonc (GA4_MEASUREMENT_ID).
    // TODO(owner): fill in LSE's own GA4 measurement ID in both places when the property exists.
    ga4MeasurementId: '',
    // Meta Pixel (dataset) ID. Public. Blank turns Meta off in the browser: fbevents.js isn't loaded.
    // The Worker has its own copy in wrangler.jsonc (META_PIXEL_ID).
    metaPixelId: '',
    // TODO(Cloudflare): create a Turnstile widget for lawyerseoexpert.com and the workers.dev host, paste its site key here.
    // Blank: Previews and localhost still work (they use the test key). The pre-launch and production hosts need this set.
    turnstileSiteKey: '',
    // Cloudflare's published test key: always passes, widget visible. Used off production.
    turnstileTestSiteKey: '1x00000000000000000000AA',
  },
  // Header links. The footer lists every planned page from src/data/pages.ts.
  nav: [
    { label: 'SEO services', href: '/law-firm-seo-services/' },
    { label: 'Practice areas', href: '/#practice-areas' },
    { label: 'Web design', href: '/lawyer-web-design-development/' },
    { label: 'Pricing', href: '/seo-pricing/' },
    { label: 'About', href: '/about/sm-fahim/' },
  ] as NavLink[],
  footer: {
    line: 'SEO for law firms, led by S. M. Fahim. Each month you see every task in a log.',
    copyright: '© 2026 Lawyer SEO Expert',
  },
  social: {
    linkedin: 'https://www.linkedin.com/company/lawyer-seo-expert/',
    facebook: 'https://www.facebook.com/LawyerSEOExpert',
    instagram: 'https://www.instagram.com/lawyerseoexpert',
  },
};

/** S. M. Fahim, from research/FACTS.md section 3. The homepage adds this node; about pages can too. */
export const fahimSchema = {
  '@type': 'Person',
  '@id': 'https://lawyerseoexpert.com/#fahim',
  name: 'S. M. Fahim',
  jobTitle: 'SEO specialist',
  worksFor: { '@id': 'https://lawyerseoexpert.com/#org' },
  image: 'https://lawyerseoexpert.com/img/people/fahim-720.webp',
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'Rajshahi University of Engineering & Technology (RUET)' },
  knowsAbout: ['Search engine optimization', 'Law firm SEO', 'Local SEO', 'Web development'],
};

/** Organization and WebSite JSON-LD, used on every indexable page. */
export const siteSchema: object[] = [
  {
    '@type': 'ProfessionalService',
    '@id': 'https://lawyerseoexpert.com/#org',
    name: 'Lawyer SEO Expert',
    url: 'https://lawyerseoexpert.com/',
    logo: 'https://lawyerseoexpert.com/icon-512.png',
    image: 'https://lawyerseoexpert.com/img/og-default.png',
    description: 'SEO and websites for law firms, led by S. M. Fahim, with a monthly log of every task.',
    email: 'hello@lawyerseoexpert.com',
    areaServed: { '@type': 'Country', name: 'United States' },
    priceRange: 'From $2,000',
    sameAs: [site.social.linkedin, site.social.facebook, site.social.instagram],
  },
  {
    '@type': 'WebSite',
    '@id': 'https://lawyerseoexpert.com/#site',
    url: 'https://lawyerseoexpert.com/',
    name: 'Lawyer SEO Expert',
    publisher: { '@id': 'https://lawyerseoexpert.com/#org' },
  },
];
