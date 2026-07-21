// Camera + multi-map rendering with depth-sorted objects and characters.
import { TILE, getMap } from '/shared/maps.js';
import { T } from '/shared/tiles.js';
import { bakeMap, buildingSprite, treeSprite, propSprite, mountainSprite, makeCharacter, drawPortrait, loadTileset, tilesetOk } from './art.js';

loadTileset();                // begin loading the terrain tileset immediately
const baked = new Map();      // mapId -> canvas
const charCache = new Map();  // lookKey -> sheet
function bakedMap(id) {
  if (!tilesetOk()) return null;              // wait for the tileset image
  if (!baked.has(id)) baked.set(id, bakeMap(getMap(id)));
  return baked.get(id);
}
function sheetFor(look) {
  const key = `${look.skin}|${look.hair}|${look.hairStyle}|${look.eye}|${look.outfit}`;
  if (!charCache.has(key)) charCache.set(key, makeCharacter(look, 3));
  return charCache.get(key);
}

export const camera = { x: 0, y: 0 };
export function focus(x, y, view) {
  const m = getMap(camera.map);
  camera.x = Math.max(0, Math.min(m.w * TILE - view.w, x - view.w / 2));
  camera.y = Math.max(0, Math.min(m.h * TILE - view.h, y - view.h / 2));
}

