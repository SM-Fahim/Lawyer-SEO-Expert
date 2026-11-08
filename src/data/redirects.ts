// Every redirect, old path to new path. The router keeps the query string, and
// matches each path with or without its trailing slash. One hop each: a target is never itself a redirect.
//
// Sources: PLAN.md section 2 (legacy URLs with impressions), research/INVENTORY.md sections 1, 5 and 7, every
// internal link in the saved WordPress pages (research/live/*.html), and the live Rank Math sitemap index
// (post-, page- and category-sitemap.xml, read 2026-11-08). The Search Console export has no page column.
// Not here on purpose:
//   /wp-admin/, /wp-login.php  Nothing to send them to. They answer 404, the broken-page log skips /wp-* paths
//                              (worker/broken.ts), and robots.txt keeps "Disallow: /wp-admin/", as LCME did after
//                              its WordPress retirement. /wp-json/, /xmlrpc.php and /wp-content/* answer 404 too.
//   /feed/                     The router serves dist/feed.xml at /feed/ (worker/router.ts). src/pages/feed.xml.ts builds it.
//   /intake, /intake/*         Another Worker's routes. Never redirected from or to.
export interface Redirect {
  from: string;
  to: string;
  status: 301 | 302;
}

export const redirects: readonly Redirect[] = [
  // Old slugs and duplicates of existing pages.
  { from: '/seo-pricing-page/', to: '/seo-pricing/', status: 301 },
  { from: '/personal-injury-lawyer-seo-2/', to: '/seo-for-personal-injury-lawyers/', status: 301 },
  { from: '/seo-for-personal-injury-lawyer/', to: '/seo-for-personal-injury-lawyers/', status: 301 },
  { from: '/seo-for-dui-lawyer/', to: '/seo-for-dui-attorneys/', status: 301 },
  { from: '/crm-software-for-personal-injury-law-firm', to: '/crm-software-for-personal-injury-lawyers/', status: 301 },
  // The old how-to-get-clients post linked here twice; the PPC page is its own page now.
  { from: '/expert-ppc-management-for-lawyers/', to: '/law-firm-ppc/', status: 301 },

  // The newsletter page was empty, with no sign-up (INVENTORY.md section 5). Owner default: send it to the blog.
  // The misspelt address goes straight there too, so it isn't a chain.
  { from: '/newsletter/', to: '/blog/', status: 301 },
  { from: '/newslatter/', to: '/blog/', status: 301 },

  // Services that have no page of their own (the old content writing page was empty). The law firm names post
  // linked a business-law page that never existed on this site (KEYWORD-MAP.md: no page for it yet).
  { from: '/lawyer-content-writing/', to: '/law-firm-seo-services/', status: 301 },
  { from: '/seo-for-business-lawyer/', to: '/law-firm-seo-services/', status: 301 },

  // WordPress accounts that never existed on this site.
  { from: '/register/', to: '/', status: 301 },
  { from: '/login/', to: '/', status: 301 },

  // Author archives. Rank Math's schema named /author/s-m-fahim/; the posts said "By admin".
  // Any other /author/* path goes to /blog/ (archivePrefixes below).
  { from: '/author/s-m-fahim/', to: '/about/sm-fahim/', status: 301 },

  // WordPress's comments feed. The posts feed keeps /feed/.
  { from: '/comments/feed/', to: '/feed/', status: 301 },

  // Rank Math's sitemap addresses.
  { from: '/sitemap_index.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/page-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/post-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/category-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/author-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/wp-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/sitemap.xml', to: '/sitemap-index.xml', status: 301 },
];

// WordPress archives, matched by prefix after the exact list above. INVENTORY.md section 7: the four
// /category/* pages were identical copies of the blog grid, and so were their feeds and page 2s. There were no
// tags, and no author page of its own. A path that is exactly a prefix (/category/) is covered too.
export const archivePrefixes: readonly Redirect[] = [
  { from: '/category/', to: '/blog/', status: 301 },
  { from: '/tag/', to: '/blog/', status: 301 },
  { from: '/author/', to: '/blog/', status: 301 },
  { from: '/blog/page/', to: '/blog/', status: 301 },
];

// WordPress shortlinks (/?p=1031, /?page_id=1031): each page's post ID, from the shortlink in its saved HTML
// (research/live/*.html). The router sends a known ID on the homepage to its page with a 301, dropping only
// the p or page_id parameter. An unknown ID is the homepage, as before.
export const wordpressIds: Readonly<Record<string, string>> = {
  '1029': '/about/',
  '197': '/about/josh-henderson/',
  '155': '/about/sm-fahim/',
  '1031': '/careers/',
  '118': '/contact-us/',
  '1210': '/crm-add/',
  '1285': '/crm-add-v2/',
  '236': '/lawyer-web-design-development/',
  '1030': '/privacy-policy/',
  '918': '/terms-and-conditions/',
  '504': '/seo-pricing/',
  '329': '/seo-pricing/',
  '650': '/law-firm-seo-services/',
  '935': '/blog/',
  '376': '/seo-for-bankruptcy-lawyers/',
  '380': '/seo-for-criminal-defense-lawyers/',
  '382': '/seo-for-dui-attorneys/',
  '384': '/seo-for-employment-lawyers/',
  '386': '/seo-for-environmental-law-attorneys/',
  '388': '/seo-for-estate-planning-lawyers/',
  '397': '/seo-for-family-lawyers/',
  '399': '/seo-for-immigration-lawyers/',
  '402': '/seo-for-personal-injury-lawyers/',
  '1000': '/criminal-defense-seo-guide/',
  '786': '/crm-software-for-personal-injury-lawyers/',
  '571': '/how-to-get-clients-as-lawyers/',
  '610': '/law-firm-names/',
  '778': '/law-firm-social-media-post-ideas/',
  '577': '/lawyer-domain-names/',
  '855': '/pi-settlement-and-attorney-fee-calculator/',
  '882': '/the-most-effective-system-to-get-personal-injury-clients-now/',
  '1014': '/web-development-for-lawyers-guide/',
};

// Redirect targets whose pages are not built yet. scripts/check-dist.mjs only warns about these, and fails
// if one is built but still listed here (a stale entry), or when STRICT_REDIRECTS=1 and any is unbuilt.
// Remove each entry in the commit that ships its page. The launch build must have this list empty.
export const pendingRedirectTargets: readonly string[] = [];
