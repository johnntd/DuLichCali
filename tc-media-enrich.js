/* tc-media-enrich.js — Media Enrichment decision brain (pure, node-testable; window.TCMediaEnrich).
 * NO network, NO DOM. The frontend does the Wikipedia REST + Wikimedia Commons fetches; THIS module
 * decides what is SAFE to show (anti-mismatch gating), normalizes image URLs + attribution, and
 * tiers confidence. HONESTY CORE: never approve a photo we cannot tie to the actual place — a
 * correct empty panel beats a wrong photo. (Loose Commons search was proven to return wrong-city /
 * unrelated images; the gates here are the defense.) */
(function (root) {
  'use strict';
  // Words that don't help identify a specific place (so a restaurant's tokens are its real name).
  var STOP = { restaurant: 1, cafe: 1, café: 1, bar: 1, grill: 1, grille: 1, kitchen: 1, the: 1, and: 1, of: 1, a: 1, an: 1, bistro: 1, diner: 1, eatery: 1, bbq: 1, co: 1, inc: 1, llc: 1, ltd: 1, house: 1, room: 1, club: 1, lounge: 1 };
  function _norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function _short(s) { return String(s == null ? '' : s).split(',')[0].trim(); }
  function tokens(name) { return _norm(name).split(' ').filter(function (w) { return w.length >= 3 && !STOP[w]; }); }
  function stripTags(html) { return String(html == null ? '' : html).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }
  function _haversineKm(a1, o1, a2, o2) {
    if ([a1, o1, a2, o2].some(function (x) { return typeof x !== 'number' || isNaN(x); })) return Infinity;
    var R = 6371, dLa = (a2 - a1) * Math.PI / 180, dLo = (o2 - o1) * Math.PI / 180;
    var s = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // Wikipedia title candidates to try, most-specific last (underscored, de-duped).
  function titleCandidates(name, city) {
    name = _short(name); city = _short(city); var out = [];
    if (name) { out.push(name); if (city) { out.push(name + ', ' + city); out.push(name + ' (' + city + ')'); } }
    return out.map(function (t) { return t.replace(/\s+/g, '_'); }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  }

  // Is a REST summary a usable match for this place? Returns 'exact' | 'name_match' | null.
  // GATE: type must be 'standard' + have an image; the place NAME tokens must appear in the title
  // (so we don't grab an unrelated standard page); 'exact' additionally requires the city token in
  // title/description/extract OR coordinates within ~25 km. Otherwise 'name_match' (lower tier).
  function summaryConfidence(summary, opts) {
    opts = opts || {};
    if (!summary || summary.type !== 'standard') return null;
    var hasImg = !!((summary.thumbnail && summary.thumbnail.source) || (summary.originalimage && summary.originalimage.source));
    if (!hasImg) return null;
    var nameToks = tokens(opts.name || ''); var titleHay = _norm(summary.title || '');
    var nameOk = !nameToks.length || nameToks.some(function (tk) { return titleHay.indexOf(tk) !== -1; });
    if (!nameOk) return null;
    var city = _norm(_short(opts.city || ''));
    var hay = _norm((summary.title || '') + ' ' + (summary.description || '') + ' ' + (summary.extract || ''));
    var cityOk = !city || hay.indexOf(city) !== -1;
    var coordOk = false;
    if (opts.coords && summary.coordinates && opts.coords.lat != null && opts.coords.lng != null) {
      coordOk = _haversineKm(+opts.coords.lat, +opts.coords.lng, +summary.coordinates.lat, +summary.coordinates.lon) <= 25;
    }
    return (cityOk || coordOk) ? 'exact' : 'name_match';
  }

  // media-list → kept gallery items (real photos only; drop icons/diagrams/svg/logos).
  function keepGalleryItems(items, max) {
    max = max || 6;
    return (Array.isArray(items) ? items : []).filter(function (it) {
      if (!it || it.type !== 'image' || !it.showInGallery) return false;
      var t = String(it.title || '');
      if (/\.svg$/i.test(t)) return false;
      if (/logo|icon|map|diagram|seal|flag|coat[_ ]of[_ ]arms|symbol|commons-logo|edit-|\.gif$/i.test(t)) return false;
      return true;
    }).slice(0, max);
  }

  // Normalize a protocol-relative/thumb URL to https + a target width (rewrites the /NNNpx- segment).
  function httpsThumb(u, width) {
    u = String(u || ''); if (!u) return '';
    if (u.indexOf('//') === 0) u = 'https:' + u;
    if (width) u = u.replace(/\/(\d+)px-/, '/' + width + 'px-');
    return u;
  }
  function srcsetThumb(item, width) { var ss = (item && item.srcset) || []; return ss.length ? httpsThumb(ss[0].src, width) : ''; }

  // Attribution from Commons extmetadata → { text, license, requiresAttribution }.
  function attributionOf(extmetadata) {
    var m = extmetadata || {}; function v(k) { return (m[k] && m[k].value != null) ? String(m[k].value) : ''; }
    var artist = stripTags(v('Artist')); var lic = v('LicenseShortName'); var req = v('AttributionRequired');
    var pd = req === 'false' || /public domain|^\s*cc0/i.test(lic);
    var text = pd ? (lic || 'Public domain') : ((artist ? artist + ' / ' : '') + (lic || 'CC'));
    return { text: text, license: lic, requiresAttribution: !pd };
  }

  // CRITICAL anti-mismatch gate for Commons intitle: search. A File: title must contain EVERY
  // significant name token; if the city is known it MUST also appear (drops the wrong-city trap,
  // e.g. "Crack Shack" → the Las Vegas file). Returns true only when safe to show.
  function acceptCommonsFile(fileTitle, name, city) {
    var t = _norm(String(fileTitle || '').replace(/^file:/i, '').replace(/\.[a-z0-9]+$/i, ''));
    var nameToks = tokens(name); if (!nameToks.length) return false;
    if (!nameToks.every(function (tk) { return t.indexOf(tk) !== -1; })) return false;
    var c = _norm(_short(city || '')); if (c && t.indexOf(c) === -1) return false;
    return true;
  }

  // The intitle: search string (quoted, so it's a phrase not loose tokens).
  function intitleQuery(name) { return 'intitle:"' + _short(name).replace(/"/g, '') + '"'; }

  // UI badge key for a confidence tier (resolved to i18n on the frontend).
  function badgeKey(confidence) {
    return confidence === 'exact' ? 'verifiedPhoto' : (confidence === 'area' ? 'areaPhoto' : (confidence === 'name_match' ? 'likelyMatchPhoto' : ''));
  }

  root.TCMediaEnrich = {
    titleCandidates: titleCandidates, summaryConfidence: summaryConfidence, keepGalleryItems: keepGalleryItems,
    httpsThumb: httpsThumb, srcsetThumb: srcsetThumb, stripTags: stripTags, attributionOf: attributionOf,
    acceptCommonsFile: acceptCommonsFile, intitleQuery: intitleQuery, badgeKey: badgeKey, tokens: tokens,
  };
})(typeof window !== 'undefined' ? window : this);
