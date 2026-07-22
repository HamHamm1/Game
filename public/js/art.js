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

// ---------------- INTERIORS (baked room + furniture sprites) ----------------
// Interiors ignore the terrain tileset — floors and walls are procedural so a
// room reads instantly even before the tileset loads. Muted, cosy palette.
const INT_PAL = {
  cafe:    { floor: '#a9743f', wall: '#c39c6a', wains: '#7a4f2c', accent: '#e0b878', marble: false },
  inn:     { floor: '#9c6a39', wall: '#b8935f', wains: '#6e4526', accent: '#d8a860', marble: false },
  library: { floor: '#7a5a3a', wall: '#8f7f62', wains: '#4a3a28', accent: '#c9b98a', marble: false },
  academy: { floor: '#6a5c4a', wall: '#7d7060', wains: '#463c30', accent: '#b0a080', marble: false },
  palace:  { floor: '#e6e0ea', floor2: '#cbc0d8', wall: '#b6a6c8', wains: '#8a6f5a', accent: '#ffd24a', marble: true },
  shop:    { floor: '#6f6470', wall: '#82778e', wains: '#463c50', accent: '#c9a24a', marble: false },
  shop2:   { floor: '#5a7068', wall: '#6f8078', wains: '#3a4a44', accent: '#c9e0d4', marble: false },
  opera:   { floor: '#5a2f3a', wall: '#7a4f6a', wains: '#3a1f2a', accent: '#ffd24a', marble: false },
  default: { floor: '#9c7048', wall: '#b09070', wains: '#6a4a30', accent: '#d0b088', marble: false },
};

function framePic(ctx, x, y, w, h, P) {
  ctx.fillStyle = shade(P.accent, 0.7); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = P.accent; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = shade(P.wall, 0.6); ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // a little landscape/portrait inside
  ctx.fillStyle = shade(P.accent, 1.15); ctx.fillRect(x + 3, y + h - 6, w - 6, 3);
  ctx.fillStyle = shade(P.wall, 0.9); ctx.fillRect(x + 4, y + 3, w - 8, 3);
}

export function bakeInterior(map) {
  const P = INT_PAL[map.style] || INT_PAL.default;
  const W = map.w, H = map.h, WP = W * TILE, HP = H * TILE;
  const { c, ctx } = makeCanvas(WP, HP);
  const wallH = 2 * TILE;                                    // top two rows = back wall

  // ---- floor (rows 2..H-1) ----
  for (let y = 2; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x * TILE, py = y * TILE;
    if (P.marble) {
      ctx.fillStyle = ((x + y) & 1) ? P.floor : P.floor2;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px + 5, py + 7); ctx.lineTo(px + TILE - 7, py + TILE - 9); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,110,140,0.16)'; ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    } else {
      const rs = (y % 2) ? 1.0 : 0.94;                       // alternate plank rows
      ctx.fillStyle = shade(P.floor, rs); ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(px, py, TILE, 1);
      ctx.fillStyle = shade(P.floor, rs * 0.86); ctx.fillRect(px, py + TILE - 2, TILE, 2);  // seam
      const off = (y % 2) ? TILE / 2 : 0;                    // staggered joints
      ctx.fillStyle = shade(P.floor, rs * 0.8); ctx.fillRect(px + off, py, 1, TILE);
    }
  }

  // ---- side walls + bottom wall (single-tile borders) ----
  const sideWall = (px, py, ao) => {
    ctx.fillStyle = shade(P.wall, ao); ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = P.wains; ctx.fillRect(px, py + TILE - 9, TILE, 9);              // baseboard
    ctx.fillStyle = shade(P.wains, 1.25); ctx.fillRect(px, py + TILE - 9, TILE, 2);
  };
  for (let y = 2; y < H; y++) { sideWall(0, y * TILE, 0.9); sideWall((W - 1) * TILE, y * TILE, 0.84); }
  const ex = W >> 1;
  for (let x = 1; x < W - 1; x++) { if (x === ex) continue; sideWall(x * TILE, (H - 1) * TILE, 0.8); }
  // inner edge shadow where floor meets side walls
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(TILE, 2 * TILE, 3, HP); ctx.fillRect((W - 1) * TILE - 3, 2 * TILE, 3, HP);

  // ---- back wall (top two rows) ----
  ctx.fillStyle = P.wall; ctx.fillRect(0, 0, WP, wallH);
  for (let x = 0; x < WP; x += 12) { ctx.fillStyle = shade(P.wall, 1.05); ctx.fillRect(x, 4, 6, wallH - 20); } // wallpaper stripes
  ctx.fillStyle = shade(P.accent, 0.8); ctx.fillRect(0, 0, WP, 3);          // crown molding
  ctx.fillStyle = P.accent; ctx.fillRect(0, 3, WP, 2);
  const railY = wallH - 15;                                                  // chair rail + wainscot
  ctx.fillStyle = P.wains; ctx.fillRect(0, railY, WP, 15);
  ctx.fillStyle = shade(P.wains, 1.25); ctx.fillRect(0, railY, WP, 2);
  for (let x = 4; x < WP - 4; x += 16) { ctx.strokeStyle = shade(P.wains, 0.75); ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, railY + 4.5, 12, 7); }
  for (let x = TILE; x < WP - TILE; x += TILE * 2) framePic(ctx, x + 5, 9, TILE - 10, 18, P);  // framed pictures
  // soft shadow where back wall meets floor
  const g = ctx.createLinearGradient(0, wallH, 0, wallH + 12);
  g.addColorStop(0, 'rgba(0,0,0,0.24)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, wallH, WP, 12);

  // ---- doorway (exit) in the bottom row ----
  const dx0 = ex * TILE, dy0 = (H - 1) * TILE;
  ctx.fillStyle = shade(P.wains, 0.6); ctx.fillRect(dx0 - 2, dy0, TILE + 4, TILE);       // door frame
  ctx.fillStyle = '#1b1622'; ctx.fillRect(dx0 + 2, dy0 + 2, TILE - 4, TILE - 2);         // opening (night outside)
  ctx.fillStyle = P.accent; ctx.fillRect(dx0 + 2, dy0 + 2, TILE - 4, 2);                 // lintel
  ctx.fillStyle = 'rgba(255,220,150,0.14)'; ctx.fillRect(dx0 + 5, dy0 + 6, TILE - 10, TILE - 8);
  ctx.fillStyle = shade(P.accent, 1.1); ctx.fillRect(dx0 + TILE / 2 - 6, dy0 + TILE - 6, 12, 3); // welcome mat glint

  return c;
}

// ---------------- FURNITURE SPRITES ----------------
// Each returns { canvas, flat?, hang? }. flat = floor decal (rug) drawn under
// everything; hang = hangs from the ceiling (chandelier). Others depth-sort.
const woodGrain = (ctx, x, y, w, h, base) => {
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(base, 0.82); for (let i = y + 3; i < y + h; i += 4) ctx.fillRect(x, i, w, 1);
  ctx.fillStyle = shade(base, 1.12); ctx.fillRect(x, y, w, 1);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
};

export function furnitureSprite(obj) {
  return cached(`f:${obj.kind}`, () => makeFurniture(obj.kind));
}

