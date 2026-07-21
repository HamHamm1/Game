// Living NPCs — authoritative server-side wander, day/night routine, and
// spontaneous NPC-to-NPC greetings. Identity (name, look, persona) stays in
// content; this module owns only the moving parts (position, facing, emote).
// Positions are broadcast per map inside the STATE packet.
import { TILE, getMap, getSolid } from '../shared/maps.js';
import { isSolid } from './collision.js';
import * as content from './content.js';

const SPEED = 2.3;                 // px per tick (~35 px/s — a gentle stroll)
const CYCLE_MS = 6 * 60 * 1000;    // day length — matches the renderer's cycle
const sims = new Map();            // npcId -> live instance

const rnd = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

function phase() { return (Date.now() % CYCLE_MS) / CYCLE_MS; }
export function isNight() { const p = phase(); return p < 0.20 || p > 0.82; }

function walkable(map, tx, ty) {
  const m = getMap(map), s = getSolid(map);
  if (tx < 1 || ty < 1 || tx >= m.w - 1 || ty >= m.h - 1) return false;
  return !s[ty * m.w + tx];
}
function nearestFree(map, tx, ty) {
  if (walkable(map, tx, ty)) return [tx, ty];
  for (let r = 1; r <= 8; r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if ((Math.abs(dx) === r || Math.abs(dy) === r) && walkable(map, tx + dx, ty + dy))
        return [tx + dx, ty + dy];
  return [tx, ty];
}

function build(npc) {
  const map = npc.map || 'school';
  const [hx, hy] = nearestFree(map, npc.x | 0, npc.y | 0);
  return {
    id: npc.id, map, personality: npc.personality,
    x: hx * TILE + TILE / 2, y: hy * TILE + TILE / 2, dir: 'down', moving: false,
    hx, hy,                                     // home anchor (tile coords)
    roam: Math.max(2, npc.roam || 5),           // wander radius in tiles
    state: 'idle', wait: rnd(20, 90), tx: 0, ty: 0,
    emote: null, emoteT: 0, cool: rnd(30, 120), // greeting cooldown
  };
}

// Rebuild live instances from current content, preserving live positions.
export function reconcile() {
  const npcs = content.get().npcs || [];
  const keep = new Set();
  for (const npc of npcs) {
    keep.add(npc.id);
    const cur = sims.get(npc.id);
    if (!cur || cur.map !== (npc.map || 'school')) sims.set(npc.id, build(npc));
    else { cur.personality = npc.personality; if (npc.roam) cur.roam = Math.max(2, npc.roam); }
  }
  for (const id of [...sims.keys()]) if (!keep.has(id)) sims.delete(id);
}

// Settle onto the current tile's centre when stopping — a tile centre always
// clears the collision box, so idle NPCs never rest clipping a wall.
function settle(s) {
  const tx = Math.floor(s.x / TILE), ty = Math.floor(s.y / TILE);
  if (walkable(s.map, tx, ty)) { s.x = tx * TILE + TILE / 2; s.y = ty * TILE + TILE / 2; }
}

function pickTarget(s) {
  const radius = isNight() ? Math.min(2, s.roam) : s.roam;   // settle closer at night
  for (let i = 0; i < 6; i++) {
    const tx = Math.round(s.hx + rnd(-radius, radius));
    const ty = Math.round(s.hy + rnd(-radius, radius));
    if (walkable(s.map, tx, ty)) { s.tx = tx * TILE + TILE / 2; s.ty = ty * TILE + TILE / 2; return true; }
  }
  return false;
}

function stepNpc(s) {
  if (s.emoteT > 0) s.emoteT--; else s.emote = null;
  if (s.cool > 0) s.cool--;

  if (s.state === 'idle') {
    s.moving = false;
    if (--s.wait <= 0) {
      if (isNight() && chance(0.5)) s.wait = rnd(60, 160);       // linger at night
      else if (pickTarget(s)) s.state = 'walk';
      else s.wait = rnd(20, 60);
    }
    return;
  }
  // walking toward target
  const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
  if (d < 3) { s.state = 'idle'; s.wait = rnd(30, 140); s.moving = false; settle(s); return; }
  const nx = s.x + (dx / d) * SPEED, ny = s.y + (dy / d) * SPEED;
  const clearX = !isSolid(s.map, nx, s.y), clearY = !isSolid(s.map, s.x, ny);
  let moved = false;
  if (clearX && clearY && !isSolid(s.map, nx, ny)) { s.x = nx; s.y = ny; moved = true; }   // diagonal, corner clear
  else if (clearX) { s.x = nx; moved = true; }                                              // slide along X
  else if (clearY) { s.y = ny; moved = true; }                                              // slide along Y
  s.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  s.moving = true;
  if (!moved) { s.state = 'idle'; s.wait = rnd(20, 60); s.moving = false; settle(s); }  // bumped something
}

const GREET = ['love', 'chat', 'happy', 'note', 'surprise'];
function greet(list) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.cool > 0 || b.cool > 0 || a.state !== 'idle' || b.state !== 'idle') continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) > TILE * 1.5) continue;
    const e = GREET[(Math.random() * GREET.length) | 0];
    a.emote = b.emote = e; a.emoteT = b.emoteT = 45;
    a.cool = b.cool = rnd(160, 340);
    a.wait = Math.max(a.wait, 40); b.wait = Math.max(b.wait, 40);
    a.dir = a.x < b.x ? 'right' : 'left'; b.dir = b.x < a.x ? 'right' : 'left';   // face each other
  }
}

let gt = 0;
// Advance every active map's NPCs and return per-map dynamic snapshots.
export function update(activeMaps) {
  const byMap = {};
  for (const s of sims.values()) {
    if (!activeMaps.has(s.map)) continue;
    stepNpc(s);
    (byMap[s.map] ||= []).push(s);
  }
  if ((gt++ % 15) === 0) for (const map in byMap) greet(byMap[map]);   // greetings ~1/sec
  const snap = {};
  for (const map in byMap) snap[map] = byMap[map].map((s) => ({
    id: s.id, x: Math.round(s.x), y: Math.round(s.y), dir: s.dir, moving: s.moving,
    ...(s.emote ? { emote: s.emote } : {}),
  }));
  return snap;
}

// Live position (pixels) for interaction/dialogue targeting.
export function posOf(id) { const s = sims.get(id); return s ? { map: s.map, x: s.x, y: s.y } : null; }

// Pause an NPC and turn it to face a point (used while chatting with a player).
export function pauseFacing(id, px, py) {
  const s = sims.get(id); if (!s) return;
  s.state = 'idle'; s.moving = false; s.wait = 150;   // ~10s
  s.dir = Math.abs(px - s.x) > Math.abs(py - s.y) ? (px < s.x ? 'left' : 'right') : (py < s.y ? 'up' : 'down');
}
