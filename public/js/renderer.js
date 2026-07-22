// Camera + multi-map rendering with depth-sorted objects and characters.
import { TILE, getMap } from '/shared/maps.js';
import { T } from '/shared/tiles.js';
import { bakeMap, bakeInterior, furnitureSprite, buildingSprite, treeSprite, propSprite, mountainSprite, makeCharacter, drawPortrait, loadTileset, tilesetOk, loadNpcSheets, npcFrames, npcPortrait } from './art.js';
import { preloadCozy } from './atlas.js';

loadTileset();                // begin loading the terrain tileset immediately
loadNpcSheets();              // and the Minifolks NPC sprite sheets
preloadCozy();                // and the cozy asset pack (used by the graphics rework)
const baked = new Map();      // mapId -> canvas
const charCache = new Map();  // lookKey -> sheet
function bakedMap(id) {
  const m = getMap(id);
  if (m.interior) {                            // interiors are procedural — no tileset needed
    if (!baked.has(id)) baked.set(id, bakeInterior(m));
    return baked.get(id);
  }
  if (!tilesetOk()) return null;              // wait for the tileset image
  if (!baked.has(id)) baked.set(id, bakeMap(m));
  return baked.get(id);
}
function sheetFor(look) {
  const key = `${look.skin}|${look.hair}|${look.hairStyle}|${look.eye}|${look.outfit}`;
  if (!charCache.has(key)) charCache.set(key, makeCharacter(look, 3));
  return charCache.get(key);
}

export const camera = { x: 0, y: 0, zoom: 1 };

// Pick a camera zoom so the world fills the screen (bigger sprites on phones,
// and small maps like interiors cover the viewport instead of leaving black
// bars). Capped so huge desktop screens don't blow interiors up absurdly.
function computeZoom(m, view) {
  const minDim = Math.min(view.w, view.h);
  const base = minDim < 520 ? 1.6 : minDim < 900 ? 1.3 : 1.1;   // phones zoom in more
  const cap = minDim < 520 ? 3.4 : minDim < 900 ? 2.6 : 2.0;    // let tiny rooms fill a phone screen
  const cover = Math.max(view.w / (m.w * TILE), view.h / (m.h * TILE)) * 1.02;
  return Math.min(Math.max(base, cover), cap);
}

export function focus(x, y, view, mapId) {
  if (mapId) camera.map = mapId;
  const m = getMap(camera.map);
  const Z = computeZoom(m, view); camera.zoom = Z;
  const vw = view.w / Z, vh = view.h / Z, worldW = m.w * TILE, worldH = m.h * TILE;
  // centre the map when it is smaller than the viewport, else follow the player
  camera.x = worldW <= vw ? (worldW - vw) / 2 : Math.max(0, Math.min(worldW - vw, x - vw / 2));
  camera.y = worldH <= vh ? (worldH - vh) / 2 : Math.max(0, Math.min(worldH - vh, y - vh / 2));
}