function makeFurniture(kind) {
  const S = TILE;
  const mk = (w, h) => makeCanvas(w, h);
  switch (kind) {
    case 'rug': {
      const { c, ctx } = mk(S, S);
      ctx.fillStyle = '#7a2f3a'; ctx.fillRect(1, 1, S - 2, S - 2);
      ctx.fillStyle = '#a4404e'; ctx.fillRect(4, 4, S - 8, S - 8);
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1; ctx.strokeRect(3.5, 3.5, S - 7, S - 7);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(S / 2 - 3, S / 2 - 3, 6, 6);
      ctx.fillStyle = '#7a2f3a'; ctx.fillRect(S / 2 - 1, S / 2 - 1, 2, 2);
      return { canvas: c, flat: true };
    }
    case 'table': {
      const { c, ctx } = mk(S, 22);
      woodGrain(ctx, 3, 4, S - 6, 8, '#8a5a34');          // top
      ctx.fillStyle = shade('#8a5a34', 0.7); ctx.fillRect(5, 12, 3, 9); ctx.fillRect(S - 8, 12, 3, 9); // legs
      return { canvas: c };
    }
    case 'desk': {
      const { c, ctx } = mk(S, 22);
      woodGrain(ctx, 2, 4, S - 4, 9, '#6f4a2c');
      ctx.fillStyle = '#3a2a1c'; ctx.fillRect(4, 13, S - 8, 7);
      ctx.fillStyle = '#e6dcc0'; ctx.fillRect(S / 2 - 5, 2, 10, 6);   // paper/book on top
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(S / 2 - 5.5, 1.5, 10, 6);
      return { canvas: c };
    }
    case 'chair': {
      const { c, ctx } = mk(20, 22);
      woodGrain(ctx, 4, 2, 12, 10, '#7a4f2c');           // back
      woodGrain(ctx, 3, 11, 14, 5, '#8a5a34');           // seat
      ctx.fillStyle = shade('#7a4f2c', 0.7); ctx.fillRect(4, 16, 2, 5); ctx.fillRect(14, 16, 2, 5);
      return { canvas: c };
    }
    case 'stool': {
      const { c, ctx } = mk(16, 16);
      woodGrain(ctx, 2, 5, 12, 4, '#8a5a34');
      ctx.fillStyle = shade('#8a5a34', 0.7); ctx.fillRect(3, 9, 2, 6); ctx.fillRect(11, 9, 2, 6);
      return { canvas: c };
    }
    case 'counter': {
      const { c, ctx } = mk(S, 26);
      woodGrain(ctx, 0, 4, S, 20, '#6f4a30');
      ctx.fillStyle = shade('#6f4a30', 1.2); ctx.fillRect(0, 4, S, 3);   // polished top
      ctx.fillStyle = shade('#6f4a30', 0.6); ctx.fillRect(2, 12, S - 4, 1);
      return { canvas: c };
    }
    case 'stove': {
      const { c, ctx } = mk(S, 26);
      ctx.fillStyle = '#3a3540'; ctx.fillRect(2, 6, S - 4, 18);
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(2.5, 6.5, S - 5, 17);
      ctx.fillStyle = '#ff8a3a'; ctx.fillRect(6, 12, 8, 8);            // fire glow
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(8, 14, 4, 4);
      ctx.fillStyle = '#8a8f98'; ctx.fillRect(S - 9, 2, 4, 6);        // flue
      return { canvas: c };
    }
    case 'bookshelf': {
      const { c, ctx } = mk(S, 34);
      woodGrain(ctx, 1, 1, S - 2, 32, '#5a3b22');
      const cols = ['#8a3f3a', '#3a6a8a', '#6a8a3a', '#8a7a3a', '#6a3a8a', '#3a8a6a'];
      for (let r = 0; r < 3; r++) {
        const yy = 4 + r * 10;
        ctx.fillStyle = '#2a1c12'; ctx.fillRect(3, yy + 7, S - 6, 3);   // shelf plank
        for (let i = 0, x = 4; x < S - 6; i++) {
          const bw = 2 + (i * 7 % 3); ctx.fillStyle = cols[(r * 3 + i) % cols.length];
          ctx.fillRect(x, yy, bw, 7); x += bw + 1;
        }
      }
      return { canvas: c };
    }
    case 'shelf': {
      const { c, ctx } = mk(S, 20);
      woodGrain(ctx, 1, 2, S - 2, 16, '#6f4a30');
      ctx.fillStyle = '#2a1c12'; ctx.fillRect(2, 9, S - 4, 2);
      for (const [x, col] of [[4, '#c94f7c'], [11, '#4fbf6a'], [18, '#4aa3ff'], [25, '#ffd24a']]) { ctx.fillStyle = col; ctx.fillRect(x, 4, 4, 4); ctx.fillRect(x, 12, 4, 4); }
      return { canvas: c };
    }
    case 'wardrobe': {
      const { c, ctx } = mk(S, 34);
      woodGrain(ctx, 3, 1, S - 6, 32, '#5a3b28');
      ctx.strokeStyle = shade('#5a3b28', 0.6); ctx.lineWidth = 1;
      ctx.strokeRect(6.5, 4.5, (S - 12) / 2 - 1, 26); ctx.strokeRect(S / 2 + 0.5, 4.5, (S - 12) / 2 - 1, 26);
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(S / 2 - 2, 16, 2, 4); ctx.fillRect(S / 2 + 1, 16, 2, 4);
      return { canvas: c };
    }
    case 'bed': {
      const { c, ctx } = mk(S, 26);
      woodGrain(ctx, 2, 2, 5, 22, '#5a3b28');            // headboard
      ctx.fillStyle = '#c96a8a'; ctx.fillRect(7, 8, S - 9, 16);   // blanket
      ctx.fillStyle = shade('#c96a8a', 0.8); ctx.fillRect(7, 16, S - 9, 8);
      ctx.fillStyle = '#f6ead6'; ctx.fillRect(8, 4, 9, 7);        // pillow
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(7.5, 4.5, S - 10, 19);
      return { canvas: c };
    }
    case 'fireplace': {
      const { c, ctx } = mk(S, 30);
      ctx.fillStyle = '#8a8478'; ctx.fillRect(1, 2, S - 2, 26);   // stone mantel
      ctx.fillStyle = shade('#8a8478', 0.8); for (let y = 4; y < 28; y += 5) ctx.fillRect(1, y, S - 2, 1);
      ctx.fillStyle = '#1b1420'; ctx.fillRect(6, 10, S - 12, 16); // hearth
      ctx.fillStyle = '#ff7a2a'; ctx.fillRect(9, 18, S - 18, 8);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(11, 20, S - 22, 5);
      ctx.fillStyle = shade('#8a8478', 1.15); ctx.fillRect(0, 1, S, 3); // mantel shelf
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(1.5, 2.5, S - 3, 25);
      return { canvas: c };
    }
    case 'plant': {
      const { c, ctx } = mk(S, 26);
      ctx.fillStyle = '#8a5a3a'; ctx.fillRect(9, 18, S - 18, 7);   // pot
      ctx.fillStyle = shade('#8a5a3a', 1.15); ctx.fillRect(9, 18, S - 18, 2);
      ctx.fillStyle = '#3a7a4a'; ctx.beginPath(); ctx.arc(S / 2, 12, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#4f9a5f'; ctx.beginPath(); ctx.arc(S / 2 - 4, 9, 4, 0, 7); ctx.arc(S / 2 + 4, 10, 4, 0, 7); ctx.arc(S / 2, 5, 4, 0, 7); ctx.fill();
      return { canvas: c };
    }
    case 'barrel': {
      const { c, ctx } = mk(20, 24);
      ctx.fillStyle = '#8a5a34'; rr(ctx, 3, 3, 14, 19, 4); ctx.fill();
      ctx.fillStyle = shade('#8a5a34', 0.8); for (const y of [7, 12, 17]) ctx.fillRect(3, y, 14, 2);
      ctx.fillStyle = '#5f5a52'; ctx.fillRect(3, 6, 14, 1); ctx.fillRect(3, 17, 14, 1);
      ctx.strokeStyle = OUTLINE; rr(ctx, 3, 3, 14, 19, 4); ctx.stroke();
      return { canvas: c };
    }
    case 'crate': {
      const { c, ctx } = mk(20, 20);
      woodGrain(ctx, 2, 3, 16, 15, '#8a6a3a');
      ctx.strokeStyle = shade('#8a6a3a', 0.6); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(2, 3); ctx.lineTo(18, 18); ctx.moveTo(18, 3); ctx.lineTo(2, 18); ctx.stroke();
      return { canvas: c };
    }
    case 'cauldron': {
      const { c, ctx } = mk(S, 24);
      ctx.fillStyle = '#2f2a34'; ctx.beginPath(); ctx.arc(S / 2, 14, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#1b1620'; ctx.fillRect(S / 2 - 9, 10, 18, 4);
      ctx.fillStyle = '#6affc4'; ctx.fillRect(S / 2 - 7, 9, 14, 3);   // bubbling brew
      ctx.fillStyle = '#a6ffe0'; ctx.fillRect(S / 2 - 3, 7, 3, 2);
      ctx.fillStyle = '#ff7a2a'; ctx.fillRect(S / 2 - 6, 22, 12, 2);  // embers
      return { canvas: c };
    }
    case 'throne': {
      const { c, ctx } = mk(S, 36);
      ctx.fillStyle = '#b0954e'; ctx.fillRect(6, 2, S - 12, 26);      // gold frame
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(8, 4, S - 16, 22);
      ctx.fillStyle = '#7a2f3a'; ctx.fillRect(10, 10, S - 20, 16);    // cushion
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(4, 0, 4, 30); ctx.fillRect(S - 8, 0, 4, 30); // arms
      gemAt(ctx, S / 2, 6, '#4aa3ff'); gemAt(ctx, S / 2 - 6, 3, '#ff4a8d'); gemAt(ctx, S / 2 + 6, 3, '#4fbf6a');
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(6.5, 2.5, S - 13, 25);
      return { canvas: c };
    }
    case 'column': {
      const { c, ctx } = mk(20, 40);
      ctx.fillStyle = '#d8cfe0'; ctx.fillRect(5, 4, 10, 32);
      ctx.fillStyle = shade('#d8cfe0', 1.12); ctx.fillRect(6, 4, 2, 32);
      ctx.fillStyle = shade('#d8cfe0', 0.8); ctx.fillRect(12, 4, 2, 32);
      ctx.fillStyle = '#c2b6cc'; ctx.fillRect(2, 0, 16, 5); ctx.fillRect(2, 35, 16, 5); // cap + base
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(5.5, 4.5, 9, 31);
      return { canvas: c };
    }
    case 'chandelier': {
      const { c, ctx } = mk(40, 30);
      ctx.strokeStyle = '#5f5a52'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, 8); ctx.stroke();
      ctx.fillStyle = '#b0954e'; ctx.beginPath(); ctx.ellipse(20, 12, 15, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd24a'; for (const x of [5, 12, 20, 28, 35]) { ctx.fillRect(x - 1, 12, 2, 6); ctx.fillStyle = '#fff2c9'; ctx.beginPath(); ctx.arc(x, 20, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd24a'; }
      return { canvas: c, hang: true };
    }
    case 'chalkboard': {
      const { c, ctx } = mk(S, 24);
      ctx.fillStyle = '#5a3b28'; ctx.fillRect(1, 1, S - 2, 20);
      ctx.fillStyle = '#26302a'; ctx.fillRect(3, 3, S - 6, 15);
      ctx.strokeStyle = 'rgba(230,230,220,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(6, 7); ctx.lineTo(14, 7); ctx.moveTo(6, 11); ctx.lineTo(18, 11); ctx.moveTo(6, 15); ctx.lineTo(12, 15); ctx.stroke();
      ctx.fillStyle = '#c9b98a'; ctx.fillRect(3, 18, S - 6, 3);
      return { canvas: c };
    }
    case 'stage': {
      const { c, ctx } = mk(S, 18);
      woodGrain(ctx, 0, 6, S, 12, '#6f4a30');
      ctx.fillStyle = '#b0954e'; ctx.fillRect(0, 4, S, 3);          // gilt lip
      ctx.fillStyle = '#7a2f3a'; ctx.fillRect(0, 0, S, 5);          // curtain hem
      return { canvas: c };
    }
    case 'seatrow': {
      const { c, ctx } = mk(S, 16);
      ctx.fillStyle = '#7a2f3a'; ctx.fillRect(2, 4, S - 4, 10);
      ctx.fillStyle = shade('#7a2f3a', 1.2); ctx.fillRect(2, 4, S - 4, 3);
      ctx.fillStyle = shade('#7a2f3a', 0.7); ctx.fillRect(2, 11, S - 4, 3);
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(2.5, 4.5, S - 5, 9);
      return { canvas: c };
    }
    case 'piano': {
      const { c, ctx } = mk(S, 26);
      ctx.fillStyle = '#1b1620'; ctx.fillRect(2, 4, S - 4, 20);
      ctx.fillStyle = '#f6ead6'; ctx.fillRect(4, 14, S - 8, 5);     // keys
      ctx.fillStyle = '#1b1620'; for (let x = 6; x < S - 6; x += 3) ctx.fillRect(x, 14, 1, 3);
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(2.5, 4.5, S - 5, 19);
      return { canvas: c };
    }
    default: {
      const { c, ctx } = mk(S, 18);
      woodGrain(ctx, 3, 3, S - 6, 12, '#7a5a3a');
      return { canvas: c };
    }
  }
}
function gemAt(ctx, x, y, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 3); ctx.lineTo(x - 3, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x - 1, y - 1, 1, 1);
}

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

// ---- opulence helpers (gold + gems) ----
const GOLD = '#e8c24a', GOLD_LO = '#b08526', GOLD_HI = '#f7e59a', MARBLE = '#f0ead9';
const GEMS = ['#d23a5a', '#3a6ad2', '#2fae6a', '#9a4ad2', '#e0a83a'];
function gem(ctx, x, y, s, col) {
  ctx.fillStyle = GOLD_LO; fillPoly(ctx, [[x, y - s - 1], [x + s + 1, y], [x, y + s + 1], [x - s - 1, y]]);
  ctx.fillStyle = col; fillPoly(ctx, [[x, y - s], [x + s, y], [x, y + s], [x - s, y]]);
  ctx.fillStyle = shade(col, 1.5); fillPoly(ctx, [[x, y - s], [x + s * 0.55, y - s * 0.15], [x, y + s * 0.2], [x - s * 0.55, y - s * 0.15]]);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - s + 0.5, 1, 1);
}
function goldDome(ctx, cx, baseY, r) {
  const ry = r * 0.98;
  ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(cx, baseY, r + 1, ry + 1, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(cx, baseY, r, ry, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = GOLD_LO; ctx.beginPath(); ctx.ellipse(cx, baseY, r, ry, 0, Math.PI * 1.5, Math.PI * 2); ctx.lineTo(cx, baseY); ctx.fill();
  ctx.strokeStyle = GOLD_LO; ctx.lineWidth = 0.75; for (let a = -2; a <= 2; a++) { ctx.beginPath(); ctx.moveTo(cx + a * r * 0.5, baseY - 1); ctx.lineTo(cx + a * r * 0.12, baseY - ry * 0.96); ctx.stroke(); }
  ctx.fillStyle = GOLD_HI; ctx.beginPath(); ctx.ellipse(cx - r * 0.32, baseY - ry * 0.42, r * 0.13, ry * 0.42, 0, 0, 7); ctx.fill();
  ctx.fillStyle = GOLD; ctx.fillRect(cx - r - 1, baseY - 1, 2 * r + 2, 2);
}
// Onion dome sitting on a tower whose top cornice is at baseY. Returns apex Y.
function onionCap(ctx, cx, baseY, r) {
  const H = r * 1.85;
  const path = (rr, ex) => { ctx.beginPath(); ctx.moveTo(cx - rr, baseY); ctx.bezierCurveTo(cx - rr * 1.3, baseY - rr * 0.85, cx - rr * 0.5, baseY - rr * 1.45, cx, baseY - H - ex); ctx.bezierCurveTo(cx + rr * 0.5, baseY - rr * 1.45, cx + rr * 1.3, baseY - rr * 0.85, cx + rr, baseY); ctx.closePath(); };
  ctx.fillStyle = OUTLINE; path(r + 1, 1); ctx.fill();
  ctx.fillStyle = GOLD; path(r, 0); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(cx, baseY - H - 2, r + 2, H + 2); ctx.clip(); ctx.fillStyle = GOLD_LO; path(r, 0); ctx.fill(); ctx.restore();
  ctx.fillStyle = GOLD_HI; ctx.beginPath(); ctx.ellipse(cx - r * 0.4, baseY - r * 0.8, r * 0.14, r * 0.55, 0, 0, 7); ctx.fill();
  ctx.fillStyle = GOLD; ctx.fillRect(cx - 0.5, baseY - H - 3, 1, 3);
  return baseY - H - 3;
}
function palaceTower(ctx, x, w, topY, sh, jglass) {
  const cx = x + w / 2;
  ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1, topY - 1, w + 2, sh - topY + 1);
  matFill(ctx, 'stone', x, topY, w, sh - topY, MARBLE, GOLD);
  ctx.fillStyle = GOLD; ctx.fillRect(x, topY, 1.5, sh - topY); ctx.fillRect(x + w - 1.5, topY, 1.5, sh - topY);
  for (let yy = topY + U; yy < sh - 3; yy += U) { ctx.fillStyle = GOLD; ctx.fillRect(x, yy, w, 1); gem(ctx, cx, yy + U * 0.5, 1.5, GEMS[(yy / U | 0) % GEMS.length]); }
  for (let i = 0; i < 3; i++) { const wy = topY + 6 + i * 9; if (wy > sh - 11) break; winDraw(ctx, 'arch', cx - 2.5, wy, 5, 7, GOLD, jglass[i % jglass.length]); }
  ctx.fillStyle = GOLD; ctx.fillRect(x - 1, topY - 2, w + 2, 2);
  const apex = onionCap(ctx, cx, topY - 2, w * 0.52);
  gem(ctx, cx, apex - 3, 1.8, GEMS[0]);
}

// Grandest building: white-marble palace dripping with gold and jewels — a
// great gold central dome, gold onion-domed towers, gem-studded gold trim,
// jewelled stained glass, a columned portico and a jewelled pediment.
function drawPalace(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop;
  const jglass = ['#b24a5a', '#4a6ac2', '#4aae7a', '#8a5ac2', '#c2a23a'];
  const tw = Math.max(U * 1.9, W * 0.14), itw = Math.max(U * 1.2, W * 0.08);
  const cbw = Math.max(U * 3, W * 0.36), cbTop = bodyTop - U * 3;

  // central body wall between towers
  ctx.fillStyle = OUTLINE; ctx.fillRect(L + tw - 1, bodyTop - 1, W - 2 * tw + 2, bh + 1);
  matFill(ctx, 'stone', L + tw, bodyTop, W - 2 * tw, bh, MARBLE, GOLD);
  // gold string courses with gem studs
  for (let yy = bodyTop + U; yy < sh - 4; yy += U) { ctx.fillStyle = GOLD; ctx.fillRect(L + tw, yy, W - 2 * tw, 1); }
  // arched jewelled windows with gold pilasters between them
  const nwin = Math.max(3, obj.w - 6), wrows = Math.max(2, obj.h - 3);
  for (let i = 0; i <= nwin; i++) { const px = L + tw + (W - 2 * tw) * i / nwin; ctx.fillStyle = GOLD; ctx.fillRect(px - 0.5, bodyTop + 2, 1.5, bh - 2); ctx.fillStyle = GOLD_LO; ctx.fillRect(px + 1, bodyTop + 2, 0.5, bh - 2); }
  for (let r = 0; r < wrows; r++) for (let i = 0; i < nwin; i++) { const gx = L + tw + (W - 2 * tw) * (i + 0.5) / nwin - 3, gy = bodyTop + 7 + r * ((bh - 16) / wrows); winDraw(ctx, 'arch', gx, gy, 6, 9, GOLD, jglass[(i + r) % jglass.length]); }
  // gold cornice with a row of gems
  ctx.fillStyle = GOLD; ctx.fillRect(L + tw - 2, bodyTop - 2, W - 2 * tw + 4, 3);
  for (let gx = L + tw + 4; gx < R - tw - 2; gx += 8) gem(ctx, gx, bodyTop - 0.5, 1.3, GEMS[(gx | 0) % GEMS.length]);

  // central raised block: rose window + great gold dome + crown gem
  ctx.fillStyle = OUTLINE; ctx.fillRect(mid - cbw / 2 - 1, cbTop - 1, cbw + 2, bodyTop - cbTop + 1);
  matFill(ctx, 'stone', mid - cbw / 2, cbTop, cbw, bodyTop - cbTop, MARBLE, GOLD);
  ctx.fillStyle = GOLD; ctx.fillRect(mid - cbw / 2, cbTop, cbw, 1.5); ctx.fillRect(mid - cbw / 2, bodyTop - 2, cbw, 1.5);
  const rr = cbw * 0.16, rcy = cbTop + U * 1.05;
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(mid, rcy, rr + 2, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a6ac2'; ctx.beginPath(); ctx.arc(mid, rcy, rr, 0, 7); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 0.75; for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3; ctx.beginPath(); ctx.moveTo(mid, rcy); ctx.lineTo(mid + Math.cos(ang) * rr, rcy + Math.sin(ang) * rr); ctx.stroke(); }
  for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; gem(ctx, mid + Math.cos(ang) * (rr + 2), rcy + Math.sin(ang) * (rr + 2), 1.2, GEMS[a % GEMS.length]); }
  const domeR = cbw * 0.42, domeTop = cbTop - domeR * 0.98;
  goldDome(ctx, mid, cbTop, domeR);
  ctx.fillStyle = MARBLE; ctx.fillRect(mid - domeR * 0.2, domeTop - U * 0.5, domeR * 0.4, U * 0.5);
  ctx.fillStyle = GOLD; ctx.fillRect(mid - domeR * 0.2, domeTop - U * 0.5, domeR * 0.4, 1);
  ctx.fillStyle = GOLD; fillPoly(ctx, [[mid - 2, domeTop - U * 0.5], [mid, domeTop - U * 0.5 - 8], [mid + 2, domeTop - U * 0.5]]);
  gem(ctx, mid, domeTop - U * 0.5 - 11, 2.6, '#d23a5a');

  // gold onion-domed towers: two corners + two inner (multi-spired)
  palaceTower(ctx, L, tw, bodyTop - U * 0.8, sh, jglass);
  palaceTower(ctx, R - tw, tw, bodyTop - U * 0.8, sh, jglass);
  palaceTower(ctx, mid - cbw / 2 - itw, itw, bodyTop - U * 1.4, bodyTop + bh * 0.5, jglass);
  palaceTower(ctx, mid + cbw / 2, itw, bodyTop - U * 1.4, bodyTop + bh * 0.5, jglass);

  // gold urns on the body roofline
  for (const ux of [L + tw + 3, R - tw - 5]) { ctx.fillStyle = GOLD; ctx.fillRect(ux, bodyTop - 5, 4, 5); ctx.beginPath(); ctx.arc(ux + 2, bodyTop - 6, 2.4, 0, 7); ctx.fill(); ctx.fillStyle = GOLD_LO; ctx.fillRect(ux + 2, bodyTop - 8, 0.5, 2); }

  // royal banners
  for (const bx of [mid - cbw / 2 - 4, mid + cbw / 2 + 1]) { const bhh = bh * 0.4; ctx.fillStyle = '#7a2f44'; ctx.fillRect(bx, bodyTop + 4, 4, bhh); gem(ctx, bx + 2, bodyTop + 4 + bhh * 0.45, 1.4, '#e0a83a'); ctx.fillStyle = '#7a2f44'; fillPoly(ctx, [[bx, bodyTop + 4 + bhh], [bx + 2, bodyTop + 4 + bhh + 3], [bx + 4, bodyTop + 4 + bhh]]); }

  // grand columned portico with a jewelled pediment
  const dw = Math.max(U * 1.2, W * 0.12);
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[mid - dw / 2 - 7, sh - U * 2.2], [mid, sh - U * 2.2 - 9], [mid + dw / 2 + 7, sh - U * 2.2]]);
  ctx.fillStyle = GOLD; fillPoly(ctx, [[mid - dw / 2 - 6, sh - U * 2.2], [mid, sh - U * 2.2 - 8], [mid + dw / 2 + 6, sh - U * 2.2]]);
  ctx.fillStyle = MARBLE; fillPoly(ctx, [[mid - dw / 2 - 3, sh - U * 2.2 - 1], [mid, sh - U * 2.2 - 6], [mid + dw / 2 + 3, sh - U * 2.2 - 1]]);
  gem(ctx, mid, sh - U * 2.2 - 3.5, 2, '#3a6ad2');
  ctx.fillStyle = GOLD; ctx.fillRect(mid - dw / 2 - 7, sh - U * 2.2, dw + 14, 2);
  for (const colx of [mid - dw / 2 - 5, mid + dw / 2 + 2]) { ctx.fillStyle = GOLD_HI; ctx.fillRect(colx, sh - U * 2.2, 3, U * 2.2); ctx.fillStyle = GOLD_LO; ctx.fillRect(colx + 2, sh - U * 2.2, 1, U * 2.2); ctx.fillStyle = GOLD; ctx.fillRect(colx - 0.5, sh - U * 2.2, 4, 1.5); ctx.fillRect(colx - 0.5, sh - 3, 4, 1.5); }
  drawDoor(ctx, mid, sh - 1, dw, U * 1.8, GOLD);
  gem(ctx, mid, sh - U * 1.2, 1.6, '#d23a5a'); gem(ctx, mid, sh - U * 0.5, 1.6, '#3a6ad2');
  for (let i = 0; i < 4; i++) { ctx.fillStyle = shade(MARBLE, 0.9 - i * 0.05); ctx.fillRect(mid - dw / 2 - 8 - i * 4, sh - 2 + i, dw + 16 + i * 8, 2); }
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

