// Procedural pixel-art engine v2: blob-autotiled terrain, building/tree/prop
// sprites with depth, and customizable characters (hairstyles + outfits).
import { T } from '/shared/tiles.js';
import { TILE, getSolid } from '/shared/maps.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return { c, ctx: x };
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1).length === 3 ? hex.slice(1).replace(/./g, '$&$&') : hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}
const hashf = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------- TERRAIN (real tileset, baked per map) ----------------
// Tileset: Tuxemon (CC BY-SA 4.0) — see public/assets/ATTRIBUTION.md.
// 16px source tiles, scaled x2 to our 32px grid. Coordinates measured from
// the sheet (grass plain, grass variants, dirt, stone, sand, snow, water).
const ST = 16; // source tile size
export const TILESET = new Image();
let tilesetReady = false;
export function loadTileset() {
  return new Promise((res) => {
    TILESET.onload = () => { tilesetReady = true; res(true); };
    TILESET.onerror = () => { tilesetReady = false; res(false); };
    TILESET.src = '/assets/terrain.png';
  });
}
export function tilesetOk() { return tilesetReady; }

// terrain code -> weighted list of source tiles [col,row] (repeats = more common)
const TSRC = {
  [T.GRASS]:     [[1, 3], [1, 3], [1, 3], [9, 3], [10, 3]],
  [T.TALLGRASS]: [[9, 3], [10, 3]],
  [T.PATH]:      [[17, 3]],
  [T.DIRT]:      [[17, 3]],
  [T.ROAD]:      [[25, 3]],
  [T.PLAZA]:     [[25, 3]],
  [T.FLOOR]:     [[25, 3]],
  [T.CARPET]:    [[25, 3]],
  [T.SAND]:      [[1, 18]],
  [T.SNOW]:      [[8, 18]],
  [T.WATER]:     [[21, 25]],
  [T.DEEPWATER]: [[17, 25]],
  [T.ROCK]:      [[17, 3]],
};
const pickTile = (code, x, y) => {
  const v = TSRC[code] || TSRC[T.GRASS];
  return v[(Math.floor(hashf(x, y) * 997)) % v.length];
};

// Terrain "height": higher priority bleeds onto lower at boundaries.
const PR = {
  [T.DEEPWATER]: 0, [T.WATER]: 1, [T.SAND]: 2,
  [T.PATH]: 3, [T.ROAD]: 3, [T.DIRT]: 3, [T.FLOOR]: 3, [T.PLAZA]: 3, [T.CARPET]: 3,
  [T.GRASS]: 4, [T.TALLGRASS]: 4, [T.SNOW]: 4, [T.ROCK]: 5,
};
const pr = (code) => PR[code] ?? 4;

// ---- dithered edge masks (ordered Bayer dithering for a pixel-art speckle) ----
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const FADE0 = 5, FADE1 = 15; // opaque within FADE0 px of the edge, dithered out to FADE1
function edgeMask(depthFn) {
  const { c, ctx } = makeCanvas(TILE, TILE);
  const img = ctx.createImageData(TILE, TILE);
  for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
    const d = depthFn(px, py);           // distance from the bleeding edge (0 = at edge)
    let on = 0;
    if (d <= FADE0) on = 1;
    else if (d < FADE1) { const t = (FADE1 - d) / (FADE1 - FADE0); on = (BAYER[py & 3][px & 3] / 16) < t ? 1 : 0; }
    const i = (py * TILE + px) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0); return c;
}
const MASKS = {
  N: edgeMask((x, y) => y), S: edgeMask((x, y) => TILE - 1 - y),
  W: edgeMask((x, y) => x), E: edgeMask((x, y) => TILE - 1 - x),
  NE: edgeMask((x, y) => Math.hypot(TILE - 1 - x, y)), NW: edgeMask((x, y) => Math.hypot(x, y)),
  SE: edgeMask((x, y) => Math.hypot(TILE - 1 - x, TILE - 1 - y)), SW: edgeMask((x, y) => Math.hypot(x, TILE - 1 - y)),
};
let SCRATCH = null;

export function bakeMap(map) {
  const { c, ctx } = makeCanvas(map.w * TILE, map.h * TILE);
  const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h) ? map.tiles[Math.max(0, Math.min(map.h - 1, y)) * map.w + Math.max(0, Math.min(map.w - 1, x))] : map.tiles[y * map.w + x];
  if (!SCRATCH) SCRATCH = makeCanvas(TILE, TILE);
  const sc = SCRATCH.ctx, scc = SCRATCH.c;

  // pass 1: base fills
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const [sx, sy] = pickTile(map.tiles[y * map.w + x], x, y);
    ctx.drawImage(TILESET, sx * ST, sy * ST, ST, ST, x * TILE, y * TILE, TILE, TILE);
  }

  // pass 2: dithered transitions — a higher neighbour bleeds onto this tile
  const blend = (bcode, bx, by, x, y, dir) => {
    const [sx, sy] = pickTile(bcode, bx, by);
    sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, TILE, TILE);
    sc.drawImage(TILESET, sx * ST, sy * ST, ST, ST, 0, 0, TILE, TILE);
    sc.globalCompositeOperation = 'destination-in'; sc.drawImage(MASKS[dir], 0, 0);
    ctx.drawImage(scc, x * TILE, y * TILE);
  };
  const orth = [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']];
  const diag = [[1, -1, 'NE', [0, -1], [1, 0]], [-1, -1, 'NW', [0, -1], [-1, 0]], [1, 1, 'SE', [0, 1], [1, 0]], [-1, 1, 'SW', [0, 1], [-1, 0]]];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const a = pr(map.tiles[y * map.w + x]);
    for (const [dx, dy, dir] of orth) {
      const b = at(x + dx, y + dy); if (pr(b) > a) blend(b, x + dx, y + dy, x, y, dir);
    }
    for (const [dx, dy, dir, o1, o2] of diag) {
      const b = at(x + dx, y + dy);
      if (pr(b) > a && pr(at(x + o1[0], y + o1[1])) <= a && pr(at(x + o2[0], y + o2[1])) <= a) blend(b, x + dx, y + dy, x, y, dir);
    }
  }

  // pass 3: decorator/clutter layer — scatter flowers, tufts, bushes, rocks on
  // grass with patchy density (some lush meadows, some bare). Baked flat.
  const solid = getSolid(map.id);
  for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
    const code = map.tiles[y * map.w + x];
    if (code !== T.GRASS && code !== T.TALLGRASS) continue;
    if (solid[y * map.w + x]) continue;                         // under trees/buildings
    const patch = hashf(Math.floor(x / 6) + 0.5, Math.floor(y / 6) + 0.5); // coarse noise
    const density = 0.08 + patch * 0.34;                        // 8%..42% (lush meadows)
    if (hashf(x * 1.7, y * 2.3) > density) continue;
    const d = pickDecor(x, y);
    ctx.drawImage(TILESET, d[0] * ST, d[1] * ST, ST, ST, x * TILE, y * TILE, TILE, TILE);
  }
  return c;
}

// Weighted decoration tiles (all sit on a grass backdrop in the sheet).
const DECOR = [];
[
  // green tufts / bushes / ferns / leaf plants (common)
  [[29, 27], 9], [[25, 33], 5], [[27, 35], 4], [[28, 35], 3], [[26, 30], 3], [[28, 27], 3], [[24, 30], 2], [[25, 30], 2],
  // flower accents
  [[24, 33], 2], [[26, 33], 2], [[29, 28], 2], [[27, 33], 1], [[28, 28], 1], [[7, 0], 1], [[6, 2], 1],
  // rocks / boulders
  [[30, 32], 2], [[31, 32], 1], [[24, 32], 1],
].forEach(([t, w]) => { for (let i = 0; i < w; i++) DECOR.push(t); });
const pickDecor = (x, y) => DECOR[Math.floor(hashf(x * 3.1 + 1.3, y * 4.7 + 0.9) * 991) % DECOR.length];

// ---------------- OBJECT SPRITES ----------------
const cache = new Map();
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

const BSTYLE = {
  academy: { wall: '#6a5c86', roof: '#5a3f8a', trim: '#c9a24a', win: '#9fd0ff' },
  palace:  { wall: '#7d6ea0', roof: '#8a5f9a', trim: '#ffd24a', win: '#bfe0ff' },
  dorm:    { wall: '#a8746a', roof: '#6b4038', trim: '#e0c9a0', win: '#ffe6a0' },
  dorm2:   { wall: '#6a7ba8', roof: '#384a6b', trim: '#c9d4e0', win: '#ffe6a0' },
  cafe:    { wall: '#c99a5a', roof: '#8a4f2f', trim: '#ffe1b0', win: '#fff2c9' },
  library: { wall: '#8a8478', roof: '#4a4642', trim: '#c9b98a', win: '#bfe0ff' },
  opera:   { wall: '#8a6a9a', roof: '#5a2f6b', trim: '#ffd24a', win: '#e0c9ff' },
  shop:    { wall: '#7a6a9a', roof: '#4a2f6b', trim: '#c9a24a', win: '#d9c2ff' },
  shop2:   { wall: '#5a8a7a', roof: '#2f5a4a', trim: '#c9e0d4', win: '#c9fff0' },
  inn:     { wall: '#b08a5a', roof: '#6b4a2f', trim: '#ffe1b0', win: '#fff2c9' },
  house:   { wall: '#b7a488', roof: '#7a4a3a', trim: '#e0d4b8', win: '#ffe6a0' },
  house2:  { wall: '#a898b0', roof: '#5a4a6b', trim: '#e0d4e8', win: '#ffe6a0' },
};

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const OUTLINE = '#241d2e';

export function buildingSprite(obj) {
  return cached(`b:${obj.style}:${obj.w}:${obj.h}:${obj.door}`, () => buildVictorian(obj));
}

// ===================== Victorian building system =====================
// Drawn at 16px/tile then upscaled x2 (nearest) so pixel density matches the
// tileset. Each style differs: material, roof shape, windows, ornaments.
const U = 16;
const fillPoly = (ctx, p) => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); ctx.fill(); };

// Muted Victorian palette — cream stone, burgundy, slate, dark green, brick
// brown, brass trim; desaturated slate/amber/sage glass (no candy brights).
const VST = {
  palace:  { mat: 'stone',  wall: '#d8cdb2', roof: '#5f3540', trim: '#b0954e', glass: '#8ea6bd', grand: 'royal' },
  academy: { mat: 'stone',  wall: '#7c7690', roof: '#38414f', trim: '#9f93b2', glass: '#7fa1ab', grand: 'magic' },
  opera:   { mat: 'stone',  wall: '#b3a4bd', roof: '#432a40', trim: '#b0954e', glass: '#a898b8', roofType: 'mansard', win: 'arch', chimney: 2, cornice: true, urns: true },
  library: { mat: 'stone',  wall: '#c4baa0', roof: '#41433f', trim: '#9c8858', glass: '#93aab8', roofType: 'hip', win: 'tall', cupola: true, cornice: true, chimney: 1 },
  cafe:    { mat: 'brick',  wall: '#9c5a45', roof: '#412c24', trim: '#c2a877', glass: '#d9c48f', roofType: 'gable', win: 'bay', awning: true, chimney: 1, ginger: true },
  shop:    { mat: 'stone',  wall: '#6f5a7e', roof: '#34273f', trim: '#a98fb8', glass: '#b7a4c9', roofType: 'mansard', win: 'sash', shopfront: true, chimney: 1 },
  shop2:   { mat: 'brick',  wall: '#456e60', roof: '#243d34', trim: '#9cb3a8', glass: '#a7c4b8', roofType: 'gable', win: 'sash', shopfront: true, chimney: 1, ginger: true },
  inn:     { mat: 'timber', wall: '#c9b48a', roof: '#43301f', trim: '#5f4230', glass: '#d9c48f', roofType: 'gable', win: 'sash', sign: true, chimney: 2, ginger: true },
  house:   { mat: 'brick',  wall: '#9a6047', roof: '#452a34', trim: '#c9b48f', glass: '#c6b184', roofType: 'gable', win: 'bay', chimney: 2, ginger: true },
  house2:  { mat: 'stone',  wall: '#8a7c9c', roof: '#3a3049', trim: '#c2b6cc', glass: '#c6b184', roofType: 'mansard', win: 'sash', chimney: 1 },
  dorm:    { mat: 'brick',  wall: '#8a5f52', roof: '#402420', trim: '#c2ab86', glass: '#c6b184', roofType: 'hip', win: 'sash', chimney: 3, cornice: true },
  dorm2:   { mat: 'brick',  wall: '#54637f', roof: '#2c3542', trim: '#a9b3c2', glass: '#c6b184', roofType: 'hip', win: 'sash', chimney: 3, cornice: true },
};

