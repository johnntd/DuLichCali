'use strict';
// node tests/tc-media-enrich.test.js — pure tests for the Media Enrichment match-safety brain.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-media-enrich.js'), 'utf8') + '\nreturn window.TCMediaEnrich;';
const M = new Function('window', src)({});
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// title candidates
ok('title candidates name + name,city + name (city)', JSON.stringify(M.titleCandidates('Balboa Park', 'San Diego')) === JSON.stringify(['Balboa_Park', 'Balboa_Park,_San_Diego', 'Balboa_Park_(San_Diego)']));
ok('no city → just the name', JSON.stringify(M.titleCandidates('Griffith Observatory', '')) === JSON.stringify(['Griffith_Observatory']));

// summaryConfidence — the article-anchor gate
var std = { type: 'standard', title: 'Balboa Park, San Diego', description: 'Historic San Diego park', extract: 'Balboa Park is an urban park in San Diego.', thumbnail: { source: 'https://x/640px-a.jpg' }, coordinates: { lat: 32.73, lon: -117.15 } };
ok('standard + city in text → exact', M.summaryConfidence(std, { name: 'Balboa Park', city: 'San Diego' }) === 'exact');
ok('disambiguation → null', M.summaryConfidence({ type: 'disambiguation', title: 'Balboa Park' }, { name: 'Balboa Park', city: 'San Diego' }) === null);
ok('standard but NO image → null', M.summaryConfidence({ type: 'standard', title: 'Balboa Park, San Diego' }, { name: 'Balboa Park', city: 'San Diego' }) === null);
ok('standard, name matches, city absent + no coords → name_match', M.summaryConfidence({ type: 'standard', title: 'Phil\'s BBQ', description: 'A barbecue chain', thumbnail: { source: 'x' } }, { name: "Phil's BBQ", city: 'San Diego' }) === 'name_match');
ok('coords within 25km confirm exact even if city word absent', M.summaryConfidence({ type: 'standard', title: 'The Prado', description: 'a venue', thumbnail: { source: 'x' }, coordinates: { lat: 32.73, lon: -117.15 } }, { name: 'The Prado', city: 'San Diego', coords: { lat: 32.74, lng: -117.16 } }) === 'exact');
ok('unrelated standard page (name tokens absent) → null', M.summaryConfidence({ type: 'standard', title: 'Onion ring', description: 'fried food', thumbnail: { source: 'x' } }, { name: "Phil's BBQ", city: 'San Diego' }) === null);

// media-list filtering
var items = [
  { type: 'image', showInGallery: true, title: 'File:El Prado Balboa Park 2.jpg', srcset: [{ src: '//upload.wikimedia.org/x/500px-El_Prado.jpg', scale: '1x' }] },
  { type: 'image', showInGallery: true, title: 'File:Map of Balboa Park.svg', srcset: [{ src: '//upload/x/500px-map.svg' }] },
  { type: 'image', showInGallery: true, title: 'File:Commons-logo.png', srcset: [{ src: '//upload/x/500px-logo.png' }] },
  { type: 'image', showInGallery: false, title: 'File:Hidden.jpg', srcset: [{ src: '//upload/x/500px-h.jpg' }] },
  { type: 'audio', showInGallery: true, title: 'File:Sound.ogg' },
];
var kept = M.keepGalleryItems(items, 6);
ok('keeps real gallery jpg only (drops svg/logo/hidden/audio)', kept.length === 1 && kept[0].title === 'File:El Prado Balboa Park 2.jpg');
ok('srcsetThumb → https + width rewrite', M.srcsetThumb(kept[0], 640) === 'https://upload.wikimedia.org/x/640px-El_Prado.jpg');
ok('httpsThumb prepends https + rewrites px', M.httpsThumb('//upload/a/300px-x.jpg', 640) === 'https://upload/a/640px-x.jpg');

// attribution
var attr = M.attributionOf({ Artist: { value: '<a href="x">Bernard Gagnon</a>' }, LicenseShortName: { value: 'CC BY-SA 3.0' }, AttributionRequired: { value: 'true' } });
ok('attribution strips tags + needs attribution', attr.text === 'Bernard Gagnon / CC BY-SA 3.0' && attr.requiresAttribution === true && attr.license === 'CC BY-SA 3.0');
var pd = M.attributionOf({ LicenseShortName: { value: 'CC0' }, AttributionRequired: { value: 'false' } });
ok('public-domain attribution does not require credit', pd.requiresAttribution === false);

// acceptCommonsFile — the wrong-city trap defense
ok('intitle query is quoted phrase', M.intitleQuery("Phil's BBQ") === 'intitle:"Phils BBQ"' || M.intitleQuery("Phil's BBQ") === 'intitle:"Phil\'s BBQ"');
ok('accepts file with all name tokens + city', M.acceptCommonsFile('File:Phils BBQ San Diego exterior.jpg', "Phil's BBQ", 'San Diego') === true);
ok('REJECTS wrong-city file (Crack Shack → Las Vegas)', M.acceptCommonsFile('File:The Crack Shack Las Vegas.jpg', 'The Crack Shack', 'San Diego') === false);
ok('REJECTS file missing a name token', M.acceptCommonsFile('File:Onion Rings.jpg', "Phil's BBQ", 'San Diego') === false);
ok('city known but absent in filename → reject (safety over coverage)', M.acceptCommonsFile('File:Phils BBQ patio.jpg', "Phil's BBQ", 'San Diego') === false);
ok('no city known → accept on name tokens alone', M.acceptCommonsFile('File:Griffith Observatory at night.jpg', 'Griffith Observatory', '') === true);

// badge keys
ok('badge keys map by confidence', M.badgeKey('exact') === 'verifiedPhoto' && M.badgeKey('area') === 'areaPhoto' && M.badgeKey('name_match') === 'likelyMatchPhoto' && M.badgeKey('x') === '');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
