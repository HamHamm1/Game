// Main client: join flow, realtime loop, local prediction + interpolation.
import { MSG, TILE, MAP_W, MAP_H, PLAYER_SPEED, TICK_HZ } from '/shared/constants.js';
import { generateMap, SOLID } from '/shared/worldgen.js';
import { createInput } from './input.js';
import { connect } from './net.js';
import { camera, focus, draw } from './renderer.js';
import * as ui from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { w: 0, h: 0 };
const map = generateMap();

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = view.w * dpr; canvas.height = view.h * dpr;
  canvas.style.width = view.w + 'px'; canvas.style.height = view.h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

// ---- Identity (persisted so progress sticks to the same player) ----
let playerId = localStorage.getItem('sw_id');
if (!playerId) { playerId = 'p-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('sw_id', playerId); }
document.getElementById('name-input').value = localStorage.getItem('sw_name') || '';

// ---- Shared client collision (mirrors the server) ----
const R = 9;
function solidAt(px, py) {
  for (const [ox, oy] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
    const tx = Math.floor((px + ox) / TILE), ty = Math.floor((py + oy) / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    if (SOLID.has(map.tiles[ty * MAP_W + tx])) return true;
  }
  return false;
}

const world = {
  status: 'pending', canChat: false,
  self: null,                 // predicted local player
  remotes: new Map(),         // id -> { prev, next, ... } for interpolation
  npcs: [], quests: [], affection: {}, questProgress: {}, reputation: 0,
  npcVersion: 0,
};

let net = null;
const input = createInput({ onInteract: () => net?.interact() });

// ---- Join ----
document.getElementById('join-btn').addEventListener('click', join);
document.getElementById('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
async function join() {
  const name = document.getElementById('name-input').value.trim().slice(0, 24) || 'ผู้พเนจร';
  localStorage.setItem('sw_name', name);
  try {
    await fetch('/api/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: playerId, name }),
    });
  } catch {}
  startNet(name);
}

function startNet(name) {
  net = connect({
    id: playerId, name,
    handlers: {
      [MSG.WELCOME]: (m) => {
        world.self = { id: m.self.id, name: m.self.name, x: m.self.x, y: m.self.y, dir: m.self.dir, moving: false };
        world.status = m.status; world.canChat = m.canChat;
        world.affection = m.affection || {}; world.questProgress = m.quests || {};
        world.reputation = m.reputation || 0;
        applyStatus();
      },
      [MSG.STATUS]: (m) => { world.status = m.status; world.canChat = m.canChat; applyStatus(); },
      [MSG.CONTENT]: (m) => {
        world.npcs = m.content.npcs || []; world.quests = m.content.quests || [];
        world.npcVersion = m.content.version;
        ui.renderQuests(world.quests, world.questProgress, world.affection, world.npcs, world.reputation);
      },
      [MSG.STATE]: (m) => ingestState(m),
      [MSG.CHAT_MSG]: (m) => ui.chatLog(m.from, m.text),
      [MSG.DIALOGUE]: (m) => ui.showDialogue(m, (i) => net.choose(i)),
      [MSG.TOAST]: (m) => {
        ui.toast(m.text, m.level);
        if (m.affection) Object.assign(world.affection, m.affection);
        if (typeof m.reputation === 'number') world.reputation = m.reputation;
        if (m.affection || m.reputation != null)
          ui.renderQuests(world.quests, world.questProgress, world.affection, world.npcs, world.reputation);
      },
      [MSG.KICK]: (m) => { world.status = 'banned'; applyStatus(m.reason); },
      __close: () => ui.toast('การเชื่อมต่อหลุด กำลังลองใหม่...', 'bad'),
    },
  });
}

function applyStatus(reason) {
  if (world.status === 'approved') ui.screen(null);
  else if (world.status === 'banned') { ui.screen('banned-screen'); if (reason) document.getElementById('ban-reason').textContent = reason; }
  else ui.screen('pending-screen');
}

// ---- Snapshot interpolation for remote players ----
function ingestState(m) {
  const now = performance.now();
  const seen = new Set();
  for (const p of m.players) {
    seen.add(p.id);
    if (world.self && p.id === world.self.id) {
      // Reconcile prediction gently toward the authoritative position.
      const dx = p.x - world.self.x, dy = p.y - world.self.y;
      if (Math.hypot(dx, dy) > TILE * 1.5) { world.self.x = p.x; world.self.y = p.y; }
      else { world.self.x += dx * 0.2; world.self.y += dy * 0.2; }
      world.self.dir = world.self.moving ? world.self.dir : p.dir;
      continue;
    }
    let r = world.remotes.get(p.id);
    if (!r) r = { prev: { x: p.x, y: p.y, t: now }, next: { x: p.x, y: p.y, t: now } };
    r.prev = r.next;
    r.next = { x: p.x, y: p.y, t: now };
    r.dir = p.dir; r.moving = p.moving; r.name = p.name; r.id = p.id;
    world.remotes.set(p.id, r);
  }
  for (const id of world.remotes.keys()) if (!seen.has(id)) world.remotes.delete(id);
}

// ---- Chat ----
const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) { net?.chat(chatInput.value.trim()); chatInput.value = ''; }
});
document.getElementById('btn-chat')?.addEventListener('click', () => chatInput.focus());
document.getElementById('btn-quest')?.addEventListener('click', ui.togglePanel);
document.getElementById('quest-close')?.addEventListener('click', ui.togglePanel);

// ---- Main loop ----
let last = performance.now(), tick = 0;
const speedPerSec = PLAYER_SPEED * TICK_HZ;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; tick++;

  if (world.self && world.status === 'approved') {
    net?.sendMove(input.state);
    let dx = (input.state.right ? 1 : 0) - (input.state.left ? 1 : 0);
    let dy = (input.state.down ? 1 : 0) - (input.state.up ? 1 : 0);
    world.self.moving = !!(dx || dy);
    if (world.self.moving) {
      const len = Math.hypot(dx, dy) || 1;
      const nx = world.self.x + (dx / len) * speedPerSec * dt;
      const ny = world.self.y + (dy / len) * speedPerSec * dt;
      if (!solidAt(nx, world.self.y)) world.self.x = nx;
      if (!solidAt(world.self.x, ny)) world.self.y = ny;
      world.self.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    }
    focus(world.self.x, world.self.y, view);
  }

  // Build interpolated remote list.
  const renderTime = now - 90; // render slightly in the past for smoothness
  const remotes = [];
  for (const r of world.remotes.values()) {
    const span = Math.max(1, r.next.t - r.prev.t);
    let a = (renderTime - r.prev.t) / span;
    a = Math.max(0, Math.min(1.2, a));
    remotes.push({
      id: r.id, name: r.name, dir: r.dir, moving: r.moving,
      x: r.prev.x + (r.next.x - r.prev.x) * a,
      y: r.prev.y + (r.next.y - r.prev.y) * a,
    });
  }

  if (world.status === 'approved' && world.self) {
    draw(ctx, view, remotes, world.self, world.npcs, tick);
  } else {
    ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, view.w, view.h);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