// Baroque opera house: rusticated arched loggia, tall arched upper windows,
// central pediment with a low dome and gold urns along a balustraded roofline.
function drawOpera(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, stone = cfg.wall, roofc = cfg.roof, trim = cfg.trim, glass = cfg.glass, gold = '#c2a24a';
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 1, bodyTop - 1, W + 2, bh + 1);
  matFill(ctx, 'stone', L, bodyTop, W, bh, stone, trim);
  ctx.fillStyle = shade(stone, 0.82); for (let x = L; x < R; x += 6) ctx.fillRect(x, sh - U * 1.7, 1, U * 1.7);  // rusticated base
  const arches = 3;
  for (let i = 0; i < arches; i++) {
    const acx = L + W * (i + 1) / (arches + 1), aw = (i === 1 ? U * 1.4 : U), ah = U * 1.6;
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(acx - aw / 2, sh - 2); ctx.lineTo(acx - aw / 2, sh - ah + aw / 2); ctx.quadraticCurveTo(acx - aw / 2, sh - ah, acx, sh - ah); ctx.quadraticCurveTo(acx + aw / 2, sh - ah, acx + aw / 2, sh - ah + aw / 2); ctx.lineTo(acx + aw / 2, sh - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = i === 1 ? '#2a1a0e' : glass; ctx.beginPath(); ctx.moveTo(acx - aw / 2 + 1, sh - 2); ctx.lineTo(acx - aw / 2 + 1, sh - ah + aw / 2); ctx.quadraticCurveTo(acx - aw / 2 + 1, sh - ah + 1, acx, sh - ah + 1); ctx.quadraticCurveTo(acx + aw / 2 - 1, sh - ah + 1, acx + aw / 2 - 1, sh - ah + aw / 2); ctx.lineTo(acx + aw / 2 - 1, sh - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = gold; ctx.fillRect(acx - 1, sh - ah - 1, 2, 3);
  }
  ctx.fillStyle = gold; ctx.fillRect(L, sh - U * 1.8, W, 1); ctx.fillStyle = shade(gold, 0.7); ctx.fillRect(L, sh - U * 1.8 + 1, W, 1);
  const uw = Math.max(3, obj.w - 2);
  for (let i = 0; i < uw; i++) { const wx = L + W * (i + 0.5) / uw - 3; litArch(ctx, wx, bodyTop + 9, 6, U * 1.1, trim, i % 2 === 0); }
  ctx.fillStyle = gold; ctx.fillRect(L, bodyTop + 3, W, 1);
  // central pediment + emblem + low dome
  const pw = W * 0.4, pApex = bodyTop - U * 1.1;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[mid - pw / 2 - 2, bodyTop], [mid, pApex - 2], [mid + pw / 2 + 2, bodyTop]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[mid - pw / 2 - 1, bodyTop], [mid, pApex], [mid + pw / 2 + 1, bodyTop]]);
  ctx.fillStyle = shade(roofc, 0.82); fillPoly(ctx, [[mid, pApex], [mid + pw / 2 + 1, bodyTop], [mid, bodyTop]]);
  ctx.fillStyle = stone; fillPoly(ctx, [[mid - pw * 0.4, bodyTop - 1], [mid, pApex + U * 0.4], [mid + pw * 0.4, bodyTop - 1]]);
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(mid, bodyTop - U * 0.35, U * 0.26, 0, 7); ctx.fill(); ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(mid, bodyTop - U * 0.35, U * 0.18, 0, 7); ctx.fill();
  ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(mid, pApex, U * 1.15 + 1, U * 0.82 + 1, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = shade(roofc, 1.15); ctx.beginPath(); ctx.ellipse(mid, pApex, U * 1.15, U * 0.82, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = shade(roofc, 0.85); ctx.beginPath(); ctx.ellipse(mid, pApex, U * 1.15, U * 0.82, 0, Math.PI * 1.5, Math.PI * 2); ctx.lineTo(mid, pApex); ctx.fill();
  ctx.fillStyle = gold; ctx.fillRect(mid - 1, pApex - U * 0.82 - 4, 2, 4); ctx.beginPath(); ctx.arc(mid, pApex - U * 0.82 - 4, 1.5, 0, 7); ctx.fill();
  for (const ux of [L + 3, mid - pw / 2 - 6, mid + pw / 2 + 3, R - 7]) { ctx.fillStyle = gold; ctx.fillRect(ux, bodyTop - 6, 4, 6); ctx.beginPath(); ctx.arc(ux + 2, bodyTop - 7, 2.4, 0, 7); ctx.fill(); }
  for (let i = 0; i < 2; i++) { const cx2 = i ? R - U * 2 : L + U * 1.5; chimneyDraw(ctx, cx2, bodyTop - U * 2.2, U * 1.8, shade(stone, 0.88)); }
}

// Victorian townhouse: projecting gabled wing with a two-storey bay window and
// gingerbread bargeboard, an entry porch, and a big chimney. house2 mirrors it
// and swaps the main roof to a dormered mansard.
function drawHouse(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, wall = cfg.wall, roofc = cfg.roof, trim = cfg.trim, mat = cfg.mat, glass = cfg.glass;
  const mir = obj.style === 'house2', wingW = Math.round(W * 0.46);
  const wX0 = mir ? R - wingW : L, wX1 = wX0 + wingW, wc = (wX0 + wX1) / 2;
  const rx0 = mir ? L : wX1, restW = mir ? (wX0 - L) : (R - wX1);
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 1, bodyTop - 1, W + 2, bh + 1);
  matFill(ctx, mat, L, bodyTop, W, bh, wall, trim);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) { const wx = rx0 + restW * (i + 0.5) / 2 - 3, wy = bodyTop + 9 + r * (bh * 0.42); if (wx > rx0 + 2 && wx < rx0 + restW - 8) winDraw(ctx, 'sash', wx, wy, 6, 9, trim, (r + i) % 2 ? glass : '#f2cf88'); }
  const dcx = rx0 + restW * 0.5;
  ctx.fillStyle = roofc; fillPoly(ctx, [[dcx - U * 0.9, sh - U * 1.5], [dcx, sh - U * 1.5 - 6], [dcx + U * 0.9, sh - U * 1.5]]);
  ctx.fillStyle = trim; ctx.fillRect(dcx - U * 0.85, sh - U * 1.5, U * 1.7, 1);
  ctx.fillStyle = shade(wall, 1.12); ctx.fillRect(dcx - U * 0.78, sh - U * 1.5, 1.5, U * 1.5); ctx.fillRect(dcx + U * 0.78 - 1.5, sh - U * 1.5, 1.5, U * 1.5);
  drawDoor(ctx, dcx, sh - 1, U * 0.8, U * 1.3, trim);
  // two-storey bay window on the wing
  const bw = wingW * 0.72;
  for (let f = 0; f < 2; f++) { const byB = sh - 2 - f * Math.round(bh * 0.44), bhh = Math.round(bh * 0.4); ctx.fillStyle = OUTLINE; ctx.fillRect(wc - bw / 2 - 1, byB - bhh - 1, bw + 2, bhh + 1); matFill(ctx, mat, wc - bw / 2, byB - bhh, bw, bhh, wall, trim); for (let i = 0; i < 3; i++) { const pwd = (bw - 4) / 3, px = wc - bw / 2 + 2 + i * pwd, lit = (i + f) % 2 === 0; ctx.fillStyle = shade(trim, 0.7); ctx.fillRect(px - 1, byB - bhh + 2, pwd - 1, bhh - 5); ctx.fillStyle = lit ? '#f2cf88' : glass; ctx.fillRect(px, byB - bhh + 3, pwd - 3, bhh - 7); } ctx.fillStyle = roofc; ctx.fillRect(wc - bw / 2 - 2, byB - bhh - 1, bw + 4, 2); }
  // front gable with bargeboard + attic window + finial
  const gApex = bodyTop - U * 1.7;
  ctx.fillStyle = OUTLINE; fillPoly(ctx, [[wX0 - 3, bodyTop], [wc, gApex - 2], [wX1 + 3, bodyTop]]);
  ctx.fillStyle = roofc; fillPoly(ctx, [[wX0 - 1, bodyTop], [wc, gApex], [wX1 + 1, bodyTop]]);
  ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[wc, gApex], [wX1 + 1, bodyTop], [wc, bodyTop]]);
  ctx.fillStyle = trim; for (let t = 0; t <= 9; t++) { const py = bodyTop - (bodyTop - gApex) * t / 9; const px = wX0 - 1 + (wc - wX0 + 1) * t / 9; fillPoly(ctx, [[px, py], [px + 3, py + 1], [px + 1, py + 3]]); const px2 = wX1 + 1 - (wX1 + 1 - wc) * t / 9; fillPoly(ctx, [[px2, py], [px2 - 3, py + 1], [px2 - 1, py + 3]]); }
  winDraw(ctx, mir ? 'sash' : 'arch', wc - 2.5, gApex + U * 0.5, 5, 7, trim, '#f2cf88');
  ctx.fillStyle = trim; ctx.fillRect(wc - 0.5, gApex - 4, 1, 4); ctx.beginPath(); ctx.arc(wc, gApex - 4, 1.5, 0, 7); ctx.fill();
  // main roof over the rest: hip (house) or mansard+dormer (house2)
  const rL = mir ? L : wX1, rR = mir ? wX0 : R, rApex = bodyTop - (mir ? U * 1.2 : U * 1.3);
  if (mir) { const ins = (rR - rL) * 0.16; ctx.fillStyle = OUTLINE; fillPoly(ctx, [[rL - 2, bodyTop], [rL + ins, rApex], [rR - ins, rApex], [rR + 2, bodyTop]]); ctx.fillStyle = roofc; fillPoly(ctx, [[rL - 1, bodyTop], [rL + ins, rApex], [rR - ins, rApex], [rR + 1, bodyTop]]); dormerDraw(ctx, (rL + rR) / 2, bodyTop - U * 0.4, roofc, trim, glass); ctx.fillStyle = trim; ctx.fillRect(rL + ins, rApex - 1, rR - rL - 2 * ins, 1); }
  else { const ins = (rR - rL) * 0.22; ctx.fillStyle = OUTLINE; fillPoly(ctx, [[rL - 2, bodyTop], [rL + ins, rApex], [rR - ins, rApex], [rR + 2, bodyTop]]); ctx.fillStyle = roofc; fillPoly(ctx, [[rL - 1, bodyTop], [rL + ins, rApex], [rR - ins, rApex], [rR + 1, bodyTop]]); ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[(rL + rR) / 2, rApex], [rR - ins, rApex], [rR + 1, bodyTop], [(rL + rR) / 2, bodyTop]]); }
  const chx = mir ? L + U * 0.6 : R - U * 1.4; chimneyDraw(ctx, chx, bodyTop - U * 2.4, U * 2, shade(wall, 0.9)); smoke(ctx, chx + 2, bodyTop - U * 2.4);
}

