import { buildHouse } from "./builder.js";
import {
  ARCHETYPES,
  SLIDERS,
  paramsFromSeed,
  getDerived,
  setDerived,
} from "./params.js";
import { STYLES } from "./styles.js";
import { schemaFromSamples } from "@engine/state.js";
import { enrichHouse, HOUSE_SCHEMA, HOUSE_OPTIONS } from "./house-options.js";
const samples = Object.keys(ARCHETYPES).flatMap((key) =>
  [0, 1, 42, 12345, 4294967295].map((seed) => paramsFromSeed(seed, key)),
);
export const adapter = {
  id: "house",
  path: "low-poly-house-generator",
  label: "House",
  noun: "house",
  filePrefix: "house",
  defaultLook: "suburb",
  defaultType: null,
  firstType: "cottage",
  colorKey: "body",
  colorLabel: "Wall hue",
  archetypes: ARCHETYPES,
  sliders: SLIDERS,
  styles: STYLES,
  paramsFromSeed,
  getDerived,
  setDerived,
  schema: schemaFromSamples(samples, SLIDERS, HOUSE_SCHEMA),
  build: buildHouse,
  materials: (style, params) => style.materials(params),
  paletteSlots: {
    body: "body",
    roof: "roof",
    trim: "trim",
    door: "accent",
    accent: "accent",
    glassLit: "glass",
    glassUnlit: "glass",
    plaza: "ground",
    foliage: "foliage",
    trunk: "trunk",
  },
  camera: {
    fov: 44,
    near: 0.1,
    far: 2000,
    min: 4,
    max: 240,
    direction: [0.8, 0.5, 0.95],
  },
  enrich: enrichHouse,
  options: HOUSE_OPTIONS,
};
