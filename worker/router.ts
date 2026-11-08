// The order of every request (docs/MIGRATION-PLAN.md §4):
//   1. http to https
//   2. add-ons, including /api/*
//   3. src/data/redirects.ts
//   4. the built files in dist/, and the 404 page for anything else
//
// There's no list of pages. Anything the build writes is live, so a new page or post needs no entry here.
import { archivePrefixes, redirects, wordpressIds, type Redirect } from '../src/data/redirects';
import { handleAddon } from './addons';
import { logBroken } from './broken';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const NOT_FOUND_PATHS = new Set(['/404', '/404.html']);
// The RSS feed keeps its old address. The assets binding can only serve a folder's index.html,
// so /feed/ reads the built file.
const FEED_PATH = '/feed/';
const FEED_FILE = '/feed.xml';
const redirectsByPath = new Map<string, Redirect>(redirects.map((redirect) => [withoutSlash(redirect.from), redirect]));

export async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const response = await respond(request, url, env, ctx);
  logBroken(request, url.pathname, response.status, env, ctx);

  // Previews stay out of search. Cloudflare only adds noindex to Preview URLs, not to workers.dev.
  return env.LIVE !== 'true' ? withNoindex(response) : response;
}

async function respond(request: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (url.protocol === 'http:' && !LOCAL_HOSTS.has(url.hostname)) {
    return redirectTo(`https://${url.host}${url.pathname}${url.search}`, 301);
  }

  const answer = await handleAddon(request, env, ctx);
  if (answer) return answer;
  // Reserved for the Worker, so it answers in JSON and never with a page.
  if (url.pathname.startsWith('/api/')) {
    return Response.json({ error: 'not_found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  const redirect = redirectsByPath.get(withoutSlash(url.pathname)) ?? archiveRedirect(url.pathname);
  if (redirect) {
    return redirectTo(`${new URL(redirect.to, url).href}${url.search}`, redirect.status);
  }
  const shortlink = shortlinkTarget(url);
  if (shortlink) return redirectTo(shortlink, 301);

  if (NOT_FOUND_PATHS.has(withoutSlash(url.pathname))) return notFoundPage(request, env);
  return staticFile(request, url, env);
}

async function staticFile(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === FEED_PATH) return feedFile(request, url.origin, env);
  if (`${url.pathname}/` === FEED_PATH) return redirectTo(`${url.origin}${FEED_PATH}${url.search}`, 301);

  // Manual, so a redirect reaches this code instead of being followed.
  const response = await env.ASSETS.fetch(new Request(request, { redirect: 'manual' }));

  // The assets binding answers /page with a 307 to /page/. These addresses are permanent and search engines
  // know them, so they stay 301s as they always were, with the query string that carries ad click IDs.
  const location = response.headers.get('location');
  if (location) {
    await response.body?.cancel();
    return redirectTo(`${url.origin}${new URL(location, url).pathname}${url.search}`, 301);
  }

  if (response.status !== 404) return response;

  await response.body?.cancel();
  return notFoundPage(request, env);
}

async function feedFile(request: Request, origin: string, env: Env): Promise<Response> {
  const feed = await env.ASSETS.fetch(new Request(`${origin}${FEED_FILE}`, { method: request.method, headers: request.headers }));
  if (feed.status === 404) {
    await feed.body?.cancel();
    return notFoundPage(request, env);
  }
  const headers = new Headers(feed.headers);
  headers.set('content-type', 'application/rss+xml; charset=UTF-8');
  return new Response(feed.body, { status: feed.status, headers });
}

async function notFoundPage(request: Request, env: Env): Promise<Response> {
  // A clean request, so the visitor's If-None-Match can't turn this into a 304.
  const pageUrl = new URL('/404', request.url);
  const page = await env.ASSETS.fetch(new Request(pageUrl, { method: request.method === 'HEAD' ? 'HEAD' : 'GET' }));

  if (!page.ok) {
    await page.body?.cancel();
    return new Response('Page not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const headers = new Headers(page.headers);
  headers.delete('etag');
  return new Response(page.body, { status: 404, headers });
}

/** /category/tips/feed/, /tag/x/, /author/admin/, /blog/page/2/: WordPress archives, by prefix. */
function archiveRedirect(path: string): Redirect | undefined {
  const withSlash = path.endsWith('/') ? path : `${path}/`;
  return archivePrefixes.find((rule) => withSlash.startsWith(rule.from));
}

/** /?p=1031 or /?page_id=1031: a WordPress shortlink to a known page. Keeps every other parameter. */
function shortlinkTarget(url: URL): string | null {
  if (url.pathname !== '/') return null;
  for (const name of ['p', 'page_id']) {
    const id = url.searchParams.get(name);
    const to = id === null ? undefined : wordpressIds[id];
    if (!to) continue;
    const params = new URLSearchParams(url.search);
    params.delete('p');
    params.delete('page_id');
    const rest = params.toString();
    return `${url.origin}${to}${rest ? `?${rest}` : ''}`;
  }
  return null;
}

function redirectTo(location: string, status: number): Response {
  return new Response(null, { status, headers: { location } });
}

function withNoindex(response: Response): Response {
  const copy = new Response(response.body, response);
  copy.headers.set('X-Robots-Tag', 'noindex');
  return copy;
}

function withoutSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