export function draw(ctx, view, mapId, remotes, self, npcs, frameTick) {
  camera.map = mapId;
  const m = getMap(mapId);
  const Z = camera.zoom || 1;
  const vw = view.w / Z, vh = view.h / Z;      // visible size in world units
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0c1420'; ctx.fillRect(0, 0, view.w, view.h);   // full-screen backdrop

  // baked terrain (blit visible region)
  const bake = bakedMap(mapId);
  if (!bake) { // tileset still loading
    ctx.fillStyle = '#3c7534'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#e9d9ff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('กำลังโหลดพื้นผิว…', view.w / 2, view.h / 2);
    return;
  }
  ctx.save();
  ctx.scale(Z, Z);                              // everything below is drawn in world units, zoomed
  // Blit the map, tolerating a map smaller than the viewport (centred, no crash).
  const worldW = m.w * TILE, worldH = m.h * TILE;
  const bsx = Math.max(0, camera.x), bsy = Math.max(0, camera.y);
  const bdx = Math.max(0, -camera.x), bdy = Math.max(0, -camera.y);
  const bsw = Math.min(worldW - bsx, vw - bdx), bsh = Math.min(worldH - bsy, vh - bdy);
  ctx.drawImage(bake, bsx, bsy, bsw, bsh, bdx, bdy, bsw, bsh);

  // interior floor decals (rugs) — drawn under furniture and characters
  if (m.interior) {
    for (const o of m.objects) {
      if (o.t !== 'furn') continue;
      const s = furnitureSprite(o);
      if (!s.flat) continue;
      ctx.drawImage(s.canvas, Math.round((o.x + 0.5) * TILE - camera.x - s.canvas.width / 2), Math.round((o.y + 0.5) * TILE - camera.y - s.canvas.height / 2));
    }
  }

  // portals glow
  for (const p of m.portals) {
    const px = p.x * TILE - camera.x, py = p.y * TILE - camera.y;
    ctx.fillStyle = 'rgba(176,107,255,0.28)'; ctx.fillRect(px, py, p.w * TILE, p.h * TILE);
    ctx.fillStyle = '#e9d9ff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    label(ctx, '▶ ' + p.label, px + p.w * TILE / 2, py + p.h * TILE / 2 + 3);
  }

  // Depth-sorted drawables: objects + npcs + players by feet Y.
  const D = [];
  const PROP_SW = { fountain: TILE * 1.3, statue: TILE * 1.2, well: TILE * 1.1, stall: TILE * 1.5, boat: TILE * 1.4, lamp: TILE * 0.4, signpost: TILE * 0.5 };
  for (const o of m.objects) {
    if (o.t === 'building') { const s = buildingSprite(o); D.push({ y: (o.y + o.h) * TILE, spr: s.canvas, dx: o.x * TILE + s.ox, dy: (o.y + o.h) * TILE - s.canvas.height, sw: o.w * TILE * 0.9, scx: (o.x + o.w / 2) * TILE, scy: (o.y + o.h) * TILE - 3 }); }
    else if (o.t === 'tree') { const s = treeSprite(o.variant, o.code === T.SNOW); D.push({ y: (o.y + 1) * TILE, spr: s.canvas, dx: o.x * TILE + s.ox, dy: (o.y + 1) * TILE - s.canvas.height, sw: TILE * 0.85, scx: (o.x + 0.5) * TILE, scy: (o.y + 1) * TILE - 2 }); }
    else if (o.t === 'mountain') { const s = mountainSprite(o); D.push({ y: (o.y + o.h) * TILE, spr: s.canvas, dx: o.x * TILE + s.ox, dy: (o.y + o.h) * TILE - s.canvas.height, sw: o.w * TILE * 0.75, scx: (o.x + o.w / 2) * TILE, scy: (o.y + o.h) * TILE - 3 }); }
    else if (o.t === 'prop') { const s = propSprite(o); const fh = s.canvas.height; const flat = o.kind === 'flowerbed' || o.kind === 'bench'; D.push({ y: (o.y + 1) * TILE, spr: s.canvas, dx: o.x * TILE + s.ox, dy: (o.y + 1) * TILE - fh, sw: flat ? 0 : (PROP_SW[o.kind] || TILE * 0.7), scx: o.x * TILE + s.ox + s.canvas.width / 2, scy: (o.y + 1) * TILE - 2 }); }
    else if (o.t === 'furn') { const s = furnitureSprite(o); if (s.flat || s.hang) continue; const fw = s.canvas.width, fh = s.canvas.height; D.push({ y: (o.y + 1) * TILE, spr: s.canvas, dx: (o.x + 0.5) * TILE - fw / 2, dy: (o.y + 1) * TILE - fh, sw: TILE * 0.5, scx: (o.x + 0.5) * TILE, scy: (o.y + 1) * TILE - 2 }); }
  }
  for (const n of npcs) {
    const nf = n.sprite ? npcFrames(n.sprite) : null;
    if (nf) {   // real Minifolks art (front-facing; flip for left/right)
      const frames = n.moving ? nf.walk : nf.idle;
      const idx = n.moving ? Math.floor(frameTick / 4) % frames.length : Math.floor(frameTick / 18) % frames.length;
      D.push({ y: n.y + TILE * 0.1, spr2: frames[idx], w: nf.w, feet: nf.feet, headTop: nf.headTop, cw: nf.cw, cx: n.x, cy: n.y, name: n.name, npc: true, flip: n.dir === 'left', emote: n.emote });
    } else {
      const sheet = sheetFor(n.look || { skin: '#e9c39b', hair: '#5a3b22', hairStyle: 'short', eye: '#333', outfit: '#556' });
      const flip = n.dir === 'left' && sheet.flipLeft;
      const frames = (n.dir === 'left' ? sheet.right : sheet[n.dir]) || sheet.down;
      const idx = n.moving ? [1, 0, 2, 0][Math.floor(frameTick / 5) % 4] : 0;
      D.push({ y: n.y + TILE * 0.1, char: sheet, frame: frames[idx], cx: n.x, cy: n.y, name: n.name, npc: true, flip, emote: n.emote });
    }
  }
  const everyone = [self, ...remotes].filter(Boolean);
  for (const p of everyone) {
    const sheet = sheetFor(p.look || { skin: '#e9c39b', hair: '#6a2fb0', hairStyle: 'short', eye: '#ff4a8d', outfit: '#2a1f3a' });
    const flip = p.dir === 'left' && sheet.flipLeft;
    const frames = (p.dir === 'left' ? sheet.right : sheet[p.dir]) || sheet.down;
    const idx = p.moving ? [1, 0, 2, 0][Math.floor(frameTick / 5) % 4] : 0;
    D.push({ y: p.y + TILE * 0.1, char: sheet, frame: frames[idx], cx: p.x, cy: p.y, name: p.name, self: p.id === self?.id, flip });
  }
  // lamp light positions (for night glow)
  const lamps = [];
  for (const o of m.objects) if (o.t === 'prop' && o.kind === 'lamp') lamps.push([o.x * TILE + TILE / 2, (o.y - 1) * TILE + 16]);

  D.sort((a, b) => a.y - b.y);

  for (const d of D) {
    if (d.spr) {
      if (d.sw) shadow(ctx, d.scx - camera.x, d.scy - camera.y, d.sw);
      ctx.drawImage(d.spr, Math.round(d.dx - camera.x), Math.round(d.dy - camera.y));
      if (d.name) { ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,16,30,0.7)'; }
    } else if (d.spr2) {   // Minifolks NPC — anchored by feet, flipped for left
      const w = d.w;
      const sx = Math.round(d.cx - camera.x - w / 2), sy = Math.round(d.cy - camera.y - d.feet);
      shadow(ctx, d.cx - camera.x, d.cy - camera.y - 2, d.cw * 0.9);
      if (d.flip) { ctx.save(); ctx.translate(sx + w, sy); ctx.scale(-1, 1); ctx.drawImage(d.spr2, 0, 0); ctx.restore(); }
      else ctx.drawImage(d.spr2, sx, sy);
      const headY = Math.round(d.cy - camera.y - d.feet + d.headTop);
      nameplate(ctx, d.name, Math.round(d.cx - camera.x), headY - 3, false, true);
      if (d.emote) drawEmote(ctx, Math.round(d.cx - camera.x), headY - 14, d.emote);
    } else if (d.char) {
      const w = d.char.w, h = d.char.h;
      const sx = Math.round(d.cx - camera.x - w / 2), sy = Math.round(d.cy - camera.y - h);
      shadow(ctx, d.cx - camera.x, d.cy - camera.y - 3, w * 0.5);
      const fr = d.frame || d.frames[d.idx];
      if (d.flip) { ctx.save(); ctx.translate(sx + w, sy); ctx.scale(-1, 1); ctx.drawImage(fr, 0, 0); ctx.restore(); }
      else ctx.drawImage(fr, sx, sy);
      if (d.self) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.strokeRect(sx + 6, sy + 2, w - 12, h - 4); }
      nameplate(ctx, d.name, Math.round(d.cx - camera.x), sy - 2, d.self, d.npc);
      if (d.emote) drawEmote(ctx, Math.round(d.cx - camera.x), sy - 14, d.emote);
    }
  }

  // hanging fixtures (chandeliers) — drawn above everyone
  if (m.interior) {
    for (const o of m.objects) {
      if (o.t !== 'furn') continue;
      const s = furnitureSprite(o);
      if (!s.hang) continue;
      ctx.drawImage(s.canvas, Math.round((o.x + 0.5) * TILE - camera.x - s.canvas.width / 2), Math.round(1.4 * TILE - camera.y));
    }
  }

  // ---- ambient light tint (day/night) ----
  const amb = ambient();
  if (m.interior) { amb.a = Math.min(amb.a, 0.14); amb.dark = 0; }   // rooms are lit within
  if (amb.a > 0.001) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = amb.a;
    ctx.fillStyle = `rgb(${amb.c[0]},${amb.c[1]},${amb.c[2]})`; ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }
  if (amb.dark > 0.04) { // warm lamp pools at night
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly] of lamps) {
      const sx = lx - camera.x, sy = ly - camera.y;
      if (sx < -80 || sx > vw + 80 || sy < -80 || sy > vh + 80) continue;
      const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 66);
      g.addColorStop(0, `rgba(255,214,140,${0.55 * amb.dark})`); g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 66, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // Building banners (drawn above everything)
  ctx.textAlign = 'center';
  for (const o of m.objects) {
    if (o.t !== 'building' || !o.name) continue;
    const bx = (o.x + o.w / 2) * TILE - camera.x, by = o.y * TILE - camera.y - 20;
    if (bx < -80 || bx > vw + 80 || by < -20 || by > vh + 20) continue;
    ctx.font = 'bold 11px system-ui'; label(ctx, o.name, bx, by);
  }
  // Map name + time of day (top center)
  ctx.font = 'bold 13px system-ui'; ctx.fillStyle = 'rgba(20,16,30,0.6)';
  const nameStr = phaseEmoji(amb.phase) + ' ' + m.name;
  const tw = ctx.measureText(nameStr).width + 16;
  ctx.fillRect(vw / 2 - tw / 2, 8, tw, 22); ctx.fillStyle = '#ffd98a';
  ctx.fillText(nameStr, vw / 2, 23);
  ctx.restore();
}

