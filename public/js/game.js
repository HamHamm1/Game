// Main client: character creator, join flow, multi-map realtime loop.
import { MSG, PLAYER_SPEED, TICK_HZ } from '/shared/constants.js';
import { TILE, getMap, getSolid } from '/shared/maps.js';
import { createInput } from './input.js';
import { connect } from './net.js';
import { focus, draw, drawPortrait } from './renderer.js';
import * as ui from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { w: 0, h: 0 };

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = view.w * dpr; canvas.height = view.h * dpr;
  canvas.style.width = view.w + 'px'; canvas.style.height = view.h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize); resize();

// ---- Identity + saved appearance ----
let playerId = localStorage.getItem('sw_id');
if (!playerId) { playerId = 'p-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('sw_id', playerId); }

const DEFAULT_LOOK = { skin: '#e9c39b', hair: '#6a2fb0', hairStyle: 'short', eye: '#ff4a8d', outfit: '#2a1f3a', outfitStyle: 'uniform' };
let look = { ...DEFAULT_LOOK, ...(JSON.parse(localStorage.getItem('sw_look') || '{}')) };
document.getElementById('name-input').value = localStorage.getItem('sw_name') || '';

// ---- Character creator ----
const OPTIONS = {
  skin: ['#f6cdae', '#e9c39b', '#d8b08a', '#c68642', '#a9714b', '#8d5524', '#d9c2c8'],
  hair: ['#2b2b2b', '#5a3b22', '#8a6bd1', '#c94f7c', '#e08a3c', '#f2d16b', '#6a2fb0', '#2b8f6b', '#c94f3a', '#9fb0c9'],
  hairStyle: ['short', 'long', 'ponytail', 'spiky', 'bun', 'hood', 'bob', 'braids'],
  eye: ['#4aa3ff', '#c9a227', '#7ad1c4', '#a24aff', '#4fbf6a', '#d13a3a', '#ff4a8d'],
  outfit: ['#2a1f3a', '#3a2f6b', '#5a5f6b', '#1f3a5a', '#7a2f4a', '#2b5a3a', '#8a5a2b', '#ffd9e6'],
};
const STYLE_LABEL = { short: 'ผมสั้น', long: 'ผมยาว', ponytail: 'หางม้า', spiky: 'ผมตั้ง', bun: 'มวยผม', hood: 'สวมฮู้ด', bob: 'บ๊อบ', braids: 'ถักเปีย' };

function buildCreator() {
  const wrap = document.getElementById('creator-options');
  wrap.innerHTML = '';
  const row = (label, key, render) => {
    const r = document.createElement('div'); r.className = 'cr-row';
    r.innerHTML = `<span>${label}</span>`;
    const opts = document.createElement('div'); opts.className = 'cr-opts';
    OPTIONS[key].forEach((v) => {
      const b = document.createElement('button'); b.className = 'cr-chip';
      render(b, v);
      b.onclick = () => { look[key] = v; syncCreator(); };
      if (look[key] === v) b.classList.add('sel');
      b.dataset.key = key; b.dataset.val = v;
      opts.appendChild(b);
    });
    r.appendChild(opts); wrap.appendChild(r);
  };
  row('สีผิว', 'skin', (b, v) => b.style.background = v);
  row('สีผม', 'hair', (b, v) => b.style.background = v);
  row('ทรงผม', 'hairStyle', (b, v) => { b.textContent = STYLE_LABEL[v]; b.classList.add('txt'); });
  row('สีตา', 'eye', (b, v) => b.style.background = v);
  row('สีชุด', 'outfit', (b, v) => b.style.background = v);
  syncCreator();
}
function syncCreator() {
  document.querySelectorAll('.cr-chip').forEach((b) => b.classList.toggle('sel', look[b.dataset.key] === b.dataset.val));
  const pv = document.getElementById('creator-preview'), pc = pv.getContext('2d');
  pc.clearRect(0, 0, pv.width, pv.height); pc.imageSmoothingEnabled = false;
  drawPortrait(pc, look, 18, 12, 120);
  localStorage.setItem('sw_look', JSON.stringify(look));
}
document.getElementById('creator-random').onclick = () => {
  for (const k of Object.keys(OPTIONS)) look[k] = OPTIONS[k][(Math.random() * OPTIONS[k].length) | 0];
  buildCreator();
};

// ---- Screens flow: creator -> join -> game ----
const world = { status: 'pending', canChat: false, self: null, map: 'school', remotes: new Map(), npcs: [], npcById: {}, npcLive: new Map(), quests: [], affection: {}, questProgress: {}, reputation: 0 };
let net = null;
const input = createInput({ onInteract: () => net?.interact() });

document.getElementById('creator-next').onclick = () => { ui.screen('join-screen'); };
document.getElementById('back-to-creator').onclick = () => { ui.screen('creator-screen'); };
document.getElementById('join-btn').addEventListener('click', join);
document.getElementById('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

async function join() {
  const name = document.getElementById('name-input').value.trim().slice(0, 24) || 'วายร้าย';
  localStorage.setItem('sw_name', name); localStorage.setItem('sw_look', JSON.stringify(look));
  try { await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: playerId, name, look }) }); } catch {}
  startNet(name);
}

