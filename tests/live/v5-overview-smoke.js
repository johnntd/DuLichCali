/* Headless smoke for the V5 experience-first Overview. Serve must be running on :8099.
   Opens a local demo trip → asserts the cinematic hero (NO ring/budget/status chips), exactly 5
   visible tabs, a 4-item bottom nav, large highlight cards, captures OUR-code errors, and
   screenshots desktop + mobile. Render smoke + visual capture (not a unit test). */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8099/travel-concierge.html';
const OURS = /tc-overview\.js|travel-concierge\.js/;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const ourErrors = [];
  page.on('pageerror', e => ourErrors.push((e && e.stack || String(e)).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') { const u = (m.location() || {}).url || ''; if (OURS.test(u)) ourErrors.push('console: ' + m.text()); } });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tc-hero__demo', { timeout: 15000 });
  // Inject real-shaped highlight data into the demo sample so the teaser + large discovery-card
  // code paths actually run (the bare sample has no attractions/liveHighlights). Honest test data.
  await page.evaluate(() => {
    var s = window.TC_SAMPLES && (window.TC_SAMPLES.las_vegas || window.TC_SAMPLES.san_diego);
    if (s) s.liveHighlights = [
      { name: 'Fremont Street Experience', category: 'attraction', note: 'Neon canopy + free shows' },
      { name: 'Red Rock Canyon', category: 'attraction', note: 'Scenic desert loop drive', rating: 4.8 }
    ];
  });
  await page.click('.tc-hero__demo');
  await page.waitForSelector('.tc-ov', { timeout: 15000 });

  const c = await page.evaluate(() => {
    const q = s => document.querySelector(s), qa = s => document.querySelectorAll(s);
    return {
      heroTitle: !!q('.tc-ov-hero__title'),
      eyebrow: !!q('.tc-ov-hero__eyebrow'),
      teasers: qa('.tc-ov-hero__teaser').length,
      heroCta: ((q('.tc-ov-hero__cta') || {}).textContent || ''),
      // dashboard chrome MUST be gone from the hero:
      ring: !!q('.tc-ov-ring'),
      budget: !!q('.tc-ov-hero__budget'),
      statusChips: qa('.tc-ov-chip').length,
      tabCount: qa('.tc-tabs .tc-tab').length,
      tabLabels: Array.from(qa('.tc-tabs .tc-tab')).map(b => b.textContent),
      bigCards: qa('.tc-ov-card--lg').length,
      bottomNav: qa('.tc-bottomnav .tc-actionbar__btn').length,
      bottomLabels: Array.from(qa('.tc-bottomnav .tc-actionbar__lbl')).map(b => b.textContent)
    };
  });

  await page.screenshot({ path: 'docs/superpowers/wireframes/v5-overview-LIVE-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/superpowers/wireframes/v5-overview-LIVE-mobile.png', fullPage: true });
  await browser.close();

  console.log('CHECKS', JSON.stringify(c, null, 2));
  console.log('OUR_ERRORS', ourErrors.length);
  ourErrors.slice(0, 6).forEach(e => console.log('  ! ' + e));
  const ok = c.heroTitle && c.eyebrow && !c.ring && !c.budget && c.statusChips === 0 &&
    c.tabCount === 5 && c.teasers >= 1 && c.bigCards >= 1 && c.bottomNav === 4 && ourErrors.length === 0;
  console.log(ok ? '\nSMOKE: PASS' : '\nSMOKE: FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('SMOKE: FAIL (exception)\n', e); process.exit(1); });
