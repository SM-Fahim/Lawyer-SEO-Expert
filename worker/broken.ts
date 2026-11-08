// Records 404 and 5xx pages in the D1 table broken_urls, for scripts/broken-report.mjs.
// This must never slow down or fail the response, so all of it runs inside
// ctx.waitUntil and every error stops here.

const MAX_LENGTH = 500;
const NOT_PAGES = /^\/(?:wp-|api\/|img\/|fonts\/|_astro\/|cdn-cgi\/)/;
// scripts/verify-live.mjs asks for missing pages on purpose. They aren't broken, and on a Preview
// every one of them would be a database write.
const VERIFY_TOOL = 'lse-verify-live/';
const STATIC_FILE = /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm)$/i;

export function logBroken(request: Request, path: string, status: number, env: Env, ctx: ExecutionContext): void {
  if (status !== 404 && status < 500) return;
  if (NOT_PAGES.test(path) || STATIC_FILE.test(path)) return;
  if (request.headers.get('user-agent')?.startsWith(VERIFY_TOOL)) return;

  try {
    ctx.waitUntil(record(path, status, referrerOf(request), env).catch(reportFailure));
  } catch (error) {
    reportFailure(error);
  }
}

// One row per path and status (the table's primary key). Times are milliseconds since
// the epoch, like every other table. A hit with no referrer keeps the last real one.
async function record(path: string, status: number, referrer: string | null, env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO broken_urls (path, status, referrer, count, first_seen, last_seen)
     VALUES (?1, ?2, ?3, 1, ?4, ?4)
     ON CONFLICT (path, status) DO UPDATE SET
       count = count + 1,
       last_seen = excluded.last_seen,
       referrer = COALESCE(excluded.referrer, referrer)`,
  )
    .bind(path.slice(0, MAX_LENGTH), status, referrer, now)
    .run();
}

// Keep where the visitor came from, not the query string, which may hold personal data.
function referrerOf(request: Request): string | null {
  const referrer = request.headers.get('referer');
  if (!referrer) return null;
  try {
    const { origin, pathname } = new URL(referrer);
    return (origin + pathname).slice(0, MAX_LENGTH);
  } catch {
    return null;
  }
}

// A missing table is expected until the migration runs, so it stays quiet. Anything
// else, such as a column name that doesn't match, goes to Workers Logs.
function reportFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes('no such table')) console.warn(JSON.stringify({ event: 'broken_urls_failed', message }));
}
