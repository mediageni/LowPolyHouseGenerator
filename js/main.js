// Low Poly House Generator — scene, state, and the render loop.
// Owns the current params + style; the UI (ui.js) drives it through `app`.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { buildHouse } from './builder.js';
import { STYLES } from './styles.js';
import { paramsFromSeed, setDerived, encodeConfig, decodeConfig } from './params.js';
import { randomSeed, seedToString, stringToSeed } from './rng.js';
import { exportGLB, exportOBJ } from './exporter.js';
import { exportRotationGIF } from './gif-export.js';
import { createUI } from './ui.js?v=20260929-gif-panel-only';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 2000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.minDistance = 4;
controls.maxDistance = 240;
controls.maxPolarAngle = Math.PI * 0.495;
controls.addEventListener('start', () => { controls.autoRotate = false; });

let styleRig = null;
let house = null;

const app = {
  params: null,
  styleKey: 'suburb',

  setStyle(key) { if (!STYLES[key]) return; this.styleKey = key; applyStyle(); rebuild(); this.sync(); },
  reroll() { this.params = paramsFromSeed(randomSeed(), null); rebuild(true); this.sync(); },
  setArchetype(key) { this.params = paramsFromSeed(this.params.seed, key); rebuild(true); this.sync(); },
  setSlider(key, value) { setDerived(this.params, key, value); rebuild(); this.sync(); },
  setHue(h) { this.params.color = { ...this.params.color, body: { ...this.params.color.body, h } }; rebuild(); this.sync(); },
  loadConfig(p) { this.params = p; rebuild(true); this.sync(); },
  exportGLB() { return exportGLB(house, `house-${seedToString(this.params.seed)}`); },
  exportOBJ() { exportOBJ(house, `house-${seedToString(this.params.seed)}`); },
  exportGIF(onProgress) {
    const name = document.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return exportRotationGIF({ scene, camera, controls, renderer,
      filename: `${name}-${seedToString(this.params.seed)}.gif`, onProgress, renderLoop: renderFrame });
  },
  shareURL() { const u = new URL(location.href); u.search = '?c=' + encodeConfig(this.params); return u.toString(); },
  get car() { return house; },
  sync() {},
};

function applyStyle() {
  const style = STYLES[app.styleKey];
  scene.background = style.background;
  renderer.toneMappingExposure = style.exposure ?? 1;
  if (styleRig) { scene.remove(styleRig); disposeTree(styleRig); }
  styleRig = style.rig();
  scene.add(styleRig);
}

function rebuild(reframe = false) {
  const style = STYLES[app.styleKey];
  const mats = style.materials(app.params);
  if (house) { scene.remove(house); disposeTree(house); }
  house = buildHouse(app.params, mats);
  scene.add(house);
  const c = house.userData.center;
  controls.target.set(0, c.y, 0);
  if (reframe) frameCamera(house.userData.size, c);
  updateURL();
}

function frameCamera(size, center) {
  const maxDim = Math.max(size.x, size.z, size.y);
  const d = maxDim * 1.5;
  camera.position.set(d * 0.8, center.y + size.y * 0.7, d * 0.95);
  controls.update();
}

function updateURL() { history.replaceState(null, '', '?c=' + encodeConfig(app.params)); }

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });
}

function initParams() {
  const q = new URLSearchParams(location.search);
  const c = q.get('c');
  if (c) { const p = decodeConfig(c); if (p) return p; }
  const seed = stringToSeed(q.get('seed'));
  return paramsFromSeed(seed != null ? seed : randomSeed(), q.get('type'));
}

app.params = initParams();
applyStyle();
rebuild(true);
createUI(app);
app.sync();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const renderFrame = () => { controls.update(); renderer.render(scene, camera); };
renderer.setAnimationLoop(renderFrame);

// expose for smoke tests
window.__app = app;
window.__rig = { camera, controls, scene, renderer };