// Victorian shopfront: fascia sign board over warm-lit display windows and a
// door, sash windows above. shop = dormered mansard, shop2 = steep gable + sign.
function drawShop(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, wall = cfg.wall, roofc = cfg.roof, trim = cfg.trim, mat = cfg.mat, glass = cfg.glass, gable = obj.style === 'shop2';
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 1, bodyTop - 1, W + 2, bh + 1);
  matFill(ctx, mat, L, bodyTop, W, bh, wall, trim);
  const rows = Math.max(1, obj.h - 3), cols = Math.max(2, obj.w - 2);
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) { const wx = L + W * (i + 0.5) / cols - 3, wy = bodyTop + 8 + r * ((bh - U * 1.9 - 8) / rows); winDraw(ctx, 'sash', wx, wy, 6, 9, trim, (r + i) % 2 ? glass : '#f2cf88'); }
  const fy = sh - U * 1.7;
  ctx.fillStyle = shade(roofc, 1.05); ctx.fillRect(L + 1, fy - 4, W - 2, 5); ctx.fillStyle = trim; ctx.fillRect(L + 1, fy - 4, W - 2, 1); ctx.fillRect(L + 1, fy, W - 2, 1);
  ctx.fillStyle = trim; for (let x = L + 6; x < R - 6; x += 5) ctx.fillRect(x, fy - 2.5, 3, 1.5);
  ctx.fillStyle = OUTLINE; ctx.fillRect(L + 2, fy, W - 4, sh - fy - 1);
  const dcx = R - U * 1.3, dw = U;
  const panes = Math.max(3, obj.w - 2), pw = (dcx - dw / 2 - 2 - (L + 3)) / panes;
  for (let i = 0; i < panes; i++) { const px = L + 3 + i * pw; ctx.fillStyle = '#f2cf88'; ctx.fillRect(px, fy + 2, pw - 1, sh - fy - 4); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px, fy + 2, pw - 1, 2); ctx.fillStyle = shade(trim, 0.7); ctx.fillRect(px - 1, fy + 2, 1, sh - fy - 4); }
  const ay = fy + 1; for (let i = 0; i * 4 < (dcx - dw / 2 - L - 2); i++) { ctx.fillStyle = i & 1 ? shade(trim, 1.05) : '#8a4a4a'; fillPoly(ctx, [[L + 2 + i * 4, ay], [L + 2 + i * 4 + 4, ay], [L + 2 + i * 4 + 2, ay + 4]]); }
  drawDoor(ctx, dcx, sh - 1, dw, U * 1.4, trim);
  if (gable) { const sg = L + 3; ctx.fillStyle = trim; ctx.fillRect(sg, bodyTop + 4, 1, 7); ctx.fillRect(sg, bodyTop + 4, 7, 1); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(sg + 4, bodyTop + 10, 7, 6); ctx.fillStyle = glass; ctx.fillRect(sg + 5, bodyTop + 11, 5, 4); }
  if (gable) { const apexY = bodyTop - U * 1.9; ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 3, bodyTop], [mid, apexY - 2], [R + 3, bodyTop]]); ctx.fillStyle = roofc; fillPoly(ctx, [[L - 1, bodyTop], [mid, apexY], [R + 1, bodyTop]]); ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[mid, apexY], [R + 1, bodyTop], [mid, bodyTop]]); ctx.fillStyle = trim; for (let gx = L - 2; gx < R + 2; gx += 4) fillPoly(ctx, [[gx, bodyTop], [gx + 4, bodyTop], [gx + 2, bodyTop + 2]]); ctx.fillStyle = trim; ctx.fillRect(mid - 0.5, apexY - 4, 1, 4); }
  else { const ins = W * 0.14, apexY = bodyTop - U * 1.6; ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 3, bodyTop], [L + ins, apexY], [R - ins, apexY], [R + 3, bodyTop]]); ctx.fillStyle = roofc; fillPoly(ctx, [[L - 1, bodyTop], [L + ins, apexY], [R - ins, apexY], [R + 1, bodyTop]]); ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[mid, apexY], [R - ins, apexY], [R + 1, bodyTop], [mid, bodyTop]]); const nd = Math.max(1, obj.w - 3); for (let i = 0; i < nd; i++) dormerDraw(ctx, L + W * (i + 0.5) / nd, bodyTop - U * 0.5, roofc, trim, glass); ctx.fillStyle = trim; ctx.fillRect(L + ins, apexY - 1, W - 2 * ins, 1); }
  const chx = R - U * 1.6; chimneyDraw(ctx, chx, bodyTop - U * 2.2, U * 1.8, shade(wall, 0.9)); smoke(ctx, chx + 2, bodyTop - U * 2.2);
}