function matFill(ctx, mat, x, y, w, h, wall, trim) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.fillStyle = wall; ctx.fillRect(x, y, w, h);
  if (mat === 'brick') {
    ctx.fillStyle = shade(wall, 0.78);
    for (let ry = 0; ry < h; ry += 3) { ctx.fillRect(x, y + ry + 2, w, 1); const off = ((ry / 3) & 1) ? 3 : 0; for (let rx = off; rx < w; rx += 6) ctx.fillRect(x + rx, y + ry, 1, 2); }
  } else if (mat === 'timber') {
    ctx.fillStyle = trim; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y + (h >> 1) - 1, w, 2);
    const step = Math.max(8, Math.round(w / Math.max(1, Math.round(w / 12))));
    for (let bx = x; bx <= x + w - 2; bx += step) ctx.fillRect(bx, y, 2, h);
  } else {
    ctx.fillStyle = shade(wall, 0.85);
    for (let ry = 0; ry < h; ry += 4) { ctx.fillRect(x, y + ry + 3, w, 1); const off = ((ry / 4) & 1) ? 4 : 0; for (let rx = off; rx < w; rx += 8) ctx.fillRect(x + rx, y + ry, 1, 4); }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(x + w - Math.max(2, w * 0.12 | 0), y, Math.max(2, w * 0.12 | 0), h);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, Math.max(1, w * 0.08 | 0), h);
}

function winDraw(ctx, type, x, y, ww, wh, trim, glass) {
  x = Math.round(x); y = Math.round(y);
  if (type === 'arch' || type === 'lancet') {
    const ah = Math.min(ww, wh * 0.55);
    ctx.fillStyle = shade(trim, 0.7);
    ctx.beginPath(); ctx.moveTo(x - 1, y + ah);
    if (type === 'lancet') ctx.lineTo(x + ww / 2, y - 1); else { ctx.quadraticCurveTo(x - 1, y - 1, x + ww / 2, y - 1); ctx.quadraticCurveTo(x + ww + 1, y - 1, x + ww + 1, y + ah); }
    ctx.lineTo(x + ww + 1, y + wh + 1); ctx.lineTo(x - 1, y + wh + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.moveTo(x, y + ah);
    if (type === 'lancet') ctx.lineTo(x + ww / 2, y + 1); else { ctx.quadraticCurveTo(x, y, x + ww / 2, y); ctx.quadraticCurveTo(x + ww, y, x + ww, y + ah); }
    ctx.lineTo(x + ww, y + wh); ctx.lineTo(x, y + wh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y + ah, ww, (wh - ah) / 2 | 0);
    ctx.fillStyle = shade(trim, 0.75); ctx.fillRect(x + (ww >> 1), y + 2, 1, wh - 2);
  } else {
    ctx.fillStyle = shade(trim, 0.7); ctx.fillRect(x - 1, y - 1, ww + 2, wh + 2);
    ctx.fillStyle = glass; ctx.fillRect(x, y, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y, ww, Math.ceil(wh / 2));
    ctx.fillStyle = shade(trim, 0.75); ctx.fillRect(x + (ww >> 1), y, 1, wh); ctx.fillRect(x, y + (wh >> 1), ww, 1);
    ctx.fillStyle = shade(trim, 0.55); ctx.fillRect(x - 1, y + wh + 1, ww + 2, 1);
    ctx.fillStyle = trim; ctx.fillRect(x - 1, y - 2, ww + 2, 1);
  }
}

function drawDoor(ctx, cx, baseY, ww, wh, trim) {
  const top = baseY - wh, sh2 = ww / 2;
  ctx.fillStyle = shade(trim, 0.6);
  ctx.beginPath(); ctx.moveTo(cx - sh2 - 1, baseY); ctx.lineTo(cx - sh2 - 1, top + sh2); ctx.quadraticCurveTo(cx - sh2 - 1, top - 1, cx, top - 1); ctx.quadraticCurveTo(cx + sh2 + 1, top - 1, cx + sh2 + 1, top + sh2); ctx.lineTo(cx + sh2 + 1, baseY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2616';
  ctx.beginPath(); ctx.moveTo(cx - sh2, baseY); ctx.lineTo(cx - sh2, top + sh2); ctx.quadraticCurveTo(cx - sh2, top + 1, cx, top + 1); ctx.quadraticCurveTo(cx + sh2, top + 1, cx + sh2, top + sh2); ctx.lineTo(cx + sh2, baseY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a1a0e'; ctx.fillRect(cx - 0.5, top + sh2, 1, wh - sh2);
  ctx.fillStyle = shade(trim, 1.15); ctx.fillRect(cx + 1, baseY - wh / 2, 1, 1);
}

function drawBay(ctx, cx, baseY, w, h, trim, glass, roofc) {
  const top = baseY - h;
  ctx.fillStyle = shade(trim, 0.6); ctx.fillRect(cx - w / 2 - 1, top, w + 2, h);
  const pw = (w - 4) / 3;
  for (let i = 0; i < 3; i++) { const px = cx - w / 2 + 1 + i * (pw + 1); ctx.fillStyle = glass; ctx.fillRect(px, top + 2, pw, h - 4); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px, top + 2, pw, 2); }
  ctx.fillStyle = roofc; fillPoly(ctx, [[cx - w / 2 - 2, top], [cx, top - 4], [cx + w / 2 + 2, top]]);
}

function chimneyDraw(ctx, x, topY, h, brickc) {
  matFill(ctx, 'brick', x, topY, 4, h, brickc, shade(brickc, 0.7));
  ctx.fillStyle = shade(brickc, 0.55); ctx.fillRect(x - 1, topY, 6, 1.5);
  ctx.fillStyle = '#39313a'; ctx.fillRect(x, topY - 2, 1.5, 2); ctx.fillRect(x + 2.5, topY - 2, 1.5, 2);
}
function dormerDraw(ctx, cx, y, roofc, trim, glass) {
  ctx.fillStyle = OUTLINE; ctx.fillRect(cx - 4, y - 5, 8, 7);
  ctx.fillStyle = shade(roofc, 1.12); fillPoly(ctx, [[cx - 5, y - 5], [cx, y - 10], [cx + 5, y - 5]]);
  ctx.fillStyle = shade(trim, 0.8); ctx.fillRect(cx - 3, y - 4, 6, 6); ctx.fillStyle = glass; ctx.fillRect(cx - 2, y - 3, 4, 4);
}

function drawRoof(ctx, obj, cfg, L, R, mid, bodyTop, roofH) {
  const W = R - L, apexY = bodyTop - roofH, rc = cfg.roof, trim = cfg.trim, rt = cfg.roofType || 'gable';
  if (rt === 'mansard') {
    const ins = W * 0.14;
    ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 3, bodyTop], [L + ins, apexY], [R - ins, apexY], [R + 3, bodyTop]]);
    ctx.fillStyle = rc; fillPoly(ctx, [[L - 1, bodyTop], [L + ins, apexY], [R - ins, apexY], [R + 1, bodyTop]]);
    ctx.fillStyle = shade(rc, 0.8); fillPoly(ctx, [[mid, apexY], [R - ins, apexY], [R + 1, bodyTop], [mid, bodyTop]]);
    ctx.fillStyle = shade(rc, 0.92); for (let k = 1; k < 4; k++) { const yy = bodyTop - roofH * k / 4, e = ins * (1 - k / 4); ctx.fillRect(L + e - 2, yy, W - 2 * e + 4, 1); }
    const nd = Math.max(1, obj.w - 3); for (let i = 0; i < nd; i++) dormerDraw(ctx, L + W * (i + 0.5) / nd, bodyTop - roofH * 0.34, rc, trim, cfg.glass);
    ctx.fillStyle = trim; ctx.fillRect(L + ins, apexY - 1, W - 2 * ins, 1); for (let cx = L + ins; cx < R - ins; cx += 3) ctx.fillRect(cx, apexY - 2, 1, 2);
  } else if (rt === 'hip') {
    const ins = W * 0.24;
    ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 3, bodyTop], [L + ins, apexY], [R - ins, apexY], [R + 3, bodyTop]]);
    ctx.fillStyle = rc; fillPoly(ctx, [[L - 1, bodyTop], [L + ins, apexY], [R - ins, apexY], [R + 1, bodyTop]]);
    ctx.fillStyle = shade(rc, 0.8); fillPoly(ctx, [[mid, apexY], [R - ins, apexY], [R + 1, bodyTop], [mid, bodyTop]]);
    ctx.fillStyle = shade(rc, 0.92); for (let k = 1; k < 3; k++) { const yy = bodyTop - roofH * k / 3, e = ins * (1 - k / 3); ctx.fillRect(L + e, yy, W - 2 * e, 1); }
    ctx.fillStyle = trim; ctx.fillRect(L + ins, apexY - 1, W - 2 * ins, 1); for (let cx = L + ins; cx < R - ins; cx += 3) ctx.fillRect(cx, apexY - 3, 1, 3);
    ctx.fillRect(L + ins - 1, apexY - 4, 2, 4); ctx.fillRect(R - ins - 1, apexY - 4, 2, 4);
  } else {
    ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 3, bodyTop], [mid, apexY - 2], [R + 3, bodyTop]]);
    ctx.fillStyle = rc; fillPoly(ctx, [[L - 1, bodyTop], [mid, apexY], [R + 1, bodyTop]]);
    ctx.fillStyle = shade(rc, 0.8); fillPoly(ctx, [[mid, apexY], [R + 1, bodyTop], [mid, bodyTop]]);
    ctx.fillStyle = shade(rc, 0.92); for (let k = 1; k < 3; k++) { const yy = apexY + (bodyTop - apexY) * k / 3, hf = (W / 2 + 3) * k / 3; ctx.fillRect(mid - hf, yy, hf * 2, 1); }
    ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(mid, bodyTop - roofH * 0.4, 3, 0, 7); ctx.fill(); ctx.fillStyle = cfg.glass; ctx.beginPath(); ctx.arc(mid, bodyTop - roofH * 0.4, 2, 0, 7); ctx.fill();
    if (cfg.ginger) { ctx.fillStyle = trim; for (let gx = L - 2; gx < R + 2; gx += 4) fillPoly(ctx, [[gx, bodyTop], [gx + 4, bodyTop], [gx + 2, bodyTop + 2]]); }
    ctx.fillStyle = trim; ctx.fillRect(mid - 0.5, apexY - 4, 1, 4); ctx.beginPath(); ctx.arc(mid, apexY - 4, 1.5, 0, 7); ctx.fill();
  }
  for (let i = 0; i < (cfg.chimney || 0); i++) chimneyDraw(ctx, L + W * (i + 1) / ((cfg.chimney) + 1) - 2, apexY - U * 0.6, roofH + U * 0.6, shade(rc, 1.2));
  if (cfg.urns) for (const ux of [L + 3, R - 7]) { ctx.fillStyle = trim; ctx.fillRect(ux, bodyTop - 6, 4, 6); ctx.beginPath(); ctx.arc(ux + 2, bodyTop - 7, 2.5, 0, 7); ctx.fill(); }
  if (cfg.cupola) { const cw = W * 0.22; ctx.fillStyle = OUTLINE; ctx.fillRect(mid - cw / 2 - 1, apexY - U - 1, cw + 2, U + 1); ctx.fillStyle = cfg.wall; ctx.fillRect(mid - cw / 2, apexY - U, cw, U); ctx.fillStyle = cfg.glass; ctx.fillRect(mid - cw / 2 + 1, apexY - U + 2, cw - 2, U - 4); ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(mid, apexY - U, cw / 2, Math.PI, 0); ctx.fill(); ctx.fillStyle = OUTLINE; ctx.fillRect(mid - 0.5, apexY - U - 4, 1, 4); }
}

