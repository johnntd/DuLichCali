'use strict';
/* E2E: Travel Concierge → open a sample trip → Generate Travel Package → the premium Guide appears.
 * Self-contained: spawns `python3 -m http.server` on a free port, drives headless Chromium, asserts,
 * cleans up. Requires playwright + python3 (both present in this repo). NOT part of the node-only
 * dry-run gate; run directly:  node tests/travel-package-flow.test.js   (or: npm run test:packageflow)
 *
 * Note: the no-login SAMPLE path is what an un-authenticated customer uses; a full "enter trip → AI
 * generate" needs login + Cloud Functions, which can't run headlessly here — the sample carries a
 * finished plan, so it validates the same "Generate → Package appears" outcome. */
const { spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = 8911;
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

(async () => {
  let chromium;
  try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP: playwright not installed'); process.exit(0); }
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 1200); });
  const b = await chromium.launch();
  try {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; pg.on('pageerror', function (e) { errs.push(String(e.message || e)); });
    // 1) Land on the Travel Concierge
    await pg.goto('http://localhost:' + PORT + '/travel-concierge.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    ok('hero CTA reads "Create My Travel Package"', /Create My Travel Package/i.test((await pg.locator('.tc-hero__cta').first().textContent().catch(function () { return ''; })) || ''));

    // 2) Open a sample trip (the no-login path a customer uses)
    await pg.locator('button:has-text("See the full sample")').first().click();
    await pg.waitForTimeout(1700);
    ok('Travel Guide is a PRIMARY tab (not buried in More)', (await pg.locator('.tc-tab', { hasText: /Travel Guide/i }).count()) > 0);
    ok('Overview shows the Travel Package banner', (await pg.locator('.tc-ov-pkgcta').count()) > 0);
    ok('banner offers "Generate full Travel Package"', (await pg.locator('.tc-ov-pkgcta__acts button', { hasText: /Generate full Travel Package/i }).count()) > 0);

    // 3) Generate → the premium Guide appears
    await pg.locator('.tc-ov-pkgcta__go').first().click();
    await pg.waitForTimeout(2200);
    ok('Travel Package (Guide) appears', (await pg.locator('.tc-pkg').count()) > 0);
    ok('Guide has a cover', (await pg.locator('.tc-pkg__cover').count()) > 0);
    ok('Guide has day pages', (await pg.locator('.tc-pkg__day').count()) > 0);
    ok('Guide can print/save PDF (toolbar)', (await pg.locator('.tc-pkg__toolbar button', { hasText: /Print/i }).count()) > 0);
    ok('no fabricated data: honest "verify" links present OR real Google-sourced facts', (await pg.locator('.tc-pkg__verify, .tc-pkg__src').count()) > 0);
    ok('no page errors during the flow', errs.length === 0);
  } finally {
    await b.close();
    try { srv.kill(); } catch (e) {}
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('TEST ERROR', e && e.message); try { } catch (x) {} process.exit(2); });
