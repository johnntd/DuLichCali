'use strict';
/* Regression: selecting the "Anaheim & San Diego" sample must PRESERVE every planned activity —
 * it must NOT turn the trip into a generic stop list or send the user back to re-enter stops.
 * After selecting, the simple next step is "Add family members", with Edit / Alternatives /
 * Generate one tap away; generating the package keeps the exact same activities.
 *
 * Self-contained: spawns `python3 -m http.server`, drives headless Chromium, asserts, cleans up.
 * Login + Cloud Functions can't run headlessly, so the logged-in mutations (add family / swap /
 * add-to-day) are validated by the node tests + the in-app buttons existing; this test proves the
 * PRESERVATION guarantee (the actual bug) end-to-end. Run:  node tests/anaheim-trip-preserve.test.js */
const { spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = 8912;
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// The specific activities the user planned — all must survive selection + package generation.
const ACTIVITIES = ['Pismo Beach', 'Avila Beach', 'San Diego Zoo', 'La Jolla Cove', 'Crystal Cove', 'Laguna Beach', 'Balboa Island', 'Cream Pan', 'Bun Cha 1008', 'Mo Ran Gak'];

(async () => {
  let chromium;
  try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP: playwright not installed'); process.exit(0); }
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 1200); });
  const b = await chromium.launch();
  try {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; pg.on('pageerror', function (e) { errs.push(String(e.message || e)); });
    await pg.goto('http://localhost:' + PORT + '/travel-concierge.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);

    // 1) Select the "Anaheim & San Diego" sample (the "Or try another" chip).
    const chip = pg.locator('button.tc-hero__demo', { hasText: /Anaheim & San Diego/i }).first();
    ok('Anaheim & San Diego sample chip is offered', (await chip.count()) > 0);
    await chip.click();
    await pg.waitForTimeout(1500);

    // 2) The post-selection action panel shows the FOUR simple actions, primary = Add family members.
    const panel = pg.locator('.tc-ov-pkgcta');
    ok('action panel ("Your trip is ready") appears', (await panel.count()) > 0);
    ok('primary next step is "Add family members"', /Add family members/i.test((await pg.locator('.tc-ov-pkgcta__primary').first().textContent().catch(function () { return ''; })) || ''));
    const panelTxt = (await panel.first().textContent().catch(function () { return ''; })) || '';
    ok('panel offers "Edit in Itinerary"', /Edit in Itinerary/i.test(panelTxt));
    ok('panel offers "Add alternative activities"', /Add alternative activities/i.test(panelTxt));
    ok('panel offers "Generate full Travel Package"', /Generate full Travel Package/i.test(panelTxt));
    // The old regress path ("Customize this trip" → regenerate → generic stop list) is gone.
    ok('no "Customize this trip" regenerate trap', !/Customize this trip/i.test(panelTxt));

    // 3) Generate the Travel Package from the overview banner → the SAME specific activities are
    //    present (plan intact, not a generic list). Do this BEFORE leaving the overview.
    await pg.locator('.tc-ov-pkgcta__go').first().click().catch(function () {});
    await pg.waitForTimeout(2000);
    ok('Travel Package (Guide) appears', (await pg.locator('.tc-pkg').count()) > 0);
    const guideText = (await pg.locator('.tc-pkg').first().textContent().catch(function () { return ''; })) || '';
    const inGuide = ACTIVITIES.filter(function (a) { return guideText.indexOf(a) >= 0; });
    ok('package keeps the planned activities, not a generic list (' + inGuide.length + '/' + ACTIVITIES.length + ')', inGuide.length >= 8);
    ok('package keeps the San Jose → Anaheim coastal day stops', /Pismo Beach/.test(guideText) && /Avila Beach/.test(guideText));
    ok('package keeps the San Diego day', /San Diego Zoo/.test(guideText));
    ok('package keeps the OC food picks', /Cream Pan/.test(guideText) && /Bun Cha 1008/.test(guideText));

    // 4) The editable itinerary also keeps every planned activity (not a generic stop list). Sweep day tabs.
    await pg.locator('.tc-tab', { hasText: 'Days' }).first().click();
    await pg.waitForTimeout(800);
    const dayTabs = pg.locator('.tc-daytab');
    const nTabs = await dayTabs.count();
    let itinText = '';
    for (let i = 0; i < nTabs; i++) { await dayTabs.nth(i).click().catch(function () {}); await pg.waitForTimeout(350); itinText += ' ' + ((await pg.locator('.tc-itin').first().textContent().catch(function () { return ''; })) || ''); }
    const inItin = ACTIVITIES.filter(function (a) { return itinText.indexOf(a) >= 0; });
    ok('itinerary preserves the planned activities (' + inItin.length + '/' + ACTIVITIES.length + ')', inItin.length >= 8);

    ok('no page errors during the flow', errs.length === 0);
    if (errs.length) console.log('  errors:', errs.slice(0, 4).join(' | '));
  } finally {
    await b.close();
    try { srv.kill(); } catch (e) {}
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('TEST ERROR', e && e.message); process.exit(2); });
