"use client";

import { useEffect, useRef, useCallback } from "react";
import type { KoiPondProps, KoiVariety } from "./types";

// --- Internal types ---
interface Vec2 {
  x: number;
  y: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  speed: number;
}

interface PatchDef {
  t: number;
  offset: number;
  rx: number;
  ry: number;
  color: string;
}

interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  length: number;
  maxHW: number;
  baseSpeed: number;
  speed: number;
  baseColor: string;
  sheenColor: string;
  patches: PatchDef[];
  spineAngles: number[];
  tailPhase: number;
  tailSpeed: number;
  wanderAngle: number;
  wanderTimer: number;
  scared: boolean;
  scareTimer: number;
}

interface LilyPad {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
  bobPhase: number;
  hasBloom: boolean;
  bloomAngle: number;
  bloomHue: number;
}

// --- Constants ---
const SPINE_SEGS = 16;
const SPINE_FOLLOW = 0.25;
const SWIM_WAVE_AMP = 0.1;
const SCARE_DURATION = 150;

// Traditional koi colors
const HI = "#C83C2C";
const HI_DEEP = "#A8301E";
const SUMI = "#1E1E1E";
const SHIRO = "#F0E8DC";
const BENI = "#D45030";

const DEFAULT_VARIETIES: KoiVariety[] = [
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.13)",
    patches: [
      { t: 0.1, offset: 0, rx: 0.12, ry: 1.0, color: HI },
      { t: 0.42, offset: 0.05, rx: 0.17, ry: 1.1, color: HI },
      { t: 0.73, offset: -0.05, rx: 0.1, ry: 0.85, color: BENI },
    ],
  },
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.12)",
    patches: [
      { t: 0.14, offset: 0.05, rx: 0.13, ry: 0.9, color: HI },
      { t: 0.48, offset: -0.1, rx: 0.15, ry: 0.85, color: HI },
      { t: 0.33, offset: 0.45, rx: 0.04, ry: 0.35, color: SUMI },
      { t: 0.58, offset: -0.4, rx: 0.035, ry: 0.3, color: SUMI },
      { t: 0.72, offset: 0.25, rx: 0.03, ry: 0.28, color: SUMI },
    ],
  },
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.13)",
    patches: [
      { t: 0.08, offset: 0, rx: 0.1, ry: 0.85, color: HI },
      { t: 0.35, offset: -0.08, rx: 0.2, ry: 1.05, color: BENI },
      { t: 0.7, offset: 0.1, rx: 0.13, ry: 0.9, color: HI },
      { t: 0.25, offset: 0.4, rx: 0.035, ry: 0.3, color: SUMI },
      { t: 0.55, offset: -0.35, rx: 0.04, ry: 0.28, color: SUMI },
    ],
  },
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.14)",
    patches: [
      { t: 0.15, offset: 0.08, rx: 0.16, ry: 1.1, color: BENI },
      { t: 0.55, offset: -0.05, rx: 0.2, ry: 1.0, color: HI },
    ],
  },
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.14)",
    patches: [{ t: 0.1, offset: 0, rx: 0.07, ry: 0.7, color: HI }],
  },
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.14)",
    patches: [
      { t: 0.08, offset: 0, rx: 0.06, ry: 0.65, color: HI },
      { t: 0.4, offset: 0, rx: 0.22, ry: 1.1, color: BENI },
    ],
  },
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.13)",
    patches: [
      { t: 0.1, offset: 0.15, rx: 0.12, ry: 0.9, color: HI },
      { t: 0.3, offset: -0.12, rx: 0.13, ry: 0.95, color: BENI },
      { t: 0.5, offset: 0.1, rx: 0.12, ry: 0.9, color: HI },
      { t: 0.7, offset: -0.08, rx: 0.11, ry: 0.85, color: BENI },
    ],
  },
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.12)",
    patches: [
      { t: 0.1, offset: 0.15, rx: 0.1, ry: 0.8, color: HI },
      { t: 0.3, offset: -0.2, rx: 0.12, ry: 0.7, color: SUMI },
      { t: 0.5, offset: 0.1, rx: 0.14, ry: 0.9, color: HI_DEEP },
      { t: 0.7, offset: -0.1, rx: 0.08, ry: 0.6, color: SUMI },
    ],
  },
  {
    base: SHIRO,
    sheen: "rgba(255,255,255,0.13)",
    patches: [
      { t: 0.22, offset: 0, rx: 0.2, ry: 1.05, color: HI },
      { t: 0.65, offset: 0.08, rx: 0.14, ry: 0.95, color: BENI },
    ],
  },
];