function drawBody(ctx, obj, cfg, L, R, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, dcx = L + obj.door * U + U / 2;
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 1, bodyTop - 1, W + 2, bh + 1);
  matFill(ctx, cfg.mat, L, bodyTop, W, bh, cfg.wall, cfg.trim);
  ctx.fillStyle = shade(cfg.wall, 0.56); ctx.fillRect(L, sh - 3, W, 3);
  ctx.fillStyle = shade(cfg.trim, 0.85); ctx.fillRect(L, bodyTop + (bh * 0.5 | 0), W, 1);
  ctx.fillStyle = shade(cfg.trim, 0.9); for (let i = 0; i * 6 < bh; i++) if (i & 1) { ctx.fillRect(L, bodyTop + 2 + i * 6, 2, 4); ctx.fillRect(R - 2, bodyTop + 2 + i * 6, 2, 4); }
  if (cfg.cornice) { ctx.fillStyle = cfg.trim; ctx.fillRect(L - 1, bodyTop - 1, W + 2, 2); }
  const cols = Math.max(1, obj.w - 2), rows = Math.max(1, obj.h - 2), ww = 6, gx0 = (W - cols * ww) / (cols + 1);
  for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
    const wx = L + gx0 + a * (ww + gx0), wy = bodyTop + 7 + b * ((bh - 15) / Math.max(1, rows));
    if (b === rows - 1 && Math.abs(wx + ww / 2 - dcx) < U) continue;
    if (cfg.shopfront && b === rows - 1) continue;
    const t = cfg.win === 'tall' ? 'sash' : cfg.win === 'bay' ? 'sash' : cfg.win;
    winDraw(ctx, t, wx, wy, ww, cfg.win === 'tall' ? 11 : 8, cfg.trim, cfg.glass);
  }
  if (cfg.awning) { const ay = bodyTop + (bh * 0.5 | 0) + 2; for (let i = 0; i * 4 < W; i++) { ctx.fillStyle = i & 1 ? shade(cfg.trim, 1.05) : '#c94f4f'; fillPoly(ctx, [[L + i * 4, ay], [L + i * 4 + 4, ay], [L + i * 4 + 2, ay + 4]]); } }
  if (cfg.shopfront) { ctx.fillStyle = OUTLINE; ctx.fillRect(L + 3, sh - U - 1, W - 6, U); ctx.fillStyle = cfg.glass; ctx.fillRect(L + 4, sh - U, W - 8, U - 3); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(L + 4, sh - U, W - 8, 2); for (let sx = L + 4; sx < R - 4; sx += 6) { ctx.fillStyle = shade(cfg.trim, 0.7); ctx.fillRect(sx, sh - U, 1, U - 3); } }
  drawDoor(ctx, dcx, sh - 1, U * 0.9, U * 1.5, cfg.trim);
  ctx.fillStyle = shade(cfg.wall, 0.72); ctx.fillRect(dcx - U * 0.8, sh - 2, U * 1.6, 2);
  if (cfg.win === 'bay') drawBay(ctx, dcx > L + W / 2 ? L + W * 0.28 : R - W * 0.28, sh - 2, U * 1.3, U * 1.05, cfg.trim, cfg.glass, cfg.roof);
  if (cfg.sign) { const sx = L + W * 0.72; ctx.fillStyle = cfg.trim; ctx.fillRect(sx, bodyTop + 5, 10, 1); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(sx + 6, bodyTop + 6, 8, 6); ctx.fillStyle = cfg.glass; ctx.fillRect(sx + 7, bodyTop + 7, 6, 4); }
}

function towerDraw(ctx, x, w, topY, sh, cfg, roofc, gold, glass, flag) {
  ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1, topY - 1, w + 2, sh - topY + 1);
  matFill(ctx, cfg.mat, x, topY, w, sh - topY, cfg.wall, gold);
  const sH = w * 1.5, cx = x + w / 2;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[x - 2, topY], [cx, topY - sH - 1], [x + w + 2, topY]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[x - 1, topY], [cx, topY - sH], [x + w + 1, topY]]);
  ctx.fillStyle = shade(roofc, 0.78); fillPoly(ctx, [[cx, topY - sH], [x + w + 1, topY], [cx, topY]]);
  ctx.fillStyle = gold; ctx.fillRect(x - 1, topY, w + 2, 1);
  ctx.strokeStyle = shade(gold, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, topY - sH); ctx.lineTo(cx, topY - sH - 7); ctx.stroke();
  ctx.fillStyle = flag; fillPoly(ctx, [[cx, topY - sH - 7], [cx + 7, topY - sH - 5], [cx, topY - sH - 3]]);
  for (let i = 0; i < 3; i++) winDraw(ctx, 'arch', cx - 2.5, topY + 5 + i * 8, 5, 6, gold, glass);
}

function drawGrand(ctx, obj, cfg, L, R, mid, bodyTop, sh, towerH, roofH) {
  const royal = cfg.grand === 'royal', W = R - L, bh = sh - bodyTop, tw = Math.max(U * 1.6, W * 0.16);
  const gold = cfg.trim, rc = cfg.roof, glass = cfg.glass, flag = royal ? '#e0566f' : '#57cfe0';
  ctx.fillStyle = OUTLINE; ctx.fillRect(L + tw - 1, bodyTop - 1, W - 2 * tw + 2, bh + 1);
  matFill(ctx, cfg.mat, L + tw, bodyTop, W - 2 * tw, bh, cfg.wall, gold);
  ctx.fillStyle = gold; ctx.fillRect(L + tw, bodyTop + 3, W - 2 * tw, 1); ctx.fillRect(L + tw, sh - 5, W - 2 * tw, 1);
  const nwin = Math.max(2, obj.w - 6), wrows = Math.max(1, obj.h - 3);
  for (let r = 0; r < wrows; r++) for (let i = 0; i < nwin; i++) { const gx = L + tw + (W - 2 * tw) * (i + 0.5) / nwin - 3, gy = bodyTop + 6 + r * ((bh - 15) / wrows); winDraw(ctx, royal ? 'arch' : 'lancet', gx, gy, 6, 9, gold, glass); }
  // grand block + dome
  const cbw = Math.max(U * 2.2, W * 0.34), cbTop = bodyTop - roofH;
  ctx.fillStyle = OUTLINE; ctx.fillRect(mid - cbw / 2 - 1, cbTop - 1, cbw + 2, bodyTop - cbTop + 1);
  matFill(ctx, cfg.mat, mid - cbw / 2, cbTop, cbw, bodyTop - cbTop, cfg.wall, gold);
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(mid, cbTop + cbw * 0.32, cbw * 0.17, 0, 7); ctx.fill(); ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(mid, cbTop + cbw * 0.32, cbw * 0.13, 0, 7); ctx.fill();
  ctx.fillStyle = shade(gold, 0.7); ctx.fillRect(mid - cbw * 0.13, cbTop + cbw * 0.32 - 0.5, cbw * 0.26, 1); ctx.fillRect(mid - 0.5, cbTop + cbw * 0.32 - cbw * 0.13, 1, cbw * 0.26);
  ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(mid, cbTop, cbw / 2 + 1, U * 0.95 + 1, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = gold; ctx.beginPath(); ctx.ellipse(mid, cbTop, cbw / 2, U * 0.95, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = shade(gold, 0.78); ctx.beginPath(); ctx.ellipse(mid, cbTop, cbw / 2, U * 0.95, 0, Math.PI * 0.5, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(mid - cbw * 0.16, cbTop - U * 0.3, cbw * 0.08, U * 0.3, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = shade(gold, 0.7); ctx.lineWidth = 1; const dt = cbTop - U * 0.95; ctx.beginPath(); ctx.moveTo(mid, dt); ctx.lineTo(mid, dt - 9); ctx.stroke();
  ctx.fillStyle = flag; fillPoly(ctx, [[mid, dt - 9], [mid + 9, dt - 6], [mid, dt - 3]]);
  towerDraw(ctx, L, tw, bodyTop - U * 0.5, sh, cfg, rc, gold, glass, flag);
  towerDraw(ctx, R - tw, tw, bodyTop - U * 0.5, sh, cfg, rc, gold, glass, flag);
  for (const bx of [mid - cbw / 2 - 4, mid + cbw / 2]) { const bhh = bh * 0.4; ctx.fillStyle = royal ? '#9a2f4a' : '#2f3f9a'; ctx.fillRect(bx, bodyTop + 4, 4, bhh); ctx.fillStyle = gold; ctx.fillRect(bx + 1, bodyTop + 4 + bhh * 0.4, 2, 2); ctx.fillStyle = royal ? '#9a2f4a' : '#2f3f9a'; fillPoly(ctx, [[bx, bodyTop + 4 + bhh], [bx + 2, bodyTop + 4 + bhh + 3], [bx + 4, bodyTop + 4 + bhh]]); }
  // portico door
  const dw = Math.max(U, W * 0.13);
  ctx.fillStyle = gold; fillPoly(ctx, [[mid - dw / 2 - 4, sh - U * 1.9], [mid, sh - U * 1.9 - 6], [mid + dw / 2 + 4, sh - U * 1.9]]);
  drawDoor(ctx, mid, sh - 1, dw, U * 1.7, gold);
  ctx.fillStyle = shade(cfg.wall, 1.12); ctx.fillRect(mid - dw / 2 - 3, sh - U * 1.9, 2, U * 1.9); ctx.fillRect(mid + dw / 2 + 1, sh - U * 1.9, 2, U * 1.9);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = shade(cfg.wall, 0.85 - i * 0.06); ctx.fillRect(mid - dw / 2 - 4 - i * 3, sh - 2 + i, dw + 8 + i * 6, 2); }
}

function pinnacle(ctx, x, baseY, roofc, gold) {
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[x - 2.5, baseY], [x, baseY - 9], [x + 2.5, baseY]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[x - 2, baseY], [x, baseY - 8], [x + 2, baseY]]);
  ctx.fillStyle = gold; ctx.fillRect(x - 0.5, baseY - 11, 1, 3);
}
function ironCrest(ctx, x0, x1, y, trim) {
  ctx.fillStyle = trim; ctx.fillRect(x0, y - 1, x1 - x0, 1);
  for (let x = x0 + 1; x < x1; x += 3) { ctx.fillRect(x, y - 3, 1, 2); }
}
function mansardRoof(ctx, L, R, topY, baseY, roofc, trim, glass) {
  const W = R - L, ins = W * 0.16, mid = (L + R) / 2;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 2, baseY], [L + ins, topY], [R - ins, topY], [R + 2, baseY]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[L, baseY], [L + ins, topY], [R - ins, topY], [R, baseY]]);
  ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[mid, topY], [R - ins, topY], [R, baseY], [mid, baseY]]);
  ctx.fillStyle = shade(roofc, 0.9); for (let k = 1; k < 4; k++) { const yy = baseY - (baseY - topY) * k / 4, e = ins * (1 - k / 4); ctx.fillRect(L + e - 1, yy, W - 2 * e + 2, 1); }
  for (let i = 0; i < 2; i++) dormerDraw(ctx, L + W * (i + 0.5) / 2, baseY - (baseY - topY) * 0.42, roofc, trim, glass);
  ironCrest(ctx, L + ins, R - ins, topY, trim);
  ctx.fillStyle = trim; ctx.fillRect(mid - 0.5, topY - 6, 1, 6); ctx.beginPath(); ctx.arc(mid, topY - 6, 1.5, 0, 7); ctx.fill();
}
function turret(ctx, x, w, topY, sh, stone, roofc, trim, glass, jewel, flag) {
  ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1, topY - 1, w + 2, sh - topY + 1);
  matFill(ctx, 'stone', x, topY, w, sh - topY, stone, trim);
  ctx.fillStyle = shade(trim, 0.8); for (let yy = topY + U; yy < sh - 3; yy += U) ctx.fillRect(x, yy, w, 1);
  for (let i = 0; i < 3; i++) winDraw(ctx, 'arch', x + w / 2 - 2.5, topY + 5 + i * 8, 5, 6, trim, jewel[i % jewel.length]);
  ctx.fillStyle = trim; ctx.fillRect(x - 1, topY - 1, w + 2, 2);
  const sH = w * 1.7, cx = x + w / 2;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[x - 2, topY], [cx, topY - sH - 1], [x + w + 2, topY]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[x - 1, topY], [cx, topY - sH], [x + w + 1, topY]]);
  ctx.fillStyle = shade(roofc, 0.78); fillPoly(ctx, [[cx, topY - sH], [x + w + 1, topY], [cx, topY]]);
  ctx.fillStyle = shade(roofc, 0.9); for (let k = 1; k < 4; k++) { const yy = topY - sH * k / 4, hf = (w / 2) * (1 - k / 4) + 1; ctx.fillRect(cx - hf, yy, hf * 2, 1); }
  ctx.strokeStyle = shade(trim, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, topY - sH); ctx.lineTo(cx, topY - sH - 8); ctx.stroke();
  ctx.fillStyle = flag; fillPoly(ctx, [[cx, topY - sH - 8], [cx + 7, topY - sH - 6], [cx, topY - sH - 4]]);
}

