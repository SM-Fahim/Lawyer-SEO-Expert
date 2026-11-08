#!/usr/bin/env node
// The local server for the browser tests: real Worker, real built site, local D1 only.
// Every setting that could reach an outside service is blanked here, whatever a local .dev.vars says.
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = process.env.E2E_PORT ?? '8791';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PERSIST = '.wrangler/e2e';
const WRANGLER = 'node_modules/wrangler/bin/wrangler.js';
const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };

rmSync(`${ROOT}${PERSIST}`, { recursive: true, force: true });

const migrate = spawnSync(
  process.execPath,
  [WRANGLER, 'd1', 'migrations', 'apply', 'lse-site', '--local', '--persist-to', PERSIST],
  { cwd: ROOT, env, stdio: ['ignore', 'inherit', 'inherit'] },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const server = spawn(
  process.execPath,
  [
    WRANGLER, 'dev',
    '--local',
    '--port', PORT,
    '--ip', '127.0.0.1',
    '--inspector-port', '0',
    '--persist-to', PERSIST,
    '--show-interactive-dev-session=false',
    '--live-reload=false',
    // Production's settings must never apply here, or this server would send real events to outside services.
    '--local-upstream', `localhost:${PORT}`,
    '--var', 'LIVE:false',
    '--var', 'IP_SALT:e2e-fake-salt',
    // Blank: with no secret, the Worker never calls Turnstile's siteverify.
    '--var', 'TURNSTILE_SECRET:',
    // Blank: with no token, the Worker never calls Reddit.
    '--var', 'REDDIT_CAPI_TOKEN:',
    '--var', 'REDDIT_TEST_ID:',
    // Blank: with no token and no pixel ID, the Worker never calls Meta.
    '--var', 'META_CAPI_TOKEN:',
    '--var', 'META_PIXEL_ID:',
    // Blank: the lead is logged only, and the email binding is never touched.
    '--var', 'EMAIL_TO:',
    '--var', 'EMAIL_FROM:',
  ],
  { cwd: ROOT, env, stdio: ['ignore', 'inherit', 'inherit'] },
);
server.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill());
