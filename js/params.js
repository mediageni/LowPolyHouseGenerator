// House parameters: archetype presets + seed -> params, URL (de)serialization.
// Pure data, no Three.js. A house is a WALLS box (1-3 storeys) + a ROOF
// (gable / hip / flat / pyramid) with a door, optional chimney + porch.

import { makeRng, rng } from './rng.js';

const r2 = (v) => Math.round(v * 1000) / 1000;

// Defaults every archetype inherits; archetypes override the distinctive bits.
// [lo,hi] number pair = sampled range. Array = random pick. Scalar = fixed.
const BASE = {
  width: [7, 11], depth: [6, 9], storeys: [1, 2], storeyH: [2.8, 3.3],
  roofType: ['gable', 'hip', 'gable'],
  roofHeight: [2.2, 3.6],          // metres, used by non-flat roofs
  eaves: [0.3, 0.6],               // roof overhang past the walls
  chimney: [true, true, false],
  porch: [false, false, true],
  floorH: [2.8, 3.2],              // vertical window pitch
  colW: [2.0, 2.6],                // horizontal window pitch
  winFill: [0.42, 0.6],            // glazing fraction of each cell
  litChance: [0.4, 0.7],           // share of windows lit at dusk
};

export const ARCHETYPES = {
  cottage:   { label: 'Cottage', width: [7, 10], depth: [6, 8], storeys: [1, 1], roofType: ['gable'],
               roofHeight: [2.6, 3.8], porch: [true, false], chimney: [true] },
  suburban:  { label: 'Suburban', width: [9, 13], depth: [7, 10], storeys: [2, 2], roofType: ['hip', 'gable'],
               roofHeight: [2.4, 3.4] },
  cabin:     { label: 'Cabin', width: [6, 9], depth: [5, 8], storeys: [1, 2], roofType: ['gable'],
               roofHeight: [3.0, 4.4], porch: [true], chimney: [true] },
  townhouse: { label: 'Townhouse', width: [6, 8], depth: [8, 11], storeys: [2, 3], roofType: ['flat', 'flat', 'hip'],
               roofHeight: [1.4, 2.4], porch: [false], chimney: [false, true] },
  villa:     { label: 'Villa', width: [12, 17], depth: [9, 12], storeys: [2, 2], roofType: ['hip'],
               roofHeight: [2.4, 3.4], porch: [true], chimney: [true, false] },
  barn:      { label: 'Barn', width: [8, 11], depth: [11, 15], storeys: [1, 2], roofType: ['gable'],
               roofHeight: [4.0, 5.6], eaves: [0.2, 0.4], porch: [false], chimney: [false] },
};
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

// Sliders the UI builds from (each edits one numeric param in place).
export const SLIDERS = [
  { key: 'width',      label: 'Width',       min: 5,   max: 20,  step: 0.5 },
  { key: 'depth',      label: 'Depth',       min: 5,   max: 16,  step: 0.5 },
  { key: 'storeys',    label: 'Storeys',     min: 1,   max: 3,   step: 1 },
  { key: 'storeyH',    label: 'Storey height', min: 2.4, max: 4, step: 0.1 },
  { key: 'roofHeight', label: 'Roof pitch',  min: 0.5, max: 6,   step: 0.1 },
  { key: 'eaves',      label: 'Eaves',       min: 0,   max: 1.2, step: 0.05 },
  { key: 'winFill',    label: 'Window size', min: 0.3, max: 0.75, step: 0.01 },
  { key: 'litChance',  label: 'Lit windows', min: 0,   max: 1,   step: 0.02 },
];

function sample(r, spec) {
  if (Array.isArray(spec)) {
    if (spec.length === 2 && typeof spec[0] === 'number' && typeof spec[1] === 'number')
      return r2(rng.range(r, spec[0], spec[1]));
    return rng.pick(r, spec);
  }
  return spec;
}
const PARAM_KEYS = Object.keys(BASE);

export function paramsFromSeed(seed, archetype) {
  const r = makeRng(seed);
  const key = archetype && ARCHETYPES[archetype] ? archetype : rng.pick(r, ARCHETYPE_KEYS);
  const a = { ...BASE, ...ARCHETYPES[key] };
  const p = { seed: seed >>> 0, archetype: key };
  for (const k of PARAM_KEYS) p[k] = sample(r, a[k]);
  p.storeys = Math.round(p.storeys);
  const wallHue = r2(rng.range(r, 0.05, 0.13));
  p.color = {
    body: { h: wallHue, s: r2(rng.range(r, 0.06, 0.26)), l: r2(rng.range(r, 0.6, 0.82)) },
    roof: { h: r2(rng.range(r, 0.0, 0.08)), s: r2(rng.range(r, 0.25, 0.55)), l: r2(rng.range(r, 0.26, 0.42)) },
    win:  { h: r2(rng.range(r, 0.07, 0.14)), s: r2(rng.range(r, 0.55, 0.85)), l: r2(rng.range(r, 0.62, 0.78)) },
  };
  return p;
}

export function setDerived(p, key, value) { p[key] = value; }
export const getDerived = (p, key) => p[key];

export function encodeConfig(p) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/=+$/, ''); }
  catch { return ''; }
}
export function decodeConfig(str) {
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(str))));
    return p && typeof p === 'object' && p.color ? p : null;
  } catch { return null; }
}