// Collegiate boarding house: long brick block, central porch, rows of sash
// windows. dorm = a row of gabled dormer-gables; dorm2 = hip roof + cupola.
function drawDorm(ctx, obj, cfg, L, R, mid, bodyTop, sh) {
  const W = R - L, bh = sh - bodyTop, wall = cfg.wall, roofc = cfg.roof, trim = cfg.trim, mat = cfg.mat, glass = cfg.glass, hip = obj.style === 'dorm2';
  ctx.fillStyle = OUTLINE; ctx.fillRect(L - 1, bodyTop - 1, W + 2, bh + 1);
  matFill(ctx, mat, L, bodyTop, W, bh, wall, trim);
  const rows = Math.max(2, obj.h - 3), cols = Math.max(3, obj.w - 2);
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) { const wx = L + W * (i + 0.5) / cols - 3, wy = bodyTop + 8 + r * ((bh - 14) / rows); if (r === rows - 1 && Math.abs(wx + 3 - mid) < U) continue; winDraw(ctx, 'sash', wx, wy, 6, 8, trim, (r * 3 + i) % 3 ? glass : '#f2cf88'); }
  ctx.fillStyle = roofc; fillPoly(ctx, [[mid - U, sh - U * 1.5], [mid, sh - U * 1.5 - 6], [mid + U, sh - U * 1.5]]);
  ctx.fillStyle = trim; ctx.fillRect(mid - U * 0.9, sh - U * 1.5, U * 1.8, 1);
  drawDoor(ctx, mid, sh - 1, U * 0.9, U * 1.4, trim);
  ctx.fillStyle = trim; ctx.fillRect(L - 1, bodyTop - 1, W + 2, 2);
  if (hip) {
    const ins = W * 0.08, apexY = bodyTop - U * 1.3;
    ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 3, bodyTop], [L + ins, apexY], [R - ins, apexY], [R + 3, bodyTop]]);
    ctx.fillStyle = roofc; fillPoly(ctx, [[L - 1, bodyTop], [L + ins, apexY], [R - ins, apexY], [R + 1, bodyTop]]);
    ctx.fillStyle = shade(roofc, 0.85); fillPoly(ctx, [[mid, apexY], [R - ins, apexY], [R + 1, bodyTop], [mid, bodyTop]]);
    const nd = Math.max(3, obj.w - 3); for (let i = 0; i < nd; i++) dormerDraw(ctx, L + W * (i + 0.5) / nd, bodyTop - U * 0.5, roofc, trim, glass);
    const cw = U * 1.3; ctx.fillStyle = OUTLINE; ctx.fillRect(mid - cw / 2 - 1, apexY - U * 0.9 - 1, cw + 2, U * 0.9 + 1); ctx.fillStyle = wall; ctx.fillRect(mid - cw / 2, apexY - U * 0.9, cw, U * 0.9); ctx.fillStyle = glass; ctx.fillRect(mid - cw / 2 + 1, apexY - U * 0.9 + 2, cw - 2, U * 0.9 - 3); ctx.fillStyle = trim; ctx.beginPath(); ctx.ellipse(mid, apexY - U * 0.9, cw / 2, U * 0.6, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = OUTLINE; ctx.fillRect(mid - 0.5, apexY - U * 0.9 - U * 0.6 - 3, 1, 3);
    for (let i = 0; i < 3; i++) chimneyDraw(ctx, L + W * (i + 1) / 4 - 2, bodyTop - U * 2.2, U * 1.8, shade(wall, 0.9));
  } else {
    const eaveApex = bodyTop - U * 0.7; ctx.fillStyle = OUTLINE; fillPoly(ctx, [[L - 2, bodyTop], [L, eaveApex - 1], [R, eaveApex - 1], [R + 2, bodyTop]]); ctx.fillStyle = shade(roofc, 0.9); fillPoly(ctx, [[L - 1, bodyTop], [L, eaveApex], [R, eaveApex], [R + 1, bodyTop]]);
    const ng = Math.max(3, Math.round(obj.w / 3));
    for (let g = 0; g < ng; g++) {
      const gcx = L + W * (g + 0.5) / ng, gw = W / ng * 0.72, gA = bodyTop - U * 1.5;
      ctx.fillStyle = OUTLINE; fillPoly(ctx, [[gcx - gw / 2 - 1, bodyTop], [gcx, gA - 2], [gcx + gw / 2 + 1, bodyTop]]);
      ctx.fillStyle = roofc; fillPoly(ctx, [[gcx - gw / 2, bodyTop], [gcx, gA], [gcx + gw / 2, bodyTop]]);
      ctx.fillStyle = shade(roofc, 0.8); fillPoly(ctx, [[gcx, gA], [gcx + gw / 2, bodyTop], [gcx, bodyTop]]);
      ctx.fillStyle = trim; for (let t = 0; t <= 6; t++) { const py = bodyTop - (bodyTop - gA) * t / 6, px = gcx - gw / 2 + (gw / 2) * t / 6; fillPoly(ctx, [[px, py], [px + 2, py + 1], [px + 1, py + 2]]); const px2 = gcx + gw / 2 - (gw / 2) * t / 6; fillPoly(ctx, [[px2, py], [px2 - 2, py + 1], [px2 - 1, py + 2]]); }
      winDraw(ctx, 'arch', gcx - 2, gA + U * 0.4, 4, 5, trim, '#f2cf88');
      ctx.fillStyle = trim; ctx.fillRect(gcx - 0.5, gA - 3, 1, 3);
    }
    for (let g = 0; g < ng - 1; g++) chimneyDraw(ctx, L + W * (g + 1) / ng - 2, bodyTop - U * 2, U * 1.6, shade(wall, 0.9));
  }
}

