import * as THREE from "three";
import { mergeMeshes, windowIsLit } from "@engine/materials.js";
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const box = (w, h, d, material, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
function name(group, text) {
  group.name = text;
  return group;
}
function paneShape(type, w, h) {
  if (type === "round") return new THREE.CircleGeometry(Math.min(w, h) / 2, 16);
  if (type === "arched") {
    const shape = new THREE.Shape(),
      radius = w / 2,
      base = -h / 2,
      shoulder = h / 2 - radius;
    shape.moveTo(-radius, base);
    shape.lineTo(radius, base);
    shape.lineTo(radius, shoulder);
    shape.absarc(0, shoulder, radius, 0, Math.PI, false);
    shape.lineTo(-radius, base);
    return new THREE.ShapeGeometry(shape, 8);
  }
  return new THREE.PlaneGeometry(w, h);
}
function windowParts(p, mats, w, h, lit = true) {
  const group = new THREE.Group(),
    t = 0.1,
    glass = mats[lit ? "glassLit" : "glassUnlit"];
  const pane = new THREE.Mesh(paneShape(p.windowType, w, h), glass);
  pane.position.z = 0.04;
  group.add(pane);
  if (p.windowType === "round") {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.min(w, h) / 2, Math.min(w, h) / 2 + t, 16),
      mats.trim,
    );
    ring.position.z = 0.075;
    group.add(ring);
  } else {
    const shoulder = p.windowType === "arched" ? h / 2 - w / 2 : h / 2;
    group.add(
      box(
        t,
        shoulder + h / 2 + t,
        0.12,
        mats.trim,
        -w / 2 - t / 2,
        -h / 2 - t,
        0,
      ),
      box(
        t,
        shoulder + h / 2 + t,
        0.12,
        mats.trim,
        w / 2 + t / 2,
        -h / 2 - t,
        0,
      ),
      box(w + t * 2, t, 0.18, mats.trim, 0, -h / 2 - t, 0.04),
    );
    if (p.windowType === "arched") {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(w / 2, w / 2 + t, 16, 1, 0, Math.PI),
        mats.trim,
      );
      ring.position.set(0, shoulder, 0.08);
      group.add(ring);
    } else group.add(box(w + t * 2, t, 0.12, mats.trim, 0, h / 2, 0));
  }
  if (p.windowType !== "wide")
    group.add(
      box(
        0.06,
        p.windowType === "round" ? Math.min(w, h) * 0.9 : h,
        0.08,
        mats.trim,
        0,
        -(p.windowType === "round" ? Math.min(w, h) * 0.9 : h) / 2,
        0.07,
      ),
      box(
        p.windowType === "round" ? Math.min(w, h) * 0.9 : w,
        0.055,
        0.08,
        mats.trim,
        0,
        -0.01,
        0.07,
      ),
    );
  if (p.shutters) {
    const sw = w * 0.3;
    for (const sign of [-1, 1]) {
      const x = sign * (w / 2 + sw / 2 + 0.17);
      group.add(box(sw, h, 0.12, mats.accent, x, -h / 2, 0));
      for (let i = 1; i < 5; i++)
        group.add(
          box(
            sw - 0.08,
            0.035,
            0.05,
            mats.door,
            x,
            -h / 2 + (h * i) / 5,
            0.075,
          ),
        );
    }
  }
  return group;
}
function attachWindow(group, p, mats, w, h, x, y, z, rotation, cx = 0, cy = 0) {
  const frame = windowParts(
    p,
    mats,
    w,
    h,
    windowIsLit(cx, cy, { seed: p.seed, litChance: p.litChance }),
  );
  frame.position.set(x, y, z);
  frame.rotation.y = rotation;
  // Flatten the window group before material merging to keep draw calls small.
  frame.updateMatrix();
  for (const mesh of [...frame.children]) {
    mesh.applyMatrix4(frame.matrix);
    group.add(mesh);
  }
  return frame;
}
export function buildArchitecture(p, mats, roofBuilder) {
  const root = new THREE.Group(),
    W = p.width,
    D = p.depth,
    wallH = p.storeys * p.storeyH,
    roofY = 0.5 + wallH;
  if (p.windows) {
    const windows = name(new THREE.Group(), "Framed windows");
    for (const [width, depth, angle] of [
      [W, D, 0],
      [W, D, Math.PI],
      [D, W, Math.PI / 2],
      [D, W, -Math.PI / 2],
    ]) {
      const columns = Math.max(
        2,
        Math.floor(width / (p.windowType === "wide" ? 3.3 : 2.7)),
      );
      for (let floor = 0; floor < p.storeys; floor++)
        for (let i = 0; i < columns; i++) {
          const x = (i - (columns - 1) / 2) * (width / (columns + 1)),
            w = clamp(
              (width / (columns + 1)) *
                p.winFill *
                (p.windowType === "wide" ? 1.6 : 1.25),
              0.65,
              2.2,
            ),
            h = Math.min(
              p.storeyH * 0.5,
              w * (p.windowType === "wide" ? 0.67 : 1.15),
            );
          if (
            angle === 0 &&
            ((floor === 0 && p.doorOn) || (floor === 1 && p.balcony)) &&
            Math.abs(x) < w / 2 + W * 0.08 + 0.25
          )
            continue;
          const pos = new THREE.Vector3(
            x,
            0.5 + (floor + 0.56) * p.storeyH,
            depth / 2 + 0.04,
          ).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          attachWindow(
            windows,
            p,
            mats,
            w,
            h,
            pos.x,
            pos.y,
            pos.z,
            angle,
            i,
            floor,
          );
        }
    }
    root.add(mergeMeshes(windows));
  }
  if (p.trimOn) {
    const trim = name(new THREE.Group(), "Facade trim"),
      thickness = p.archetype === "cabin" ? 0.16 : 0.12;
    for (const x of [-W / 2, W / 2])
      for (const z of [-D / 2, D / 2])
        trim.add(box(thickness, wallH, 0.16, mats.accent, x, 0.5, z));
    for (let i = 0; i <= p.storeys; i++) {
      const y = 0.5 + i * p.storeyH;
      trim.add(box(W + 0.1, 0.12, D + 0.1, mats.trim, 0, y, 0));
    }
    if (p.archetype === "cabin")
      for (let y = 0.7; y < roofY; y += 0.55) {
        trim.add(
          box(W + 0.06, 0.075, 0.08, mats.door, 0, y, D / 2 + 0.03),
          box(W + 0.06, 0.075, 0.08, mats.door, 0, y, -D / 2 - 0.03),
          box(0.08, 0.075, D + 0.06, mats.door, W / 2 + 0.03, y, 0),
          box(0.08, 0.075, D + 0.06, mats.door, -W / 2 - 0.03, y, 0),
        );
      }
    if (p.archetype === "barn")
      for (let x = -W / 2 + 0.5; x < W / 2; x += 0.65)
        trim.add(box(0.07, wallH, 0.1, mats.trim, x, 0.5, D / 2 + 0.03));
    root.add(mergeMeshes(trim));
  }
  if (p.doorOn) {
    const entry = name(new THREE.Group(), "Entry details"),
      w = p.archetype === "barn" ? W * 0.35 : clamp(W * 0.16, 0.9, 1.5),
      h = clamp(p.storeyH * 0.62, 1.6, 2.4);
    entry.add(
      box(w + 0.28, 0.12, 0.35, mats.trim, 0, 0.5 + h, D / 2 + 0.04),
      box(0.12, h, 0.35, mats.trim, -w / 2 - 0.06, 0.5, D / 2 + 0.04),
      box(0.12, h, 0.35, mats.trim, w / 2 + 0.06, 0.5, D / 2 + 0.04),
    );
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 4),
      mats.accent,
    );
    handle.position.set(w * 0.33, 0.5 + h * 0.46, D / 2 + 0.2);
    entry.add(handle);
    entry.add(box(w + 0.5, 0.12, 0.8, mats.trim, 0, 0.12, D / 2 + 0.5));
    if (p.archetype === "barn") {
      for (const sign of [-1, 1]) {
        const beam = box(0.09, h * 0.93, 0.08, mats.trim, 0, 0.5, D / 2 + 0.2);
        beam.rotation.z = sign * 0.48;
        beam.position.x = sign * w * 0.23;
        entry.add(beam);
      }
    }
    root.add(mergeMeshes(entry));
  }
  if (p.balcony && p.storeys >= 2) {
    const balcony = name(new THREE.Group(), "Balcony"),
      bw = Math.min(W * 0.6, 5.2),
      by = 0.5 + p.storeyH,
      bz = D / 2 + 0.8;
    balcony.add(
      box(bw, 0.18, 1.8, mats.trim, 0, by, bz),
      box(bw, 0.09, 0.12, mats.accent, 0, by + 1.1, bz + 0.85),
    );
    for (let x = -bw / 2; x <= bw / 2 + 0.01; x += bw / 8)
      balcony.add(box(0.065, 1, 0.065, mats.accent, x, by + 0.18, bz + 0.85));
    for (const x of [-bw / 2, bw / 2]) {
      balcony.add(
        box(0.12, 1.1, 0.12, mats.accent, x, by + 0.18, bz + 0.8),
        box(0.07, 0.08, 1.65, mats.accent, x, by + 1.1, bz),
      );
    }
    if (p.doorOn) {
      balcony.add(box(1.2, 2, 0.18, mats.door, 0, by + 0.18, D / 2 + 0.08));
      if (p.windows)
        attachWindow(
          balcony,
          { ...p, shutters: false, windowType: "wide" },
          mats,
          0.9,
          1.2,
          0,
          by + 1.3,
          D / 2 + 0.19,
          0,
        );
    }
    root.add(mergeMeshes(balcony));
  }
  if (p.garage) {
    const garage = name(new THREE.Group(), "Garage"),
      gw = clamp(W * 0.32, 3.1, 4.8),
      gd = Math.min(D * 0.82, 7),
      gh = Math.min(p.storeyH, 3.3),
      gx = W / 2 + gw / 2 - 0.18;
    garage.add(
      box(gw, gh, gd, mats.body, gx, 0.5, 0),
      box(gw + 0.3, 0.4, gd + 0.3, mats.trim, gx, 0, 0),
    );
    garage.add(
      roofBuilder(
        {
          ...p,
          roofType:
            p.roofType === "flat" || p.roofType === "shed" ? "flat" : "gable",
          roofHeight: Math.min(p.roofHeight * 0.45, 1.3),
          eaves: 0.2,
        },
        mats.roof,
        gw,
        gd,
        gx,
        0,
        0.5 + gh,
      ),
    );
    if (p.doorOn) {
      garage.add(
        box(gw * 0.8, gh * 0.78, 0.18, mats.accent, gx, 0.5, gd / 2 + 0.05),
      );
      for (let i = 1; i < 6; i++)
        garage.add(
          box(
            gw * 0.78,
            0.045,
            0.025,
            mats.trim,
            gx,
            0.5 + (gh * 0.78 * i) / 6,
            gd / 2 + 0.15,
          ),
        );
    }
    root.add(garage);
  }
  if (p.dormers && p.roofOn && p.roofType !== "flat") {
    const dormers = name(new THREE.Group(), "Dormers"),
      alongX =
        p.roofType === "gambrel"
          ? false
          : p.roofType === "shed"
            ? true
            : W >= D,
      span = alongX ? W : D,
      depth = alongX ? D : W,
      angle = alongX ? 0 : Math.PI / 2;
    const count = span >= 10 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const horizontal = (i - (count - 1) / 2) * span * 0.4,
        forward = depth * 0.28;
      const roofSurface =
        p.roofType === "gambrel"
          ? roofY +
            p.roofHeight *
              (forward / (depth / 2 + p.eaves) <= 0.5
                ? 1 - 0.56 * (forward / (depth / 2 + p.eaves))
                : 1.44 * (1 - forward / (depth / 2 + p.eaves)))
          : p.roofType === "shed"
            ? roofY +
              p.roofHeight * (1 - (forward + depth / 2) / (depth + p.eaves * 2))
            : roofY + p.roofHeight * (1 - forward / (depth / 2 + p.eaves));
      const dormer = new THREE.Group();
      dormer.add(box(1.7, 1.35, 2, mats.body, 0, 0, 0));
      dormer.add(
        roofBuilder(
          { ...p, roofType: "gable", roofHeight: 0.65, eaves: 0.14 },
          mats.roof,
          1.7,
          2,
          0,
          0,
          1.35,
        ),
      );
      if (p.windows)
        attachWindow(
          dormer,
          { ...p, shutters: false, windowType: "classic" },
          mats,
          0.8,
          0.85,
          0,
          0.72,
          1.03,
          0,
          i,
          3,
        );
      dormer.position.set(horizontal, roofSurface - 0.15, forward);
      dormer.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      dormer.rotation.y = angle;
      dormers.add(dormer);
    }
    root.add(dormers);
  }
  return root;
}
