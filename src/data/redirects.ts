// Every redirect, old path to new path. The router keeps the query string, and
// matches each path with or without its trailing slash. One hop each: a target is never itself a redirect.
//
// Sources: PLAN.md section 2 (legacy URLs with impressions) and research/INVENTORY.md section 7.
// Not here on purpose:
//   /wp-admin/, /wp-login.php  Nothing to send them to. They answer 404, the broken-page log skips /wp-* paths
//                              (worker/broken.ts), and robots.txt keeps "Disallow: /wp-admin/", as LCME did after
//                              its WordPress retirement.
//   /feed/                     The router serves dist/feed.xml at /feed/ when a blog ships one (worker/router.ts).
//                              Until then it answers 404.
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
  { from: '/newslatter/', to: '/newsletter/', status: 301 },

  // Services that have no page of their own. PLAN.md section 9: no PPC page.
  { from: '/lawyer-content-writing/', to: '/law-firm-seo-services/', status: 301 },

  // WordPress accounts that never existed on this site.
  { from: '/register/', to: '/', status: 301 },
  { from: '/login/', to: '/', status: 301 },

  // INVENTORY.md section 7: the four category pages were identical copies of the blog grid.
  // TODO(blog): enable these when /blog/ is built.
  // { from: '/category/tips/', to: '/blog/', status: 301 },
  // { from: '/category/personal-injury-lawyer-seo/', to: '/blog/', status: 301 },
  // { from: '/category/criminal-defense-seo/', to: '/blog/', status: 301 },
  // { from: '/category/web-development-for-lawyers/', to: '/blog/', status: 301 },

  // Rank Math's sitemap addresses.
  { from: '/sitemap_index.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/page-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/post-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/category-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/wp-sitemap.xml', to: '/sitemap-index.xml', status: 301 },
  { from: '/sitemap.xml', to: '/sitemap-index.xml', status: 301 },
];

// Redirect targets whose pages are not built yet. scripts/check-dist.mjs only warns about these, and fails
// if one is built but still listed here (a stale entry), or when STRICT_REDIRECTS=1 and any is unbuilt.
// Remove each entry in the commit that ships its page. The launch build must have this list empty.
export const pendingRedirectTargets: readonly string[] = [
  '/crm-software-for-personal-injury-lawyers/',
  '/newsletter/',
];