// Bespoke Victorian palace: cream stone, burgundy mansard + pointed turrets,
// rose window, arched windows, wrought-iron cresting, portico entrance.
function drawPalace(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, stone = cfg.wall, roofc = cfg.roof, trim = cfg.trim, glass = cfg.glass;
  const jewel = ['#7a3a44', '#3f6270', '#9a7a44', '#4a5a72', '#5a4a6a'];
  const flag = '#8a3a48', tw = Math.max(U * 1.7, W * 0.14);

  // central body wall (between towers)
  ctx.fillStyle = OUTLINE; ctx.fillRect(L + tw - 1, bodyTop - 1, W - 2 * tw + 2, bh + 1);
  matFill(ctx, 'stone', L + tw, bodyTop, W - 2 * tw, bh, stone, trim);
  ctx.fillStyle = shade(trim, 0.85); for (let yy = bodyTop + U; yy < sh - 4; yy += U) ctx.fillRect(L + tw, yy, W - 2 * tw, 1);
  const nwin = Math.max(3, obj.w - 5), wrows = Math.max(2, obj.h - 3);
  for (let r = 0; r < wrows; r++) for (let i = 0; i < nwin; i++) { const gx = L + tw + (W - 2 * tw) * (i + 0.5) / nwin - 3, gy = bodyTop + 7 + r * ((bh - 16) / wrows); winDraw(ctx, 'arch', gx, gy, 6, 9, trim, jewel[(i + r) % jewel.length]); }
  ctx.fillStyle = trim; ctx.fillRect(L + tw - 2, bodyTop - 1, W - 2 * tw + 4, 2);   // cornice

  // central raised block (tallest) + rose window + mansard roof
  const cbw = Math.max(U * 2.6, W * 0.36), cbTop = bodyTop - U * 2.2;
  ctx.fillStyle = OUTLINE; ctx.fillRect(mid - cbw / 2 - 1, cbTop - 1, cbw + 2, bodyTop - cbTop + 1);
  matFill(ctx, 'stone', mid - cbw / 2, cbTop, cbw, bodyTop - cbTop, stone, trim);
  ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(mid, cbTop + U * 0.8, cbw * 0.17, 0, 7); ctx.fill();
  ctx.fillStyle = jewel[1]; ctx.beginPath(); ctx.arc(mid, cbTop + U * 0.8, cbw * 0.13, 0, 7); ctx.fill();
  ctx.strokeStyle = shade(trim, 0.7); ctx.lineWidth = 1;
  for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3; ctx.beginPath(); ctx.moveTo(mid, cbTop + U * 0.8); ctx.lineTo(mid + Math.cos(ang) * cbw * 0.13, cbTop + U * 0.8 + Math.sin(ang) * cbw * 0.13); ctx.stroke(); }
  mansardRoof(ctx, mid - cbw / 2, mid + cbw / 2, cbTop - U * 1.6, cbTop, roofc, trim, glass);

  // pointed corner turrets
  turret(ctx, L, tw, bodyTop - U * 0.6, sh, stone, roofc, trim, glass, jewel, flag);
  turret(ctx, R - tw, tw, bodyTop - U * 0.6, sh, stone, roofc, trim, glass, jewel, flag);
  // extra pinnacles for a multi-spired roofline
  for (const px of [mid - cbw / 2, mid + cbw / 2, mid - cbw * 0.2, mid + cbw * 0.2]) pinnacle(ctx, px, cbTop, roofc, trim);
  // wrought-iron cresting along the body eaves
  ironCrest(ctx, L + tw, mid - cbw / 2, bodyTop, trim); ironCrest(ctx, mid + cbw / 2, R - tw, bodyTop, trim);

  // banners
  for (const bx of [mid - cbw / 2 - 4, mid + cbw / 2]) { const bhh = bh * 0.42; ctx.fillStyle = '#7a3340'; ctx.fillRect(bx, bodyTop + 4, 4, bhh); ctx.fillStyle = trim; ctx.fillRect(bx + 1, bodyTop + 4 + bhh * 0.45, 2, 2); ctx.fillStyle = '#7a3340'; fillPoly(ctx, [[bx, bodyTop + 4 + bhh], [bx + 2, bodyTop + 4 + bhh + 3], [bx + 4, bodyTop + 4 + bhh]]); }

  // grand portico entrance: pediment, columns, arched door, steps
  const dw = Math.max(U, W * 0.12);
  ctx.fillStyle = trim; fillPoly(ctx, [[mid - dw / 2 - 5, sh - U * 2], [mid, sh - U * 2 - 7], [mid + dw / 2 + 5, sh - U * 2]]);
  ctx.fillStyle = shade(trim, 0.8); ctx.fillRect(mid - dw / 2 - 5, sh - U * 2, dw + 10, 2);
  for (const colx of [mid - dw / 2 - 4, mid + dw / 2 + 2]) { ctx.fillStyle = shade(stone, 1.12); ctx.fillRect(colx, sh - U * 2, 2, U * 2); ctx.fillStyle = shade(stone, 0.68); ctx.fillRect(colx + 2, sh - U * 2, 1, U * 2); }
  drawDoor(ctx, mid, sh - 1, dw, U * 1.7, trim);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = shade(stone, 0.85 - i * 0.06); ctx.fillRect(mid - dw / 2 - 6 - i * 3, sh - 2 + i, dw + 12 + i * 6, 2); }
}

// ---- prettiness helpers ----
function litArch(ctx, x, y, ww, wh, trim, lit) {
  if (lit) { ctx.fillStyle = 'rgba(242,207,136,0.22)'; ctx.fillRect(x - 2, y - 1, ww + 4, wh + 3); }
  winDraw(ctx, 'arch', x, y, ww, wh, trim, lit ? '#f2cf88' : '#454158');
}
function leadWin(ctx, x, y, w, h, frame, lit) {
  ctx.fillStyle = shade(frame, 0.7); ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = lit ? '#f2cf88' : '#51616e'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(40,30,20,0.5)'; ctx.lineWidth = 0.5; ctx.beginPath();
  for (let d = -h; d < w; d += 3) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.moveTo(x + d, y); ctx.lineTo(x + d + h, y + h); } ctx.stroke();
}
function flowerBox(ctx, x, y, w) {
  ctx.fillStyle = '#4a3020'; ctx.fillRect(x, y, w, 2);
  const cols = ['#c85a7a', '#d9c44a', '#7a5ad0', '#e08a4a']; for (let i = 0; i < w; i += 2) { ctx.fillStyle = cols[(i >> 1) % 4]; ctx.fillRect(x + i, y - 1, 1, 1); }
}
function smoke(ctx, x, y) { ctx.fillStyle = 'rgba(210,210,218,0.4)'; ctx.beginPath(); ctx.arc(x, y - 2, 1.6, 0, 7); ctx.arc(x + 2, y - 5, 2, 0, 7); ctx.arc(x - 1, y - 8, 1.8, 0, 7); ctx.arc(x + 2, y - 11, 1.4, 0, 7); ctx.fill(); }