export function draw(ctx, view, mapId, remotes, self, npcs, frameTick) {
  camera.map = mapId;
  const m = getMap(mapId);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0c1420'; ctx.fillRect(0, 0, view.w, view.h);

  // baked terrain (blit visible region)
  const bake = bakedMap(mapId);
  if (!bake) { // tileset still loading
    ctx.fillStyle = '#3c7534'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#e9d9ff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('กำลังโหลดพื้นผิว…', view.w / 2, view.h / 2);
    return;
  }
  ctx.drawImage(bake, camera.x, camera.y, view.w, view.h, 0, 0, view.w, view.h);

  // portals glow
  for (const p of m.portals) {
    const px = p.x * TILE - camera.x, py = p.y * TILE - camera.y;
    ctx.fillStyle = 'rgba(176,107,255,0.28)'; ctx.fillRect(px, py, p.w * TILE, p.h * TILE);
    ctx.fillStyle = '#e9d9ff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    label(ctx, '▶ ' + p.label, px + p.w * TILE / 2, py + p.h * TILE / 2 + 3);
  }

  // Depth-sorted drawables: objects + npcs + players by feet Y.
  const D = [];
  for (const o of m.objects) {
    if (o.t === 'building') { const s = buildingSprite(o); D.push({ y: (o.y + o.h) * TILE, spr: s.canvas, dx: o.x * TILE + s.ox, dy: (o.y + o.h) * TILE - s.canvas.height }); }
    else if (o.t === 'tree') { const s = treeSprite(o.variant, o.code === T.SNOW); D.push({ y: (o.y + 1) * TILE, spr: s.canvas, dx: o.x * TILE + s.ox, dy: (o.y + 1) * TILE - s.canvas.height }); }
    else if (o.t === 'mountain') { const s = mountainSprite(o); D.push({ y: (o.y + o.h) * TILE, spr: s.canvas, dx: o.x * TILE + s.ox, dy: (o.y + o.h) * TILE - s.canvas.height }); }
    else if (o.t === 'prop') { const s = propSprite(o); const fh = s.canvas.height; D.push({ y: (o.y + 1) * TILE, spr: s.canvas, dx: o.x * TILE + s.ox, dy: (o.y + 1) * TILE - fh, shadow: o.kind !== 'flowerbed' && o.kind !== 'bench' }); }
  }
  for (const n of npcs) {
    const sheet = sheetFor(n.look || { skin: '#e9c39b', hair: '#5a3b22', hairStyle: 'short', eye: '#333', outfit: '#556' });
    D.push({ y: n.y * TILE + TILE, char: sheet, frames: sheet.down, idx: 0, cx: n.x * TILE + TILE / 2, cy: n.y * TILE + TILE, name: n.name, npc: true });
  }
  const everyone = [self, ...remotes].filter(Boolean);
  for (const p of everyone) {
    const sheet = sheetFor(p.look || { skin: '#e9c39b', hair: '#6a2fb0', hairStyle: 'short', eye: '#ff4a8d', outfit: '#2a1f3a' });
    const flip = p.dir === 'left' && sheet.flipLeft;
    const frames = (p.dir === 'left' ? sheet.right : sheet[p.dir]) || sheet.down;
    const idx = p.moving ? [1, 0, 2, 0][Math.floor(frameTick / 5) % 4] : 0;
    D.push({ y: p.y + TILE * 0.1, char: sheet, frame: frames[idx], cx: p.x, cy: p.y, name: p.name, self: p.id === self?.id, flip });
  }
  D.sort((a, b) => a.y - b.y);

  for (const d of D) {
    if (d.spr) {
      if (d.shadow) shadow(ctx, d.dx + d.spr.width / 2 - camera.x, (d.y) - camera.y - 2, d.spr.width * 0.28);
      ctx.drawImage(d.spr, Math.round(d.dx - camera.x), Math.round(d.dy - camera.y));
      if (d.name) { ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,16,30,0.7)'; }
    } else if (d.char) {
      const w = d.char.w, h = d.char.h;
      const sx = Math.round(d.cx - camera.x - w / 2), sy = Math.round(d.cy - camera.y - h);
      shadow(ctx, d.cx - camera.x, d.cy - camera.y - 3, w * 0.28);
      const fr = d.frame || d.frames[d.idx];
      if (d.flip) { ctx.save(); ctx.translate(sx + w, sy); ctx.scale(-1, 1); ctx.drawImage(fr, 0, 0); ctx.restore(); }
      else ctx.drawImage(fr, sx, sy);
      if (d.self) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.strokeRect(sx + 6, sy + 2, w - 12, h - 4); }
      nameplate(ctx, d.name, Math.round(d.cx - camera.x), sy - 2, d.self, d.npc);
    }
  }

  // Building banners (drawn above everything)
  ctx.textAlign = 'center';
  for (const o of m.objects) {
    if (o.t !== 'building' || !o.name) continue;
    const bx = (o.x + o.w / 2) * TILE - camera.x, by = o.y * TILE - camera.y - 20;
    if (bx < -80 || bx > view.w + 80 || by < -20 || by > view.h + 20) continue;
    ctx.font = 'bold 11px system-ui'; label(ctx, o.name, bx, by);
  }
  // Map name (top center)
  ctx.font = 'bold 13px system-ui'; ctx.fillStyle = 'rgba(20,16,30,0.6)';
  const tw = ctx.measureText('📍 ' + m.name).width + 16;
  ctx.fillRect(view.w / 2 - tw / 2, 8, tw, 22); ctx.fillStyle = '#ffd98a';
  ctx.fillText('📍 ' + m.name, view.w / 2, 23);
}

function shadow(ctx, cx, cy, r) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.4, 0, 0, 7); ctx.fill(); }
function label(ctx, text, cx, y) {
  const tw = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(20,16,30,0.72)'; ctx.fillRect(cx - tw / 2, y - 11, tw, 16);
  ctx.fillStyle = '#e9d9ff'; ctx.fillText(text, cx, y + 1);
}
function nameplate(ctx, name, cx, y, self, npc) {
  ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
  const tw = ctx.measureText(name).width + 8;
  ctx.fillStyle = self ? 'rgba(120,60,180,0.9)' : npc ? 'rgba(40,30,60,0.7)' : 'rgba(0,0,0,0.6)';
  ctx.fillRect(cx - tw / 2, y - 11, tw, 13);
  ctx.fillStyle = self ? '#ffe6a0' : '#fff'; ctx.fillText(name, cx, y - 1);
}

export { drawPortrait };
