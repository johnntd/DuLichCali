'use strict';
// Mobile Barber — AI STYLE STUDIO (vendor-only).
// Self-initialising module rendered into #mbStyleStudioRoot on dashboard.html.
// Reuses window.MobileBarberAIPreview (compression/cache) + window.MBLightbox.
// Calls the vendor-authed `generateStyleStudio` callable. NOTHING persists to
// Firestore/Storage: favorites + save history are localStorage/session only.
(function (root) {
  if (!root || !root.document) return;

  // ── i18n: vi / en / es (no hardcoded user-facing strings) ───────────────
  var STUDIO_STRINGS = {
    en: {
      studioTitle: 'AI Style Studio', studioSub: 'Vendor consult — analyse a selfie, explore looks',
      studioConsent: 'I have the customer’s consent to analyse this photo.',
      studioUpload: 'Upload / take selfie', studioGenerate: 'Generate looks', studioGenerating: 'Generating…',
      studioReady: 'Photo ready — pick a studio and generate.', studioConsentRequired: 'Confirm consent first.',
      studioError: 'AI Style Studio is temporarily unavailable.',
      modeHaircut: 'Hair Styles', modeColor: 'Hair Colors', modeTexture: 'Texture', modeEyebrow: 'Eyebrows',
      modeBeard: 'Beards', modeWig: 'Wigs', modeHairsystem: 'Hair Systems', modeEvent: 'Event Styles',
      modeVacation: 'Vacation Styles', favorites: 'Favorites', consult: 'Consultation',
      consultFeatures: 'Features', consultScores: 'Harmony (vendor-only)', consultStrategy: 'Strategy',
      consultEphemeral: 'Vendor-only · not saved · not shown to customer',
      saveToPhone: 'Save to phone', favorite: 'Favorite', unfavorite: 'Saved ✓', compare: 'Compare',
      scoreSymmetry: 'Symmetry', scoreYouthfulness: 'Youthfulness', scoreProfessional: 'Professional',
      scoreConfidence: 'Confidence', scoreSoftness: 'Softness', scoreMaintenance: 'Maintenance',
      emphasize: 'Emphasize', balance: 'Balance', thinning: 'Hair fullness',
      audienceLabel: 'Audience', audMan: 'Man', audWoman: 'Woman', audChild: 'Child', audNeutral: 'Auto',
      lightboxClose: 'Close', lightboxPreview: 'Preview',
    },
    vi: {
      studioTitle: 'Studio Tạo Kiểu AI', studioSub: 'Tư vấn cho thợ — phân tích ảnh, khám phá kiểu',
      studioConsent: 'Tôi đã được khách đồng ý phân tích ảnh này.',
      studioUpload: 'Tải / chụp ảnh', studioGenerate: 'Tạo kiểu', studioGenerating: 'Đang tạo…',
      studioReady: 'Ảnh đã sẵn sàng — chọn studio và tạo kiểu.', studioConsentRequired: 'Hãy xác nhận đồng ý trước.',
      studioError: 'Studio Tạo Kiểu AI tạm thời không khả dụng.',
      modeHaircut: 'Kiểu Tóc', modeColor: 'Màu Tóc', modeTexture: 'Kết Cấu Tóc', modeEyebrow: 'Chân Mày',
      modeBeard: 'Râu', modeWig: 'Tóc Giả', modeHairsystem: 'Hệ Thống Tóc', modeEvent: 'Kiểu Sự Kiện',
      modeVacation: 'Kiểu Du Lịch', favorites: 'Yêu Thích', consult: 'Tư Vấn',
      consultFeatures: 'Đặc Điểm', consultScores: 'Hài Hòa (chỉ thợ xem)', consultStrategy: 'Chiến Lược',
      consultEphemeral: 'Chỉ thợ xem · không lưu · không hiển thị cho khách',
      saveToPhone: 'Lưu về máy', favorite: 'Yêu thích', unfavorite: 'Đã lưu ✓', compare: 'So sánh',
      scoreSymmetry: 'Cân Đối', scoreYouthfulness: 'Trẻ Trung', scoreProfessional: 'Chuyên Nghiệp',
      scoreConfidence: 'Tự Tin', scoreSoftness: 'Mềm Mại', scoreMaintenance: 'Bảo Dưỡng',
      emphasize: 'Nhấn Mạnh', balance: 'Cân Bằng', thinning: 'Độ Dày Tóc',
      audienceLabel: 'Đối tượng', audMan: 'Nam', audWoman: 'Nữ', audChild: 'Trẻ em', audNeutral: 'Tự động',
      lightboxClose: 'Đóng', lightboxPreview: 'Xem trước',
    },
    es: {
      studioTitle: 'Estudio de Estilo AI', studioSub: 'Consulta del vendedor — analiza una selfie, explora looks',
      studioConsent: 'Tengo el consentimiento del cliente para analizar esta foto.',
      studioUpload: 'Subir / tomar selfie', studioGenerate: 'Generar looks', studioGenerating: 'Generando…',
      studioReady: 'Foto lista — elige un estudio y genera.', studioConsentRequired: 'Confirma el consentimiento primero.',
      studioError: 'El Estudio de Estilo AI no está disponible temporalmente.',
      modeHaircut: 'Cortes', modeColor: 'Colores', modeTexture: 'Textura', modeEyebrow: 'Cejas',
      modeBeard: 'Barbas', modeWig: 'Pelucas', modeHairsystem: 'Sistemas Capilares', modeEvent: 'Estilos de Evento',
      modeVacation: 'Estilos de Vacaciones', favorites: 'Favoritos', consult: 'Consulta',
      consultFeatures: 'Rasgos', consultScores: 'Armonía (solo vendedor)', consultStrategy: 'Estrategia',
      consultEphemeral: 'Solo vendedor · no se guarda · no se muestra al cliente',
      saveToPhone: 'Guardar en el teléfono', favorite: 'Favorito', unfavorite: 'Guardado ✓', compare: 'Comparar',
      scoreSymmetry: 'Simetría', scoreYouthfulness: 'Juventud', scoreProfessional: 'Profesional',
      scoreConfidence: 'Confianza', scoreSoftness: 'Suavidad', scoreMaintenance: 'Mantenimiento',
      emphasize: 'Destacar', balance: 'Equilibrar', thinning: 'Densidad capilar',
      audienceLabel: 'Audiencia', audMan: 'Hombre', audWoman: 'Mujer', audChild: 'Niño', audNeutral: 'Automático',
      lightboxClose: 'Cerrar', lightboxPreview: 'Vista previa',
    },
  };

  var state = { lang: 'en', consent: false, selfieDataUrl: '', mode: 'haircut', options: {},
                audience: 'neutral', modeOptions: {},
                analyzing: false, analysis: null, recommendations: [], sessionId: '',
                favorites: [], compareIds: [] };

  function t(key) {
    return (STUDIO_STRINGS[state.lang] && STUDIO_STRINGS[state.lang][key]) || STUDIO_STRINGS.en[key] || '';
  }
  function detectLang() {
    try {
      var p = new URLSearchParams(root.location.search).get('lang');
      if (STUDIO_STRINGS[p]) return p;
      var saved = root.localStorage.getItem('dlc_lang') || root.localStorage.getItem('dlcLang');
      if (STUDIO_STRINGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }
  function applyI18n(scope) {
    (scope || root.document).querySelectorAll('[data-studio-i18n]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-studio-i18n'));
    });
  }

  // Public: re-render on external lang change (additive; dashboard keeps its own).
  function setLang(lang) {
    if (!STUDIO_STRINGS[lang]) return;
    state.lang = lang;
    render();
  }

  var _langBound = false;
  function init() {
    var rootEl = root.document.getElementById('mbStyleStudioRoot');
    if (!rootEl) return; // not on this page
    state.lang = detectLang();
    // Re-translate when the dashboard's language buttons are clicked (additive).
    if (!_langBound) {
      root.document.querySelectorAll('.mb-language__button[data-lang]').forEach(function (btn) {
        btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
      });
      _langBound = true;
    }
    render();
  }

  // 9 studios + their option controls. Data-driven so each mode is declared once.
  var STUDIO_DEFS = [
    { mode: 'haircut', label: 'modeHaircut', controls: [] },
    { mode: 'color', label: 'modeColor', controls: [{ key: 'type', values: ['highlight', 'balayage', 'ombre', 'gray_blend', 'fashion'] }] },
    { mode: 'texture', label: 'modeTexture', controls: [{ key: 'texture', values: ['curly', 'straight', 'wavy'] }] },
    { mode: 'eyebrow', label: 'modeEyebrow', controls: [{ key: 'shape', values: ['natural', 'arched', 'straight', 'rounded', 'soft_angled'] }] },
    { mode: 'beard', label: 'modeBeard', controls: [{ key: 'length', values: ['stubble', 'short', 'medium', 'full'] }, { key: 'shape', values: ['rounded', 'angular', 'tapered'] }] },
    { mode: 'wig', label: 'modeWig', controls: [{ key: 'family', values: ['natural', 'business', 'modern', 'long', 'layered', 'curly', 'elegant', 'glamorous', 'cute', 'simple', 'school'] }] },
    { mode: 'hairsystem', label: 'modeHairsystem', controls: [{ key: 'type', values: ['frontal', 'partial', 'full', 'topper', 'crown'] }] },
    { mode: 'event', label: 'modeEvent', controls: [{ key: 'occasion', values: ['wedding', 'cruise', 'disneyland', 'vegas', 'beach', 'birthday', 'graduation', 'holiday'] }] },
    { mode: 'vacation', label: 'modeVacation', controls: [{ key: 'destination', values: ['hawaii', 'europe', 'california_coast', 'theme_parks', 'luxury_resorts'] }] },
  ];

  function elt(tag, cls, text) { var e = root.document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function render() {
    var host = root.document.getElementById('mbStyleStudioRoot');
    if (!host) return;
    host.innerHTML = '';

    // Header + consent + upload + generate
    var head = elt('div', 'mb-studio-head');
    head.appendChild(elt('h2', 'mb-studio-title', t('studioTitle')));
    head.appendChild(elt('p', 'mb-studio-sub', t('studioSub')));
    var consent = elt('label', 'mb-studio-consent');
    var cb = root.document.createElement('input'); cb.type = 'checkbox';
    cb.addEventListener('change', function () { state.consent = cb.checked; refreshControls(); });
    consent.appendChild(cb); consent.appendChild(elt('span', null, t('studioConsent')));
    head.appendChild(consent);

    var upload = root.document.createElement('input');
    upload.type = 'file'; upload.accept = 'image/*'; upload.className = 'mb-studio-upload'; upload.id = 'mbStudioUpload';
    upload.addEventListener('change', onUpload);
    var uploadBtn = elt('label', 'mb-button mb-button--ghost', t('studioUpload')); uploadBtn.setAttribute('for', 'mbStudioUpload');
    head.appendChild(uploadBtn); head.appendChild(upload);

    // Audience selector — controls which audience the backend targets
    var audWrap = elt('div', 'mb-studio-audience-wrap');
    var audLabel = elt('label', 'mb-studio-audience-label', t('audienceLabel'));
    var audSel = root.document.createElement('select'); audSel.className = 'mb-studio-audience';
    [['neutral', t('audNeutral')], ['man', t('audMan')], ['woman', t('audWoman')], ['child', t('audChild')]].forEach(function (pair) {
      var o = root.document.createElement('option'); o.value = pair[0]; o.textContent = pair[1];
      if (pair[0] === state.audience) o.selected = true;
      audSel.appendChild(o);
    });
    audSel.addEventListener('change', function () { state.audience = audSel.value; });
    audWrap.appendChild(audLabel); audWrap.appendChild(audSel);
    head.appendChild(audWrap);

    host.appendChild(head);

    var selfiePreview = elt('div', 'mb-studio-selfie'); selfiePreview.id = 'mbStudioSelfie';
    if (state.selfieDataUrl) { var im = root.document.createElement('img'); im.src = state.selfieDataUrl; im.alt = ''; selfiePreview.appendChild(im); }
    host.appendChild(selfiePreview);

    host.appendChild(renderConsultation()); // Task 9

    // Accordion of 9 studios
    var acc = elt('div', 'mb-studio-accordion');
    STUDIO_DEFS.forEach(function (def) {
      var d = root.document.createElement('details'); d.className = 'mb-studio-panel'; d.setAttribute('data-mode', def.mode);
      var sum = root.document.createElement('summary'); sum.className = 'mb-studio-panel__summary';
      sum.appendChild(elt('span', 'mb-studio-panel__title', t(def.label)));
      d.appendChild(sum);
      var body = elt('div', 'mb-studio-panel__body');
      def.controls.forEach(function (ctrl) {
        var sel = root.document.createElement('select'); sel.className = 'mb-studio-select'; sel.setAttribute('data-ctrl', ctrl.key);
        ctrl.values.forEach(function (v) { var o = root.document.createElement('option'); o.value = v; o.textContent = v.replace(/_/g, ' '); o.selected = !!(state.modeOptions[def.mode] && state.modeOptions[def.mode][ctrl.key] === v); sel.appendChild(o); });
        sel.addEventListener('change', function () { state.modeOptions[def.mode] = state.modeOptions[def.mode] || {}; state.modeOptions[def.mode][ctrl.key] = sel.value; });
        body.appendChild(sel);
      });
      var gen = elt('button', 'mb-button mb-button--primary mb-studio-generate', t('studioGenerate'));
      gen.type = 'button'; gen.disabled = !(state.consent && state.selfieDataUrl);
      gen.addEventListener('click', function () { onGenerate(def, body); });
      body.appendChild(gen);
      body.appendChild(elt('div', 'mb-studio-results', '')); // results container
      d.appendChild(body); acc.appendChild(d);
    });
    // Favorites panel (session/local; no Firestore)
    var fav = root.document.createElement('details'); fav.className = 'mb-studio-panel mb-studio-panel--favorites';
    var fsum = root.document.createElement('summary'); fsum.className = 'mb-studio-panel__summary';
    fsum.appendChild(elt('span', 'mb-studio-panel__title', t('favorites')));
    fav.appendChild(fsum);
    fav.appendChild(renderFavorites()); // Task 8
    acc.appendChild(fav);
    host.appendChild(acc);

    applyI18n(host);
  }

  function refreshControls() {
    root.document.querySelectorAll('.mb-studio-generate').forEach(function (b) {
      b.disabled = !(state.consent && state.selfieDataUrl);
    });
  }

  function onUpload(ev) {
    var file = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!state.consent) { toast(t('studioConsentRequired')); ev.target.value = ''; return; }
    var AIP = root.MobileBarberAIPreview;
    if (!AIP || typeof AIP.compressImage !== 'function') { toast(t('studioError')); return; }
    AIP.compressImage(file).then(function (dataUrl) {
      state.selfieDataUrl = dataUrl; toast(t('studioReady')); render();
    }).catch(function () { toast(t('studioError')); });
  }

  function onGenerate(def, bodyEl) {
    if (state.analyzing) return;
    state.analyzing = true; state.mode = def.mode;
    var opts = {};
    bodyEl.querySelectorAll('.mb-studio-select').forEach(function (s) { opts[s.getAttribute('data-ctrl')] = s.value; });
    state.options = opts;
    state.sessionId = 'studio_' + def.mode + '_' + Math.random().toString(36).slice(2, 9);
    var resultsEl = bodyEl.querySelector('.mb-studio-results');
    if (resultsEl) resultsEl.textContent = t('studioGenerating');
    callStudio({ dataUrl: state.selfieDataUrl, mode: def.mode, options: opts,
                 audience: state.audience || 'neutral' }).then(function (res) {
      state.analyzing = false;
      if (!res.ok) { if (resultsEl) resultsEl.textContent = res.message || t('studioError'); return; }
      state.analysis = res.analysis || null;
      state.recommendations = res.recommendations || [];
      renderResults(resultsEl, res.recommendations); // Task 8
      renderConsultationInto(); // Task 9 refresh
    });
  }

  function toast(msg) {
    var el = root.document.getElementById('mbDashboardToast');
    if (!el) { if (root.console) root.console.log('[style-studio]', msg); return; }
    el.textContent = msg; el.hidden = false;
    root.setTimeout(function () { el.hidden = true; }, 2600);
  }

  function renderResults(container, recs) {
    if (!container) return;
    container.innerHTML = '';
    (recs || []).forEach(function (rec) {
      var imgSrc = rec.previewDataUrl || '';
      var card = elt('article', 'mb-studio-card'); card.setAttribute('data-style-id', rec.styleId || '');
      if (imgSrc) {
        var img = root.document.createElement('img'); img.className = 'mb-studio-card__img'; img.src = imgSrc; img.alt = rec.title || ''; img.loading = 'lazy';
        img.addEventListener('click', function () { openLightbox(imgSrc, rec.title || ''); });
        card.appendChild(img);
      }
      if (rec.previewKind === 'style_inspiration') card.appendChild(elt('span', 'mb-studio-card__insp', '★'));
      card.appendChild(elt('strong', 'mb-studio-card__title', rec.title || ''));
      if (rec.whyItFitsFace) card.appendChild(elt('p', 'mb-studio-card__why', rec.whyItFitsFace));
      if (rec.maintenance) card.appendChild(elt('p', 'mb-studio-card__meta', rec.maintenance));
      if (rec.barberNotes) card.appendChild(elt('p', 'mb-studio-card__notes', rec.barberNotes));
      [['colorRecommendation'], ['highlightRecommendation'], ['curlStraightRecommendation']].forEach(function (k) {
        if (rec[k[0]]) card.appendChild(elt('p', 'mb-studio-card__rec', rec[k[0]]));
      });

      var actions = elt('div', 'mb-studio-card__actions');
      var saveBtn = elt('button', 'mb-button mb-button--ghost mb-button--sm', t('saveToPhone')); saveBtn.type = 'button';
      saveBtn.addEventListener('click', function () { saveToPhone(imgSrc, rec); });
      var favBtn = elt('button', 'mb-button mb-button--ghost mb-button--sm', isFav(rec.styleId) ? t('unfavorite') : t('favorite')); favBtn.type = 'button';
      favBtn.addEventListener('click', function () { toggleFav(rec, imgSrc); favBtn.textContent = isFav(rec.styleId) ? t('unfavorite') : t('favorite'); });
      var cmpBtn = elt('button', 'mb-button mb-button--ghost mb-button--sm', t('compare')); cmpBtn.type = 'button';
      cmpBtn.addEventListener('click', function () { addCompare(rec, imgSrc); });
      actions.appendChild(saveBtn); actions.appendChild(favBtn); actions.appendChild(cmpBtn);
      card.appendChild(actions);
      container.appendChild(card);

      // Cache FULL-res to localStorage on this device only (reuses AIP helper).
      var AIP = root.MobileBarberAIPreview;
      if (AIP && typeof AIP.saveLocalCopy === 'function' && imgSrc) {
        try { AIP.saveLocalCopy(state.sessionId, rec.styleId || '', imgSrc); } catch (e) {}
      }
    });
  }

  function openLightbox(src, caption) {
    if (!src || !root.MBLightbox || !root.MBLightbox.open) return;
    root.MBLightbox.open(src, { caption: caption || '', closeLabel: t('lightboxClose'), ariaLabel: caption || t('lightboxPreview') });
  }

  // Save-to-phone: trigger a native download of the full-res data URL. No upload.
  function extFromDataUrl(src) { var m = /^data:image\/(\w+)/.exec(src || ''); return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'jpg'; }
  function saveToPhone(src, rec) {
    if (!src) return;
    var a = root.document.createElement('a');
    a.href = src; a.download = ((rec && rec.styleId) || 'style') + '.' + extFromDataUrl(src);
    root.document.body.appendChild(a); a.click(); root.document.body.removeChild(a);
  }

  // Favorites: session/local only — NO Firestore. Stores text ref + on-device key.
  var FAV_KEY = 'mb_studio_favorites';
  function readFavs() { try { return JSON.parse(root.localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } }
  function writeFavs(list) { try { root.localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) {} }
  function isFav(id) { return !!id && readFavs().some(function (f) { return f.styleId === id; }); }
  function toggleFav(rec, imgSrc) {
    if (!rec || !rec.styleId) return;
    var list = readFavs(); var id = rec.styleId || '';
    if (list.some(function (f) { return f.styleId === id; })) {
      list = list.filter(function (f) { return f.styleId !== id; });
    } else {
      // text reference only (+ local cache key); no image bytes in this store.
      list.push({ styleId: id, title: rec.title || '', mode: state.mode, sessionId: state.sessionId,
                  whyItFitsFace: rec.whyItFitsFace || '', barberNotes: rec.barberNotes || '' });
    }
    writeFavs(list);
  }
  function renderFavorites() {
    var wrap = elt('div', 'mb-studio-panel__body mb-studio-favorites');
    var list = readFavs();
    if (!list.length) { wrap.appendChild(elt('p', 'mb-studio-empty', '—')); return wrap; }
    list.forEach(function (f) {
      var row = elt('div', 'mb-studio-fav-row');
      var AIP = root.MobileBarberAIPreview;
      var cached = AIP && AIP.readLocalCopy ? AIP.readLocalCopy(f.sessionId, f.styleId) : '';
      if (cached) { var im = root.document.createElement('img'); im.src = cached; im.alt = ''; row.appendChild(im); }
      row.appendChild(elt('span', null, f.title || f.styleId));
      wrap.appendChild(row);
    });
    return wrap;
  }

  // Compare: side-by-side (the existing MBLightbox is single-image). Collect 2.
  function addCompare(rec, imgSrc) {
    if (!imgSrc) return;
    state.compareIds = (state.compareIds || []).concat([{ src: imgSrc, title: rec.title || '' }]).slice(-2);
    if (state.compareIds.length === 2) showCompare();
  }
  function showCompare() {
    var existing = root.document.getElementById('mbStudioCompare'); if (existing) existing.remove();
    var ov = elt('div', 'mb-studio-compare'); ov.id = 'mbStudioCompare';
    state.compareIds.forEach(function (c) {
      var fig = elt('figure', 'mb-studio-compare__col');
      var im = root.document.createElement('img'); im.src = c.src; im.alt = c.title; fig.appendChild(im);
      fig.appendChild(elt('figcaption', null, c.title)); ov.appendChild(fig);
    });
    var close = elt('button', 'mb-studio-compare__close', '×'); close.type = 'button';
    close.addEventListener('click', function () { ov.remove(); state.compareIds = []; });
    ov.appendChild(close);
    root.document.body.appendChild(ov);
  }

  function renderConsultation() {
    var wrap = elt('section', 'mb-studio-consult'); wrap.id = 'mbStudioConsult';
    wrap.appendChild(elt('h3', 'mb-studio-consult__title', t('consult')));
    wrap.appendChild(elt('p', 'mb-studio-consult__note', t('consultEphemeral')));
    wrap.appendChild(elt('div', 'mb-studio-consult__body', ''));
    fillConsultation(wrap.querySelector('.mb-studio-consult__body'));
    return wrap;
  }
  function renderConsultationInto() {
    var body = root.document.querySelector('#mbStudioConsult .mb-studio-consult__body');
    if (body) fillConsultation(body);
  }
  function fillConsultation(body) {
    if (!body) return;
    body.innerHTML = '';
    var a = state.analysis;
    if (!a) { body.appendChild(elt('p', 'mb-studio-empty', '—')); return; }

    // Features (positive phrases)
    if (a.features && Object.keys(a.features).length) {
      var fblock = elt('div', 'mb-studio-consult__features');
      fblock.appendChild(elt('h4', null, t('consultFeatures')));
      Object.keys(a.features).forEach(function (k) {
        if (!a.features[k]) return;
        var row = elt('div', 'mb-studio-consult__feature');
        row.appendChild(elt('span', 'mb-studio-consult__k', k));
        row.appendChild(elt('span', 'mb-studio-consult__v', String(a.features[k])));
        fblock.appendChild(row);
      });
      body.appendChild(fblock);
    }

    // Harmony scores 0–100 (vendor-only; bars). Never shown to customer.
    if (a.scores) {
      var sblock = elt('div', 'mb-studio-consult__scores');
      sblock.appendChild(elt('h4', null, t('consultScores')));
      [['symmetry', 'scoreSymmetry'], ['youthfulness', 'scoreYouthfulness'], ['professional', 'scoreProfessional'],
       ['confidence', 'scoreConfidence'], ['softness', 'scoreSoftness'], ['maintenance', 'scoreMaintenance']].forEach(function (pair) {
        var val = a.scores[pair[0]];
        if (val == null) return;
        var row = elt('div', 'mb-studio-score');
        row.appendChild(elt('span', 'mb-studio-score__label', t(pair[1])));
        var bar = elt('div', 'mb-studio-score__bar'); var fillEl = elt('div', 'mb-studio-score__fill');
        fillEl.style.width = Math.max(0, Math.min(100, val)) + '%'; bar.appendChild(fillEl); row.appendChild(bar);
        row.appendChild(elt('span', 'mb-studio-score__num', String(val))); sblock.appendChild(row);
      });
      body.appendChild(sblock);
    }

    // Strategy (emphasize / balance) + thinning (soft language)
    var emph = (a.strategy && Array.isArray(a.strategy.emphasize)) ? a.strategy.emphasize : [];
    var bal  = (a.strategy && Array.isArray(a.strategy.balance)) ? a.strategy.balance : [];
    if (emph.length || bal.length) {
      var st = elt('div', 'mb-studio-consult__strategy'); st.appendChild(elt('h4', null, t('consultStrategy')));
      if (emph.length) st.appendChild(elt('p', null, t('emphasize') + ': ' + emph.join(', ')));
      if (bal.length) st.appendChild(elt('p', null, t('balance') + ': ' + bal.join(', ')));
      body.appendChild(st);
    }
    if (a.thinning && a.thinning.note) {
      body.appendChild(elt('p', 'mb-studio-consult__thinning', t('thinning') + ': ' + a.thinning.note));
    }
  }

  // Thin client for the vendor callable. Mirrors mobile-barber-ai-preview.js
  // generate() but targets generateStyleStudio and passes mode/options/goal.
  function callStudio(opts) {
    opts = opts || {};
    if (!opts.dataUrl) return Promise.resolve({ ok: false, code: 'no_image', message: 'No selfie.' });
    if (typeof root.firebase === 'undefined' || !root.firebase.functions) {
      return Promise.resolve({ ok: false, code: 'firebase_unavailable', message: t('studioError') });
    }
    var callable;
    try {
      callable = root.firebase.functions().httpsCallable('generateStyleStudio', { timeout: 180000 });
    } catch (e) {
      return Promise.resolve({ ok: false, code: 'callable_init_failed', message: t('studioError') });
    }
    return callable({
      selfieDataUrl: opts.dataUrl, lang: state.lang, mode: opts.mode,
      options: opts.options || {}, audience: opts.audience || 'neutral',
      preference: opts.preference || '', goal: opts.goal || '',
    }).then(function (result) {
      var p = (result && result.data) || {};
      if (!p.ok) return { ok: false, code: p.debugCode || 'provider_error', message: p.vendorMessage || t('studioError') };
      var recs = (p.recommendations || []).filter(function (r) { return r && r.previewDataUrl && !r.error; });
      if (!recs.length) return { ok: false, code: 'empty', message: t('studioError') };
      return { ok: true, mode: p.mode, analysis: p.analysis || null, recommendations: recs,
               provider: p.provider || 'gemini', generationTimeMs: p.generationTimeMs || 0 };
    }).catch(function (err) {
      if (root.console) root.console.error('[style-studio] callable failed', err);
      return { ok: false, code: 'callable_threw', message: t('studioError') };
    });
  }

  root.MobileBarberStyleStudio = { init: init, setLang: setLang, _t: t, _state: state };

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})(typeof window !== 'undefined' ? window : this);