// ---- day/night cycle ----
const CYCLE_MS = 6 * 60 * 1000;  // a full day every 6 minutes
const SKY = [
  { t: 0.00, c: [58, 74, 150], a: 0.55 },   // deep night
  { t: 0.15, c: [78, 88, 150], a: 0.46 },
  { t: 0.21, c: [255, 196, 148], a: 0.32 },  // dawn (warm)
  { t: 0.30, c: [255, 252, 245], a: 0.05 },  // morning
  { t: 0.50, c: [255, 255, 255], a: 0.00 },  // noon
  { t: 0.66, c: [255, 238, 210], a: 0.10 },  // afternoon
  { t: 0.76, c: [255, 150, 100], a: 0.34 },  // dusk (orange)
  { t: 0.85, c: [128, 96, 150], a: 0.40 },   // twilight
  { t: 0.93, c: [58, 74, 150], a: 0.52 },    // nightfall
  { t: 1.00, c: [58, 74, 150], a: 0.55 },
];
const lerp = (a, b, t) => a + (b - a) * t;
function phaseNow() {
  const q = new URLSearchParams(location.search).get('phase');
  if (q !== null && !isNaN(parseFloat(q))) return ((parseFloat(q) % 1) + 1) % 1;
  return (Date.now() % CYCLE_MS) / CYCLE_MS;
}
function ambient() {
  const p = phaseNow();
  let k0 = SKY[0], k1 = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) if (p >= SKY[i].t && p <= SKY[i + 1].t) { k0 = SKY[i]; k1 = SKY[i + 1]; break; }
  const t = k1.t === k0.t ? 0 : (p - k0.t) / (k1.t - k0.t);
  const c = [0, 1, 2].map((i) => Math.round(lerp(k0.c[i], k1.c[i], t)));
  const a = lerp(k0.a, k1.a, t);
  const dark = c[2] > c[0] + 8 ? Math.max(0, (a - 0.12) / 0.5) : 0;   // cool tint → lamps glow
  return { c, a, dark, phase: p };
}
const phaseEmoji = (p) => p < 0.2 ? '🌙' : p < 0.3 ? '🌅' : p < 0.66 ? '☀️' : p < 0.82 ? '🌆' : '🌙';