function solidAt(mapId, px, py) {
  const m = getMap(mapId), s = getSolid(mapId), R = 9;
  for (const [ox, oy] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
    const tx = Math.floor((px + ox) / TILE), ty = Math.floor((py + oy) / TILE);
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    if (s[ty * m.w + tx]) return true;
  }
  return false;
}

function startNet(name) {
  net = connect({
    id: playerId, name, look,
    handlers: {
      [MSG.WELCOME]: (m) => {
        world.self = { id: m.self.id, name: m.self.name, x: m.self.x, y: m.self.y, dir: m.self.dir, moving: false, look: m.self.look };
        world.map = m.self.map || 'school';
        world.status = m.status; world.canChat = m.canChat;
        world.affection = m.affection || {}; world.questProgress = m.quests || {}; world.reputation = m.reputation || 0;
        applyStatus();
      },
      [MSG.STATUS]: (m) => { world.status = m.status; world.canChat = m.canChat; applyStatus(); },
      [MSG.CONTENT]: (m) => {
        world.npcs = m.content.npcs || []; world.quests = m.content.quests || [];
        world.npcById = {}; for (const n of world.npcs) world.npcById[n.id] = n;
        ui.renderQuests(world.quests, world.questProgress, world.affection, world.npcs, world.reputation);
      },
      [MSG.STATE]: (m) => ingestState(m),
      [MSG.CHAT_MSG]: (m) => ui.chatLog(m.from, m.text),
      [MSG.DIALOGUE]: (m) => ui.showDialogue(m, (i) => net.choose(i), (npcId, text) => net.aiChat(npcId, text)),
      [MSG.AI_TYPING]: () => ui.setTyping(true),
      [MSG.AI_REPLY]: (m) => {
        ui.setTyping(false); ui.appendChat(m.from, m.text, false);
        if (typeof m.affection === 'number') { world.affection[m.npcId] = m.affection; document.getElementById('dlg-aff').textContent = `♥ ${m.affection}`; }
        if (typeof m.reputation === 'number') world.reputation = m.reputation;
        ui.renderQuests(world.quests, world.questProgress, world.affection, world.npcs, world.reputation);
      },
      [MSG.TOAST]: (m) => {
        ui.toast(m.text, m.level);
        if (m.affection) Object.assign(world.affection, m.affection);
        if (typeof m.reputation === 'number') world.reputation = m.reputation;
        if (m.affection || m.reputation != null) ui.renderQuests(world.quests, world.questProgress, world.affection, world.npcs, world.reputation);
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

function ingestState(m) {
  const now = performance.now(), seen = new Set();
  // Detect a map change for the local player (portal used).
  if (world.self && m.map && m.map !== world.map) { world.map = m.map; world.remotes.clear(); world.npcLive.clear(); }
  for (const p of m.players) {
    seen.add(p.id);
    if (world.self && p.id === world.self.id) {
      const dx = p.x - world.self.x, dy = p.y - world.self.y;
      if (Math.hypot(dx, dy) > TILE * 1.5) { world.self.x = p.x; world.self.y = p.y; }
      else { world.self.x += dx * 0.2; world.self.y += dy * 0.2; }
      if (p.look) world.self.look = p.look;
      continue;
    }
    let r = world.remotes.get(p.id);
    if (!r) r = { prev: { x: p.x, y: p.y, t: now }, next: { x: p.x, y: p.y, t: now } };
    r.prev = r.next; r.next = { x: p.x, y: p.y, t: now };
    r.dir = p.dir; r.moving = p.moving; r.name = p.name; r.id = p.id; r.look = p.look;
    world.remotes.set(p.id, r);
  }
  for (const id of world.remotes.keys()) if (!seen.has(id)) world.remotes.delete(id);

  // Living NPCs — interpolate positions like remote players.
  if (m.npcs) {
    const seenN = new Set();
    for (const n of m.npcs) {
      seenN.add(n.id);
      let r = world.npcLive.get(n.id);
      if (!r) r = { prev: { x: n.x, y: n.y, t: now }, next: { x: n.x, y: n.y, t: now } };
      r.prev = r.next; r.next = { x: n.x, y: n.y, t: now };
      r.dir = n.dir; r.moving = n.moving; r.emote = n.emote; r.id = n.id;
      world.npcLive.set(n.id, r);
    }
    for (const id of world.npcLive.keys()) if (!seenN.has(id)) world.npcLive.delete(id);
  }
}

// ---- Chat / buttons ----
const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && chatInput.value.trim()) { net?.chat(chatInput.value.trim()); chatInput.value = ''; } });
document.getElementById('btn-chat')?.addEventListener('click', () => chatInput.focus());
document.getElementById('btn-quest')?.addEventListener('click', ui.togglePanel);
document.getElementById('quest-close')?.addEventListener('click', ui.togglePanel);
document.getElementById('dlg-send')?.addEventListener('click', () => ui.sendDialogue());
document.getElementById('dlg-close')?.addEventListener('click', () => ui.hideDialogue());
document.getElementById('dlg-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') ui.sendDialogue(); e.stopPropagation(); });

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
      const nx = world.self.x + (dx / len) * speedPerSec * dt, ny = world.self.y + (dy / len) * speedPerSec * dt;
      if (!solidAt(world.map, nx, world.self.y)) world.self.x = nx;
      if (!solidAt(world.map, world.self.x, ny)) world.self.y = ny;
      world.self.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    }
    focus(world.self.x, world.self.y, view);
  }

  const renderTime = now - 90, remotes = [];
  for (const r of world.remotes.values()) {
    const span = Math.max(1, r.next.t - r.prev.t);
    let a = Math.max(0, Math.min(1.2, (renderTime - r.prev.t) / span));
    remotes.push({ id: r.id, name: r.name, dir: r.dir, moving: r.moving, look: r.look, x: r.prev.x + (r.next.x - r.prev.x) * a, y: r.prev.y + (r.next.y - r.prev.y) * a });
  }

  if (world.status === 'approved' && world.self) {
    const npcs = [];
    if (world.npcLive.size) {
      for (const r of world.npcLive.values()) {
        const ident = world.npcById[r.id]; if (!ident) continue;
        const span = Math.max(1, r.next.t - r.prev.t);
        const a = Math.max(0, Math.min(1.2, (renderTime - r.prev.t) / span));
        npcs.push({
          id: r.id, name: ident.name, look: ident.look, dir: r.dir, moving: r.moving, emote: r.emote,
          x: r.prev.x + (r.next.x - r.prev.x) * a, y: r.prev.y + (r.next.y - r.prev.y) * a,
        });
      }
    } else { // fallback before first NPC snapshot arrives
      for (const n of world.npcs) if ((n.map || 'school') === world.map)
        npcs.push({ id: n.id, name: n.name, look: n.look, dir: 'down', moving: false, x: n.x * TILE + TILE / 2, y: n.y * TILE + TILE / 2 });
    }
    draw(ctx, view, world.map, remotes, world.self, npcs, tick);
  } else { ctx.fillStyle = '#0c1420'; ctx.fillRect(0, 0, view.w, view.h); }
  requestAnimationFrame(loop);
}
buildCreator();
ui.screen('creator-screen');
requestAnimationFrame(loop);