// --- Helpers ---
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function dist(a: Vec2, b: Vec2) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Cosine-interpolated width profile for C1 smooth body
const WIDTH_KEYS: [number, number][] = [
  [0, 0],
  [0.03, 0.55],
  [0.12, 0.85],
  [0.32, 1.0],
  [0.52, 0.92],
  [0.72, 0.5],
  [0.87, 0.14],
  [1.0, 0.02],
];

function widthProfile(t: number): number {
  for (let i = 0; i < WIDTH_KEYS.length - 1; i++) {
    if (t <= WIDTH_KEYS[i + 1][0]) {
      const lt =
        (t - WIDTH_KEYS[i][0]) /
        (WIDTH_KEYS[i + 1][0] - WIDTH_KEYS[i][0]);
      const smooth = (1 - Math.cos(lt * Math.PI)) / 2;
      return (
        WIDTH_KEYS[i][1] +
        (WIDTH_KEYS[i + 1][1] - WIDTH_KEYS[i][1]) * smooth
      );
    }
  }
  return WIDTH_KEYS[WIDTH_KEYS.length - 1][1];
}

// --- Spine ---
function computeSpine(fish: Fish): Vec2[] {
  const segLen = fish.length / SPINE_SEGS;
  const pts: Vec2[] = [{ x: fish.x, y: fish.y }];
  for (let i = 0; i < SPINE_SEGS; i++) {
    const t = (i + 1) / SPINE_SEGS;
    const wave =
      Math.sin(fish.tailPhase + t * Math.PI * 2.5) *
      SWIM_WAVE_AMP *
      t *
      t;
    const angle = fish.spineAngles[i] + wave;
    const prev = pts[i];
    pts.push({
      x: prev.x + Math.cos(angle) * segLen,
      y: prev.y + Math.sin(angle) * segLen,
    });
  }
  return pts;
}

function spineDir(spine: Vec2[], i: number): number {
  const n = spine.length;
  if (i <= 0)
    return Math.atan2(spine[1].y - spine[0].y, spine[1].x - spine[0].x);
  if (i >= n - 1)
    return Math.atan2(
      spine[n - 1].y - spine[n - 2].y,
      spine[n - 1].x - spine[n - 2].x
    );
  return Math.atan2(
    spine[i + 1].y - spine[i - 1].y,
    spine[i + 1].x - spine[i - 1].x
  );
}

function bodyPath(
  ctx: CanvasRenderingContext2D,
  spine: Vec2[],
  hw: number
) {
  const N = spine.length;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const w = widthProfile(t) * hw;
    const dir = spineDir(spine, i);
    const px = Math.cos(dir + Math.PI / 2);
    const py = Math.sin(dir + Math.PI / 2);
    left.push({ x: spine[i].x + px * w, y: spine[i].y + py * w });
    right.push({ x: spine[i].x - px * w, y: spine[i].y - py * w });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < N - 1; i++) {
    const mx = (left[i].x + left[i + 1].x) / 2;
    const my = (left[i].y + left[i + 1].y) / 2;
    ctx.quadraticCurveTo(left[i].x, left[i].y, mx, my);
  }
  ctx.lineTo(left[N - 1].x, left[N - 1].y);
  ctx.lineTo(right[N - 1].x, right[N - 1].y);
  for (let i = N - 2; i >= 1; i--) {
    const mx = (right[i].x + right[i - 1].x) / 2;
    const my = (right[i].y + right[i - 1].y) / 2;
    ctx.quadraticCurveTo(right[i].x, right[i].y, mx, my);
  }
  ctx.lineTo(right[0].x, right[0].y);
  const fwd = spineDir(spine, 0) + Math.PI;
  ctx.quadraticCurveTo(
    spine[0].x + Math.cos(fwd) * hw * 0.25,
    spine[0].y + Math.sin(fwd) * hw * 0.25,
    left[0].x,
    left[0].y
  );
  ctx.closePath();
}