// Soft, directional drop shadow (sun from upper-left → offset toward lower-right).
function shadow(ctx, cx, cy, w) {
  const rx = w / 2, ry = Math.max(3, Math.min(13, w * 0.17));
  const x = cx + 2, y = cy + 1;
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.2, ry * 1.2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
}
function label(ctx, text, cx, y) {
  const tw = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(20,16,30,0.72)'; ctx.fillRect(cx - tw / 2, y - 11, tw, 16);
  ctx.fillStyle = '#e9d9ff'; ctx.fillText(text, cx, y + 1);
}
const EMOTE = {
  love: { g: '♥', c: '#ff5a8d' }, chat: { g: '♬', c: '#7fc4ff' },
  happy: { g: '☺', c: '#ffd24a' }, note: { g: '♪', c: '#b06bff' },
  surprise: { g: '!', c: '#ff8a3a' },
};
function drawEmote(ctx, cx, y, kind) {
  const e = EMOTE[kind] || EMOTE.chat;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - 9, y - 15, 18, 16, 5) : ctx.rect(cx - 9, y - 15, 18, 16); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 3, y + 0); ctx.lineTo(cx + 3, y + 0); ctx.lineTo(cx, y + 4); ctx.closePath(); ctx.fill(); // tail
  ctx.fillStyle = e.c; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e.g, cx, y - 6); ctx.textBaseline = 'alphabetic';
}
function nameplate(ctx, name, cx, y, self, npc) {
  ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
  const tw = ctx.measureText(name).width + 8;
  ctx.fillStyle = self ? 'rgba(120,60,180,0.9)' : npc ? 'rgba(40,30,60,0.7)' : 'rgba(0,0,0,0.6)';
  ctx.fillRect(cx - tw / 2, y - 11, tw, 13);
  ctx.fillStyle = self ? '#ffe6a0' : '#fff'; ctx.fillText(name, cx, y - 1);
}

export { drawPortrait, npcPortrait };
