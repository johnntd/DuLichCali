'use strict';
// Pure, dependency-free helpers for the AI Style Studio callable.
// Kept separate from index.js so it can be unit-tested with plain node.

// The 9 studios. Each: allowed option enum (+ default), and a prompt-guidance
// string injected into the vision prompt. `audience` is the customer audience.
const STUDIO_MODES = {
  haircut:    { options: {}, guidance: 'Recommend 5 haircut styles only.' },
  color:      { options: { type: ['highlight', 'balayage', 'ombre', 'gray_blend', 'fashion'] },
                guidance: 'Recommend 5 hair-color looks of the requested type. Keep the cut natural.' },
  texture:    { options: { texture: ['curly', 'straight', 'wavy'] },
                guidance: 'Recommend 5 looks showing the requested hair texture.' },
  eyebrow:    { options: { shape: ['natural', 'arched', 'straight', 'rounded', 'soft_angled'],
                           thickness: ['natural', 'fuller', 'refined'] },
                guidance: 'Recommend 5 eyebrow shaping/grooming looks. Change ONLY the brows; do not alter hair, eyes, or skin.' },
  beard:      { options: { length: ['stubble', 'short', 'medium', 'full'],
                           density: ['natural', 'fuller'], shape: ['rounded', 'angular', 'tapered'] },
                guidance: 'Men only. Recommend 5 beard styles that flatter the jaw and face proportions.' },
  wig:        { options: { family: ['natural', 'business', 'modern', 'long', 'layered', 'curly', 'elegant', 'glamorous', 'cute', 'simple', 'school'] },
                guidance: 'Recommend 5 fuller, natural hairstyles for this person, each rendered as the person\'s OWN healthy growing hair — salon-quality and believable, NEVER costume-like. In the imageEditPrompt do NOT use the word "wig"/"hairpiece"; describe the RESULT as a natural fuller hairstyle. Each imageEditPrompt MUST demand: a soft slightly-irregular hairline blending into the forehead and temples with fine baby hairs (no hard edge, no band, no cap line, no helmet shape), natural density/volume and individual-strand detail, a realistic part/scalp, soft matte-to-natural sheen (not plastic or glossy), hair colour/undertone matched to the skin tone and photo lighting, and preservation of identity, head angle, lighting and background.' },
  hairsystem: { options: { type: ['frontal', 'partial', 'full', 'topper', 'crown'] },
                guidance: 'Recommend 5 looks that restore natural-looking fullness, framed as a before/after fullness improvement (NEVER a medical claim). In the imageEditPrompt do NOT use the word "wig"/"hairpiece"; describe the RESULT as the person\'s own fuller natural growing hair with a soft natural hairline, realistic density and scalp, matched colour/lighting, and preserved identity, angle, lighting and background — never costume-like.' },
  event:      { options: { occasion: ['wedding', 'cruise', 'disneyland', 'vegas', 'beach', 'birthday', 'graduation', 'holiday'] },
                guidance: 'Recommend 5 special-occasion looks suited to the requested event.' },
  vacation:   { options: { destination: ['hawaii', 'europe', 'california_coast', 'theme_parks', 'luxury_resorts'] },
                guidance: 'Recommend 5 low-maintenance, climate-appropriate vacation looks for the requested destination.' },
};

const STUDIO_AUDIENCES = ['man', 'woman', 'child', 'neutral'];
const STUDIO_PREFS = ['professional', 'trendy', 'low_maintenance', 'natural', 'bold'];
const STUDIO_GOALS = ['professional', 'youthful', 'elegant', 'executive', 'natural', 'confident', 'wedding', 'vacation', 'party', 'casual', 'business', 'soft', 'masculine', 'feminine', 'cute', 'glamorous'];

// Master Stylist composite attributes the model may auto-decide for the single
// best look. Used by normalizeMasterpiece to coerce the model's object safely.
const MASTER_ATTR_KEYS = ['haircut', 'color', 'texture', 'bangs', 'eyebrows', 'beard', 'wigOrSystem'];

