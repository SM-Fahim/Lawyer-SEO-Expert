import { describe, expect, it } from 'vitest';
import { archivePrefixes, pendingRedirectTargets, redirects, wordpressIds } from '../../src/data/redirects';

const INTAKE = /^\/intake(\/|$)/i;
const noSlash = (path: string) => path.replace(/\/$/, '') || '/';
const sources = new Set(redirects.map((r) => noSlash(r.from)));
const map = new Map(redirects.map((r) => [noSlash(r.from), r.to]));

// /intake and /intake/* on the zone are routed to another Worker (rudin-intake-staging). This site must never
// redirect from or to them. scripts/check-dist.mjs also fails the build if a built file sits under /intake.
describe('redirect table', () => {
  it('never touches /intake', () => {
    for (const { from, to } of [...redirects, ...archivePrefixes]) {
      expect(from).not.toMatch(INTAKE);
      expect(to).not.toMatch(INTAKE);
    }
    for (const to of Object.values(wordpressIds)) expect(to).not.toMatch(INTAKE);
  });

  it('is one hop: no target is itself a redirect', () => {
    const targets = [...redirects, ...archivePrefixes].map((r) => r.to).concat(Object.values(wordpressIds));
    for (const to of targets) expect(sources.has(noSlash(to)), to).toBe(false);
  });

  it('sends no archive prefix to a path inside it', () => {
    for (const { from, to } of archivePrefixes) expect(to.startsWith(from)).toBe(false);
  });

  it('is all 301s', () => {
    for (const { status } of [...redirects, ...archivePrefixes]) expect(status).toBe(301);
  });

  it('waits on no unbuilt page (a launch build needs this empty)', () => {
    expect(pendingRedirectTargets).toEqual([]);
  });

  // PLAN.md section 2: legacy URLs with impressions but no page.
  it.each([
    ['/personal-injury-lawyer-seo-2', '/seo-for-personal-injury-lawyers/'],
    ['/seo-for-dui-lawyer', '/seo-for-dui-attorneys/'],
    ['/seo-for-personal-injury-lawyer', '/seo-for-personal-injury-lawyers/'],
    ['/crm-software-for-personal-injury-law-firm', '/crm-software-for-personal-injury-lawyers/'],
    ['/register', '/'],
    ['/login', '/'],
    ['/newslatter', '/blog/'],
  ])('has the legacy URL %s, to %s', (from, to) => {
    expect(map.get(from)).toBe(to);
  });

  // research/INVENTORY.md: the old pages that have no page of their own now, and old internal links.
  it.each([
    ['/newsletter', '/blog/'],
    ['/seo-pricing-page', '/seo-pricing/'],
    ['/lawyer-content-writing', '/law-firm-seo-services/'],
    ['/seo-for-business-lawyer', '/law-firm-seo-services/'],
    ['/expert-ppc-management-for-lawyers', '/law-firm-ppc/'],
    ['/author/s-m-fahim', '/about/sm-fahim/'],
    ['/comments/feed', '/feed/'],
  ])('has the old page %s, to %s', (from, to) => {
    expect(map.get(from)).toBe(to);
  });

  it.each(['/sitemap_index.xml', '/page-sitemap.xml', '/post-sitemap.xml', '/category-sitemap.xml', '/author-sitemap.xml', '/wp-sitemap.xml', '/sitemap.xml'])(
    'sends the WordPress sitemap %s to the site\'s own sitemap',
    (from) => {
      expect(map.get(from)).toBe('/sitemap-index.xml');
    },
  );

  it('covers the category, tag and author archives by prefix', () => {
    const prefixes = new Map(archivePrefixes.map((r) => [r.from, r.to]));
    expect(prefixes.get('/category/')).toBe('/blog/');
    expect(prefixes.get('/tag/')).toBe('/blog/');
    expect(prefixes.get('/author/')).toBe('/blog/');
  });

  it('knows the shortlink ID of every old page with a new home', () => {
    expect(Object.keys(wordpressIds)).toHaveLength(32);
    expect(wordpressIds['1031']).toBe('/careers/');
    expect(wordpressIds['935']).toBe('/blog/');
    expect(wordpressIds['329']).toBe('/seo-pricing/');
  });

  it('leaves /feed/, /wp-login.php and /wp-admin/ out (the router serves the feed; the rest answer 404)', () => {
    for (const path of ['/feed', '/wp-login.php', '/wp-admin']) expect(sources.has(path)).toBe(false);
  });
});
