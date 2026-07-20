// Procedural pixel-art: no external image assets. Everything is drawn into
// offscreen canvases once, then blitted crisply (image smoothing off).
import { TILE } from '/shared/constants.js';
import { T } from '/shared/worldgen.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

// Draw a grid of single-char color keys at block size S.
function paint(ctx, grid, pal, S, ox = 0, oy = 0) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * S, oy + y * S, S, S);
    }
  }
}

// ---------- Character sprite sheets (4 dirs x 3 walk frames) ----------
const FRONT = [
  '   HHHHHH   ',
  '  HHHHHHHH  ',
  ' HHHHHHHHHH ',
  ' HHSSSSSSHH ',
  ' HSSSSSSSSH ',
  ' HSEWSSWESH ',
  ' HSSSSSSSSH ',
  '  SSSSSSSS  ',
  '  AOOOOOOA  ',
  ' OOOOOOOOOO ',
  ' OOOOOOOOOO ',
  ' OOCOOOOCOO ',
  '  OOOOOOOO  ',
  '  OO    OO  ',
];
const BACK = [
  '   HHHHHH   ',
  '  HHHHHHHH  ',
  ' HHHHHHHHHH ',
  ' HHHHHHHHHH ',
  ' HHHHHHHHHH ',
  ' HHHHHHHHHH ',
  ' HHHHHHHHHH ',
  '  SSSSSSSS  ',
  '  AOOOOOOA  ',
  ' OOOOOOOOOO ',
  ' OOOOOOOOOO ',
  ' OOOOOOOOOO ',
  '  OOOOOOOO  ',
  '  OO    OO  ',
];
const SIDE = [
  '   HHHHH    ',
  '  HHHHHHH   ',
  ' HHHHHHHHH  ',
  ' HHSSSSSH   ',
  ' HSSSSSSH   ',
  ' HSSSWES    ',
  ' HSSSSSS    ',
  '  SSSSSS    ',
  '  AOOOOO    ',
  '  OOOOOOO   ',
  '  OOOOOOO   ',
  '  OOOOOO    ',
  '  OOOOO     ',
  '  OO OO     ',
];

const legDown = (ctx, x, S, pal) => {
  ctx.fillStyle = pal.O; ctx.fillRect(x * S, 14 * S, 2 * S, 1 * S);
  ctx.fillStyle = pal.B; ctx.fillRect(x * S, 15 * S, 2 * S, 1 * S);
};
const legUp = (ctx, x, S, pal) => {
  ctx.fillStyle = pal.B; ctx.fillRect(x * S, 14 * S, 2 * S, 1 * S);
};

function frame(grid, pal, S, leftDown, rightDown, bob) {
  const { c, ctx } = makeCanvas(12 * S, 16 * S);
  paint(ctx, grid, pal, S, 0, bob * S);
  (leftDown ? legDown : legUp)(ctx, 2.5, S, pal);
  (rightDown ? legDown : legUp)(ctx, 7.5, S, pal);
  return c;
}

export function makeCharacter(colors, S = 3) {
  const pal = {
    H: colors.hair, A: colors.accent || shade(colors.hair, 1.25),
    S: colors.skin, E: colors.eye, W: '#ffffff',
    O: colors.outfit, C: shade(colors.outfit, 0.7), B: '#2a2320',
  };
  const dir = (grid) => [
    frame(grid, pal, S, true, true, 0),    // 0 idle
    frame(grid, pal, S, true, false, -1),  // 1 step A
    frame(grid, pal, S, false, true, -1),  // 2 step B
  ];
  const right = dir(SIDE);
  // Mirror the side sheet for walking left.
  const left = right.map((f) => {
    const { c, ctx } = makeCanvas(f.width, f.height);
    ctx.translate(f.width, 0); ctx.scale(-1, 1); ctx.drawImage(f, 0, 0);
    return c;
  });
  return { down: dir(FRONT), up: dir(BACK), right, left, w: 12 * S, h: 16 * S };
}

// ---------- Tileset ----------
function noise(ctx, w, h, color, density) {
  ctx.fillStyle = color;
  for (let i = 0; i < density; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5) % 1;
    const y = (Math.sin(i * 78.233) * 12543.7) % 1;
    ctx.fillRect(Math.abs(x) * w | 0, Math.abs(y) * h | 0, 2, 2);
  }
}
function tile(draw) {
  const { c, ctx } = makeCanvas(TILE, TILE);
  draw(ctx);
  return c;
}