function normalizeStudioMode(v) {
  const m = String(v || '').toLowerCase().trim();
  return STUDIO_MODES[m] ? m : 'haircut';
}
function normalizeStudioOptions(mode, opts) {
  const def = STUDIO_MODES[normalizeStudioMode(mode)].options;
  const out = {};
  opts = opts || {};
  Object.keys(def).forEach((key) => {
    const allowed = def[key];
    const val = String(opts[key] || '').toLowerCase().trim();
    out[key] = allowed.indexOf(val) >= 0 ? val : allowed[0];
  });
  return out;
}
function normalizeStudioAudience(v) {
  const a = String(v || '').toLowerCase().trim();
  return STUDIO_AUDIENCES.indexOf(a) >= 0 ? a : 'neutral';
}
function normalizeStudioPref(v) {
  const p = String(v || '').toLowerCase().trim();
  return STUDIO_PREFS.indexOf(p) >= 0 ? p : '';
}
function normalizeStudioGoal(v) {
  const g = String(v || '').toLowerCase().trim();
  return STUDIO_GOALS.indexOf(g) >= 0 ? g : '';
}
// Beard is men-only; the studio forces audience=man for that mode.
function audienceForMode(mode, audience) {
  return normalizeStudioMode(mode) === 'beard' ? 'man' : normalizeStudioAudience(audience);
}

const STUDIO_LANG_NAME = { en: 'English', vi: 'Vietnamese (tiếng Việt)', es: 'Spanish (Español)' };
// Harmony/proportion metrics (NOT attractiveness). SP-6 adds customer-safe
// 'harmony' + 'naturalness' alongside the existing vendor metrics.
const SCORE_KEYS = ['symmetry', 'harmony', 'naturalness', 'youthfulness', 'professional', 'confidence', 'softness', 'maintenance'];
// The customer-safe subset surfaced on the public result (style guidance only).
const CUSTOMER_SCORE_KEYS = ['naturalness', 'harmony', 'professional', 'youthfulness', 'maintenance'];

function normalizeStudioScores(raw) {
  raw = raw || {};
  const out = {};
  SCORE_KEYS.forEach((k) => {
    const r = raw[k];
    const v = (typeof r === 'number' || typeof r === 'string') ? Number(r) : NaN;
    out[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
  });
  return out;
}

function buildStudioAnalysisPrompt(mode, options, audience, preference, goal, lang) {
  const langName = STUDIO_LANG_NAME[lang] || 'English';
  const m = normalizeStudioMode(mode);
  const guidance = STUDIO_MODES[m].guidance;
  const optsLine = Object.keys(options || {}).length ? JSON.stringify(options) : '(none)';
  return [
    'You are a professional barber/stylist consultant analysing ONE customer selfie for a vendor-only studio tool. The OUTPUT IS READ ONLY BY THE BARBER, never shown to the customer.',
    'SAFETY (absolute): use POSITIVE, respectful language only. Do NOT diagnose any medical condition, do NOT judge attractiveness, do NOT make ethnicity assumptions, NEVER make a medical claim (e.g. about hair loss — say "appears thinner", never "balding"). Children: wholesome, age-appropriate only.',
    '',
    'STUDIO MODE: ' + m + '. ' + guidance,
    'Options: ' + optsLine + '. Customer audience: ' + audience + '. Preference: ' + (preference || 'none') + '. Goal: ' + (goal || 'none') + '.',
    '',
    'First, analyse the face and return a structured "analysis" object with:',
    '- features: { faceShape (oval|round|square|diamond|heart|triangle|oblong), forehead, eyes, eyelids, brows, nose, lips, cheeks, jawChin, ears, hairline, hairDensity, beardDensity, skinToneBand, approxAgeRange } — each a SHORT positive phrase in ' + langName + '.',
    '- scores: integer 0..100 for symmetry, harmony, naturalness, youthfulness, professional, confidence, softness, maintenance. These are PROPORTION/HARMONY/STYLE-GUIDANCE metrics, NOT attractiveness and NOT a rating of the person.',
    '- strategy: { emphasize: [..], balance: [..] } — positive phrasing only, in ' + langName + '.',
    '- thinning: { level (none|mild|moderate|advanced), note } — soft language, never a medical claim.',
    '',
    'Then recommend EXACTLY 5 styles for this mode. Each style:',
    '{ "styleId":"kebab-id","styleTitle":"","targetAudience":"man|woman|child|neutral","description":"","whyItFitsFace":"","maintenanceLevel":"","haircutInstructionsForBarber":"","colorRecommendation":"","highlightRecommendation":"","curlStraightRecommendation":"","confidence":0.0,"safetyNotes":"","imageEditPrompt":"" }',
    'imageEditPrompt: precise ENGLISH instruction to render THIS look on the SAME person (preserve identity, face, ethnicity, skin tone, age, gender presentation; change only what this mode targets).',
    '',
    'LANGUAGE: write every customer-facing field AND the analysis in ' + langName + '. Write imageEditPrompt in ENGLISH only.',
    'Return STRICT JSON only (no markdown) of the form:',
    '{"analysis":{"features":{},"scores":{},"strategy":{"emphasize":[],"balance":[]},"thinning":{"level":"","note":""}},"styles":[ ... 5 items ... ]}',
  ].join('\n');
}

// ── Master Stylist (one-click best look) ─────────────────────────────────────
// Coerce the model's `bestLook` object into a safe masterpiece shape. Null-safe:
// always returns string fields + an attributes object (possibly empty).
function normalizeMasterpiece(raw) {
  raw = raw || {};
  const attrsIn = (raw.attributes && typeof raw.attributes === 'object' && !Array.isArray(raw.attributes)) ? raw.attributes : {};
  const attributes = {};
  MASTER_ATTR_KEYS.forEach((k) => { if (attrsIn[k]) attributes[k] = String(attrsIn[k]).trim(); });
  // SP-6: customer-friendly harmony summary (plain language, no clinical numbers).
  const harmonyIn = (raw.harmony && typeof raw.harmony === 'object' && !Array.isArray(raw.harmony)) ? raw.harmony : {};
  const toShortList = (v) => (Array.isArray(v) ? v : [])
    .map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4);
  return {
    title: String(raw.title || raw.styleTitle || 'Your best look').trim(),
    explanation: String(raw.explanation || raw.whyItFitsFace || '').trim(),
    imageEditPrompt: String(raw.imageEditPrompt || raw.editPrompt || '').trim(),
    attributes,
    harmony: { noticed: toShortList(harmonyIn.noticed), recommends: toShortList(harmonyIn.recommends) },
  };
}

