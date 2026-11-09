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
  // The one CTA, everywhere (research/FACTS.md section 1). It opens the booking dialog. Every button, the header,
  // the dialog title and the talk line read the label from here.
  // 2026-11-08: changed from 'Book a ranking review' after the owner's CTA feedback; owner confirmation pending.
  // To revert, put the old label back on the next line.
  cta: {
    label: 'Get your plan and price',
    sub: 'Free, 30 minutes with Fahim. You leave knowing which searches can bring you clients, what it takes and what it costs.',
    href: '/#book',
  },
  // The hero form's words, everywhere a hero form is set (judge ruling 1, 2026-11-08). A practice page swaps
  // "your firm" for its practice in plain words through askTitle().
  ask: {
    sub: 'Send your website. Fahim sends back the searches worth winning in your market and your monthly price, in writing.',
    submit: 'Get my plan and price',
    talk: 'Prefer a call?',
    reply: 'Fahim answers within an hour in business hours.',
    done: 'Your plan and price come by email within an hour in business hours.',
  },
  contact: {
    email: 'hello@lawyerseoexpert.com',
  },
  calendly: {
    url: calendly,
    // Calendly's own accent set to LSE's ink (black).
    embedUrl: `${calendly}?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=000000`,
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
    // Turnstile widget "lawyerseoexpert.com" (Managed), created 2026-11-09 for the apex, www and the workers.dev host.
    // Public. Previews and localhost use the test key below. The secret is TURNSTILE_SECRET on the Worker.
    turnstileSiteKey: '0x4AAAAAAF5oIvENgpApeb7f',
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
    line: 'SEO and websites for law firms, led by S. M. Fahim.',
    copyright: '© 2026 Lawyer SEO Expert',
  },
  social: {
    linkedin: 'https://www.linkedin.com/company/lawyer-seo-expert/',
    facebook: 'https://www.facebook.com/LawyerSEOExpert',
    instagram: 'https://www.instagram.com/lawyerseoexpert',
  },
};

/** The hero form's heading. `who` is "your firm", or the practice in plain words, like "your injury firm". */
export const askTitle = (who = 'your firm'): string => `What could Google bring ${who}, and what would it cost?`;

/** S. M. Fahim, from research/FACTS.md section 3. The homepage adds this node; about pages can too. */
export const fahimSchema = {
  '@type': 'Person',
  '@id': 'https://lawyerseoexpert.com/#fahim',
  name: 'S. M. Fahim',
  jobTitle: 'SEO specialist',
  worksFor: { '@id': 'https://lawyerseoexpert.com/#org' },
  image: 'https://lawyerseoexpert.com/img/people/fahim.webp',
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'Rajshahi University of Engineering & Technology (RUET)' },
  knowsAbout: ['Search engine optimization', 'Law firm SEO', 'Local SEO', 'Web development'],
};

/** Josh Henderson, Sales Director, from research/FACTS.md section 3. He gives business input, not legal advice. */
export const joshSchema = {
  '@type': 'Person',
  '@id': 'https://lawyerseoexpert.com/#josh',
  name: 'Josh Henderson',
  jobTitle: 'Sales Director',
  worksFor: { '@id': 'https://lawyerseoexpert.com/#org' },
  image: 'https://lawyerseoexpert.com/img/people/josh.webp',
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'Texas Tech University School of Law' },
    { '@type': 'CollegeOrUniversity', name: 'University of New Mexico' },
  ],
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
    description: "SEO for law firms that puts them at the top of Google, the Map and Google's AI answers, led by S. M. Fahim. Websites built to rank.",
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