// Cozy café: brick, asymmetric corner turret, warm-lit storefront + awning,
// flower boxes, gingerbread gable, smoking chimney, hanging sign.
function drawCafe(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const brick = cfg.wall, roofc = cfg.roof, trim = cfg.trim, tw = U * 1.5, bx = L + tw * 0.7, bh = sh - bodyTop, cx = (bx + R) / 2;
  ctx.fillStyle = OUTLINE; ctx.fillRect(bx - 1, bodyTop - 1, R - bx + 1, bh + 1);
  matFill(ctx, 'brick', bx, bodyTop, R - bx, bh, brick, trim);
  const cols = Math.max(2, obj.w - 2);
  for (let i = 0; i < cols; i++) { const wx = bx + (R - bx) * (i + 0.5) / cols - 3; if (wx < bx + 2 || wx > R - 8) continue; litArch(ctx, wx, bodyTop + 7, 6, 7, trim, ((i * 5) % 3) !== 0); flowerBox(ctx, wx - 1, bodyTop + 15, 8); }
  const gy = sh - Math.round(U * 1.4), pn = Math.max(3, obj.w - 1), pw = (R - bx - 6) / pn;
  ctx.fillStyle = OUTLINE; ctx.fillRect(bx + 1, gy - 1, R - bx - 2, sh - gy);
  for (let i = 0; i < pn; i++) { const px = bx + 3 + i * pw; ctx.fillStyle = '#f2cf88'; ctx.fillRect(px, gy + 1, pw - 1, sh - gy - 4); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px, gy + 1, pw - 1, 2); ctx.fillStyle = shade(trim, 0.7); ctx.fillRect(px - 1, gy + 1, 1, sh - gy - 4); }
  drawDoor(ctx, R - U * 1.1, sh - 1, U * 0.85, U * 1.35, trim);
  const ay = gy - 2; for (let i = 0; i * 4 < (R - bx - 2); i++) { ctx.fillStyle = i & 1 ? '#8a3a3a' : '#e8d3a0'; fillPoly(ctx, [[bx + 1 + i * 4, ay], [bx + 1 + i * 4 + 4, ay], [bx + 1 + i * 4 + 2, ay + 4]]); }
  ctx.fillStyle = '#5a2f2f'; ctx.fillRect(bx + 1, ay - 1, R - bx - 2, 1);
  const sg = bx + 4; ctx.fillStyle = trim; ctx.fillRect(sg, bodyTop + 3, 1, 7); ctx.fillRect(sg, bodyTop + 3, 7, 1); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(sg + 4, bodyTop + 9, 7, 6); ctx.fillStyle = '#e8d3a0'; ctx.fillRect(sg + 5, bodyTop + 10, 5, 4);
  const apexY = bodyTop - U * 1.7;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[bx - 3, bodyTop], [cx, apexY - 2], [R + 3, bodyTop]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[bx - 1, bodyTop], [cx, apexY], [R + 1, bodyTop]]);
  ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[cx, apexY], [R + 1, bodyTop], [cx, bodyTop]]);
  ctx.fillStyle = shade(roofc, 0.92); for (let k = 1; k < 3; k++) { const yy = apexY + (bodyTop - apexY) * k / 3, hf = ((R - bx) / 2 + 3) * k / 3; ctx.fillRect(cx - hf, yy, hf * 2, 1); }
  ctx.fillStyle = trim; for (let gx = bx - 2; gx < R + 2; gx += 4) fillPoly(ctx, [[gx, bodyTop], [gx + 4, bodyTop], [gx + 2, bodyTop + 2]]);
  ctx.fillStyle = trim; ctx.fillRect(cx - 0.5, apexY - 4, 1, 4); ctx.beginPath(); ctx.arc(cx, apexY - 4, 1.5, 0, 7); ctx.fill();
  chimneyDraw(ctx, R - U * 1.4, apexY - U * 0.4, U * 1.6, shade(brick, 1.1)); smoke(ctx, R - U * 1.4 + 2, apexY - U * 0.4);
  const ttop = bodyTop - U, tcx = L + tw / 2;
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 1, ttop - 1, tw + 2, sh - ttop + 1);
  matFill(ctx, 'brick', L, ttop, tw, sh - ttop, brick, trim);
  litArch(ctx, tcx - 2.5, ttop + 4, 5, 7, trim, true); litArch(ctx, tcx - 2.5, ttop + 14, 5, 7, trim, false);
  const sH = tw * 1.3; ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 2, ttop], [tcx, ttop - sH - 1], [L + tw + 2, ttop]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[L - 1, ttop], [tcx, ttop - sH], [L + tw + 1, ttop]]);
  ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[tcx, ttop - sH], [L + tw + 1, ttop], [tcx, ttop]]);
  ctx.fillStyle = trim; ctx.fillRect(tcx - 0.5, ttop - sH - 4, 1, 4);
}

// Classical library: colonnade + full pediment + rooftop cupola (temple form).
function drawLibrary(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, stone = cfg.wall, roofc = cfg.roof, trim = cfg.trim, nc = Math.max(4, obj.w);
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 1, bodyTop - 1, W + 2, bh + 1);
  matFill(ctx, 'stone', L, bodyTop, W, bh, stone, trim);
  for (let i = 0; i < nc; i++) { const wx = L + 2 + (W - 4) * (i + 0.5) / nc - 2; litArch(ctx, wx, bodyTop + 7, 4, bh - 14, trim, i % 2 === 0); }
  for (let i = 0; i <= nc; i++) { const c = L + 2 + (W - 4) * i / nc; ctx.fillStyle = shade(stone, 1.12); ctx.fillRect(c - 1, bodyTop + 3, 2, bh - 4); ctx.fillStyle = shade(stone, 0.68); ctx.fillRect(c + 1, bodyTop + 3, 1, bh - 4); ctx.fillStyle = trim; ctx.fillRect(c - 1.5, bodyTop + 3, 3, 1); ctx.fillRect(c - 1.5, sh - 4, 3, 1); }
  drawDoor(ctx, mid, sh - 1, U * 1.1, U * 1.6, trim);
  ctx.fillStyle = trim; ctx.fillRect(L - 1, bodyTop - 1, W + 2, 2); ctx.fillStyle = shade(stone, 1.05); ctx.fillRect(L - 2, bodyTop - 3, W + 4, 2);
  const apexY = bodyTop - U * 1.4;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 4, bodyTop - 2], [mid, apexY - 2], [R + 4, bodyTop - 2]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[L - 3, bodyTop - 3], [mid, apexY], [R + 3, bodyTop - 3]]);
  ctx.fillStyle = shade(roofc, 0.82); fillPoly(ctx, [[mid, apexY], [R + 3, bodyTop - 3], [mid, bodyTop - 3]]);
  ctx.fillStyle = stone; fillPoly(ctx, [[L + U * 0.8, bodyTop - 4], [mid, apexY + U * 0.5], [R - U * 0.8, bodyTop - 4]]);
  ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(mid, bodyTop - U * 0.4, U * 0.32, 0, 7); ctx.fill(); ctx.fillStyle = cfg.glass; ctx.beginPath(); ctx.arc(mid, bodyTop - U * 0.4, U * 0.25, 0, 7); ctx.fill();
  ctx.fillStyle = trim; for (let dx = L - 3; dx < R + 3; dx += 3) ctx.fillRect(dx, bodyTop - 3, 1, 1);
  const dw = U * 1.5; ctx.fillStyle = OUTLINE; ctx.fillRect(mid - dw / 2 - 1, apexY - U * 0.9 - 1, dw + 2, U * 0.9 + 1); ctx.fillStyle = stone; ctx.fillRect(mid - dw / 2, apexY - U * 0.9, dw, U * 0.9);
  ctx.fillStyle = roofc; ctx.beginPath(); ctx.ellipse(mid, apexY - U * 0.9, dw / 2, U * 0.7, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = shade(roofc, 0.78); ctx.beginPath(); ctx.ellipse(mid, apexY - U * 0.9, dw / 2, U * 0.7, 0, Math.PI * 0.5, 0); ctx.fill();
  ctx.fillStyle = trim; ctx.fillRect(mid - 0.5, apexY - U * 0.9 - U * 0.7 - 4, 1, 4); ctx.beginPath(); ctx.arc(mid, apexY - U * 0.9 - U * 0.7 - 4, 1.4, 0, 7); ctx.fill();
}

// Tudor inn: jettied (overhanging) half-timber floors, leaded diamond panes,
// asymmetric cross-gable, big smoking chimney, hanging bracket sign.
function drawInn(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, roofc = cfg.roof, plaster = cfg.wall, beam = cfg.trim;
  const floors = Math.max(2, Math.min(3, obj.h - 2)), j = 3, fh = bh / floors;
  for (let f = 0; f < floors; f++) {
    const inset = (floors - 1 - f) * j, fx = L + inset, fw = W - 2 * inset, fy = sh - (f + 1) * fh;
    ctx.fillStyle = OUTLINE; ctx.fillRect(fx - 1, fy - 1, fw + 2, fh + (f > 0 ? 2 : 1));
    matFill(ctx, 'timber', fx, fy, fw, fh, plaster, beam);
    if (f > 0) { ctx.fillStyle = beam; ctx.fillRect(fx, fy + fh - 2, fw, 2); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(fx, fy + fh, fw, 1); }
    const cols = Math.max(2, obj.w - 2); for (let i = 0; i < cols; i++) { const wx = fx + fw * (i + 0.5) / cols - 3; leadWin(ctx, wx, fy + 4, 6, 7, beam, (i + f) % 2 === 0); }
  }
  const gInset = (floors - 1) * j;
  drawDoor(ctx, Math.max(L + gInset + U, Math.min(R - gInset - U * 0.6, L + obj.door * U + U / 2)), sh - 1, U * 0.85, U * 1.3, beam);
  const apexY = bodyTop - U * 2;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 3, bodyTop], [mid, apexY - 2], [R + 3, bodyTop]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[L - 1, bodyTop], [mid, apexY], [R + 1, bodyTop]]);
  ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[mid, apexY], [R + 1, bodyTop], [mid, bodyTop]]);
  ctx.fillStyle = shade(roofc, 0.92); for (let k = 1; k < 3; k++) { const yy = apexY + (bodyTop - apexY) * k / 3, hf = (W / 2 + 3) * k / 3; ctx.fillRect(mid - hf, yy, hf * 2, 1); }
  const cgx = L + W * 0.32, cgY = bodyTop + 2, cgA = cgY - U * 1.5;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[cgx - U * 0.9, cgY], [cgx, cgA - 1], [cgx + U * 0.9, cgY]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[cgx - U * 0.8, cgY], [cgx, cgA], [cgx + U * 0.8, cgY]]);
  ctx.fillStyle = plaster; fillPoly(ctx, [[cgx - U * 0.5, cgY], [cgx, cgA + U * 0.4], [cgx + U * 0.5, cgY]]);
  ctx.fillStyle = beam; ctx.fillRect(cgx - U * 0.5, cgY - 1, U, 1); ctx.fillRect(cgx - 0.5, cgA + U * 0.4, 1, cgY - (cgA + U * 0.4));
  leadWin(ctx, cgx - 2, cgY - U * 0.7, 4, 5, beam, true);
  ctx.fillStyle = beam; ctx.fillRect(cgx - 0.5, cgA - 3, 1, 3); ctx.fillRect(mid - 0.5, apexY - 4, 1, 4);
  chimneyDraw(ctx, R - U * 1.7, apexY - U * 0.3, U * 1.9, '#7a5a4a'); smoke(ctx, R - U * 1.7 + 2, apexY - U * 0.3);
  const sgx = R - U * 1.2, sgy = bodyTop + U; ctx.fillStyle = beam; ctx.fillRect(sgx - 8, sgy, 8, 1); ctx.fillRect(sgx - 8, sgy, 1, 4); ctx.fillStyle = '#4a3020'; ctx.fillRect(sgx - 7, sgy + 4, 6, 5); ctx.fillStyle = cfg.glass; ctx.fillRect(sgx - 6, sgy + 5, 4, 3);
}