// Pick the customer-safe subset of harmony scores (style guidance only — never
// attractiveness). Returns { key: 0..100|null } for the CUSTOMER_SCORE_KEYS.
function customerScores(scores) {
  scores = scores || {};
  const out = {};
  CUSTOMER_SCORE_KEYS.forEach((k) => { out[k] = (typeof scores[k] === 'number') ? scores[k] : null; });
  return out;
}

// Single-pass prompt for the AI Master Stylist: analyse the selfie and design
// THE one best overall look (not 5 options) + a customer-facing explanation.
function buildMasterStylistPrompt(audience, goal, lang) {
  const langName = STUDIO_LANG_NAME[lang] || 'English';
  return [
    'You are an elite celebrity stylist + personal image consultant. Analyse ONE selfie and design the SINGLE BEST overall look for this person — not random options. Output is shown to the customer.',
    'SAFETY (absolute): POSITIVE language only. Never say ugly/bad/balding/old-looking/unattractive or make a medical claim. Use "balance", "soften", "emphasize", "enhance", "fuller appearance", "youthful-looking". Children: wholesome, age-appropriate only.',
    'Customer audience: ' + audience + '. Style goal: ' + (goal || 'most flattering overall') + '.',
    '',
    'First produce an "analysis" object: features { faceShape, faceLengthWidth, forehead, eyes, eyelids, brows, nose, lips, cheeks, jawChin, ears, hairline, hairDensity, crownVisibility, currentHairLength, beardDensity, skinToneBand, approxAgeRange } (short POSITIVE phrases in ' + langName + '); scores { symmetry, harmony, naturalness, youthfulness, professional, confidence, softness, maintenance } as integer 0..100 PROPORTION/HARMONY/STYLE-GUIDANCE metrics (NOT attractiveness, NOT a rating of the person); strategy { emphasize:[], balance:[] } positive phrasing (emphasize = strengths like eyes/smile/cheekbones/jawline; balance = proportions to soften like forehead/face length/jaw width); thinning { level (none|mild|moderate|advanced), note } soft language.',
    'ALSO in analysis: hairVolumeAssessment = one of "adequate" | "mild_thinning" | "moderate_thinning" | "advanced_thinning" (assess CURRENT volume/density/hairline/crown honestly but kindly), and wigDecision = { needed: "none"|"optional"|"recommended"|"strong_recommend", reason: short positive sentence in ' + langName + ', naturalAlternative: the haircut/colour/style that helps without added hair (in ' + langName + '), selectedApproach: "haircut"|"color"|"texture"|"eyebrow_beard"|"subtle_volume"|"topper"|"hair_system"|"wig" }.',
    'WIG DECISION RULES (do NOT over-recommend a wig): adequate volume → needed="none", solve with haircut/color/texture; mild_thinning → needed="optional", prefer a subtle fuller hairstyle; moderate_thinning → needed="recommended", a natural fuller style or topper/hair-system; advanced_thinning → needed="strong_recommend", a natural hair-system. NEVER pick "wig" as selectedApproach for "Find My Best Look" unless advanced_thinning.',
    '',
    'Then choose THE SINGLE BEST look ("bestLook") following this PRIORITY ORDER: 1) better haircut, 2) better shape/texture, 3) better colour/highlight, 4) eyebrow/beard grooming, 5) SUBTLE volume improvement, 6) topper/hair-system ONLY if truly beneficial per wigDecision. Improve the person GENTLY and BELIEVABLY (subtle fuller crown, cleaner shape, better layering, natural hairline, age-appropriate) — NOT a giant-volume or dramatic transformation. Set wigOrSystem to "" unless wigDecision.needed is "recommended"/"strong_recommend"; NEVER describe it as a "wig". Return:',
    '{ "title":"", "attributes":{ "haircut":"","color":"","texture":"","bangs":"","eyebrows":"","beard":"","wigOrSystem":"" }, "harmony":{ "noticed":[], "recommends":[] }, "explanation":"", "imageEditPrompt":"" }',
    'harmony.noticed: 2-4 SHORT, friendly, plain-language positives the AI noticed (in ' + langName + '), e.g. "expressive eyes", "balanced cheekbones", "warm skin tone" — NO clinical measurements, NO numbers. harmony.recommends: 2-4 SHORT plain-language recommendations (in ' + langName + '), e.g. "soft layered cut", "natural chestnut tone", "light eyebrow cleanup".',
    'explanation: 2-3 warm sentences in ' + langName + ' on WHY this look suits them AND why it fits the "' + (goal || 'most flattering') + '" goal (what it emphasizes/balances), e.g. "This look emphasizes your eyes and adds natural volume around the crown for a balanced, confident, professional appearance; the warm chestnut complements your skin tone." Speak to the customer ("your").',
    'imageEditPrompt: ONE precise ENGLISH instruction to render the transformation on the SAME person (preserve identity/eyes/nose/lips/age/ethnicity/skin tone/bone structure, head angle, lighting and background). Describe everything as the person\'s OWN natural growing hair — do NOT use the word "wig"/"hairpiece". If extra fullness is added, demand a soft natural hairline with baby hairs, realistic density/scalp and matched colour/lighting; never a pasted-on, cap-line, helmet, plastic or costume look.',
    '',
    'Return STRICT JSON only: {"analysis":{...},"bestLook":{...}}',
  ].join('\n');
}

