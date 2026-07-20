// Camera + world/entity rendering.
import { TILE, MAP_W, MAP_H } from '/shared/constants.js';
import { generateMap, LANDMARKS } from '/shared/worldgen.js';
import { makeTiles, makeCharacter, makeNpc, drawPortrait } from './pixel.js';

const map = generateMap();
const tiles = makeTiles();
const npcSprites = new Map();       // npcId -> canvas
const charCache = new Map();        // color-key -> sheet

// Distinct palettes so players standing together look different.
const PALETTES = [
  { hair: '#6a2fb0', skin: '#e9c39b', eye: '#ff4a8d', outfit: '#2a1f3a' }, // the villain (you-ish)
  { hair: '#c94f3a', skin: '#f3d2b3', eye: '#3aa0ff', outfit: '#264f7a' },
  { hair: '#2b8f6b', skin: '#e6bd94', eye: '#f2d16b', outfit: '#5a2f4a' },
  { hair: '#d1a12b', skin: '#f6cdae', eye: '#7a4aff', outfit: '#3a5a2f' },
];
function sheetFor(id) {
  const key = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTES.length;
  const k = 'p' + key;
  if (!charCache.has(k)) charCache.set(k, makeCharacter(PALETTES[key], 3));
  return charCache.get(k);
}

export const camera = { x: 0, y: 0 };

export function focus(x, y, view) {
  camera.x = Math.max(0, Math.min(MAP_W * TILE - view.w, x - view.w / 2));
  camera.y = Math.max(0, Math.min(MAP_H * TILE - view.h, y - view.h / 2));
}

export function draw(ctx, view, world, self, npcs, frameTick) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, 0, view.w, view.h);

  const x0 = Math.floor(camera.x / TILE), y0 = Math.floor(camera.y / TILE);
  const x1 = Math.min(MAP_W, x0 + Math.ceil(view.w / TILE) + 1);
  const y1 = Math.min(MAP_H, y0 + Math.ceil(view.h / TILE) + 1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const code = map.tiles[y * MAP_W + x];
      const spr = tiles[code] || tiles[0];
      ctx.drawImage(spr, Math.round(x * TILE - camera.x), Math.round(y * TILE - camera.y));
    }
  }

  // Collect drawables (NPCs + players) and sort by feet-Y for depth.
  const drawables = [];
  for (const n of npcs) {
    if (!npcSprites.has(n.id)) npcSprites.set(n.id, makeNpc(n.portrait));
    drawables.push({ kind: 'npc', spr: npcSprites.get(n.id), x: n.x * TILE + TILE / 2, y: n.y * TILE + TILE, name: n.name, role: n.role });
  }
  const everyone = [self, ...world.filter((p) => p.id !== self?.id)].filter(Boolean);
  for (const p of everyone) {
    const sheet = sheetFor(p.id);
    const frames = sheet[p.dir] || sheet.down;
    const idx = p.moving ? [1, 0, 2, 0][Math.floor(frameTick / 6) % 4] : 0;
    drawables.push({ kind: 'player', spr: frames[idx], x: p.x, y: p.y, name: p.name, self: p.id === self?.id, w: sheet.w, h: sheet.h });
  }
  drawables.sort((a, b) => a.y - b.y);

  for (const d of drawables) {
    const w = d.w || d.spr.width, h = d.h || d.spr.height;
    const sx = Math.round(d.x - camera.x - w / 2);
    const sy = Math.round(d.y - camera.y - h);
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(Math.round(d.x - camera.x), Math.round(d.y - camera.y - 3), w * 0.3, 5, 0, 0, 7);
    ctx.fill();
    ctx.drawImage(d.spr, sx, sy);
    if (d.self) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, w, h); }
    nameplate(ctx, d.name, Math.round(d.x - camera.x), sy - 4, d.self, d.role);
  }

  // Landmark banners.
  ctx.textAlign = 'center';
  for (const lm of LANDMARKS) {
    const bx = lm.x * TILE - camera.x, by = lm.y * TILE - camera.y;
    if (bx < -60 || bx > view.w + 60 || by < -20 || by > view.h + 20) continue;
    ctx.font = 'bold 12px system-ui, sans-serif';
    const tw = ctx.measureText(lm.label).width + 12;
    ctx.fillStyle = 'rgba(20,16,30,0.7)';
    ctx.fillRect(bx - tw / 2, by - 9, tw, 16);
    ctx.fillStyle = '#e9d9ff';
    ctx.fillText(lm.label, bx, by + 3);
  }
}

function nameplate(ctx, name, cx, y, self, role) {
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(name).width + 8;
  ctx.fillStyle = self ? 'rgba(120,60,180,0.85)' : 'rgba(0,0,0,0.6)';
  ctx.fillRect(cx - tw / 2, y - 12, tw, 14);
  ctx.fillStyle = '#fff';
  ctx.fillText(name, cx, y - 1);
}

export { drawPortrait };
