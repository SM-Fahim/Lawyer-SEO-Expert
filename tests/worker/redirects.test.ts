import { describe, expect, it } from 'vitest';
import { redirects } from '../../src/data/redirects';

// /intake and /intake/* on the zone are routed to another Worker (rudin-intake-staging). This site must never
// redirect from or to them. scripts/check-dist.mjs also fails the build if a built file sits under /intake.
describe('redirect table', () => {
  it('never touches /intake', () => {
    for (const { from, to } of redirects) {
      expect(from).not.toMatch(/^\/intake(\/|$)/i);
      expect(to).not.toMatch(/^\/intake(\/|$)/i);
    }
  });

  it('is one hop: no target is itself a redirect', () => {
    const sources = new Set(redirects.map((r) => r.from.replace(/\/$/, '')));
    for (const { to } of redirects) expect(sources.has(to.replace(/\/$/, '') || '/')).toBe(false);
  });

  it('has the legacy URLs from the plan', () => {
    const map = new Map(redirects.map((r) => [r.from.replace(/\/$/, ''), r.to]));
    expect(map.get('/seo-pricing-page')).toBe('/seo-pricing/');
    expect(map.get('/seo-for-dui-lawyer')).toBe('/seo-for-dui-attorneys/');
    expect(map.get('/crm-software-for-personal-injury-law-firm')).toBe('/crm-software-for-personal-injury-lawyers/');
    expect(map.get('/newslatter')).toBe('/newsletter/');
    expect(map.get('/login')).toBe('/');
  });
});
