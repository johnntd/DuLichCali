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
                guidance: 'Recommend 5 realistic WIG looks appropriate to the audience. Render as a natural-looking wig on the same person.' },
  hairsystem: { options: { type: ['frontal', 'partial', 'full', 'topper', 'crown'] },
                guidance: 'Recommend 5 hair-system looks that restore natural fullness. Frame as before/after fullness. NEVER a medical claim.' },
  event:      { options: { occasion: ['wedding', 'cruise', 'disneyland', 'vegas', 'beach', 'birthday', 'graduation', 'holiday'] },
                guidance: 'Recommend 5 special-occasion looks suited to the requested event.' },
  vacation:   { options: { destination: ['hawaii', 'europe', 'california_coast', 'theme_parks', 'luxury_resorts'] },
                guidance: 'Recommend 5 low-maintenance, climate-appropriate vacation looks for the requested destination.' },
};

const STUDIO_AUDIENCES = ['man', 'woman', 'child', 'neutral'];
const STUDIO_PREFS = ['professional', 'trendy', 'low_maintenance', 'natural', 'bold'];
const STUDIO_GOALS = ['professional', 'youthful', 'elegant', 'executive', 'natural', 'confident', 'wedding', 'vacation', 'party', 'business', 'soft', 'masculine', 'feminine', 'cute', 'glamorous'];

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
const SCORE_KEYS = ['symmetry', 'youthfulness', 'professional', 'confidence', 'softness', 'maintenance'];

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
    '- scores: integer 0..100 for symmetry, youthfulness, professional, confidence, softness, maintenance. These are PROPORTION/HARMONY metrics, NOT a rating of the person.',
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
  return {
    title: String(raw.title || raw.styleTitle || 'Your best look').trim(),
    explanation: String(raw.explanation || raw.whyItFitsFace || '').trim(),
    imageEditPrompt: String(raw.imageEditPrompt || raw.editPrompt || '').trim(),
    attributes,
  };
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
    'First produce an "analysis" object: features { faceShape, forehead, eyes, eyelids, brows, nose, lips, cheeks, jawChin, ears, hairline, hairDensity, beardDensity, skinToneBand, approxAgeRange } (short positive phrases in ' + langName + '); scores { symmetry, youthfulness, professional, confidence, softness, maintenance } as integer 0..100 PROPORTION/HARMONY metrics (not a rating of the person); strategy { emphasize:[], balance:[] } positive phrasing; thinning { level (none|mild|moderate|advanced), note } soft language.',
    '',
    'Then choose THE SINGLE BEST look ("bestLook"): auto-decide haircut, color, texture, bangs, eyebrows, beard (men only), and a wig/hair-system ONLY if it clearly improves fullness or harmony. Return:',
    '{ "title":"", "attributes":{ "haircut":"","color":"","texture":"","bangs":"","eyebrows":"","beard":"","wigOrSystem":"" }, "explanation":"", "imageEditPrompt":"" }',
    'explanation: 2-3 sentences in ' + langName + ' on WHY this look suits them (what it emphasizes/balances), e.g. "adds volume near the crown, balances proportions, softens the jawline, emphasizes the eyes; the warm chestnut complements your skin tone for a youthful, professional appearance."',
    'imageEditPrompt: ONE precise ENGLISH instruction to render the FULL transformation on the SAME person (preserve identity/eyes/nose/lips/age/ethnicity/skin tone/bone structure; enhance hair, color, eyebrows, beard, and wig/hair-system if chosen).',
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
  STUDIO_LANG_NAME, SCORE_KEYS, normalizeStudioScores, buildStudioAnalysisPrompt,
  normalizeMasterpiece, buildMasterStylistPrompt, resolveDailyLimit,
};
