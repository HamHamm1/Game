// Procedural pixel-art engine v2: blob-autotiled terrain, building/tree/prop
// sprites with depth, and customizable characters (hairstyles + outfits).
import { T } from '/shared/tiles.js';
import { TILE } from '/shared/maps.js';

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

// ---------------- TERRAIN (baked per map) ----------------
const TERRAIN = {
  [T.GRASS]:     { base: '#4a8b3f', hi: '#5aa24b', lo: '#3c7534', pr: 3 },
  [T.TALLGRASS]: { base: '#3f7d36', hi: '#57a047', lo: '#356b2d', pr: 3 },
  [T.PATH]:      { base: '#c9b48a', hi: '#d8c69e', lo: '#b39a6f', pr: 4 },
  [T.ROAD]:      { base: '#b7a98a', hi: '#c9bda3', lo: '#9c8b6f', pr: 4 },
  [T.PLAZA]:     { base: '#cdbfa0', hi: '#ddd0b3', lo: '#b3a488', pr: 4 },
  [T.FLOOR]:     { base: '#cdbfa0', hi: '#ddd0b3', lo: '#b3a488', pr: 4 },
  [T.DIRT]:      { base: '#a9885f', hi: '#bd9c6f', lo: '#8f7049', pr: 4 },
  [T.SAND]:      { base: '#e0cc95', hi: '#eeddac', lo: '#cdb87f', pr: 2 },
  [T.SNOW]:      { base: '#e8eef5', hi: '#ffffff', lo: '#cfd8e6', pr: 3 },
  [T.CARPET]:    { base: '#7a2f4a', hi: '#95466a', lo: '#5f2038', pr: 4 },
  [T.WATER]:     { base: '#3f79c9', hi: '#5f9ae0', lo: '#2f5fa8', pr: 1 },
  [T.DEEPWATER]: { base: '#274f8f', hi: '#3a68a8', lo: '#1d3d70', pr: 0 },
  [T.ROCK]:      { base: '#7d7568', hi: '#948b7c', lo: '#615a50', pr: 5 },
};
const terr = (code) => TERRAIN[code] || TERRAIN[T.GRASS];

function flatTile(ctx, px, py, code) {
  const c = terr(code); ctx.fillStyle = c.base; ctx.fillRect(px, py, TILE, TILE);
  // subtle texture dots
  for (let i = 0; i < 6; i++) {
    const hx = hashf(px + i * 3, py), hy = hashf(py + i * 5, px);
    ctx.fillStyle = hx > 0.5 ? c.hi : c.lo;
    ctx.fillRect(px + (hx * TILE | 0), py + (hy * TILE | 0), 2, 2);
  }
  if (code === T.WATER || code === T.DEEPWATER) {
    ctx.fillStyle = c.hi;
    ctx.fillRect(px + 4, py + 8 + (hashf(px, py) * 6 | 0), 10, 2);
    ctx.fillRect(px + 16, py + 20 + (hashf(py, px) * 6 | 0), 8, 2);
  }
}

// Round an outer corner: fill the quadrant with the lower-priority neighbour.
function roundCorner(ctx, px, py, qx, qy, lowCode) {
  const c = terr(lowCode);
  const cx = px + qx * 16, cy = py + qy * 16;
  ctx.fillStyle = c.base;
  ctx.fillRect(cx, cy, 16, 16);
  // foam / edge highlight for water
  if (lowCode === T.WATER || lowCode === T.DEEPWATER) { ctx.fillStyle = shade(c.hi, 1.1); }
}

export function bakeMap(map) {
  const { c, ctx } = makeCanvas(map.w * TILE, map.h * TILE);
  const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h) ? T.GRASS : map.tiles[y * map.w + x];
  // pass 1: flat tiles
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) flatTile(ctx, x * TILE, y * TILE, map.tiles[y * map.w + x]);
  // pass 2: round outer corners toward lower-priority neighbours
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const code = map.tiles[y * map.w + x], g = terr(code).pr, px = x * TILE, py = y * TILE;
    const corners = [
      [0, 0, at(x - 1, y), at(x, y - 1)],   // TL
      [1, 0, at(x + 1, y), at(x, y - 1)],   // TR
      [0, 1, at(x - 1, y), at(x, y + 1)],   // BL
      [1, 1, at(x + 1, y), at(x, y + 1)],   // BR
    ];
    for (const [qx, qy, nH, nV] of corners) {
      if (terr(nH).pr < g && terr(nV).pr < g && nH === nV) roundCorner(ctx, px, py, qx, qy, nH);
    }
  }
  return c;
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

export function buildingSprite(obj) {
  return cached(`b:${obj.style}:${obj.w}:${obj.h}:${obj.door}`, () => {
    const s = BSTYLE[obj.style] || BSTYLE.house;
    const W = obj.w * TILE, bodyH = obj.h * TILE, roofH = Math.round(TILE * 1.6);
    const H = bodyH + roofH;
    const { c, ctx } = makeCanvas(W, H);
    // body
    ctx.fillStyle = s.wall; ctx.fillRect(0, roofH, W, bodyH);
    ctx.fillStyle = shade(s.wall, 0.85); ctx.fillRect(0, roofH, W, 3);
    // stone courses
    ctx.fillStyle = shade(s.wall, 0.9);
    for (let y = roofH + 8; y < H; y += 10) ctx.fillRect(0, y, W, 1);
    // windows
    ctx.fillStyle = s.win;
    const cols = Math.max(1, obj.w - 2), rows = Math.max(1, obj.h - 2);
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
      const wx = 10 + cx * ((W - 20) / cols), wy = roofH + 12 + cy * ((bodyH - 20) / Math.max(1, rows));
      ctx.fillStyle = s.win; ctx.fillRect(wx, wy, 10, 12);
      ctx.strokeStyle = shade(s.trim, 0.8); ctx.strokeRect(wx + .5, wy + .5, 10, 12);
      ctx.fillStyle = shade(s.win, 0.7); ctx.fillRect(wx + 4, wy, 2, 12);
    }
    // door
    const dx = obj.door * TILE;
    ctx.fillStyle = '#4a3020'; ctx.fillRect(dx + 6, H - TILE - 2, TILE - 12, TILE + 2);
    ctx.fillStyle = shade(s.trim, 1.1); ctx.fillRect(dx + TILE - 12, H - 16, 2, 2);
    ctx.strokeStyle = shade(s.wall, 0.6); ctx.strokeRect(dx + 6.5, H - TILE - 1.5, TILE - 12, TILE + 2);
    // roof (gable)
    ctx.fillStyle = s.roof;
    ctx.beginPath(); ctx.moveTo(-4, roofH + 2); ctx.lineTo(W / 2, 0); ctx.lineTo(W + 4, roofH + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(s.roof, 1.2);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W + 4, roofH + 2); ctx.lineTo(W / 2, roofH + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = s.trim; ctx.fillRect(-4, roofH, W + 8, 4);
    // finial
    ctx.fillStyle = s.trim; ctx.fillRect(W / 2 - 1, -6, 2, 8);
    return { canvas: c, ox: 0, oy: -(H - bodyH) };
  });
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
