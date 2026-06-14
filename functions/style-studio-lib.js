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
const STUDIO_GOALS = ['professional', 'youthful', 'elegant', 'masculine', 'feminine', 'soft', 'confident', 'vacation', 'wedding', 'party'];

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

module.exports = {
  STUDIO_MODES, STUDIO_AUDIENCES, STUDIO_PREFS, STUDIO_GOALS,
  normalizeStudioMode, normalizeStudioOptions, normalizeStudioAudience,
  normalizeStudioPref, normalizeStudioGoal, audienceForMode,
};
