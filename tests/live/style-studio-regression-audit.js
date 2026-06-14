'use strict';
// Production regression audit for /style-studio (opt-in, needs a browser).
// Setup:  npm i -D playwright && npx playwright install chromium
// Run:    node tests/live/style-studio-regression-audit.js
// Audits the LIVE production page against the core invariants. Read-only.
const { chromium } = require('playwright');
const URL = process.env.SS_URL || 'https://www.dulichcali21.com/style-studio';
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass: !!pass, detail: detail || '' }); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 390, height: 844 } }).then(c => c.newPage());
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push((e && e.message) || String(e)));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => pageErrors.push('GOTO ' + e.message));
  await page.waitForTimeout(4500); // let anon auth settle

  ok('page loads with no uncaught JS errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

  const base = await page.evaluate(() => {
    const SS = window.StyleStudioPublic;
    return {
      moduleLoaded: !!SS,
      signedIn: SS && SS._state && SS._state.signedIn,
      isAnonymous: SS && SS._state && SS._state.isAnonymous,
      nativeSelects: document.querySelectorAll('select').length,
      goalChips: document.querySelectorAll('#ssGoalChips .ss-chip').length,
      audienceSegs: document.querySelectorAll('#ssAudienceSeg .ss-seg__btn, #ssAudienceSeg button').length,
      showcaseCards: document.querySelectorAll('#ssShowcase .ss-showcase-card').length,
      hasWigMatch: !!document.getElementById('ssWigMatch'),
      hasWigBtn: !!document.getElementById('ssWigGenerate'),
      hasAccount: !!document.getElementById('ssAccount'),
      hasAuthPanel: !!document.getElementById('ssAuthPanel'),
      hasMasterBtn: !!document.getElementById('ssGenerateBest'),
      accordionPanels: document.querySelectorAll('#ssAccordion .ss-panel').length,
      optChipGroups: document.querySelectorAll('.ss-optchips').length,
      jsVersion: Array.from(document.scripts).map(s => s.src).find(s => /style-studio-public/.test(s)) || '',
    };
  });
  ok('StyleStudioPublic module loaded', base.moduleLoaded);
  ok('anonymous auth completed (signedIn)', base.signedIn === true, 'signedIn=' + base.signedIn + ' anon=' + base.isAnonymous);
  ok('ZERO native <select> elements', base.nativeSelects === 0, 'found ' + base.nativeSelects);
  ok('goal chips rendered', base.goalChips >= 10, 'chips=' + base.goalChips);
  ok('audience segmented control rendered', base.audienceSegs === 4, 'segs=' + base.audienceSegs);
  ok('per-mode option chips (not selects)', base.optChipGroups > 0, 'groups=' + base.optChipGroups);
  ok('showcase carousel has 5 cards', base.showcaseCards === 5, 'cards=' + base.showcaseCards);
  ok('AI Wig Match flagship present', base.hasWigMatch && base.hasWigBtn);
  ok('9 manual mode panels', base.accordionPanels === 9, 'panels=' + base.accordionPanels);
  ok('account control + auth panel present', base.hasAccount && base.hasAuthPanel);
  ok('master button present', base.hasMasterBtn);

  // Master never-silent: showcase "Create my look" with nothing filled → must give feedback.
  const sc = await page.evaluate(async () => {
    const cta = document.querySelector('#ssShowcase .ss-showcase-card__cta');
    const before = (document.getElementById('ssStatus') || {}).textContent || '';
    if (cta) cta.click();
    await new Promise(r => setTimeout(r, 700));
    const after = (document.getElementById('ssStatus') || {}).textContent || '';
    return { label: cta ? cta.textContent.trim() : null, before, after, changed: before !== after };
  });
  ok('"Create my look" CTA gives feedback (not silent)', sc.changed && /consent|selfie|photo|generat|design|analy/i.test(sc.after), JSON.stringify(sc));

  // Viewer scroll-lock + restore: open with a fake image, confirm body locks, close, confirm restore.
  const viewer = await page.evaluate(async () => {
    const SS = window.StyleStudioPublic;
    if (!SS || !SS._openViewer) return { skip: 'no _openViewer' };
    const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP////////////////////////////////////////////////////////////////////////////////////////////////8B/8AAEQgAAQABAwEiAAIRAQMRAf/EABQAAQAAAAAAAAAAAAAAAAAAAAD/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL8A/9k=';
    SS._openViewer([{ src: img, title: 'audit', why: '' }], 0);
    await new Promise(r => setTimeout(r, 300));
    const locked = (document.body.style.position === 'fixed') || document.body.classList.contains('ss-viewer-open');
    const viewerOpen = !!document.getElementById('ssViewer');
    SS._closeViewer();
    await new Promise(r => setTimeout(r, 300));
    const restored = (document.body.style.position !== 'fixed');
    const viewerClosed = !document.getElementById('ssViewer');
    return { viewerOpen, locked, restored, viewerClosed };
  });
  ok('viewer opens + locks scroll', viewer.viewerOpen && viewer.locked, JSON.stringify(viewer));
  ok('viewer closes + RESTORES scroll (no freeze)', viewer.restored && viewer.viewerClosed, JSON.stringify(viewer));

  // Auth panel is non-trapping (opening it must NOT lock body scroll).
  const authPanel = await page.evaluate(async () => {
    const btn = document.querySelector('#ssAccount button, #ssAccount [data-action], #ssAccount a');
    const beforeLocked = document.body.style.position === 'fixed';
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 300));
    const panelVisible = (() => { const p = document.getElementById('ssAuthPanel'); return p && !p.hidden; })();
    const afterLocked = document.body.style.position === 'fixed';
    return { panelVisible, beforeLocked, afterLocked };
  });
  ok('auth panel is non-trapping (no body scroll lock)', authPanel.afterLocked === false, JSON.stringify(authPanel));

  // Language switch keeps the page working (text localizes, no error).
  const lang = await page.evaluate(async () => {
    const SS = window.StyleStudioPublic;
    const en = (document.querySelector('[data-ss-i18n="heroSub"]') || {}).textContent || '';
    if (SS && SS.setLang) SS.setLang('vi');
    await new Promise(r => setTimeout(r, 300));
    const vi = (document.querySelector('[data-ss-i18n="heroSub"]') || {}).textContent || '';
    if (SS && SS.setLang) SS.setLang('en');
    return { changed: en !== vi, en: en.slice(0, 30), vi: vi.slice(0, 30) };
  });
  ok('language switch localizes (vi/en) without error', lang.changed, JSON.stringify(lang));

  ok('serving expected JS version', /style-studio-public\.js\?v=2026/.test(base.jsVersion), base.jsVersion.split('/').pop());

  await browser.close();

  // Report
  const passed = results.filter(r => r.pass).length;
  console.log('\n=== /style-studio PRODUCTION REGRESSION AUDIT ===');
  results.forEach(r => console.log((r.pass ? '  PASS ' : '  FAIL ') + r.name + (r.detail ? '  — ' + r.detail : '')));
  console.log(`\nRESULT: ${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
