/* Headless smoke for the V4 Overview tab. Serves must be running on :8099.
   Loads the concierge, opens a local demo trip (no login/Firestore), asserts the Overview
   container renders with its key blocks, captures page errors from OUR code, and screenshots
   desktop (1280) + mobile (390). Not a unit test — a render smoke + visual capture. */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8099/travel-concierge.html';
const OURS = /tc-overview\.js|travel-concierge\.js/;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const ourErrors = [];
  page.on('pageerror', e => { const s = (e && e.stack) || String(e); ourErrors.push(s); });
  page.on('console', m => { if (m.type() === 'error') { const loc = m.location() || {}; if (OURS.test(loc.url || '')) ourErrors.push('console: ' + m.text() + ' @ ' + loc.url); } });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tcApp .tc-hero, #tcApp', { timeout: 15000 });
  // Open a local demo trip → lands on the Overview tab.
  await page.waitForSelector('.tc-hero__demo', { timeout: 15000 });
  await page.click('.tc-hero__demo');
  await page.waitForSelector('.tc-ov', { timeout: 15000 });

  const checks = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    return {
      overview: !!q('.tc-ov'),
      hero: !!q('.tc-ov-hero'),
      ring: !!q('.tc-ov-ring__pct'),
      ringText: (q('.tc-ov-ring__pct') || {}).textContent || '',
      timeline: !!q('.tc-ov-tl') || !!q('.tc-ov-sec'),
      quick: !!q('.tc-ov-quick'),
      overviewTabActive: !!q('.tc-tab--on') && /overview|tổng quan|resumen/i.test((q('.tc-tab--on') || {}).textContent || ''),
      tabCount: document.querySelectorAll('.tc-tab').length,
      // honesty: no <img> with a data: or obviously-fake src; real imgs only via tc-place__img
      imgs: Array.from(document.querySelectorAll('.tc-ov img')).map(i => i.className)
    };
  });

  await page.screenshot({ path: 'docs/superpowers/wireframes/v4-overview-LIVE-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/superpowers/wireframes/v4-overview-LIVE-mobile.png', fullPage: true });

  await browser.close();
  console.log('CHECKS', JSON.stringify(checks, null, 2));
  console.log('OUR_ERRORS', ourErrors.length);
  ourErrors.slice(0, 8).forEach(e => console.log('  ! ' + e.split('\n')[0]));
  const okCore = checks.overview && checks.hero && checks.ring && checks.quick && checks.tabCount === 13 && ourErrors.length === 0;
  console.log(okCore ? '\nSMOKE: PASS' : '\nSMOKE: FAIL');
  process.exit(okCore ? 0 : 1);
})().catch(e => { console.error('SMOKE: FAIL (exception)\n', e); process.exit(1); });
