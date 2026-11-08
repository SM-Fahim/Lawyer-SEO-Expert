// Runs the built router in the real Workers runtime with a real assets binding and production's
// asset settings. It proves that nothing leaves the Worker now that WordPress is gone, and that the
// binding's own redirects and 404s come out the way the router promises. Every outbound request goes to
// the recorder below, and the hostname is reserved, so nothing can leave this machine.
//
// Run with: npm run test:runtime
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { convertV4MiniflareOptions, Miniflare, Response as MfResponse } from 'miniflare';
import { build } from 'esbuild';

const HOST = 'lse-test.invalid';
const SITE = `https://${HOST}`;
const outbound = [];

function recordOutbound(request) {
  outbound.push(request.url);
  return new MfResponse('A test reached the network', { status: 599 });
}

const bundle = await build({
  entryPoints: ['worker/index.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'router',
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-11-04',
        bindings: { LIVE: 'true', SITE_HOST: HOST },
        outboundService: recordOutbound,
        assets: {
          directory: fileURLToPath(new URL('../worker/fixtures/site', import.meta.url)),
          binding: 'ASSETS',
          // Production's run_worker_first: the Worker sees page loads before the assets do.
          routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true },
          assetConfig: { html_handling: 'auto-trailing-slash', not_found_handling: '404-page' },
        },
      },
    ],
  }),
);

const NOT_FOUND = 'new 404 page';

const checks = {
  async 'a page with no list entry answers 200'() {
    const response = await mf.dispatchFetch(`${SITE}/new-page/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /a new page/);
  },

  async 'a page without its slash gets a 301 that keeps the query string'() {
    const response = await mf.dispatchFetch(`${SITE}/new-page?rdt_cid=x&utm_source=reddit`, { redirect: 'manual' });
    await response.arrayBuffer();
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), `${SITE}/new-page/?rdt_cid=x&utm_source=reddit`);
  },

  async 'an unknown path gets the built 404 page with status 404'() {
    const response = await mf.dispatchFetch(`${SITE}/this-does-not-exist/`);
    assert.equal(response.status, 404);
    assert.match(await response.text(), new RegExp(NOT_FOUND));
  },

  async 'old WordPress paths get the 404 page'() {
    for (const path of ['/wp-admin/', '/wp-login.php', '/wp-json/', '/xmlrpc.php']) {
      const response = await mf.dispatchFetch(`${SITE}${path}`);
      assert.equal(response.status, 404, path);
      assert.match(await response.text(), new RegExp(NOT_FOUND), path);
    }
  },

  async 'a WordPress search on the homepage is the homepage'() {
    const response = await mf.dispatchFetch(`${SITE}/?s=term`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /new homepage/);
  },

  async 'a POST to a page or an unknown path stays inside the Worker'() {
    for (const path of ['/', '/this-does-not-exist/', '/wp-login.php']) {
      const response = await mf.dispatchFetch(`${SITE}${path}`, { method: 'POST', body: 'a=1' });
      await response.arrayBuffer();
      assert.ok(response.status >= 400 && response.status < 500, `${path} answered ${response.status}`);
    }
  },

  async 'none of the above left the Worker'() {
    assert.deepEqual(outbound, []);
  },
};

let failed = 0;
try {
  for (const [name, check] of Object.entries(checks)) {
    try {
      await check();
      console.log(`pass  ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL  ${name}\n${error.stack ?? error}`);
    }
  }
} finally {
  await mf.dispose();
}

console.log(`${Object.keys(checks).length - failed} of ${Object.keys(checks).length} passed`);
process.exit(failed ? 1 : 0);
