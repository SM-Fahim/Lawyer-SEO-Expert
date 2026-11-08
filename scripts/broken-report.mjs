#!/usr/bin/env node
// Prints the broken_urls table, most hit first (plan section 5). Scanner noise is expected, so look
// for high counts and real referrers. Read only: the query is a fixed SELECT.
//
// Usage: node scripts/broken-report.mjs [--limit=100] [--preview] [--local]
//
//   default     the production database, lse-site
//   --preview   the Preview database, lse-site-preview
//   --local     the local database from `wrangler dev`, for trying this script out
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WRANGLER = 'node_modules/wrangler/bin/wrangler.js';

const args = process.argv.slice(2);
const known = /^--(preview|local|limit=\d+)$/;
const bad = args.find((arg) => !known.test(arg));
if (bad) {
  console.error(`broken-report: unknown option ${bad}. Usage: node scripts/broken-report.mjs [--limit=100] [--preview] [--local]`);
  process.exit(2);
}
const limit = Number(args.find((arg) => arg.startsWith('--limit='))?.slice('--limit='.length) ?? 100);
const database = args.includes('--preview') ? 'lse-site-preview' : 'lse-site';
const where = args.includes('--local') ? '--local' : '--remote';

const sql = `SELECT path, status, count, referrer, first_seen, last_seen FROM broken_urls ORDER BY count DESC, last_seen DESC LIMIT ${limit}`;
const run = spawnSync(process.execPath, [WRANGLER, 'd1', 'execute', database, where, '--json', '--command', sql], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 60_000,
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
if (run.status !== 0) {
  console.error(`broken-report: wrangler failed.\n${run.stderr || run.stdout || run.error?.message || ''}`);
  process.exit(1);
}

const rows = JSON.parse(run.stdout)[0]?.results ?? [];
const when = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

console.log(`broken_urls in ${database} (${where.slice(2)}): ${rows.length} row(s), most hit first.\n`);
if (rows.length) {
  console.log('Hits  Status  Last seen (UTC)   Path  <- Referrer');
  for (const row of rows) {
    const referrer = row.referrer ? `  <- ${row.referrer}` : '';
    console.log(`${String(row.count).padStart(4)}  ${row.status}     ${when(row.last_seen)}  ${row.path}${referrer}`);
  }
}
