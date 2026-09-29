// Selectable visual styles. Each builds a "rig" (lights + ground + bg) and a
// material set for the house. Windows read as glass by day, glow warm at dusk.

import * as THREE from 'three';
import { makeWindowMaterial } from './builder.js';

const col = (hsl) => new THREE.Color().setHSL((hsl.h % 1 + 1) % 1, hsl.s, hsl.l);
const std = (o) => new THREE.MeshStandardMaterial({ flatShading: true, ...o });

function groundPlane(material) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), material);
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
  return g;
}

function houseMats(p, night, opts = {}) {
  const body = col(p.color.body);
  const win = opts.win ? new THREE.Color(opts.win) : col(p.color.win);
  return {
    body: makeWindowMaterial({ color: body, win, floorH: p.floorH, colW: p.colW,
      winFill: p.winFill, litChance: p.litChance, night, seed: p.seed }),
    roof: std({ color: col(p.color.roof), roughness: 0.85 }),
    trim: std({ color: opts.trim ?? 0xf2efe8, roughness: 0.9 }),
    door: std({ color: opts.door ?? 0x5a3d28, roughness: 0.7 }),
    plaza: std({ color: opts.lawn ?? 0x7faa55, roughness: 0.98 }),
    foliage: std({ color: opts.foliage ?? 0x3f7a48, roughness: 0.92 }),
    trunk: std({ color: opts.trunk ?? 0x4a3724, roughness: 0.95 }),
  };
}

function sunRig({ hemi, sun, sunColor, sunInt, ground, fill }) {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(hemi[0], hemi[1], 0.85));
  const key = new THREE.DirectionalLight(sunColor, sunInt);
  key.position.set(sun[0], sun[1], sun[2]); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 160;
  key.shadow.camera.left = key.shadow.camera.bottom = -36;
  key.shadow.camera.right = key.shadow.camera.top = 36; key.shadow.bias = -0.0004;
  g.add(key);
  if (fill) g.add(new THREE.DirectionalLight(fill[0], fill[1]).translateX(-30));
  g.add(groundPlane(std({ color: ground, roughness: 0.97 })));
  return g;
}

// --- Suburb: sunny day, green lawn (the hero look) ---------------------------
const suburb = {
  label: 'Suburb',
  background: new THREE.Color('#bfe0f2'),
  exposure: 1.0,
  rig() { return sunRig({ hemi: [0xffffff, 0x9fb98a], sun: [-28, 46, 30], sunColor: 0xfff3da, sunInt: 1.85, ground: 0x6fa04a, fill: [0xcfe0ff, 0.35] }); },
  materials(p) { return houseMats(p, false, { lawn: 0x6fa04a, foliage: 0x3f7a48, trunk: 0x4a3724 }); },
};

// --- Dusk: golden hour, warm windows light up --------------------------------
const dusk = {
  label: 'Dusk',
  background: new THREE.Color('#e8a06a'),
  exposure: 1.12,
  rig() { return sunRig({ hemi: [0x9a6a7a, 0x2a2030], sun: [-30, 26, 20], sunColor: 0xffb070, sunInt: 1.7, ground: 0x4d5a40, fill: [0x7a5a8a, 0.3] }); },
  materials(p) { return houseMats(p, true, { lawn: 0x4d5a40, foliage: 0x2f5a38, trunk: 0x3a2a1c }); },
};

// --- Snow: cold overcast, white ground ---------------------------------------
const snow = {
  label: 'Snow',
  background: new THREE.Color('#cddcea'),
  exposure: 1.05,
  rig() { return sunRig({ hemi: [0xffffff, 0xc4d2de], sun: [-22, 42, 26], sunColor: 0xeaf2ff, sunInt: 1.55, ground: 0xeef4fa, fill: [0xdfe9f5, 0.35] }); },
  materials(p) { return houseMats(p, false, { lawn: 0xeef4fa, foliage: 0x3a6b48, trunk: 0x4a3724 }); },
};

// --- Studio: clean neutral showroom ------------------------------------------
const studio = {
  label: 'Studio',
  background: new THREE.Color('#e9edf2'),
  exposure: 1.0,
  rig() {
    const g = sunRig({ hemi: [0xffffff, 0xc4ccd4], sun: [-18, 44, 28], sunColor: 0xffffff, sunInt: 1.8, ground: 0xeef2f6, fill: [0xdfe6ee, 0.4] });
    const grid = new THREE.GridHelper(600, 150, 0xc0c8d0, 0xd8dee6);
    grid.material.transparent = true; grid.material.opacity = 0.25; grid.position.y = 0.01; g.add(grid);
    return g;
  },
  materials(p) { return houseMats(p, false, { lawn: 0xeef2f6, foliage: 0x3f7a48, trunk: 0x4a3724 }); },
};

export const STYLES = { suburb, dusk, snow, studio };
export const STYLE_KEYS = Object.keys(STYLES);
