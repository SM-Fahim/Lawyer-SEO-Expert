// Sitewide facts: name, contact, booking link, tracking IDs, schema. Placeholder nav until the design phase.

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
  // TODO(design): real share image and logo. These paths are placeholders and are not required to exist.
  ogImage: '/img/og-default.png',
  logo: '/favicon.ico',
  cta: {
    label: 'Schedule a call',
    href: '/#book',
  },
  contact: {
    email: 'hello@lawyerseoexpert.com',
  },
  calendly: {
    url: calendly,
    // TODO(design): add primary_color=<LSE accent hex> once the brand colour is chosen.
    embedUrl: `${calendly}?hide_event_type_details=1&hide_gdpr_banner=1`,
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
  // TODO(design): the real navigation and footer.
  nav: [
    { label: 'Contact', href: '/contact-us/' },
  ] as NavLink[],
  footer: {
    legal: [{ label: 'Privacy policy', href: '/privacy-policy/' }] as NavLink[],
    copyright: '© 2026 Lawyer SEO Expert',
  },
  social: {
    linkedin: 'https://www.linkedin.com/company/lawyer-seo-expert/',
    facebook: 'https://www.facebook.com/LawyerSEOExpert',
    instagram: 'https://www.instagram.com/lawyerseoexpert',
  },
};

/** Organization and WebSite JSON-LD, used on every indexable page. TODO(copy): description and people. */
export const siteSchema: object[] = [
  {
    '@type': 'ProfessionalService',
    '@id': 'https://lawyerseoexpert.com/#org',
    name: 'Lawyer SEO Expert',
    url: 'https://lawyerseoexpert.com/',
    email: 'hello@lawyerseoexpert.com',
    areaServed: 'US',
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