const BESPOKE = { cafe: drawCafe, library: drawLibrary, inn: drawInn, opera: drawOpera, house: drawHouse, house2: drawHouse, shop: drawShop, shop2: drawShop, dorm: drawDorm, dorm2: drawDorm };

function buildVictorian(obj) {
  const cfg = VST[obj.style] || VST.house;
  const W = obj.w * U, bodyH = obj.h * U, PAD = 6, grand = !!cfg.grand, rt = cfg.roofType || 'gable';
  const roofH = grand ? Math.round(U * 2.6) : rt === 'gable' ? Math.round(U * 2.1) : rt === 'mansard' ? Math.round(U * 1.7) : Math.round(U * 1.4);
  const towerH = grand ? Math.round(U * 3.2) : 0;
  const topExtra = grand ? towerH + roofH + Math.round(U * 3.2) : Math.round(U * 4.4);
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

// ---------------- CHARACTERS (redrawn — prettier, more human) ----------------
// Native sprite drawn at CW x CH, then the renderer scales it. Slimmer, taller
// proportions with a defined head, neck, torso, arms and striding legs, plus a
// soft-shaded face (eyes with highlights, brows, blush, mouth).
const CW = 32, CH = 48, CX = 16, OUT = '#241826';
const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

function chrPal(look) {
  return {
    sk: look.skin, skS: shade(look.skin, 0.85), skL: shade(look.skin, 1.07),
    ha: look.hair, haS: shade(look.hair, 0.75), haL: shade(look.hair, 1.28),
    ou: look.outfit, ouS: shade(look.outfit, 0.78), ouL: shade(look.outfit, 1.2),
    eye: look.eye, blush: 'rgba(240,130,150,0.5)', shoe: shade(look.outfit, 0.5),
  };
}

// Legs + shoes. dir: 'front'|'back'|'side'. p: 0 stand, 1 left-fwd, 2 right-fwd.
function legs(ctx, P, dir, p) {
  const yTop = 37, len = 8;
  if (dir === 'side') {
    // striding profile: a front leg and a back leg
    const swing = p === 1 ? 3 : p === 2 ? -3 : 0;
    const back = { x: CX - 2 - swing, };
    const front = { x: CX - 2 + swing };
    R(ctx, back.x, yTop, 4, len, P.ouS); R(ctx, back.x, yTop + len, 5, 2, shade(P.shoe, 0.9)); // back leg
    R(ctx, front.x, yTop, 4, len, P.ou); R(ctx, front.x - 1, yTop + len, 5, 2, P.shoe);        // front leg
    ctx.fillStyle = OUT; ctx.fillRect(front.x, yTop, 1, len);
    return;
  }
  const lo = p === 1 ? -1 : p === 2 ? 1 : 0;   // left leg vertical step
  const ro = p === 1 ? 1 : p === 2 ? -1 : 0;
  const lx = CX - 5, rx = CX + 1;
  R(ctx, lx, yTop + Math.max(0, lo), 4, len - Math.abs(lo), P.ouS);
  R(ctx, rx, yTop + Math.max(0, ro), 4, len - Math.abs(ro), P.ouS);
  R(ctx, lx, yTop + len - 1, 4, 3, P.shoe);                 // shoes
  R(ctx, rx, yTop + len - 1, 4, 3, P.shoe);
  R(ctx, lx, yTop + len - 1, 4, 1, shade(P.shoe, 1.3));
  R(ctx, rx, yTop + len - 1, 4, 1, shade(P.shoe, 1.3));
}

// Torso + arms. dir: 'front'|'back'|'side'.
function torso(ctx, P, dir, p) {
  const top = 24, bot = 38;
  if (dir === 'side') {
    R(ctx, CX - 5, top, 9, bot - top, P.ou);
    R(ctx, CX - 5, top, 2, bot - top, P.ouL); R(ctx, CX + 2, top, 2, bot - top, P.ouS);
    // one swinging arm in front
    const sw = p === 1 ? 2 : p === 2 ? -2 : 0;
    R(ctx, CX - 2 + sw, top + 3, 3, 8, P.ouS);
    R(ctx, CX - 2 + sw, top + 10, 3, 2, P.sk);              // hand
    ctx.fillStyle = OUT; ctx.fillRect(CX - 6, top, 1, bot - top);
    return;
  }
  // front / back torso: shoulders taper to waist
  R(ctx, CX - 6, top, 12, 4, P.ou);                          // shoulders
  R(ctx, CX - 5, top + 4, 10, 6, P.ou);
  R(ctx, CX - 4, top + 10, 8, bot - top - 10, P.ou);         // waist
  R(ctx, CX - 6, top, 3, 10, P.ouL); R(ctx, CX + 3, top, 3, 10, P.ouS); // shading
  if (dir === 'front') { R(ctx, CX - 1, top + 2, 2, 10, shade(P.ou, 0.9)); } // placket
  // arms swing opposite to legs
  const la = p === 1 ? 1 : p === 2 ? -1 : 0;
  const ra = p === 1 ? -1 : p === 2 ? 1 : 0;
  R(ctx, CX - 8, top + 2 + la, 3, 8, P.ouS);  R(ctx, CX - 8, top + 10 + la, 3, 2, P.sk); // L arm+hand
  R(ctx, CX + 5, top + 2 + ra, 3, 8, P.ouS);  R(ctx, CX + 5, top + 10 + ra, 3, 2, P.sk); // R arm+hand
  R(ctx, CX - 3, top - 1, 6, 1, P.sk);                       // neck
}

// Head + hair + face.
function head(ctx, P, style, dir) {
  const top = 6, faceB = 20;
  const back = dir === 'back', side = dir === 'side';
  // face (skin) — rounded block
  if (!back) {
    R(ctx, CX - 6, top + 1, 12, faceB - top - 1, P.sk);
    R(ctx, CX - 7, top + 3, 1, faceB - top - 5, P.sk); R(ctx, CX + 6, top + 3, 1, faceB - top - 5, P.sk); // cheeks
    R(ctx, CX - 6, top, 12, 1, P.sk); R(ctx, CX - 5, top + (faceB - top - 1), 10, 1, P.sk);
    R(ctx, CX + 3, top + 2, 3, faceB - top - 3, P.skS);      // shade side
    R(ctx, CX - 7, top + 3, 2, faceB - top - 6, P.skL);      // light side
  } else {
    R(ctx, CX - 6, top, 12, faceB - top, P.sk);
  }
  drawHairAndFace(ctx, P, style, dir, top, faceB);
}

function drawHairAndFace(ctx, P, style, dir, top, faceB) {
  const back = dir === 'back', side = dir === 'side';
  // ---- face features (front & side only) ----
  if (!back) {
    if (side) {
      R(ctx, CX + 2, top + 6, 2, 2, '#fff'); R(ctx, CX + 3, top + 6, 1, 2, P.eye); R(ctx, CX + 3, top + 6, 1, 1, OUT);
      R(ctx, CX + 1, top + 5, 3, 1, P.haS);                  // brow
      R(ctx, CX + 4, top + 9, 2, 1, P.blush);                // blush
      R(ctx, CX + 4, top + 11, 2, 1, shade(P.sk, 0.7));      // mouth
    } else {
      // two eyes with white, iris, pupil, highlight
      for (const ex of [CX - 4, CX + 2]) {
        R(ctx, ex, top + 6, 3, 3, '#fff');
        R(ctx, ex + 1, top + 6, 2, 3, P.eye);
        R(ctx, ex + 1, top + 7, 1, 2, OUT);
        R(ctx, ex + 1, top + 6, 1, 1, '#fff');               // highlight
      }
      R(ctx, CX - 5, top + 4, 3, 1, P.haS); R(ctx, CX + 2, top + 4, 3, 1, P.haS); // brows
      R(ctx, CX - 5, top + 9, 2, 1, P.blush); R(ctx, CX + 3, top + 9, 2, 1, P.blush); // blush
      R(ctx, CX - 1, top + 8, 1, 1, P.skS);                  // nose
      R(ctx, CX - 1, top + 11, 3, 1, shade(P.sk, 0.7));      // mouth
    }
  }
  // ---- hair ----
  const H = P.ha, HL = P.haL, HS = P.haS;
  const cap = () => { // crown + top shading
    R(ctx, CX - 6, top - 2, 12, 5, H);
    R(ctx, CX - 7, top, 14, 2, H);
    R(ctx, CX - 6, top - 2, 12, 1, HL);
    R(ctx, CX + 2, top - 1, 3, 3, HS);
  };
  if (style === 'hood') {
    const h = shade(P.ou, 1.05), hs = shade(P.ou, 0.8);
    R(ctx, CX - 8, top - 3, 16, 7, h);
    if (side) R(ctx, CX - 8, top - 3, 14, 15, h);
    else { R(ctx, CX - 8, top - 1, 3, 14, h); R(ctx, CX + 5, top - 1, 3, 14, hs); if (back) R(ctx, CX - 8, top - 1, 16, 14, h); }
    return;
  }
  cap();
  if (back) { R(ctx, CX - 7, top, 14, faceB - top + 2, H); R(ctx, CX + 3, top, 4, faceB - top, HS); }
  if (side) {
    R(ctx, CX - 7, top - 1, 5, faceB - top + 1, H);          // back of side hair
    if (style === 'long') R(ctx, CX - 7, top, 4, faceB - top + 8, H);
    if (style === 'ponytail') { R(ctx, CX - 9, top + 1, 3, 10, H); R(ctx, CX - 9, top + 10, 3, 1, HS); }
  } else {
    // front side-locks framing the face
    R(ctx, CX - 7, top, 2, faceB - top - 2, H); R(ctx, CX + 5, top, 2, faceB - top - 2, H);
    R(ctx, CX - 7, top, 1, faceB - top - 2, HL);
    // bangs
    R(ctx, CX - 6, top + 1, 12, 2, H); R(ctx, CX - 1, top + 1, 2, 3, H);   // centre fringe
    switch (style) {
      case 'long': R(ctx, CX - 8, top, 2, faceB - top + 9, H); R(ctx, CX + 6, top, 2, faceB - top + 9, H); if (back) R(ctx, CX - 8, top, 16, faceB - top + 9, H); break;
      case 'ponytail': R(ctx, CX + 6, top, 2, faceB - top + 6, H); R(ctx, CX + 7, top + 3, 2, 6, HS); break;
      case 'spiky': for (const sx of [CX - 6, CX - 3, CX, CX + 3, CX + 5]) { R(ctx, sx, top - 4, 2, 4, H); } R(ctx, CX - 6, top - 4, 1, 4, HL); break;
      case 'bun': R(ctx, CX - 3, top - 5, 6, 4, H); R(ctx, CX - 2, top - 5, 4, 1, HL); break;
      case 'bob': R(ctx, CX - 7, top, 2, faceB - top + 1, H); R(ctx, CX + 5, top, 2, faceB - top + 1, H); break;
      case 'braids': R(ctx, CX - 8, top + 3, 2, faceB - top + 4, H); R(ctx, CX + 6, top + 3, 2, faceB - top + 4, H); R(ctx, CX - 8, top + faceB - top + 6, 2, 1, HL); R(ctx, CX + 6, top + faceB - top + 6, 2, 1, HL); break;
      default: break; // short
    }
  }
}

function renderChar(dir, look, p) {
  const P = chrPal(look), { c, ctx } = makeCanvas(CW, CH);
  ctx.imageSmoothingEnabled = false;
  const style = look.hairStyle || 'short';
  const d = dir === 'up' ? 'back' : (dir === 'down' ? 'front' : 'side');
  legs(ctx, P, d, p);
  torso(ctx, P, d, p);
  head(ctx, P, style, d);
  return c;
}

export function makeCharacter(look, _S) {
  const L = { skin: '#e9c39b', hair: '#6a2fb0', hairStyle: 'short', eye: '#ff4a8d', outfit: '#2a1f3a', ...look };
  const dir = (d) => [renderChar(d, L, 0), renderChar(d, L, 1), renderChar(d, L, 2)];
  const right = dir('right');
  return { down: dir('down'), up: dir('up'), right, left: right, w: CW, h: CH, flipLeft: true };
}

// ---------------- NPC SPRITES (MinifolksVillagers — real pixel art) ----------------
// Front-facing villager sheets: row 0 = idle (4 frames), row 1 = walk (6). We
// scale them up so their on-screen height matches the procedural player, and
// flip horizontally for left/right movement (there is no back/side art).
const NPC_TYPES = ['princess', 'queen', 'nobleman', 'noblewoman', 'oldman', 'oldwoman', 'peasant', 'villagerman', 'villagerwoman', 'worker'];
const NF = 32, NPC_SCALE = 3, NPC_FEET = 30;   // native frame, upscale, feet row
const npcImgs = {};
export function loadNpcSheets() {
  for (const t of NPC_TYPES) { const img = new Image(); img.src = `/assets/npc/${t}.png`; npcImgs[t] = img; }
}
const npcFrameCache = new Map();
export function npcFrames(type) {
  const img = npcImgs[type];
  if (!img || !img.complete || !img.naturalWidth) return null;      // still loading
  if (npcFrameCache.has(type)) return npcFrameCache.get(type);
  const slice = (col, row) => {
    const { c, ctx } = makeCanvas(NF * NPC_SCALE, NF * NPC_SCALE);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, col * NF, row * NF, NF, NF, 0, 0, NF * NPC_SCALE, NF * NPC_SCALE);
    return c;
  };
  const f = {
    idle: [0, 1, 2, 3].map((c) => slice(c, 0)),
    walk: [0, 1, 2, 3, 4, 5].map((c) => slice(c, 1)),
    w: NF * NPC_SCALE, h: NF * NPC_SCALE,
    feet: NPC_FEET * NPC_SCALE, headTop: 16 * NPC_SCALE, cw: 16 * NPC_SCALE,
  };
  npcFrameCache.set(type, f);
  return f;
}

// ---------------- PORTRAIT ----------------
export function npcPortrait(type) {   // a static idle frame for dialogue portraits
  const f = npcFrames(type); return f ? f.idle[0] : null;
}
export function drawPortrait(ctx, look, x, y, size) {
  const L = { skin: '#e9c39b', hair: '#6a2fb0', hairStyle: 'short', eye: '#ff4a8d', outfit: '#2a1f3a', ...look };
  const front = renderChar('down', L, 0);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const sc = size / CW;                       // width fills the box; body extends below (bust)
  ctx.drawImage(front, x, y, CW * sc, CH * sc);
  ctx.restore();
}