export function makeTiles() {
  const s = {};
  s[T.GRASS] = tile((x) => { x.fillStyle = '#3f7a3a'; x.fillRect(0, 0, TILE, TILE); noise(x, TILE, TILE, '#4c8f43', 40); noise(x, TILE, TILE, '#356b32', 20); });
  s[T.PATH]  = tile((x) => { x.fillStyle = '#b9a583'; x.fillRect(0, 0, TILE, TILE); noise(x, TILE, TILE, '#a8946f', 30); x.strokeStyle = '#9c8964'; x.strokeRect(0.5, 0.5, TILE - 1, TILE - 1); });
  s[T.WATER] = tile((x) => { x.fillStyle = '#2a5fa8'; x.fillRect(0, 0, TILE, TILE); x.fillStyle = '#3f79c9'; x.fillRect(0, 6, TILE, 3); x.fillRect(0, 20, TILE, 3); x.fillStyle = '#6fa8e0'; x.fillRect(4, 12, 8, 2); });
  s[T.TREE]  = tile((x) => { x.fillStyle = '#3f7a3a'; x.fillRect(0, 0, TILE, TILE); x.fillStyle = '#5a3b22'; x.fillRect(14, 18, 4, 12); x.fillStyle = '#1f5a2a'; x.beginPath(); x.arc(16, 13, 13, 0, 7); x.fill(); x.fillStyle = '#2f7a3a'; x.beginPath(); x.arc(12, 11, 8, 0, 7); x.fill(); x.fillStyle = '#43994c'; x.beginPath(); x.arc(19, 9, 6, 0, 7); x.fill(); });
  s[T.WALL]  = tile((x) => { x.fillStyle = '#6b5f7a'; x.fillRect(0, 0, TILE, TILE); x.strokeStyle = '#4a4257'; for (let i = 0; i <= TILE; i += 8) { x.beginPath(); x.moveTo(0, i); x.lineTo(TILE, i); x.stroke(); } x.beginPath(); x.moveTo(16, 0); x.lineTo(16, 8); x.moveTo(8, 8); x.lineTo(8, 16); x.moveTo(24, 8); x.lineTo(24, 16); x.stroke(); });
  s[T.FLOOR] = tile((x) => { x.fillStyle = '#cdbfa0'; x.fillRect(0, 0, TILE, TILE); x.strokeStyle = '#b6a687'; x.strokeRect(2, 2, TILE - 4, TILE - 4); x.strokeRect(8, 8, TILE - 16, TILE - 16); });
  s[T.FLOWER] = tile((x) => { x.drawImage(s[T.GRASS], 0, 0); for (const [fx, fy, col] of [[8, 8, '#e85d8a'], [20, 12, '#f2d16b'], [12, 22, '#8a6bd1'], [24, 24, '#ff9d5c']]) { x.fillStyle = col; x.beginPath(); x.arc(fx, fy, 3, 0, 7); x.fill(); x.fillStyle = '#ffe8a0'; x.fillRect(fx - 1, fy - 1, 2, 2); } });
  s[T.FOUNTAIN] = tile((x) => { x.fillStyle = '#8fa2b8'; x.fillRect(0, 0, TILE, TILE); x.fillStyle = '#3f79c9'; x.beginPath(); x.arc(16, 16, 11, 0, 7); x.fill(); x.fillStyle = '#9fd0ff'; x.beginPath(); x.arc(16, 16, 5, 0, 7); x.fill(); });
  s[T.HEDGE] = tile((x) => { x.fillStyle = '#245c2a'; x.fillRect(0, 0, TILE, TILE); noise(x, TILE, TILE, '#2f7336', 60); x.strokeStyle = '#1c471f'; x.strokeRect(1, 1, TILE - 2, TILE - 2); });
  s[T.SAND] = tile((x) => { x.fillStyle = '#d9c48f'; x.fillRect(0, 0, TILE, TILE); noise(x, TILE, TILE, '#cbb47c', 30); });
  s[T.ROOF] = tile((x) => { x.fillStyle = '#7a3f5a'; x.fillRect(0, 0, TILE, TILE); x.fillStyle = '#94506e'; for (let y = 0; y < TILE; y += 8) for (let i = (y / 8) % 2 ? 4 : 0; i < TILE; i += 8) { x.fillRect(i, y, 6, 6); } });
  s[T.DOOR] = tile((x) => { x.drawImage(s[T.FLOOR], 0, 0); x.fillStyle = '#5a3b22'; x.fillRect(8, 2, 16, 28); x.fillStyle = '#3a2616'; x.fillRect(10, 4, 12, 26); x.fillStyle = '#f2d16b'; x.fillRect(19, 16, 2, 3); });
  s[T.RUG] = tile((x) => { x.drawImage(s[T.FLOOR], 0, 0); x.fillStyle = '#7a2f4a'; x.fillRect(4, 4, TILE - 8, TILE - 8); x.strokeStyle = '#d4a24a'; x.strokeRect(7, 7, TILE - 14, TILE - 14); });
  return s;
}

// ---------- NPC token (a standing chibi) ----------
export function makeNpc(portrait) {
  const sheet = makeCharacter({
    hair: portrait.hair, skin: portrait.skin, eye: portrait.eye, outfit: portrait.outfit,
  }, 3);
  return sheet.down[0];
}

// ---------- Portrait bust for dialogue ----------
export function drawPortrait(ctx, portrait, x, y, size) {
  const S = size / 12;
  const pal = { H: portrait.hair, S: portrait.skin, E: portrait.eye, W: '#fff', O: portrait.outfit, A: shade(portrait.hair, 1.25) };
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  paint(ctx, FRONT.slice(0, 12), pal, S, x, y);
  ctx.restore();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}
