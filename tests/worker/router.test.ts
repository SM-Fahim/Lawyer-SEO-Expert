import { afterEach, describe, expect, it, vi } from 'vitest';
import { redirects } from '../../src/data/redirects';
import { envWith, originMustNotBeCalled, send, SITE } from './router-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

const HOMEPAGE = 'new homepage';
const NEW_PAGE = 'a new page';
const NOT_FOUND = 'new 404 page';

describe('the built files', () => {
  it('serves /favicon.ico', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/favicon.ico`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('fixture icon\n');
    expect(origin.requests).toHaveLength(0);
  });

  it('serves /', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(HOMEPAGE);
    expect(origin.requests).toHaveLength(0);
  });

  it('serves /?rdt_cid=x as the new homepage', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/?rdt_cid=x&utm_source=reddit`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(HOMEPAGE);
    expect(origin.requests).toHaveLength(0);
  });

  it('serves /thank-you/ and keeps it working with a query string', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/thank-you/?from=form`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('thank you');
  });

  it('sends /thank-you to /thank-you/ with a 301, keeping the query string', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/thank-you?from=form`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/thank-you/?from=form`);
    expect(origin.requests).toHaveLength(0);
  });

  it('keeps ad click IDs on the slash redirect', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/thank-you?rdt_cid=x&utm_source=reddit`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/thank-you/?rdt_cid=x&utm_source=reddit`);
  });

  it('keeps a Meta fbclid on every kind of redirect', async () => {
    originMustNotBeCalled();
    const query = '?fbclid=IwAR2-abc_1.x&utm_source=facebook';
    const cases: Array<[string, string]> = [
      [`${SITE}/thank-you${query}`, `${SITE}/thank-you/${query}`],
      [`${SITE}/lawyer-content-writing/${query}`, `${SITE}/law-firm-seo-services/${query}`],
      [`http://lawyerseoexpert.com/thank-you/${query}`, `${SITE}/thank-you/${query}`],
    ];
    for (const [from, to] of cases) {
      const response = await send(from);
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe(to);
    }
  });

  it('handles HEAD on the homepage', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/`, { init: { method: 'HEAD' } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('answers a POST to a page with a 405', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/`, { init: { method: 'POST', body: 'a=1' } });
    expect(response.status).toBe(405);
    expect(origin.requests).toHaveLength(0);
  });
});

// The reason live-paths.ts is gone: publishing is building.
describe('a new page', () => {
  it('needs no list entry: a page in the build answers 200', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/new-page/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(NEW_PAGE);
    expect(origin.requests).toHaveLength(0);
  });

  it('gets the 301 from the path without a slash too', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/new-page`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/new-page/`);
  });

  it('has no noindex in production', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/new-page/`);
    expect(response.headers.has('x-robots-tag')).toBe(false);
  });

});

describe('builder pages (/kit/, /variants/)', () => {
  it('are served on a Preview', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/kit/`, { env: envWith({ LIVE: 'false' }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('the kit demo');
  });

  it.each(['/kit/', '/kit', '/variants/', '/kit/anything'])('%s is a 404 in production', async (path) => {
    originMustNotBeCalled();
    const response = await send(`${SITE}${path}`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain(NOT_FOUND);
  });
});

describe('WordPress is gone', () => {
  it.each(['/wp-admin/', '/wp-login.php', '/wp-json/', '/xmlrpc.php', '/wp-includes/js/jquery/jquery.min.js', '/wp-content/uploads/missing.jpg'])(
    '%s gets the 404 page and never reaches an origin',
    async (path) => {
      const origin = originMustNotBeCalled();
      const response = await send(`${SITE}${path}`);
      expect(response.status).toBe(404);
      expect(await response.text()).toContain(NOT_FOUND);
      expect(origin.requests).toHaveLength(0);
    },
  );

  it.each(['s=term', 's=', 'p=123', 'page_id=7', 'cat=3', 'tag=x', 'author=1', 'm=202601', 'feed=rss2', 'rest_route=/wp/v2/posts', 'preview=true', 'attachment_id=9'])(
    'serves /?%s as the new homepage',
    async (query) => {
      const origin = originMustNotBeCalled();
      const response = await send(`${SITE}/?${query}`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(HOMEPAGE);
      expect(origin.requests).toHaveLength(0);
    },
  );

  it.each(['/this-does-not-exist/', '/wp-login.php'])('a POST to %s stays inside the Worker', async (path) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}${path}`, { init: { method: 'POST', body: 'a=1' } });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(origin.requests).toHaveLength(0);
  });
});

describe('redirects', () => {
  it.each(redirects.map((r) => [r.from, r.to, r.status] as const))('%s goes to %s with a %i', async (from, to, status) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}${from}`);
    expect(response.status).toBe(status);
    expect(response.headers.get('location')).toBe(`${SITE}${to}`);
    expect(origin.requests).toHaveLength(0);
  });

  it.each([
    ['/seo-for-personal-injury-lawyer/', '/seo-for-personal-injury-lawyers/'],
    ['/seo-for-personal-injury-lawyer', '/seo-for-personal-injury-lawyers/'],
    ['/seo-pricing-page/', '/seo-pricing/'],
    ['/lawyer-content-writing/', '/law-firm-seo-services/'],
  ])('old WordPress URL: %s goes to %s with a 301', async (from, to) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}${from}`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}${to}`);
    expect(origin.requests).toHaveLength(0);
  });

  it('keeps the query string', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/lawyer-content-writing/?rdt_cid=x&utm_source=reddit`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/law-firm-seo-services/?rdt_cid=x&utm_source=reddit`);
  });
});

