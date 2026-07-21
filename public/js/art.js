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
  return cached(`b:${obj.style}:${obj.w}:${obj.h}:${obj.door}`, () => {
    const s = BSTYLE[obj.style] || BSTYLE.house;
    if (obj.style === 'palace') return grandBuilding(obj, 'royal');
    if (obj.style === 'academy') return grandBuilding(obj, 'magic');
    return normalBuilding(obj, s);
  });
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
