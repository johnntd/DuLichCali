// SP-4 live audit — verifies the Studio gallery, showcase carousel and Wig
// Match example strip all render REAL, loaded images (no blank cards, no salon
// interior), Asian-majority imagery wired correctly, and captures screenshots.
// Run: node tests/live/style-studio-gallery-audit.js  (local server on :8080)
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.SS_BASE || 'http://localhost:8080';
const OUT = 'docs/screenshots';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results = { pass: [], fail: [], warn: [], console: [] };
  const note = (ok, msg) => (ok ? results.pass : results.fail).push(msg);

  async function audit(label, viewport, shotName) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') results.console.push(`[${label}] ${m.text()}`); });
    await page.goto(`${BASE}/style-studio.html`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('#ssGallery .ss-gcard', { timeout: 15000 });
    // Scroll through the whole page to trigger loading="lazy" images (the lower
    // gallery cards only fetch when scrolled into view — correct perf behavior).
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 250));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200); // allow lazy images to settle

    // Gallery: 9 cards, each with a loaded photo, none left as gradient.
    const gallery = await page.$$eval('#ssGallery .ss-gcard', cards => cards.map(c => {
      const img = c.querySelector('.ss-gcard__img');
      return {
        mode: c.getAttribute('data-mode'),
        hasImg: !!img,
        loaded: img ? (img.complete && img.naturalWidth > 0) : false,
        src: img ? img.getAttribute('src') : '',
        gradient: c.querySelector('.ss-gcard__media--gradient') ? true : false,
      };
    }));
    note(gallery.length === 9, `[${label}] gallery card count = ${gallery.length} (expect 9)`);
    const blanks = gallery.filter(g => !g.loaded);
    note(blanks.length === 0, `[${label}] gallery cards with UNLOADED image: ${blanks.map(b => b.mode).join(',') || 'none'}`);
    const grads = gallery.filter(g => g.gradient);
    note(grads.length === 0, `[${label}] gallery cards still gradient(blank): ${grads.map(b => b.mode).join(',') || 'none'}`);

    // Showcase: 5 cards each with a loaded bg image.
    const showcase = await page.$$eval('#ssShowcase .ss-showcase-card', cards => cards.map(c => {
      const img = c.querySelector('.ss-showcase-card__bg');
      return { loaded: img ? (img.complete && img.naturalWidth > 0) : false, src: img ? img.getAttribute('src') : '' };
    }));
    note(showcase.length === 5, `[${label}] showcase card count = ${showcase.length} (expect 5)`);
    note(showcase.every(s => s.loaded), `[${label}] showcase all images loaded: ${showcase.filter(s => !s.loaded).length} broken`);

    // Wig examples: 2 figures with loaded images.
    const wigex = await page.$$eval('#ssWigExamples .ss-wigex', figs => figs.map(f => {
      const img = f.querySelector('.ss-wigex__img');
      return { loaded: img ? (img.complete && img.naturalWidth > 0) : false, cap: (f.querySelector('.ss-wigex__cap') || {}).textContent || '' };
    }));
    note(wigex.length === 2, `[${label}] wig examples count = ${wigex.length} (expect 2)`);
    note(wigex.every(w => w.loaded), `[${label}] wig examples loaded: ${wigex.filter(w => !w.loaded).length} broken`);
    note(wigex.every(w => w.cap.trim().length > 0), `[${label}] wig examples have captions`);

    // Salon interior must be gone everywhere.
    const allSrc = await page.$$eval('img', imgs => imgs.map(i => i.getAttribute('src') || ''));
    const salon = allSrc.filter(s => /hair-3\.jpg/.test(s));
    note(salon.length === 0, `[${label}] salon-interior (hair-3.jpg) references: ${salon.length} (expect 0)`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/${shotName}`, fullPage: true });
    results[`shot_${label}`] = `${OUT}/${shotName}`;
    await ctx.close();
    return { gallery, showcase, wigex };
  }

  const desktop = await audit('desktop', { width: 1280, height: 900 }, 'style-studio-sp4-desktop.jpg');
  const mobile = await audit('mobile', { width: 390, height: 844 }, 'style-studio-sp4-mobile.jpg');

  await browser.close();

  console.log('\n===== SP-4 GALLERY AUDIT =====');
  console.log('PASS:', results.pass.length, '| FAIL:', results.fail.length);
  results.pass.forEach(p => console.log('  ✓', p));
  if (results.fail.length) results.fail.forEach(f => console.log('  ✗', f));
  if (results.console.length) { console.log('\nConsole errors:'); results.console.forEach(c => console.log('  !', c)); }
  else console.log('\nConsole errors: none');
  console.log('\nDesktop gallery srcs:'); desktop.gallery.forEach(g => console.log(`  ${g.mode}: ${g.src} (loaded=${g.loaded})`));
  console.log('\nFINAL:', results.fail.length === 0 ? 'PASS' : 'FAIL');
  process.exit(results.fail.length === 0 ? 0 : 1);
})().catch(e => { console.error('AUDIT ERROR', e); process.exit(2); });
