'use strict';
// Pure, dependency-free honesty clamp for AI-curated RecommendationMedia (Media Enrichment
// "Learn more"). Mirrors functions/lib/userPlaceSanitize.js. The AI may DECIDE which link types
// matter and craft search queries, but it can NEVER hand the user a fake/unverified URL:
//   - videos (youtube/tiktok)      → a SEARCH link only (never a specific watch/embed URL)
//   - reviews / map / photos       → deterministic search links (an AI-supplied url is ignored)
//   - official_site/menu/ticket/blog → the AI url is kept ONLY if https + a real (non-search/social)
//                                      host, marked 'ai_suggested'; otherwise a deterministic search link
// No fabricated ratings/prices/hours pass through here (this module governs the links array only).

var SEARCH_SOCIAL_RE = /(?:google|bing|duckduckgo|yahoo)\.[a-z.]+\/(?:search|maps)|youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|x\.com|twitter\.com/i;

function enc(s) { return encodeURIComponent(String(s == null ? '' : s).trim()); }
function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 160); }
function gsearch(q) { return 'https://www.google.com/search?q=' + enc(q); }
function ytSearch(q) { return 'https://www.youtube.com/results?search_query=' + enc(q); }
function tiktokSearch(q) { return 'https://www.tiktok.com/search?q=' + enc(q); }
function yelpSearch(name, city) { return 'https://www.yelp.com/search?find_desc=' + enc(name) + '&find_loc=' + enc(city); }
function mapSearch(name, city) { return 'https://www.google.com/maps/search/?api=1&query=' + enc((clean(name, 120) + ' ' + clean(city, 80)).trim()); }

function isSafeOfficialUrl(u) {
  u = String(u || '').trim();
  if (!/^https:\/\//i.test(u)) return false;
  var host = '';
  try { host = u.replace(/^https:\/\//i, '').split(/[\/?#]/)[0].toLowerCase(); } catch (e) { return false; }
  if (host.indexOf('.') === -1) return false;          // must be a real domain
  if (SEARCH_SOCIAL_RE.test(u)) return false;            // a search/social URL is not an "official site"
  return true;
}

var VIDEO_TYPES = { youtube_official: 1, youtube_search: 1, review_video: 1, video: 1 };
var DETERMINISTIC = { google_reviews: 1, yelp_reviews: 1, tripadvisor: 1, photos: 1, map: 1 };
var AI_URL_TYPES = { official_site: 1, menu: 1, ticket: 1, blog_guide: 1 };
function suffixFor(type) { return ({ menu: ' menu', ticket: ' tickets', official_site: ' official website', blog_guide: ' travel guide review' })[type] || ''; }

// items = AI RecommendationMedia[] ; ctx = { name, city }. Returns sanitized RecommendationMedia[].
function sanitizeMediaItems(items, ctx) {
  ctx = ctx || {};
  var name = clean(ctx.name, 120), city = clean(ctx.city, 80);
  var out = [];
  (Array.isArray(items) ? items : []).forEach(function (it) {
    if (!it || !it.type) return;
    var type = String(it.type), title = clean(it.title, 80), reason = clean(it.reason, 200);
    var query = clean(it.query || it.searchQuery, 120);

    if (VIDEO_TYPES[type] || type === 'tiktok') {
      var q = query || (name + ' ' + city + ' review');
      out.push({
        type: type === 'tiktok' ? 'tiktok' : 'youtube_search',
        title: title || (type === 'tiktok' ? 'Find on TikTok' : 'Find videos on YouTube'),
        url: type === 'tiktok' ? tiktokSearch(q) : ytSearch(q),
        source: type === 'tiktok' ? 'tiktok_search' : 'youtube_search',
        verificationStatus: 'search', reason: reason,
      });
    } else if (DETERMINISTIC[type]) {
      var url = (type === 'yelp_reviews') ? yelpSearch(name, city)
        : (type === 'map' || type === 'photos') ? mapSearch(name, city)
        : (type === 'tripadvisor') ? gsearch(name + ' ' + city + ' tripadvisor reviews')
        : gsearch(name + ' ' + city + ' reviews');
      out.push({ type: type, title: title || type.replace(/_/g, ' '), url: url, source: 'search', verificationStatus: 'search', reason: reason });
    } else if (AI_URL_TYPES[type]) {
      if (isSafeOfficialUrl(it.url)) {
        out.push({ type: type, title: title || type.replace(/_/g, ' '), url: clean(it.url, 300), source: 'ai_grounded', verificationStatus: 'ai_suggested', reason: reason });
      } else {
        out.push({ type: type, title: title || type.replace(/_/g, ' '), url: gsearch(name + ' ' + city + suffixFor(type)), source: 'search', verificationStatus: 'search', reason: reason });
      }
    }
    // unknown types are dropped
  });
  return out;
}

module.exports = {
  sanitizeMediaItems: sanitizeMediaItems, isSafeOfficialUrl: isSafeOfficialUrl,
  gsearch: gsearch, ytSearch: ytSearch, tiktokSearch: tiktokSearch, yelpSearch: yelpSearch, mapSearch: mapSearch,
  VIDEO_TYPES: VIDEO_TYPES, DETERMINISTIC: DETERMINISTIC, AI_URL_TYPES: AI_URL_TYPES,
};
