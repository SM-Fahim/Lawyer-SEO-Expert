// Sites we link to as evidence but don't vouch for: other agencies whose published prices the /seo-pricing/
// market table cites (judge ruling, content/DEPTH-BRIEF.md section 18.1). A link to one of these domains, or to
// any subdomain of one, gets rel="nofollow" by itself: in depth copy (src/lib/markdown.ts) and in HairTable.
// Write the bare domain, without "www." or a path. Official sources (Google, bar rules) never go here.
export const nofollowDomains: string[] = [
  // Reserved for examples (RFC 2606). The /kit/ sample and the unit tests use it.
  'example.com',
  // /seo-pricing/, "What other agencies publish as law firm SEO prices": the publishers in its two tables, and the
  // Ahrefs survey (an SEO vendor's own data), which the models section cites too.
  'jurisdigital.com',
  'hennessey.com',
  'growlaw.co',
  'seoprofy.com',
  'webkeydigital.com',
  'fwd-lawyermarketing.com',
  'dagmarmarketing.com',
  'ahrefs.com',
  'whitehat-seo.co.uk',
  'firstpage.com.au',
  'lawonline.ca',
];