// Gothic collegiate academy: central clock tower with spire + battlements,
// symmetric gabled wings with dormers, lancet windows, buttresses.
function drawAcademy(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, stone = cfg.wall, roofc = cfg.roof, trim = cfg.trim;
  const jewel = ['#5a6a8a', '#4a6a70', '#6a5a7a', '#7a6a4a'];
  const ctw = Math.max(U * 2.6, W * 0.24), cL = mid - ctw / 2, cR = mid + ctw / 2;

  const wing = (x0, x1) => {
    const w = x1 - x0, wc = (x0 + x1) / 2, nb = Math.max(2, Math.round(w / U) - 1), rows = Math.max(1, obj.h - 3);
    ctx.fillStyle = OUTLINE; ctx.fillRect(x0 - 1, bodyTop - 1, w + 2, bh + 1);
    matFill(ctx, 'stone', x0, bodyTop, w, bh, stone, trim);
    for (let c = 0; c < nb; c++) for (let r = 0; r < rows; r++) { const wx = x0 + w * (c + 0.5) / nb - 2.5, wy = bodyTop + 7 + r * ((bh - 16) / rows); winDraw(ctx, 'lancet', wx, wy, 5, 10, trim, (c + r) % 2 ? jewel[(c + r) % jewel.length] : '#f2cf88'); }
    for (let i = 0; i <= nb; i++) { const bx = x0 + w * i / nb; ctx.fillStyle = shade(stone, 0.84); ctx.fillRect(bx - 1, bodyTop + 2, 2, bh - 2); ctx.fillStyle = shade(stone, 1.08); ctx.fillRect(bx - 1, bodyTop + 2, 1, bh - 2); ctx.fillStyle = roofc; fillPoly(ctx, [[bx - 2, bodyTop + 2], [bx, bodyTop - 2], [bx + 2, bodyTop + 2]]); }
    const apexY = bodyTop - U * 1.6;
    ctx.fillStyle = OUTLINE; fillPoly(ctx, [[x0 - 2, bodyTop], [wc, apexY - 2], [x1 + 2, bodyTop]]);
    ctx.fillStyle = roofc; fillPoly(ctx, [[x0 - 1, bodyTop], [wc, apexY], [x1 + 1, bodyTop]]);
    ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[wc, apexY], [x1 + 1, bodyTop], [wc, bodyTop]]);
    ctx.fillStyle = shade(roofc, 0.92); for (let k = 1; k < 3; k++) { const yy = apexY + (bodyTop - apexY) * k / 3, hf = (w / 2 + 2) * k / 3; ctx.fillRect(wc - hf, yy, hf * 2, 1); }
    const nd = Math.max(1, Math.round(w / (U * 2.2))); for (let i = 0; i < nd; i++) dormerDraw(ctx, x0 + w * (i + 0.5) / nd, bodyTop - U * 0.5, roofc, trim, cfg.glass);
    ctx.fillStyle = trim; ctx.fillRect(wc - 0.5, apexY - 4, 1, 4);
  };
  wing(L, cL); wing(cR, R);

  const tTop = bodyTop - U * 2.6;
  ctx.fillStyle = OUTLINE; ctx.fillRect(cL - 1, tTop - 1, ctw + 2, sh - tTop + 1);
  matFill(ctx, 'stone', cL, tTop, ctw, sh - tTop, stone, trim);
  ctx.fillStyle = shade(trim, 0.85); for (let yy = tTop + U; yy < sh - 4; yy += U) ctx.fillRect(cL, yy, ctw, 1);
  const clkY = tTop + U * 0.95;
  ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(mid, clkY, ctw * 0.22, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.arc(mid, clkY, ctw * 0.18, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mid, clkY); ctx.lineTo(mid, clkY - ctw * 0.12); ctx.moveTo(mid, clkY); ctx.lineTo(mid + ctw * 0.09, clkY + ctw * 0.05); ctx.stroke();
  for (let i = 0; i < 2; i++) { const wx = cL + ctw * (i + 1) / 3 - 2.5; winDraw(ctx, 'lancet', wx, clkY + ctw * 0.3, 5, U * 1.2, trim, '#f2cf88'); }
  drawDoor(ctx, mid, sh - 1, U * 1.2, U * 1.8, trim);
  ctx.fillStyle = trim; ctx.fillRect(cL - 1, tTop - 1, ctw + 2, 2);
  ctx.fillStyle = stone; for (let bx = cL; bx < cR; bx += 4) ctx.fillRect(bx, tTop - 3, 2, 3);
  pinnacle(ctx, cL + 1, tTop, roofc, trim); pinnacle(ctx, cR - 1, tTop, roofc, trim);
  const sH = ctw * 0.9, y0 = tTop - 3;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[cL - 2, y0], [mid, y0 - sH - 1], [cR + 2, y0]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[cL - 1, y0], [mid, y0 - sH], [cR + 1, y0]]);
  ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[mid, y0 - sH], [cR + 1, y0], [mid, y0]]);
  ctx.fillStyle = shade(roofc, 0.92); for (let k = 1; k < 4; k++) { const yy = y0 - sH * k / 4, hf = (ctw / 2 + 1) * (1 - k / 4); ctx.fillRect(mid - hf, yy, hf * 2, 1); }
  ctx.strokeStyle = shade(trim, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mid, y0 - sH); ctx.lineTo(mid, y0 - sH - 9); ctx.stroke();
  ctx.fillStyle = '#57cfe0'; fillPoly(ctx, [[mid, y0 - sH - 9], [mid + 8, y0 - sH - 6], [mid, y0 - sH - 3]]);
}

const BESPOKE = { cafe: drawCafe, library: drawLibrary, inn: drawInn };

function buildVictorian(obj) {
  const cfg = VST[obj.style] || VST.house;
  const W = obj.w * U, bodyH = obj.h * U, PAD = 6, grand = !!cfg.grand, rt = cfg.roofType || 'gable';
  const roofH = grand ? Math.round(U * 2.6) : rt === 'gable' ? Math.round(U * 2.1) : rt === 'mansard' ? Math.round(U * 1.7) : Math.round(U * 1.4);
  const towerH = grand ? Math.round(U * 3.2) : 0;
  const topExtra = grand ? towerH + roofH + Math.round(U * 1.7) : Math.round(U * 4.4);
  const sw = W + PAD * 2, sh = bodyH + topExtra;
  const { c: sc, ctx } = makeCanvas(sw, sh);
  const L = PAD, R = PAD + W, mid = L + W / 2, bodyTop = sh - bodyH;
  if (cfg.grand === 'royal') drawPalace(ctx, obj, cfg, L, R, mid, bodyTop, sh);
  else if (obj.style === 'academy') drawAcademy(ctx, obj, cfg, L, R, mid, bodyTop, sh);
  else if (grand) drawGrand(ctx, obj, cfg, L, R, mid, bodyTop, sh, towerH, roofH);
  else if (BESPOKE[obj.style]) BESPOKE[obj.style](ctx, obj, cfg, L, R, mid, bodyTop, sh);
  else { drawBody(ctx, obj, cfg, L, R, bodyTop, sh); drawRoof(ctx, obj, cfg, L, R, mid, bodyTop, roofH); }
  const f = makeCanvas(sw * 2, sh * 2); f.ctx.imageSmoothingEnabled = false; f.ctx.drawImage(sc, 0, 0, sw * 2, sh * 2);
  return { canvas: f.c, ox: -PAD * 2, oy: 0 };
}

function normalBuilding(obj, s) {
  const PAD = 6, W = obj.w * TILE, bodyH = obj.h * TILE, roofH = Math.round(TILE * 1.9);
  const cw = W + PAD * 2, ch = bodyH + roofH;
  const { c, ctx } = makeCanvas(cw, ch);
  const L = PAD, R = PAD + W, mid = L + W / 2, bodyTop = ch - bodyH, apex = 5;
  // body outline + graded wall
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 2, bodyTop - 1, W + 4, bodyH + 1);
  const g = ctx.createLinearGradient(0, bodyTop, 0, ch);
  g.addColorStop(0, shade(s.wall, 1.08)); g.addColorStop(1, shade(s.wall, 0.82));
  ctx.fillStyle = g; ctx.fillRect(L, bodyTop, W, bodyH);
  ctx.fillStyle = shade(s.wall, 0.6); ctx.fillRect(L, ch - 6, W, 6);            // foundation
  ctx.fillStyle = shade(s.trim, 0.95);                                          // corner quoins
  for (let i = 0; i * 12 < bodyH; i++) if (i % 2) { const yy = bodyTop + 4 + i * 12; ctx.fillRect(L, yy, 5, 7); ctx.fillRect(R - 5, yy, 5, 7); }
  // windows (framed + sheen + sill)
  const cols = Math.max(1, obj.w - 2), rows = Math.max(1, obj.h - 2), gx = (W - cols * 14) / (cols + 1);
  for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
    const wx = L + gx + a * (14 + gx), wy = bodyTop + 13 + b * ((bodyH - 26) / Math.max(1, rows));
    ctx.fillStyle = shade(s.trim, 0.7); ctx.fillRect(wx - 2, wy - 2, 14, 17);
    ctx.fillStyle = s.win; ctx.fillRect(wx, wy, 10, 13);
    ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillRect(wx, wy, 10, 4);
    ctx.fillStyle = shade(s.trim, 0.6); ctx.fillRect(wx + 4, wy, 2, 13); ctx.fillRect(wx, wy + 6, 10, 1);
    ctx.fillStyle = shade(s.trim, 0.5); ctx.fillRect(wx - 2, wy + 15, 14, 2);
  }
  // awning for shops
  if (['cafe', 'shop', 'shop2', 'inn'].includes(obj.style)) {
    const ay = bodyTop + 3;
    for (let i = 0; i * 8 < W; i++) { ctx.fillStyle = i % 2 ? shade(s.trim, 1.05) : '#c9524a'; ctx.beginPath(); ctx.moveTo(L + i * 8, ay); ctx.lineTo(L + i * 8 + 8, ay); ctx.lineTo(L + i * 8 + 4, ay + 9); ctx.closePath(); ctx.fill(); }
  }
  // arched door + steps
  const dcx = L + obj.door * TILE + TILE / 2;
  ctx.fillStyle = shade(s.trim, 0.6); rr(ctx, dcx - 11, ch - TILE - 6, 22, TILE + 6, 10); ctx.fill();
  ctx.fillStyle = '#4a3020'; rr(ctx, dcx - 9, ch - TILE - 4, 18, TILE + 4, 8); ctx.fill();
  ctx.fillStyle = '#3a2616'; ctx.fillRect(dcx - 1, ch - TILE - 2, 2, TILE);
  ctx.fillStyle = shade(s.trim, 1.2); ctx.beginPath(); ctx.arc(dcx - 4, ch - 15, 1.5, 0, 7); ctx.fill();
  ctx.fillStyle = shade(s.wall, 0.72); ctx.fillRect(dcx - 14, ch - 3, 28, 3);
  // gable roof: outline, lit + shaded halves, tile lines, eave trim, finial
  ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(L - PAD, bodyTop + 2); ctx.lineTo(mid, apex - 2); ctx.lineTo(R + PAD, bodyTop + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = s.roof; ctx.beginPath(); ctx.moveTo(L - PAD + 2, bodyTop); ctx.lineTo(mid, apex); ctx.lineTo(R + PAD - 2, bodyTop); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(s.roof, 0.78); ctx.beginPath(); ctx.moveTo(mid, apex); ctx.lineTo(R + PAD - 2, bodyTop); ctx.lineTo(mid, bodyTop); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(s.roof, 0.66); ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) { const yy = apex + (bodyTop - apex) * k / 4, half = (W / 2 + PAD) * k / 4; ctx.beginPath(); ctx.moveTo(mid - half, yy); ctx.lineTo(mid + half, yy); ctx.stroke(); }
  ctx.fillStyle = s.trim; ctx.fillRect(L - PAD, bodyTop, W + PAD * 2, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(L, bodyTop + 3, W, 4);
  ctx.fillStyle = s.trim; ctx.fillRect(mid - 1, apex - 8, 2, 8); ctx.beginPath(); ctx.arc(mid, apex - 9, 2.5, 0, 7); ctx.fill();
  return { canvas: c, ox: -PAD, oy: 0 };
}