describe('WordPress archives', () => {
  it.each([
    ['/category/tips/', '/blog/'],
    ['/category/criminal-defense-seo', '/blog/'],
    ['/category/tips/feed/', '/blog/'],
    ['/category/personal-injury-lawyer-seo/page/2/', '/blog/'],
    ['/category/', '/blog/'],
    ['/category', '/blog/'],
    ['/tag/seo/', '/blog/'],
    ['/author/admin/', '/blog/'],
    ['/author/s-m-fahim/', '/about/sm-fahim/'],
    ['/blog/page/2/', '/blog/'],
  ])('%s goes to %s with one 301', async (from, to) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}${from}`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}${to}`);
    expect(origin.requests).toHaveLength(0);
  });

  it('keeps the query string', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/category/tips/?utm_source=x`);
    expect(response.headers.get('location')).toBe(`${SITE}/blog/?utm_source=x`);
  });

  it.each(['/categoryx/', '/tags/', '/authors/', '/blog/'])('leaves %s alone', async (path) => {
    originMustNotBeCalled();
    const response = await send(`${SITE}${path}`);
    expect(response.status).not.toBe(301);
  });
});

describe('WordPress shortlinks', () => {
  it.each([
    ['p=1031', '/careers/'],
    ['p=1210', '/crm-add/'],
    ['p=935', '/blog/'],
    ['page_id=118', '/contact-us/'],
    ['p=610', '/law-firm-names/'],
  ])('/?%s goes to %s with one 301', async (query, to) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/?${query}`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}${to}`);
    expect(origin.requests).toHaveLength(0);
  });

  it('keeps every other parameter', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/?p=402&gclid=abc&utm_source=x`);
    expect(response.headers.get('location')).toBe(`${SITE}/seo-for-personal-injury-lawyers/?gclid=abc&utm_source=x`);
  });

  it('only works on the homepage', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/blog/?p=1031`);
    expect(response.status).not.toBe(301);
  });
});

describe('http to https', () => {
  it('sends a 301, keeping path and query, before anything else', async () => {
    const origin = originMustNotBeCalled();
    for (const path of ['/', '/new-page/', '/api/health']) {
      const response = await send(`http://lawyerseoexpert.com${path}?a=1`);
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe(`${SITE}${path}?a=1`);
    }
    expect(origin.requests).toHaveLength(0);
  });

  it('leaves local development on http', async () => {
    originMustNotBeCalled();
    const response = await send('http://localhost:8787/');
    expect(response.status).toBe(200);
  });
});

describe('/api/*', () => {
  it('answers the health check', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(origin.requests).toHaveLength(0);
  });

  it('answers an unknown /api/ path with a JSON 404', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/api/nothing-here`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
    expect(origin.requests).toHaveLength(0);
  });
});

describe('the 404 page', () => {
  it.each(['/404', '/404/', '/404.html', '/this-does-not-exist/', '/this-does-not-exist', '/some/unknown/url'])(
    '%s gets the built page with status 404',
    async (path) => {
      const origin = originMustNotBeCalled();
      const response = await send(`${SITE}${path}`);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(await response.text()).toContain(NOT_FOUND);
      expect(origin.requests).toHaveLength(0);
    },
  );

  it('with HEAD gives a 404 with no body', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/this-does-not-exist/`, { init: { method: 'HEAD' } });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('ignores the visitor\'s If-None-Match', async () => {
    originMustNotBeCalled();
    const first = await send(`${SITE}/404`);
    expect(first.headers.has('etag')).toBe(false);
    for (const path of ['/404', '/this-does-not-exist/']) {
      const response = await send(`${SITE}${path}`, { init: { headers: { 'if-none-match': '*' } } });
      expect(response.status).toBe(404);
      expect(await response.text()).toContain(NOT_FOUND);
    }
  });

  it('still gives a 404 if the page is missing from the build', async () => {
    originMustNotBeCalled();
    const emptyAssets = { fetch: async () => new Response(null, { status: 404 }) } as unknown as Fetcher;
    const response = await send(`${SITE}/this-does-not-exist/`, { env: envWith({ ASSETS: emptyAssets }) });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Page not found');
  });
});

describe('the feed', () => {
  it('serves the RSS file at /feed/, with the type WordPress used', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/feed/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/rss+xml; charset=UTF-8');
    expect(response.headers.has('x-robots-tag')).toBe(false);
    expect(await response.text()).toContain('new feed');
    expect(origin.requests).toHaveLength(0);
  });

  it('sends /feed to /feed/ with a 301', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}/feed`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/feed/`);
    expect(origin.requests).toHaveLength(0);
  });
});

