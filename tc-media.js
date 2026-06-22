/* Media Enrichment "Learn more" — deterministic, honest baseline link builder.
 * Pure browser-IIFE + node-testable (see tests/tc-media.test.js). Produces the RecommendationMedia[]
 * shown INSTANTLY on a card (search links can't be faked); the AI callable researchPlaceMedia later
 * enriches/reorders + adds candidate official/menu/ticket links. NEVER emits a specific video URL —
 * videos are always YouTube SEARCH links (the project's "no fake/embedded videos" rule). */
(function (root) {
  'use strict';
  function enc(s) { return encodeURIComponent(String(s == null ? '' : s).trim()); }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function gsearch(q) { return 'https://www.google.com/search?q=' + enc(q); }
  function ytSearch(q) { return 'https://www.youtube.com/results?search_query=' + enc(q); }
  function tiktokSearch(q) { return 'https://www.tiktok.com/search?q=' + enc(q); }
  function yelpSearch(name, city) { return 'https://www.yelp.com/search?find_desc=' + enc(name) + '&find_loc=' + enc(city); }
  function mapSearch(name, city) { return 'https://www.google.com/maps/search/?api=1&query=' + enc((clean(name) + ' ' + clean(city)).trim()); }
  function isSafeUrl(u) {
    u = String(u || '').trim();
    if (!/^https:\/\//i.test(u)) return false;
    var h = ''; try { h = u.replace(/^https:\/\//i, '').split(/[\/?#]/)[0].toLowerCase(); } catch (e) { return false; }
    if (h.indexOf('.') === -1) return false;
    if (/(?:google|bing|duckduckgo|yahoo)\.[a-z.]+\/(?:search|maps)|youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com/i.test(u)) return false;
    return true;
  }

  function mk(type, title, url, vs) { return { type: type, title: title, url: url, source: (vs === 'ai_suggested' ? 'ai_grounded' : 'search'), verificationStatus: (vs || 'search'), reason: '' }; }
  function reviews(n, c) { return mk('google_reviews', 'Google reviews', gsearch(n + ' ' + c + ' reviews')); }
  function yelp(n, c) { return mk('yelp_reviews', 'Yelp reviews', yelpSearch(n, c)); }
  function tripadvisor(n, c) { return mk('tripadvisor', 'Tripadvisor', gsearch(n + ' ' + c + ' tripadvisor reviews')); }
  function menu(n, c) { return mk('menu', 'Menu', gsearch(n + ' ' + c + ' menu')); }
  function official(n, c, url) { return isSafeUrl(url) ? mk('official_site', 'Official site', clean(url).slice(0, 300), 'ai_suggested') : mk('official_site', 'Official site', gsearch(n + ' ' + c + ' official website')); }
  function ticket(n, c, url) { return isSafeUrl(url) ? mk('ticket', 'Tickets', clean(url).slice(0, 300), 'ai_suggested') : mk('ticket', 'Tickets', gsearch(n + ' ' + c + ' tickets')); }
  function ytReview(n, c) { return mk('youtube_search', 'Find videos on YouTube', ytSearch(n + ' ' + c + ' review')); }
  function ytFood(n, c) { return mk('youtube_search', 'Find food videos on YouTube', ytSearch(n + ' ' + c + ' food review')); }
  function ytGuide(n, c) { return mk('youtube_search', 'Find travel videos on YouTube', ytSearch(n + ' ' + c + ' travel guide')); }
  function mapItem(n, c) { return mk('map', 'Map', mapSearch(n, c)); }
  function photos(n, c) { return mk('photos', 'Photos', mapSearch(n, c)); }

  // Build the deterministic, type-prioritized baseline media list (all honest search links).
  function build(item, type, city) {
    item = item || {};
    var n = clean(item.name || ''), c = clean(city || item.city || '');
    type = String(type || '').toLowerCase();
    if (type === 'restaurant' || type === 'coffee' || type === 'food') return [menu(n, c), reviews(n, c), yelp(n, c), ytFood(n, c), photos(n, c)];
    if (type === 'tour') return [official(n, c, item.officialUrl || item.url), ticket(n, c, item.ticketUrl), ytReview(n, c), reviews(n, c)];
    if (type === 'attraction') return [official(n, c, item.officialUrl), ticket(n, c, item.ticketUrl), ytReview(n, c), reviews(n, c), mapItem(n, c), photos(n, c)];
    if (type === 'event') return [official(n, c, item.eventUrl || item.officialUrl), ticket(n, c, item.ticketUrl), mapItem(n, c), ytReview(n, c)];
    if (type === 'hotel' || type === 'stay') return [official(n, c, item.officialUrl), reviews(n, c), tripadvisor(n, c), photos(n, c), mapItem(n, c)];
    if (type === 'scenic' || type === 'beach' || type === 'stopover' || type === 'hidden_gem' || type === 'highlight') return [mapItem(n, c), ytGuide(n, c), reviews(n, c)];
    return [mapItem(n, c), reviews(n, c), ytReview(n, c)]; // safe honest fallback for unknown types
  }

  root.TCMedia = { build: build, ytSearch: ytSearch, tiktokSearch: tiktokSearch, gsearch: gsearch, yelpSearch: yelpSearch, mapSearch: mapSearch, isSafeUrl: isSafeUrl };
})(typeof window !== 'undefined' ? window : this);