// Bespoke grand structure: two spired towers, central dome, banners, stained
// glass, grand staircase. theme 'royal' (palace) or 'magic' (academy).
function grandBuilding(obj, theme) {
  const PAD = 10, W = obj.w * TILE, bodyH = obj.h * TILE, towerH = Math.round(TILE * 3.4);
  const cw = W + PAD * 2, ch = bodyH + towerH + 6;
  const { c, ctx } = makeCanvas(cw, ch);
  const L = PAD, R = PAD + W, mid = L + W / 2, bodyTop = ch - bodyH;
  const royal = theme === 'royal';
  const wall = royal ? '#ece6d6' : '#7a6ca0', wallHi = shade(wall, 1.06), wallLo = shade(wall, 0.8);
  const roof = royal ? '#7a3f9a' : '#3f56a0', gold = '#ffd24a', goldLo = '#c99a3a';
  const flag = royal ? '#e05a7a' : '#5ad0e0';
  const glass = royal ? ['#e05a7a', '#5a9ae0', '#b06ae0', '#5ad08a'] : ['#5ad0e0', '#b06ae0', '#e0c95a', '#e05a8a'];
  const tw = Math.max(TILE * 1.7, W * 0.16);

  function spire(cx, baseY, halfW, hgt, withFlag) {
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(cx - halfW - 2, baseY + 2); ctx.lineTo(cx, baseY - hgt - 2); ctx.lineTo(cx + halfW + 2, baseY + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(cx - halfW, baseY); ctx.lineTo(cx, baseY - hgt); ctx.lineTo(cx + halfW, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(roof, 0.78); ctx.beginPath(); ctx.moveTo(cx, baseY - hgt); ctx.lineTo(cx + halfW, baseY); ctx.lineTo(cx, baseY); ctx.closePath(); ctx.fill();
    if (withFlag) {
      ctx.strokeStyle = goldLo; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, baseY - hgt); ctx.lineTo(cx, baseY - hgt - 13); ctx.stroke();
      ctx.fillStyle = flag; ctx.beginPath(); ctx.moveTo(cx, baseY - hgt - 13); ctx.lineTo(cx + 13, baseY - hgt - 9); ctx.lineTo(cx, baseY - hgt - 5); ctx.closePath(); ctx.fill();
    } else { ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(cx, baseY - hgt - 2, 2.5, 0, 7); ctx.fill(); }
  }
  function tower(tx) {
    const topY = bodyTop - TILE * 0.7;
    ctx.fillStyle = OUTLINE; ctx.fillRect(tx - 2, topY - 2, tw + 4, ch - topY);
    const g = ctx.createLinearGradient(tx, 0, tx + tw, 0); g.addColorStop(0, wallLo); g.addColorStop(0.5, wallHi); g.addColorStop(1, wallLo);
    ctx.fillStyle = g; ctx.fillRect(tx, topY, tw, ch - topY);
    spire(tx + tw / 2, topY, tw / 2 + 2, TILE * 1.5, true);
    for (let i = 0; i < 2; i++) { const wy = topY + 12 + i * 17, fx = tx + tw / 2; ctx.fillStyle = goldLo; rr(ctx, fx - 5, wy - 1, 10, 13, 5); ctx.fill(); ctx.fillStyle = glass[(i + 1) % glass.length]; rr(ctx, fx - 4, wy, 8, 12, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(fx - 4, wy, 8, 3); }
  }

  // central body
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 1, bodyTop - 1, W + 2, bodyH + 1);
  const bg = ctx.createLinearGradient(0, bodyTop, 0, ch); bg.addColorStop(0, wallHi); bg.addColorStop(1, wallLo);
  ctx.fillStyle = bg; ctx.fillRect(L, bodyTop, W, bodyH);
  ctx.fillStyle = gold; ctx.fillRect(L, bodyTop + 5, W, 3); ctx.fillRect(L, ch - 9, W, 3);
  ctx.fillStyle = shade(wall, 0.62); ctx.fillRect(L, ch - 6, W, 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1;                       // stone courses
  for (let yy = bodyTop + 14; yy < ch - 10; yy += 12) { ctx.beginPath(); ctx.moveTo(L, yy + 0.5); ctx.lineTo(R, yy + 0.5); ctx.stroke(); }

  // central raised block + dome + big flag
  const cbw = Math.max(TILE * 2.4, W * 0.34), cbTop = bodyTop - TILE * 1.5;
  ctx.fillStyle = OUTLINE; ctx.fillRect(mid - cbw / 2 - 2, cbTop - 2, cbw + 4, bodyTop - cbTop + 4);
  ctx.fillStyle = wallHi; ctx.fillRect(mid - cbw / 2, cbTop, cbw, bodyTop - cbTop);
  ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(mid, cbTop, cbw / 2 + 2, TILE * 0.95 + 2, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = gold; ctx.beginPath(); ctx.ellipse(mid, cbTop, cbw / 2, TILE * 0.95, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = shade(gold, 0.78); ctx.beginPath(); ctx.ellipse(mid, cbTop, cbw / 2, TILE * 0.95, 0, Math.PI * 0.5, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(mid - cbw * 0.16, cbTop - TILE * 0.3, cbw * 0.09, TILE * 0.34, 0, 0, 7); ctx.fill();
  spire(mid, cbTop - TILE * 0.9, 0.1, 0, false);
  ctx.strokeStyle = goldLo; ctx.lineWidth = 2; const dtop = cbTop - TILE * 0.95; ctx.beginPath(); ctx.moveTo(mid, dtop); ctx.lineTo(mid, dtop - 18); ctx.stroke();
  ctx.fillStyle = flag; ctx.beginPath(); ctx.moveTo(mid, dtop - 18); ctx.lineTo(mid + 18, dtop - 13); ctx.lineTo(mid, dtop - 8); ctx.closePath(); ctx.fill();
  // stained glass on raised block
  for (let i = 0; i < 3; i++) { const gx = mid - cbw / 2 + cbw * (i + 0.5) / 3, gy = cbTop + 9; ctx.fillStyle = goldLo; rr(ctx, gx - 5, gy - 1, 10, 19, 5); ctx.fill(); ctx.fillStyle = glass[i % glass.length]; rr(ctx, gx - 4, gy, 8, 17, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(gx - 4, gy, 8, 3); }

  // side towers (after body so they overlap corners)
  tower(L); tower(R - tw);

  // arched stained-glass windows filling the facade wings (multiple rows)
  const nwin = Math.max(2, obj.w - 4), wRows = Math.max(1, obj.h - 4);
  for (let r = 0; r < wRows; r++) {
    const winY = bodyTop + 14 + r * ((bodyH - 26) / wRows);
    for (let i = 0; i < nwin; i++) {
      const gx = L + tw + (W - 2 * tw) * (i + 0.5) / nwin;
      ctx.fillStyle = goldLo; rr(ctx, gx - 6, winY - 1, 12, 22, 6); ctx.fill();
      ctx.fillStyle = glass[(i + r) % glass.length]; rr(ctx, gx - 5, winY, 10, 20, 5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(gx - 5, winY + 9, 10, 1); ctx.fillRect(gx - 0.5, winY + 2, 1, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(gx - 5, winY, 10, 3);
    }
  }
  // short hanging banners
  for (const bx of [mid - cbw / 2 - 7, mid + cbw / 2 + 1]) {
    const bh = bodyH * 0.4;
    ctx.fillStyle = royal ? '#9a2f4a' : '#2f3f9a'; ctx.fillRect(bx, bodyTop + 6, 8, bh);
    ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(bx + 4, bodyTop + 6 + bh * 0.5, 2.5, 0, 7); ctx.fill();
    ctx.fillStyle = royal ? '#9a2f4a' : '#2f3f9a'; const by = bodyTop + 6 + bh; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 4, by + 5); ctx.lineTo(bx + 8, by); ctx.closePath(); ctx.fill();
  }
  // grand arched door
  const doorW = Math.max(TILE, W * 0.13);
  ctx.fillStyle = goldLo; rr(ctx, mid - doorW / 2 - 3, ch - TILE * 1.7 - 3, doorW + 6, TILE * 1.7 + 6, doorW / 2); ctx.fill();
  ctx.fillStyle = '#432c1c'; rr(ctx, mid - doorW / 2, ch - TILE * 1.7, doorW, TILE * 1.7, doorW / 2 - 2); ctx.fill();
  ctx.fillStyle = '#33210f'; ctx.fillRect(mid - 1, ch - TILE * 1.55, 2, TILE * 1.55);
  ctx.strokeStyle = goldLo; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { const yy = ch - TILE * 1.7 + i * (TILE * 1.7 / 4); ctx.beginPath(); ctx.moveTo(mid - doorW / 2 + 2, yy); ctx.lineTo(mid + doorW / 2 - 2, yy); ctx.stroke(); }
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(mid - doorW * 0.2, ch - TILE * 0.75, 2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(mid + doorW * 0.2, ch - TILE * 0.75, 2, 0, 7); ctx.fill();
  // staircase apron
  for (let i = 0; i < 3; i++) { const sw = doorW + 12 + i * 13; ctx.fillStyle = shade(wall, 0.9 - i * 0.08); ctx.fillRect(mid - sw / 2, ch - 6 + i * 2, sw, 3); }
  return { canvas: c, ox: -PAD, oy: 0 };
}

export function treeSprite(variant, snow) {
  return cached(`t:${variant}:${snow ? 1 : 0}`, () => {
    const W = TILE * 2, H = TILE * 2.6 | 0;
    const { c, ctx } = makeCanvas(W, H);
    const trunk = '#5a3b22';
    ctx.fillStyle = trunk; ctx.fillRect(W / 2 - 3, H - 20, 6, 20);
    ctx.fillStyle = shade(trunk, 0.8); ctx.fillRect(W / 2 - 3, H - 20, 2, 20);
    const greens = [['#1f5a2a', '#2f7a3a', '#43994c'], ['#265f36', '#357a48', '#4fa05e'], ['#3a5a1f', '#547a2f', '#6f9943']][variant % 3];
    const cx = W / 2, cy = H - 30;
    ctx.fillStyle = greens[0]; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 7); ctx.fill();
    ctx.fillStyle = greens[1]; ctx.beginPath(); ctx.arc(cx - 8, cy - 4, 13, 0, 7); ctx.arc(cx + 9, cy - 2, 12, 0, 7); ctx.fill();
    ctx.fillStyle = greens[2]; ctx.beginPath(); ctx.arc(cx - 4, cy - 10, 9, 0, 7); ctx.arc(cx + 8, cy - 8, 7, 0, 7); ctx.fill();
    if (snow) { ctx.fillStyle = '#eef4fb'; ctx.beginPath(); ctx.arc(cx - 4, cy - 12, 7, 0, 7); ctx.arc(cx + 8, cy - 10, 5, 0, 7); ctx.fill(); }
    return { canvas: c, ox: -TILE / 2, oy: -(H - TILE) };
  });
}

export function mountainSprite(obj) {
  return cached(`m:${obj.w}:${obj.h}`, () => {
    const W = obj.w * TILE, H = obj.h * TILE + TILE;
    const { c, ctx } = makeCanvas(W, H);
    ctx.fillStyle = '#6f6656'; ctx.beginPath(); ctx.moveTo(4, H); ctx.lineTo(W * 0.32, TILE * 0.6); ctx.lineTo(W * 0.5, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7d7568'; ctx.beginPath(); ctx.moveTo(W * 0.3, H); ctx.lineTo(W * 0.62, 6); ctx.lineTo(W - 4, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#948b7c'; ctx.beginPath(); ctx.moveTo(W * 0.62, 6); ctx.lineTo(W - 4, H); ctx.lineTo(W * 0.62, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eef4fb'; ctx.beginPath(); ctx.moveTo(W * 0.62, 6); ctx.lineTo(W * 0.52, TILE * 0.9); ctx.lineTo(W * 0.72, TILE * 0.9); ctx.closePath(); ctx.fill();
    return { canvas: c, ox: 0, oy: -TILE };
  });
}

export function propSprite(obj) {
  const kind = obj.kind;
  return cached(`p:${kind}:${obj.color || ''}:${obj.label || ''}`, () => {
    if (kind === 'fountain') {
      const W = TILE * 2, H = TILE * 2, { c, ctx } = q(W, H);
      ctx.fillStyle = '#9aa6b8'; ctx.beginPath(); ctx.arc(W / 2, H - 14, 26, 0, 7); ctx.fill();
      ctx.fillStyle = '#3f79c9'; ctx.beginPath(); ctx.arc(W / 2, H - 14, 20, 0, 7); ctx.fill();
      ctx.fillStyle = '#7ab0ec'; ctx.beginPath(); ctx.arc(W / 2, H - 16, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#cfe6ff'; ctx.fillRect(W / 2 - 2, H - 44, 4, 30);
      ctx.beginPath(); ctx.arc(W / 2, H - 44, 5, 0, 7); ctx.fill();
      return { canvas: c, ox: 0, oy: -(H - TILE * 2) };
    }
    if (kind === 'statue') {
      const W = TILE * 2, H = TILE * 2.4 | 0, { c, ctx } = q(W, H);
      ctx.fillStyle = '#8f8a80'; ctx.fillRect(W / 2 - 16, H - 16, 32, 16);
      ctx.fillStyle = '#b8b2a6'; ctx.fillRect(W / 2 - 8, H - 52, 16, 40);
      ctx.beginPath(); ctx.arc(W / 2, H - 56, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#cfc9bd'; ctx.fillRect(W / 2 - 12, H - 40, 4, 24);
      return { canvas: c, ox: 0, oy: -(H - TILE * 2) };
    }
    if (kind === 'lamp') {
      const W = TILE, H = TILE * 2, { c, ctx } = q(W, H);
      ctx.fillStyle = '#3a3140'; ctx.fillRect(W / 2 - 2, 20, 4, H - 20);
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(W / 2, 16, 7, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,140,0.35)'; ctx.beginPath(); ctx.arc(W / 2, 16, 13, 0, 7); ctx.fill();
      return { canvas: c, ox: 0, oy: -(H - TILE) };
    }
    if (kind === 'stall') {
      const W = TILE * 2, H = TILE * 2, { c, ctx } = q(W, H);
      const col = { red: '#c94f4f', blue: '#4f6fc9', green: '#4fae62', yellow: '#d1a12b' }[obj.color] || '#c94f4f';
      ctx.fillStyle = '#6a4a2f'; ctx.fillRect(6, H - 26, W - 12, 22);
      ctx.fillStyle = '#8a6a3f'; ctx.fillRect(6, H - 26, W - 12, 4);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? col : '#f2e6cf'; ctx.beginPath(); ctx.moveTo(4 + i * 12, 18); ctx.lineTo(16 + i * 12, 18); ctx.lineTo(10 + i * 12, 28); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = col; ctx.fillRect(2, 10, W - 4, 9);
      ctx.fillStyle = '#c94f8a'; ctx.fillRect(12, H - 22, 6, 6); ctx.fillStyle = '#4faeae'; ctx.fillRect(30, H - 22, 6, 6);
      return { canvas: c, ox: 0, oy: -(H - TILE * 2) };
    }
    if (kind === 'flowerbed') {
      const W = TILE * 3, H = TILE * 1.4 | 0, { c, ctx } = q(W, H);
      ctx.fillStyle = '#5a3b22'; ctx.fillRect(2, H - 12, W - 4, 12);
      const cols = ['#e85d8a', '#f2d16b', '#8a6bd1', '#ff9d5c', '#ff5c8a'];
      for (let i = 0; i < 14; i++) { const fx = 6 + hashf(i, obj.x) * (W - 12), fy = H - 14 - hashf(obj.y, i) * 8; ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.arc(fx, fy, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe8a0'; ctx.fillRect(fx - 1, fy - 1, 2, 2); }
      return { canvas: c, ox: 0, oy: -(H - TILE) };
    }
    if (kind === 'bench') {
      const W = TILE * 2, H = TILE, { c, ctx } = q(W, H);
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(6, 12, W - 12, 6); ctx.fillRect(6, 18, W - 12, 8); ctx.fillStyle = '#5a3f28'; ctx.fillRect(8, 24, 4, 6); ctx.fillRect(W - 12, 24, 4, 6);
      return { canvas: c, ox: 0, oy: 0 };
    }
    if (kind === 'signpost') {
      const W = TILE * 3, H = TILE * 1.6 | 0, { c, ctx } = q(W, H);
      ctx.fillStyle = '#5a3b22'; ctx.fillRect(W / 2 - 2, 16, 4, H - 16);
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(8, 6, W - 16, 18); ctx.strokeStyle = '#4a3020'; ctx.strokeRect(8.5, 6.5, W - 16, 18);
      ctx.fillStyle = '#f2e6cf'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(obj.label || '', W / 2, 19);
      return { canvas: c, ox: -TILE, oy: -(H - TILE) };
    }
    if (kind === 'boat') {
      const W = TILE * 2, H = TILE * 1.6 | 0, { c, ctx } = q(W, H);
      ctx.fillStyle = '#6a4a2f'; ctx.beginPath(); ctx.moveTo(4, H - 16); ctx.lineTo(W - 4, H - 16); ctx.lineTo(W - 12, H - 4); ctx.lineTo(12, H - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a6a3f'; ctx.fillRect(W / 2 - 1, 4, 2, H - 20); ctx.fillStyle = '#e0d4b8'; ctx.beginPath(); ctx.moveTo(W / 2, 6); ctx.lineTo(W - 8, H - 20); ctx.lineTo(W / 2, H - 20); ctx.closePath(); ctx.fill();
      return { canvas: c, ox: 0, oy: -(H - TILE) };
    }
    // fallback
    const { c, ctx } = q(TILE, TILE); ctx.fillStyle = '#888'; ctx.fillRect(8, 8, 16, 16);
    return { canvas: c, ox: 0, oy: 0 };
  });
}
function q(w, h) { return makeCanvas(w, h); }

// ---------------- CHARACTERS (customizable) ----------------
const BODY_FRONT = ['            ', '   SSSSSS   ', '  SSSSSSSS  ', '  SSSSSSSS  ', '  SSSSSSSS  ', '  SSSSSSSS  ', '  SSSSSSSS  ', '   SSSSSS   ', '  AOOOOOOA  ', ' OOOOOOOOOO ', ' OOOOOOOOOO ', ' OOCOOOOCOO ', '  OOOOOOOO  '];
const BODY_BACK = BODY_FRONT;
const BODY_SIDE = ['            ', '   SSSSS    ', '  SSSSSSS   ', '  SSSSSSS   ', '  SSSSSSS   ', '  SSSSSSS   ', '  SSSSSSS   ', '   SSSSS    ', '  AOOOOO    ', '  OOOOOOO   ', '  OOOOOOO   ', '  OOOOOO    ', '  OOOOO     '];

function paintBody(ctx, grid, pal, S, bob) {
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
    const col = pal[grid[y][x]]; if (col) { ctx.fillStyle = col; ctx.fillRect(x * S, (y + bob) * S, S, S); }
  }
}
function drawEyes(ctx, S, dir, eye) {
  ctx.fillStyle = '#fff';
  if (dir === 'down') { ctx.fillRect(3.5 * S, 5 * S, 1.5 * S, 1.2 * S); ctx.fillRect(7 * S, 5 * S, 1.5 * S, 1.2 * S); ctx.fillStyle = eye; ctx.fillRect(4 * S, 5.1 * S, S, S); ctx.fillRect(7.3 * S, 5.1 * S, S, S); }
  else if (dir === 'right') { ctx.fillRect(6 * S, 5 * S, 1.6 * S, 1.2 * S); ctx.fillStyle = eye; ctx.fillRect(6.4 * S, 5.1 * S, S, S); }
  else if (dir === 'left') { ctx.fillRect(3.5 * S, 5 * S, 1.6 * S, 1.2 * S); ctx.fillStyle = eye; ctx.fillRect(3.9 * S, 5.1 * S, S, S); }
}
function drawHair(ctx, S, dir, style, hair, accent, outfit) {
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x * S, y * S, w * S, h * S); };
  const back = dir === 'up';
  const side = dir === 'left' || dir === 'right';
  // base cap
  if (side) { R(2, 1, 6, 2, hair); R(2, 3, 2, 3, hair); }
  else { R(2, 1, 8, 2, hair); R(3, 0, 6, 1, accent); R(2, 3, 1, back ? 5 : 3, hair); R(9, 3, 1, back ? 5 : 3, hair); }
  if (back && !side) R(2, 1, 8, 6, hair);           // back of head fully covered
  switch (style) {
    case 'long': if (side) { R(2, 3, 2, 7, hair); } else { R(2, 3, 1, 7, hair); R(9, 3, 1, 7, hair); if (back) R(2, 3, 8, 7, hair); } break;
    case 'ponytail': if (back) R(4, 6, 4, 6, hair); else if (side) R(1, 3, 2, 6, hair); else { R(8.5, 3, 1.5, 5, hair); } break;
    case 'spiky': R(2, -0.2, 1, 1.4, hair); R(4, -0.4, 1, 1.6, hair); R(6, -0.4, 1, 1.6, hair); R(8, -0.2, 1, 1.4, hair); break;
    case 'bun': R(4.5, -1.2, 3, 2.4, hair); R(5, -1.5, 2, 1.2, accent); break;
    case 'bob': if (!side && !back) { R(2, 3, 1, 4, hair); R(9, 3, 1, 4, hair); } if (side) R(2, 3, 2, 4, hair); break;
    case 'braids': if (!side) { R(1.5, 4, 1.2, 6, hair); R(9.3, 4, 1.2, 6, hair); R(1.5, 9.6, 1.2, 1, accent); R(9.3, 9.6, 1.2, 1, accent); } else R(1.5, 4, 1.5, 6, hair); break;
    case 'hood': { const h = shade(outfit, 1.1); R(1.5, 0.5, 9, 3, h); if (side) R(1.5, 0.5, 7, 6, h); else { R(1.5, 1, 1.5, 6, h); R(9, 1, 1.5, 6, h); if (back) R(1.5, 1, 9, 6, h); } break; }
    default: break; // short
  }
}

const legDown = (ctx, S, x, pal) => { ctx.fillStyle = pal.O; ctx.fillRect(x * S, 13 * S, 2 * S, 1 * S); ctx.fillStyle = pal.B; ctx.fillRect(x * S, 14 * S, 2 * S, 1.4 * S); };
const legUp = (ctx, S, x, pal) => { ctx.fillStyle = pal.B; ctx.fillRect(x * S, 13 * S, 2 * S, 1.2 * S); };

function frame(dir, look, S, leftDown, rightDown, bob) {
  const grid = dir === 'up' ? BODY_BACK : dir === 'down' ? BODY_FRONT : BODY_SIDE;
  const { c, ctx } = makeCanvas(12 * S, 16 * S);
  const pal = { S: look.skin, O: look.outfit, A: shade(look.outfit, 1.2), C: shade(look.outfit, 0.7), B: '#2a2320' };
  paintBody(ctx, grid, pal, S, bob);
  drawHair(ctx, S, dir, look.hairStyle || 'short', look.hair, shade(look.hair, 1.3), look.outfit);
  if (dir !== 'up') drawEyes(ctx, S, dir, look.eye);
  legDownUp(ctx, S, leftDown, rightDown, pal);
  return c;
}
function legDownUp(ctx, S, l, r, pal) { (l ? legDown : legUp)(ctx, S, 2.5, pal); (r ? legDown : legUp)(ctx, S, 7.5, pal); }

export function makeCharacter(look, S = 3) {
  const L = { skin: '#e9c39b', hair: '#6a2fb0', hairStyle: 'short', eye: '#ff4a8d', outfit: '#2a1f3a', ...look };
  const dir = (d) => [frame(d, L, S, true, true, 0), frame(d, L, S, true, false, 0), frame(d, L, S, false, true, 0)];
  const right = dir('right');
  const left = right; // side reused; flipped at draw time via renderer
  return { down: dir('down'), up: dir('up'), right, left, w: 12 * S, h: 16 * S, flipLeft: true };
}

// ---------------- PORTRAIT ----------------
export function drawPortrait(ctx, look, x, y, size) {
  const S = size / 12;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const pal = { S: look.skin, O: look.outfit, A: shade(look.outfit, 1.2), C: shade(look.outfit, 0.7), B: '#2a2320' };
  ctx.translate(x, y);
  paintBody(ctx, BODY_FRONT, pal, S, 0);
  drawHair(ctx, S, 'down', look.hairStyle || 'short', look.hair, shade(look.hair, 1.3), look.outfit);
  drawEyes(ctx, S, 'down', look.eye);
  ctx.restore();
}