describe('sitemap and robots.txt', () => {
  const INDEX = '/sitemap-index.xml';
  const FILES = [INDEX, '/sitemap-0.xml', '/robots.txt'];
  const OLD = ['/sitemap_index.xml', '/page-sitemap.xml', '/post-sitemap.xml', '/category-sitemap.xml', '/wp-sitemap.xml', '/sitemap.xml'];
  const PREVIEW_HOST = 'https://phase-8-pages-lawyerseoexpert-site.fahim-afd.workers.dev';
  const previewEnv = () => envWith({ LIVE: 'false' });

  it.each(FILES)('%s comes from our files on a Preview, keeps its type, and has noindex', async (path) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${PREVIEW_HOST}${path}`, { env: previewEnv() });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(path.endsWith('.xml') ? 'xml' : 'text/plain');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(origin.requests).toHaveLength(0);
  });

  it('a Preview\'s robots.txt still lets crawlers in, so they can read its noindex header', async () => {
    originMustNotBeCalled();
    const response = await send(`${PREVIEW_HOST}/robots.txt`, { env: previewEnv() });
    expect(await response.text()).not.toMatch(/^Disallow: \/$/m);
  });

  it.each(FILES)('%s comes from our files in production, with no noindex', async (path) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(path.endsWith('.xml') ? 'xml' : 'text/plain');
    expect(response.headers.has('x-robots-tag')).toBe(false);
    expect(await response.text()).toContain(path === '/robots.txt' ? 'fixture robots' : 'fixture sitemap');
    expect(origin.requests).toHaveLength(0);
  });

  it.each(OLD)('%s goes to the new sitemap with a 301 in production', async (path) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${SITE}${path}`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}${INDEX}`);
    expect(origin.requests).toHaveLength(0);
  });

  it.each(OLD)('%s with a trailing slash goes there too', async (path) => {
    originMustNotBeCalled();
    const response = await send(`${SITE}${path}/`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}${INDEX}`);
  });

  it.each(OLD)('%s stays on the Preview\'s own host, with noindex', async (path) => {
    const origin = originMustNotBeCalled();
    const response = await send(`${PREVIEW_HOST}${path}`, { env: previewEnv() });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${PREVIEW_HOST}${INDEX}`);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(origin.requests).toHaveLength(0);
  });
});

describe('noindex', () => {
  const previewEnv = () => envWith({ LIVE: 'false' });

  it('is added to everything when LIVE is not true', async () => {
    originMustNotBeCalled();
    for (const path of ['/', '/api/health', '/new-page/', '/this-does-not-exist/']) {
      const response = await send(`${SITE}${path}`, { env: previewEnv() });
      expect(response.headers.get('x-robots-tag')).toBe('noindex');
    }
  });

  it('is added to redirects too, keeping them on the Preview\'s host', async () => {
    originMustNotBeCalled();
    const host = 'https://lawyerseoexpert-site.fahim-afd.workers.dev';
    const response = await send(`${host}/lawyer-content-writing/`, { env: previewEnv() });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${host}/law-firm-seo-services/`);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('is not added to the pages once LIVE is true', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/`);
    expect(response.headers.has('x-robots-tag')).toBe(false);
  });

  it('treats a missing LIVE as a Preview', async () => {
    originMustNotBeCalled();
    const response = await send(`${SITE}/`, { env: envWith({ LIVE: '' }) });
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });
});

describe('www', () => {
  const WWW = 'https://www.lawyerseoexpert.com';

  it('sends a www page to the apex in one 301, keeping the path and query', async () => {
    const origin = originMustNotBeCalled();
    const response = await send(`${WWW}/seo-pricing/?gclid=x&utm_source=google`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/seo-pricing/?gclid=x&utm_source=google`);
    expect(origin.requests).toHaveLength(0);
  });

  it('sends http://www straight to https on the apex', async () => {
    originMustNotBeCalled();
    const response = await send('http://www.lawyerseoexpert.com/');
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/`);
  });

  it('sends an old WordPress address on www to its new page in one hop', async () => {
    originMustNotBeCalled();
    const response = await send(`${WWW}/seo-pricing-page/?fbclid=y`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/seo-pricing/?fbclid=y`);
  });

  it('sends a WordPress shortlink on www to its new page in one hop', async () => {
    originMustNotBeCalled();
    const response = await send(`${WWW}/?p=155&utm_source=x`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/about/sm-fahim/?utm_source=x`);
  });

  it('sends a WordPress archive on www to the blog in one hop', async () => {
    originMustNotBeCalled();
    const response = await send(`${WWW}/category/tips/`);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`${SITE}/blog/`);
  });

  it('never serves a page or the API on www', async () => {
    originMustNotBeCalled();
    for (const path of ['/', '/api/lead', '/sitemap-index.xml', '/robots.txt']) {
      const response = await send(`${WWW}${path}`);
      expect(response.status, path).toBe(301);
      expect(response.headers.get('location'), path).toBe(`${SITE}${path}`);
    }
  });
});