// --- Fish creation ---
function createFish(
  canvasW: number,
  canvasH: number,
  index: number,
  varieties: KoiVariety[],
  sizeRange: [number, number],
  speedMul: number
): Fish {
  const variety = varieties[index % varieties.length];
  const angle = Math.random() * Math.PI * 2;
  const baseSpeed = (0.3 + Math.random() * 0.25) * speedMul;
  const length = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
  const x = 120 + Math.random() * Math.max(1, canvasW - 240);
  const y = 120 + Math.random() * Math.max(1, canvasH - 240);

  const patches = variety.patches.map((p) => ({
    t: p.t + (Math.random() - 0.5) * 0.06,
    offset: p.offset + (Math.random() - 0.5) * 0.15,
    rx: p.rx * (0.88 + Math.random() * 0.24),
    ry: p.ry * (0.88 + Math.random() * 0.24),
    color: p.color,
  }));

  return {
    x,
    y,
    vx: Math.cos(angle) * baseSpeed * 0.5,
    vy: Math.sin(angle) * baseSpeed * 0.5,
    heading: angle,
    length,
    maxHW: length * 0.17,
    baseSpeed,
    speed: baseSpeed,
    baseColor: variety.base,
    sheenColor: variety.sheen,
    patches,
    spineAngles: Array.from({ length: SPINE_SEGS }, () => angle + Math.PI),
    tailPhase: Math.random() * Math.PI * 2,
    tailSpeed: 0.04 + Math.random() * 0.02,
    wanderAngle: angle,
    wanderTimer: 200 + Math.random() * 400,
    scared: false,
    scareTimer: 0,
  };
}

// --- Fish update ---
function updateFish(fish: Fish, allFish: Fish[], w: number, h: number) {
  fish.wanderTimer--;
  if (fish.wanderTimer <= 0) {
    fish.wanderAngle += (Math.random() - 0.5) * 0.7;
    fish.wanderTimer = 250 + Math.random() * 450;
  }

  if (fish.scared) {
    fish.scareTimer--;
    const prog = fish.scareTimer / SCARE_DURATION;
    fish.speed = fish.baseSpeed + fish.baseSpeed * 3 * prog;
    if (fish.scareTimer <= 0) {
      fish.scared = false;
      fish.speed = fish.baseSpeed;
    }
  }

  const tx = Math.cos(fish.wanderAngle) * fish.speed;
  const ty = Math.sin(fish.wanderAngle) * fish.speed;
  const steer = fish.scared ? 0.04 : 0.008;
  fish.vx = lerp(fish.vx, tx, steer);
  fish.vy = lerp(fish.vy, ty, steer);

  for (const other of allFish) {
    if (other === fish) continue;
    const d = dist(fish, other);
    if (d < 70 && d > 0.1) {
      fish.vx += ((fish.x - other.x) / d) * 0.002;
      fish.vy += ((fish.y - other.y) / d) * 0.002;
    }
  }

  const margin = 100;
  const ef = 0.015;
  if (fish.x < margin) {
    fish.vx += ef * (1 - fish.x / margin);
    fish.wanderAngle = lerpAngle(fish.wanderAngle, 0, 0.01);
  }
  if (fish.x > w - margin) {
    fish.vx -= ef * (1 - (w - fish.x) / margin);
    fish.wanderAngle = lerpAngle(fish.wanderAngle, Math.PI, 0.01);
  }
  if (fish.y < margin) {
    fish.vy += ef * (1 - fish.y / margin);
    fish.wanderAngle = lerpAngle(fish.wanderAngle, Math.PI / 2, 0.01);
  }
  if (fish.y > h - margin) {
    fish.vy -= ef * (1 - (h - fish.y) / margin);
    fish.wanderAngle = lerpAngle(fish.wanderAngle, -Math.PI / 2, 0.01);
  }

  const spd = Math.sqrt(fish.vx ** 2 + fish.vy ** 2);
  const maxSpd = fish.scared ? fish.baseSpeed * 4 : fish.baseSpeed * 1.15;
  if (spd > maxSpd) {
    fish.vx = (fish.vx / spd) * maxSpd;
    fish.vy = (fish.vy / spd) * maxSpd;
  }

  fish.x += fish.vx;
  fish.y += fish.vy;
  fish.x = clamp(fish.x, -30, w + 30);
  fish.y = clamp(fish.y, -30, h + 30);

  if (spd > 0.04) {
    const velAngle = Math.atan2(fish.vy, fish.vx);
    fish.heading = lerpAngle(
      fish.heading,
      velAngle,
      fish.scared ? 0.06 : 0.02
    );
  }

  fish.spineAngles[0] = fish.heading + Math.PI;
  for (let i = 1; i < SPINE_SEGS; i++) {
    fish.spineAngles[i] = lerpAngle(
      fish.spineAngles[i],
      fish.spineAngles[i - 1],
      SPINE_FOLLOW
    );
  }

  const speedRatio = spd / fish.baseSpeed;
  fish.tailPhase += fish.tailSpeed * (0.5 + speedRatio * 0.5);
}

