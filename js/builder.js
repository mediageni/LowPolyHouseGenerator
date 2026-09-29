// Pure builder: params -> THREE.Group (a flat-shaded low-poly house).
// A house is a box of WALLS (1-3 storeys) on a thin plinth, topped by a ROOF
// (gable / hip / flat / pyramid), with a front DOOR, a CHIMNEY and a small front
// PORCH on some types. Windows are drawn by a shader patched into the wall material
// (a world-space grid on vertical faces, lit per-cell at dusk). A lawn + a couple
// of trees finish the plot. Deterministic from the seed.

import * as THREE from 'three';
import { makeRng } from './rng.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// --- low-level mesh assembly --------------------------------------------------
function tri(pos, a, b, c) { pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
function quad(pos, a, b, c, d) { tri(pos, a, b, c); tri(pos, a, c, d); }
function meshFrom(positions, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function boxMesh(w, h, d, mat, cx, cy, cz) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy + h / 2, cz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// --- window material: standard material + a window grid in the shader ---------
export function makeWindowMaterial({ color, win, floorH, colW, winFill, litChance, night, seed }) {
  // Panes are shiny + sky-tinted (glassy) by day and glow warm by night; the wall
  // stays matte. roughness/metalness are lowered ON the panes so they catch the
  // sky + sun as a real glass reflection rather than reading as flat paint.
  const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, metalness: 0.0, roughness: 0.85 });
  const u = {
    uWin: { value: win }, uFloorH: { value: floorH }, uColW: { value: colW },
    uFill: { value: winFill }, uLit: { value: litChance }, uNight: { value: night ? 1 : 0 },
    uSeed: { value: (seed % 1000) * 0.1 }, uGlass: { value: new THREE.Color(0.62, 0.76, 0.92) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWPos=(modelMatrix*vec4(transformed,1.0)).xyz;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n vWNrm=mat3(modelMatrix)*objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform vec3 uWin, uGlass; uniform float uFloorH,uColW,uFill,uLit,uNight,uSeed;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453); }
        vec2 winInfo(){
          vec3 n=normalize(vWNrm);
          if(abs(n.y)>0.5) return vec2(0.0);                 // roof/floor: no windows
          float hc = abs(n.x)>abs(n.z) ? vWPos.z : vWPos.x;  // coord along the wall
          float cx=floor(hc/uColW), cy=floor((vWPos.y-0.4)/uFloorH);
          float lx=fract(hc/uColW), ly=fract((vWPos.y-0.4)/uFloorH);
          float mx=(1.0-uFill)*0.5;
          float pane=step(mx,lx)*step(lx,1.0-mx)*step(0.3,ly)*step(ly,0.82)*step(0.4,vWPos.y);
          float lit=step(h21(vec2(cx,cy)),uLit);
          return vec2(pane,lit);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { float pane=winInfo().x;
          // by day: tint the pane toward a light sky-glass colour + a faint top-down sheen
          float sheen=0.08*fract(vWPos.y*0.7);
          diffuseColor.rgb=mix(diffuseColor.rgb, uGlass+sheen, pane*(1.0-uNight)*0.82);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        { float pane=winInfo().x; roughnessFactor=mix(roughnessFactor, 0.1, pane); }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        { float pane=winInfo().x; metalnessFactor=mix(metalnessFactor, 0.28, pane*(1.0-uNight)); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec2 w=winInfo();
          totalEmissiveRadiance+=uGlass*w.x*(1.0-uNight)*0.12;        // faint daytime glass sheen
          float glow=w.x*mix(0.05, 1.0, w.y)*uNight;
          totalEmissiveRadiance+=uWin*glow*1.8;
        }`);
  };
  return mat;
}

// --- roofs -------------------------------------------------------------------
// All roofs sit on a footprint w×d centred at (cx,cz), starting at baseY.
function buildRoof(p, mat, w, d, cx, cz, baseY) {
  const t = p.roofType, h = p.roofHeight, over = p.eaves;
  if (t === 'flat') {                          // thin parapet cap
    return boxMesh(w + over, Math.max(0.25, h * 0.12), d + over, mat, cx, baseY, cz);
  }
  const bw = (w / 2) + over, bd = (d / 2) + over;
  const b = [[cx + bw, baseY, cz + bd], [cx + bw, baseY, cz - bd], [cx - bw, baseY, cz - bd], [cx - bw, baseY, cz + bd]];
  const pos = [];
  // little eave skirt down to the wall line
  const s = [[cx + w / 2, baseY - 0.25, cz + d / 2], [cx + w / 2, baseY - 0.25, cz - d / 2], [cx - w / 2, baseY - 0.25, cz - d / 2], [cx - w / 2, baseY - 0.25, cz + d / 2]];
  quad(pos, s[0], s[1], b[1], b[0]); quad(pos, s[1], s[2], b[2], b[1]);
  quad(pos, s[2], s[3], b[3], b[2]); quad(pos, s[3], s[0], b[0], b[3]);

  if (t === 'gable') {                          // ridge along the longer axis
    const alongX = w >= d;
    if (alongX) {
      const rl = [cx - bw, baseY + h, cz], rr = [cx + bw, baseY + h, cz];
      quad(pos, b[3], b[0], rr, rl); quad(pos, b[1], b[2], rl, rr);
      tri(pos, b[0], b[1], rr); tri(pos, b[2], b[3], rl);
    } else {
      const rf = [cx, baseY + h, cz + bd], rb = [cx, baseY + h, cz - bd];
      quad(pos, b[0], b[1], rb, rf); quad(pos, b[2], b[3], rf, rb);
      tri(pos, b[1], b[2], rb); tri(pos, b[3], b[0], rf);
    }
  } else if (t === 'hip') {                     // 4 slopes to a short ridge
    const alongX = w >= d;
    const inset = Math.min(bw, bd) * 0.55;
    if (alongX) {
      const rl = [cx - bw + inset, baseY + h, cz], rr = [cx + bw - inset, baseY + h, cz];
      quad(pos, b[3], b[0], rr, rl); quad(pos, b[1], b[2], rl, rr);
      tri(pos, b[0], b[1], rr); tri(pos, b[2], b[3], rl);
    } else {
      const rf = [cx, baseY + h, cz + bd - inset], rb = [cx, baseY + h, cz - bd + inset];
      quad(pos, b[0], b[1], rb, rf); quad(pos, b[2], b[3], rf, rb);
      tri(pos, b[1], b[2], rb); tri(pos, b[3], b[0], rf);
    }
  } else {                                       // pyramid: single apex
    const ap = [cx, baseY + h, cz];
    tri(pos, b[0], b[1], ap); tri(pos, b[1], b[2], ap); tri(pos, b[2], b[3], ap); tri(pos, b[3], b[0], ap);
  }
  return meshFrom(pos, mat);
}

// --- a front porch: a small flat roof on two posts -------------------------------
function buildPorch(p, mats, W, D, wallH) {
  const g = new THREE.Group();
  const pd = clamp(D * 0.32, 1.4, 3.2), pw = clamp(W * 0.5, 2.4, 6);
  const z = D / 2 + pd / 2, top = clamp(wallH * 0.5, 2.4, 3.4);
  const post = 0.22;
  for (const sx of [-1, 1]) g.add(boxMesh(post, top, post, mats.trim, sx * (pw / 2 - post), 0, z + pd / 2 - post));
  g.add(boxMesh(pw, 0.2, pd, mats.roof, 0, top, z));        // porch roof slab
  g.add(boxMesh(pw + 0.6, 0.12, pd + 0.4, mats.trim, 0, 0.02, z)); // porch deck
  return g;
}

// --- a scatter tree (conifer cone or round blob) on a small trunk ---------------
function makeTree(r, mats) {
  const g = new THREE.Group();
  const fr = 0.7 + r() * 1.0, th = 2.0 + r() * 2.6;
  const trunkH = th * 0.3, tr = Math.max(0.1, fr * 0.16);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.8, tr, trunkH, 5), mats.trunk);
  trunk.position.y = trunkH / 2; trunk.castShadow = true; g.add(trunk);
  if (r() < 0.5) {
    let y = trunkH, fh = th - trunkH, rr = fr;
    const tiers = r() < 0.5 ? 2 : 1;
    for (let i = 0; i < tiers; i++) {
      const ch = fh / tiers * 1.3;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rr, ch, 6), mats.foliage);
      cone.position.y = y + ch / 2 * 0.82; cone.castShadow = true; g.add(cone);
      y += ch * 0.55; rr *= 0.72;
    }
  } else {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(fr, 0), mats.foliage);
    blob.position.y = trunkH + fr * 0.8; blob.castShadow = true; g.add(blob);
  }
  return g;
}

// --- the lawn slab + a few trees around the house -------------------------------
function buildYard(p, mats, hx, hz) {
  const g = new THREE.Group();
  const r = makeRng((p.seed ^ 0x9e3779b9) >>> 0);
  const pad = Math.max(3.5, Math.max(hx, hz) * 0.9);
  const YHX = hx + pad, YHZ = hz + pad, YH = 0.4;
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(YHX * 2, YH, YHZ * 2), mats.plaza);
  lawn.position.y = YH / 2; lawn.receiveShadow = true; lawn.castShadow = true; g.add(lawn);

  const count = clamp(Math.round(2 + (YHX + YHZ) * 0.25), 2, 9);
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 12) {
    tries++;
    const x = (r() * 2 - 1) * (YHX - 0.8), z = (r() * 2 - 1) * (YHZ - 0.8);
    if (Math.abs(x) < hx + 1.0 && Math.abs(z) < hz + 2.4) continue; // keep clear of house + entry
    const t = makeTree(r, mats); t.position.set(x, YH, z); g.add(t); placed++;
  }
  return { group: g, top: YH };
}

export function buildHouse(p, mats) {
  const root = new THREE.Group();
  root.name = 'house';
  const house = new THREE.Group();

  const W = p.width, D = p.depth;
  const storeys = clamp(Math.round(p.storeys), 1, 3);
  const wallH = storeys * p.storeyH;

  // plinth + walls
  house.add(boxMesh(W + 0.5, 0.5, D + 0.5, mats.trim, 0, 0, 0));
  house.add(boxMesh(W, wallH, D, mats.body, 0, 0.5, 0));

  // roof
  const roofBaseY = 0.5 + wallH;
  house.add(buildRoof(p, mats.roof, W, D, 0, 0, roofBaseY));

  // chimney on the roof, offset to one side
  if (p.chimney) {
    const cw = 0.6, ch = p.roofType === 'flat' ? 0.9 : p.roofHeight * 0.9 + 0.6;
    house.add(boxMesh(cw, ch, cw, mats.trim, W * 0.28, roofBaseY, D * 0.12));
  }

  // front door (on +Z face)
  const doorH = clamp(p.storeyH * 0.62, 1.6, 2.4), doorW = clamp(W * 0.16, 0.9, 1.5);
  house.add(boxMesh(doorW, doorH, 0.3, mats.door, 0, 0.5, D / 2));

  // porch
  if (p.porch) house.add(buildPorch(p, mats, W, D, wallH));

  // yard with trees; stand the house on the lawn
  const { group: yard, top } = buildYard(p, mats, W / 2, D / 2);
  house.position.y = top;
  root.add(yard, house);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  root.userData.size = size; root.userData.center = center;
  return root;
}