// ── Public Style Studio promo quota (pure) ───────────────────────────────────
// How many free public generations a single (anonymous) user gets today, given
// the `config/styleStudioPromo` doc and today's ISO date (YYYY-MM-DD). Returns 0
// unless the promo is explicitly active AND today is within [startDate,endDate].
// Integers only — never touches images.
function resolveDailyLimit(promo, todayISO) {
  if (!promo || promo.active !== true) return 0;
  const t = String(todayISO || ''); const s = String(promo.startDate || ''); const e = String(promo.endDate || '');
  if (s && t < s) return 0;
  if (e && t > e) return 0;
  const n = Number(promo.freeGenerationsPerUser);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

module.exports = {
  STUDIO_MODES, STUDIO_AUDIENCES, STUDIO_PREFS, STUDIO_GOALS, MASTER_ATTR_KEYS,
  normalizeStudioMode, normalizeStudioOptions, normalizeStudioAudience,
  normalizeStudioPref, normalizeStudioGoal, audienceForMode,
  STUDIO_LANG_NAME, SCORE_KEYS, CUSTOMER_SCORE_KEYS, normalizeStudioScores, customerScores, buildStudioAnalysisPrompt,
  normalizeMasterpiece, buildMasterStylistPrompt, resolveDailyLimit,
};