function scareFish(fish: Fish, cx: number, cy: number, scareRadius: number) {
  const d = dist(fish, { x: cx, y: cy });
  if (d < scareRadius) {
    fish.scared = true;
    fish.scareTimer = SCARE_DURATION;
    fish.speed = fish.baseSpeed * (2 + (1 - d / scareRadius) * 2);
    const away = Math.atan2(fish.y - cy, fish.x - cx);
    fish.wanderAngle = away + (Math.random() - 0.5) * 0.4;
    fish.vx += Math.cos(away) * fish.speed * 0.3;
    fish.vy += Math.sin(away) * fish.speed * 0.3;
  }
}

// --- Fish drawing ---
function drawFish(ctx: CanvasRenderingContext2D, fish: Fish) {
  const spine = computeSpine(fish);
  const N = spine.length;
  const hw = fish.maxHW;
  const len = fish.length;

  // Tail fin
  const tailBase = spine[N - 1];
  const tDir = spineDir(spine, N - 1);
  const tWave = Math.sin(fish.tailPhase) * 0.25;
  const tAngle = tDir + tWave;
  const tP = tAngle + Math.PI / 2;
  const fLen = len * 0.2;
  const fW = len * 0.14;
  const stalkW = widthProfile(1.0) * hw + 1;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(
    tailBase.x + Math.cos(tP) * stalkW,
    tailBase.y + Math.sin(tP) * stalkW
  );
  ctx.bezierCurveTo(
    tailBase.x + Math.cos(tAngle) * fLen * 0.3 + Math.cos(tP) * fW * 0.5,
    tailBase.y + Math.sin(tAngle) * fLen * 0.3 + Math.sin(tP) * fW * 0.5,
    tailBase.x + Math.cos(tAngle) * fLen * 0.7 + Math.cos(tP) * fW,
    tailBase.y + Math.sin(tAngle) * fLen * 0.7 + Math.sin(tP) * fW,
    tailBase.x + Math.cos(tAngle) * fLen + Math.cos(tP) * fW * 0.85,
    tailBase.y + Math.sin(tAngle) * fLen + Math.sin(tP) * fW * 0.85
  );
  ctx.quadraticCurveTo(
    tailBase.x + Math.cos(tAngle) * fLen * 0.88,
    tailBase.y + Math.sin(tAngle) * fLen * 0.88,
    tailBase.x + Math.cos(tAngle) * fLen - Math.cos(tP) * fW * 0.85,
    tailBase.y + Math.sin(tAngle) * fLen - Math.sin(tP) * fW * 0.85
  );
  ctx.bezierCurveTo(
    tailBase.x + Math.cos(tAngle) * fLen * 0.7 - Math.cos(tP) * fW,
    tailBase.y + Math.sin(tAngle) * fLen * 0.7 - Math.sin(tP) * fW,
    tailBase.x + Math.cos(tAngle) * fLen * 0.3 - Math.cos(tP) * fW * 0.5,
    tailBase.y + Math.sin(tAngle) * fLen * 0.3 - Math.sin(tP) * fW * 0.5,
    tailBase.x - Math.cos(tP) * stalkW,
    tailBase.y - Math.sin(tP) * stalkW
  );
  ctx.closePath();
  const tailGrad = ctx.createLinearGradient(
    tailBase.x,
    tailBase.y,
    tailBase.x + Math.cos(tAngle) * fLen,
    tailBase.y + Math.sin(tAngle) * fLen
  );
  tailGrad.addColorStop(0, fish.baseColor);
  tailGrad.addColorStop(1, fish.baseColor + "66");
  ctx.fillStyle = tailGrad;
  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Pectoral fins
  const pfT = 0.22;
  const pfI = Math.round(pfT * (N - 1));
  const pfPt = spine[pfI];
  const pfDir = spineDir(spine, pfI);
  const pfPerp = pfDir + Math.PI / 2;
  const pfW = widthProfile(pfT) * hw;
  const pfFlap = Math.sin(fish.tailPhase * 0.5) * 0.25;
  const pfLen = len * 0.14;

  for (const side of [1, -1]) {
    ctx.save();
    const base = {
      x: pfPt.x + Math.cos(pfPerp) * pfW * 0.85 * side,
      y: pfPt.y + Math.sin(pfPerp) * pfW * 0.85 * side,
    };
    const tip = {
      x:
        base.x +
        Math.cos(pfPerp + 0.35 * side + pfFlap * side) * pfLen +
        Math.cos(pfDir) * pfLen * 0.4,
      y:
        base.y +
        Math.sin(pfPerp + 0.35 * side + pfFlap * side) * pfLen +
        Math.sin(pfDir) * pfLen * 0.4,
    };
    const end = {
      x:
        pfPt.x +
        Math.cos(pfDir) * len * 0.07 +
        Math.cos(pfPerp) * pfW * 0.6 * side,
      y:
        pfPt.y +
        Math.sin(pfDir) * len * 0.07 +
        Math.sin(pfPerp) * pfW * 0.6 * side,
    };
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.quadraticCurveTo(tip.x, tip.y, end.x, end.y);
    ctx.fillStyle = fish.baseColor;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Body
  bodyPath(ctx, spine, hw);
  ctx.fillStyle = fish.baseColor;
  ctx.fill();

  // Patches (clipped to body)
  ctx.save();
  bodyPath(ctx, spine, hw);
  ctx.clip();

  for (const patch of fish.patches) {
    const si = patch.t * (N - 1);
    const idx = Math.floor(clamp(si, 0, N - 2));
    const frac = si - idx;
    const pos = {
      x: lerp(spine[idx].x, spine[idx + 1].x, frac),
      y: lerp(spine[idx].y, spine[idx + 1].y, frac),
    };
    const dir = spineDir(spine, Math.round(clamp(si, 0, N - 1)));
    const perp = dir + Math.PI / 2;
    const localW = widthProfile(patch.t) * hw;
    const cx = pos.x + Math.cos(perp) * patch.offset * localW;
    const cy = pos.y + Math.sin(perp) * patch.offset * localW;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir);

    const prx = patch.rx * len;
    const pry = patch.ry * localW;
    const maxR = Math.max(prx, pry);
    const grad = ctx.createRadialGradient(0, 0, maxR * 0.6, 0, 0, maxR);
    grad.addColorStop(0, patch.color);
    grad.addColorStop(1, patch.color + "00");

    ctx.beginPath();
    ctx.ellipse(0, 0, prx, pry, 0, 0, Math.PI * 2);
    ctx.fillStyle = patch.color;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, 0, prx * 1.15, pry * 1.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Sheen
  const sheenIdx = Math.round(N * 0.3);
  const sheenGrad = ctx.createRadialGradient(
    spine[sheenIdx].x,
    spine[sheenIdx].y,
    0,
    spine[sheenIdx].x,
    spine[sheenIdx].y,
    len * 0.4
  );
  sheenGrad.addColorStop(0, fish.sheenColor);
  sheenGrad.addColorStop(0.6, "rgba(255,255,255,0.03)");
  sheenGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(fish.x - len, fish.y - len, len * 2, len * 2);

  ctx.restore(); // end clip

  // Outline
  bodyPath(ctx, spine, hw);
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Dorsal ridge
  const dStart = Math.round(N * 0.12);
  const dEnd = Math.round(N * 0.7);
  ctx.beginPath();
  ctx.moveTo(spine[dStart].x, spine[dStart].y);
  for (let i = dStart + 1; i <= dEnd; i++) ctx.lineTo(spine[i].x, spine[i].y);
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Eyes
  const eyeT = 0.05;
  const eI = Math.max(1, Math.round(eyeT * (N - 1)));
  const eDir = spineDir(spine, eI);
  const ePerp = eDir + Math.PI / 2;
  const eW = widthProfile(eyeT) * hw;
  for (const side of [1, -1]) {
    const ex = spine[eI].x + Math.cos(ePerp) * eW * 0.6 * side;
    const ey = spine[eI].y + Math.sin(ePerp) * eW * 0.6 * side;
    ctx.beginPath();
    ctx.arc(ex, ey, len * 0.013, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fill();
  }
}

// --- Environment drawing ---
function drawRipple(ctx: CanvasRenderingContext2D, ripple: Ripple) {
  for (let i = 0; i < 3; i++) {
    const r = ripple.radius * (1 - i * 0.2);
    if (r <= 0) continue;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180,210,230,${ripple.opacity * (0.4 - i * 0.12)})`;
    ctx.lineWidth = 1.5 - i * 0.4;
    ctx.stroke();
  }
}

function drawWater(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number
) {
  ctx.save();
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 6; i++) {
    const x = (Math.sin(time * 0.0003 + i * 1.3) * w) / 2 + w / 2;
    const y = (Math.cos(time * 0.0004 + i * 1.7) * h) / 2 + h / 2;
    const r = 120 + Math.sin(time * 0.0006 + i) * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(200,230,255,1)");
    g.addColorStop(1, "rgba(200,230,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function createLilyPads(
  cw: number,
  ch: number,
  count: number,
  bloomChance: number
): LilyPad[] {
  return Array.from({ length: count }, () => ({
    x: 80 + Math.random() * Math.max(1, cw - 160),
    y: 80 + Math.random() * Math.max(1, ch - 160),
    radius: 22 + Math.random() * 22,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.001,
    bobPhase: Math.random() * Math.PI * 2,
    hasBloom: Math.random() < bloomChance,
    bloomAngle: Math.random() * Math.PI * 2,
    bloomHue: Math.floor(Math.random() * 3),
  }));
}

function drawLilyPad(
  ctx: CanvasRenderingContext2D,
  pad: LilyPad,
  time: number
) {
  const bob = Math.sin(time * 0.0006 + pad.bobPhase) * 1.5;
  ctx.save();
  ctx.translate(pad.x, pad.y + bob);
  ctx.rotate(pad.rotation + time * pad.rotSpeed);

  ctx.beginPath();
  ctx.arc(0, 0, pad.radius, 0.15, Math.PI * 2 - 0.15);
  ctx.lineTo(0, 0);
  ctx.closePath();

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, pad.radius);
  g.addColorStop(0, "rgba(45,100,45,0.55)");
  g.addColorStop(1, "rgba(30,75,30,0.35)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(25,65,25,0.25)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 5; i++) {
    const a = 0.3 + (i / 5) * (Math.PI * 2 - 0.6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      Math.cos(a) * pad.radius * 0.85,
      Math.sin(a) * pad.radius * 0.85
    );
    ctx.stroke();
  }

  if (pad.hasBloom) {
    const br = pad.radius * 0.45;
    const bx = Math.cos(pad.bloomAngle) * pad.radius * 0.15;
    const by = Math.sin(pad.bloomAngle) * pad.radius * 0.15;

    const petalColors = [
      ["rgba(245,230,235,0.85)", "rgba(235,200,210,0.75)"],
      ["rgba(235,170,185,0.85)", "rgba(215,130,155,0.75)"],
      ["rgba(250,240,220,0.85)", "rgba(240,225,195,0.75)"],
    ][pad.bloomHue];

    for (let i = 0; i < 8; i++) {
      const pa = pad.bloomAngle + (i / 8) * Math.PI * 2;
      const px = bx + Math.cos(pa) * br * 0.35;
      const py = by + Math.sin(pa) * br * 0.35;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(pa);
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 0.55, br * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = petalColors[1];
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < 6; i++) {
      const pa = pad.bloomAngle + (i / 6) * Math.PI * 2 + 0.25;
      const px = bx + Math.cos(pa) * br * 0.15;
      const py = by + Math.sin(pa) * br * 0.15;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(pa);
      ctx.beginPath();
      ctx.ellipse(0, 0, br * 0.4, br * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = petalColors[0];
      ctx.fill();
      ctx.restore();
    }

    const cGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br * 0.18);
    cGrad.addColorStop(0, "rgba(230,200,80,0.9)");
    cGrad.addColorStop(1, "rgba(210,180,60,0.7)");
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = cGrad;
    ctx.fill();
  }

  ctx.restore();
}

// --- Main Component ---
export function KoiPond({
  fishCount = 9,
  fishSize = [50, 80],
  speed = 1,
  varieties,
  waterColor = ["#1a3a4a", "#0f2b3a", "#0a1f2e"],
  lilyPadCount,
  showLilyPads = true,
  bloomChance = 0.45,
  showVignette = true,
  scareRadius = 200,
  rippleSize = 140,
  className,
  style,
}: KoiPondProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    fish: Fish[];
    ripples: Ripple[];
    lilyPads: LilyPad[];
    animId: number;
    time: number;
    cssW: number;
    cssH: number;
  }>({
    fish: [],
    ripples: [],
    lilyPads: [],
    animId: 0,
    time: 0,
    cssW: 0,
    cssH: 0,
  });

  // Stable refs for props used inside animation loop
  const propsRef = useRef({
    scareRadius,
    rippleSize,
    waterColor,
    showLilyPads,
    showVignette,
  });
  propsRef.current = {
    scareRadius,
    rippleSize,
    waterColor,
    showLilyPads,
    showVignette,
  };

  const handleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const state = stateRef.current;
    const p = propsRef.current;

    state.ripples.push({
      x,
      y,
      radius: 0,
      maxRadius: p.rippleSize,
      opacity: 1,
      speed: 1.5 + Math.random() * 0.5,
    });
    state.ripples.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      radius: 0,
      maxRadius: p.rippleSize * 0.6,
      opacity: 0.7,
      speed: 1.0 + Math.random() * 0.5,
    });

    for (const f of state.fish) scareFish(f, x, y, p.scareRadius);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state = stateRef.current;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      state.cssW = rect.width;
      state.cssH = rect.height;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", handleClick);

    const usedVarieties = varieties ?? DEFAULT_VARIETIES;
    state.fish = Array.from({ length: fishCount }, (_, i) =>
      createFish(state.cssW, state.cssH, i, usedVarieties, fishSize, speed)
    );
    const padCount =
      lilyPadCount ?? 4 + Math.floor(Math.random() * 3);
    state.lilyPads = showLilyPads
      ? createLilyPads(state.cssW, state.cssH, padCount, bloomChance)
      : [];

    const animate = () => {
      const w = state.cssW;
      const h = state.cssH;
      const p = propsRef.current;
      state.time++;

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, p.waterColor[0]);
      bg.addColorStop(0.5, p.waterColor[1]);
      bg.addColorStop(1, p.waterColor[2]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      drawWater(ctx, w, h, state.time);

      if (p.showLilyPads) {
        for (const pad of state.lilyPads) drawLilyPad(ctx, pad, state.time);
      }

      state.ripples = state.ripples.filter((r) => r.opacity > 0.01);
      for (const r of state.ripples) {
        r.radius += r.speed;
        r.opacity = clamp(1 - r.radius / r.maxRadius, 0, 1);
        drawRipple(ctx, r);
      }

      for (const f of state.fish) updateFish(f, state.fish, w, h);

      const sorted = [...state.fish].sort((a, b) => a.y - b.y);
      for (const f of sorted) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.filter = "blur(6px)";
        ctx.beginPath();
        ctx.ellipse(
          f.x + 3,
          f.y + 4,
          f.length * 0.15,
          f.maxHW * 0.8,
          f.heading,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = "#000";
        ctx.fill();
        ctx.restore();
        drawFish(ctx, f);
      }

      if (p.showVignette) {
        const vig = ctx.createRadialGradient(
          w / 2,
          h / 2,
          Math.min(w, h) * 0.35,
          w / 2,
          h / 2,
          Math.max(w, h) * 0.75
        );
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.35)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      }

      state.animId = requestAnimationFrame(animate);
    };

    state.animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(state.animId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", handleClick);
    };
  }, [fishCount, fishSize, speed, varieties, showLilyPads, lilyPadCount, bloomChance, handleClick]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        cursor: "pointer",
        ...style,
      }}
    />
  );
}
