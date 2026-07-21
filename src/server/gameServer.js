// Authoritative realtime world across multiple maps.
import { WebSocketServer } from 'ws';
import { MSG, STATUS, TICK_HZ, PLAYER_SPEED, MAX_CHAT_LEN } from '../shared/constants.js';
import { TILE, getMap } from '../shared/maps.js';
import * as players from './players.js';
import * as content from './content.js';
import { isSolid, portalAt } from './collision.js';
import { aiReply, aiEnabled } from './ai.js';

let nextConnId = 1;
const live = new Map(); // connId -> { ws, id, input, acc }

function send(ws, type, data) { if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data })); }
function broadcast(type, data, filter) {
  const packet = JSON.stringify({ type, ...data });
  for (const c of live.values()) { if (filter && !filter(c)) continue; if (c.ws.readyState === 1) c.ws.send(packet); }
}

export function enforce(id, status) {
  for (const c of live.values()) {
    if (c.id !== id) continue;
    send(c.ws, MSG.STATUS, { status, canChat: c.acc.canChat });
    if (status === STATUS.BANNED) { send(c.ws, MSG.KICK, { reason: 'ถูกแอดมินระงับการเข้าเล่น' }); c.ws.close(); }
  }
}
export function notifyChat(id, canChat) {
  for (const c of live.values()) if (c.id === id) send(c.ws, MSG.STATUS, { status: c.acc.status, canChat });
}
export function pushContent() { broadcast(MSG.CONTENT, { content: content.get() }); }

function npcsOnMap(mapId) { return content.get().npcs.filter((n) => (n.map || 'school') === mapId); }

function templateDialogue(npc) {
  const P = content.get().personalities || {};
  const tpl = P[npc.personality] || P.default || {
    lines: [`${npc.name}: "...มีอะไรให้ช่วยไหม?"`],
    choices: [{ text: 'ทักทาย (+2 ♥)', affection: 2 }, { text: 'ยิ้มให้ (+1 ♥)', affection: 1 }, { text: 'จากไป', affection: 0 }],
  };
  const lines = (tpl.lines || []).map((l) => l.replace(/\{name\}/g, npc.name).replace(/\{role\}/g, npc.role || ''));
  return { lines: lines.length ? lines : [`${npc.name}: "..."`], choices: tpl.choices };
}

function nearestNpc(acc) {
  let best = null, bestD = Infinity;
  for (const npc of npcsOnMap(acc.map)) {
    const d = Math.hypot(npc.x * TILE - acc.x, npc.y * TILE - acc.y);
    if (d < bestD) { bestD = d; best = npc; }
  }
  return bestD <= TILE * 1.7 ? best : null;
}

function handleInteract(c) {
  const best = nearestNpc(c.acc);
  if (!best) return;
  const explicit = content.get().dialogues[best.id];
  const dlg = explicit ? { lines: explicit.lines, choices: explicit.choices } : templateDialogue(best);
  send(c.ws, MSG.DIALOGUE, {
    npc: { id: best.id, name: best.name, role: best.role, portrait: best.look || best.portrait },
    affection: c.acc.affection[best.id] || 0,
    lines: dlg.lines,
    choices: dlg.choices || [{ text: 'ทักทาย (+2 ♥)', affection: 2 }, { text: 'จากไป', affection: 0 }],
    history: c.acc.ai?.[best.id] || [],
    ai: aiEnabled(),
  });
}

function handleChoice(c, index) {
  const best = nearestNpc(c.acc);
  if (!best) return;
  const explicit = content.get().dialogues[best.id];
  const choices = (explicit ? explicit.choices : templateDialogue(best).choices) || [];
  const choice = choices[index];
  if (!choice) return;
  if (choice.affection) {
    const total = players.addAffection(c.acc.id, best.id, choice.affection);
    c.acc = players.get(c.acc.id);
    send(c.ws, MSG.TOAST, {
      text: `${best.name}: ความสัมพันธ์ ${total} ♥`,
      level: choice.affection > 1 ? 'good' : 'ok',
      affection: { [best.id]: total }, reputation: c.acc.reputation,
    });
  }
}

async function handleAiChat(c, npcId, text) {
  const acc = c.acc;
  const npc = content.get().npcs.find((n) => n.id === npcId);
  if (!npc || !text) return;
  send(c.ws, MSG.AI_TYPING, { npcId });
  acc.ai ||= {};
  const hist = acc.ai[npcId] || [];
  const reply = await aiReply(npc, acc, hist, text);
  hist.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
  acc.ai[npcId] = hist.slice(-40);   // keep recent memory (persists across sessions)
  // free-form chatting slowly warms the relationship
  if ((acc.affection[npcId] || 0) < 100) players.addAffection(acc.id, npcId, 1);
  c.acc = players.get(acc.id);
  players.persist();
  send(c.ws, MSG.AI_REPLY, { npcId, from: npc.name, text: reply, affection: acc.affection[npcId] || 0, reputation: c.acc.reputation });
}

function usePortal(c, portal) {
  const acc = c.acc;
  acc.map = portal.to;
  acc.x = portal.tx * TILE + TILE / 2;
  acc.y = portal.ty * TILE + TILE / 2;
  acc.input = {}; c.input = {};
  players.persist();
  send(c.ws, MSG.TOAST, { text: `เดินทางสู่ ${getMap(portal.to).name}`, level: 'good' });
  send(c.ws, MSG.CONTENT, { content: content.get() });
}

function step() {
  for (const c of live.values()) {
    const acc = c.acc;
    if (!acc || acc.status !== STATUS.APPROVED) continue;
    const inp = c.input, m = getMap(acc.map);
    let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const nx = acc.x + (dx / len) * PLAYER_SPEED, ny = acc.y + (dy / len) * PLAYER_SPEED;
      if (!isSolid(acc.map, nx, acc.y)) acc.x = nx;
      if (!isSolid(acc.map, acc.x, ny)) acc.y = ny;
      acc.x = Math.max(TILE, Math.min((m.w - 1) * TILE, acc.x));
      acc.y = Math.max(TILE, Math.min((m.h - 1) * TILE, acc.y));
      acc.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      acc.moving = true;
      const p = portalAt(acc.map, acc.x, acc.y);
      if (p) usePortal(c, p);
    } else acc.moving = false;
  }

  // Broadcast per map so you only see players on your map.
  const byMap = {};
  for (const c of live.values()) {
    if (!c.acc || c.acc.status !== STATUS.APPROVED) continue;
    (byMap[c.acc.map] ||= []).push({
      id: c.acc.id, name: c.acc.name, map: c.acc.map,
      x: Math.round(c.acc.x), y: Math.round(c.acc.y),
      dir: c.acc.dir, moving: !!c.acc.moving, look: c.acc.look, rep: c.acc.reputation,
    });
  }
  for (const c of live.values()) {
    if (!c.acc || c.acc.status !== STATUS.APPROVED) continue;
    send(c.ws, MSG.STATE, { players: byMap[c.acc.map] || [], map: c.acc.map, t: Date.now() });
  }
}

export function attach(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    const connId = nextConnId++;
    const c = { connId, ws, id: null, acc: null, input: {} };
    live.set(connId, c);
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      switch (m.type) {
        case MSG.HELLO: {
          const id = String(m.id || '').slice(0, 40) || `guest-${connId}`;
          const acc = players.upsert(id, String(m.name || '').slice(0, 24), m.look);
          c.id = id; c.acc = acc;
          send(ws, MSG.WELCOME, {
            self: { id: acc.id, name: acc.name, x: acc.x, y: acc.y, dir: acc.dir, map: acc.map, look: acc.look },
            status: acc.status, canChat: acc.canChat,
            affection: acc.affection, quests: acc.quests, reputation: acc.reputation,
          });
          send(ws, MSG.CONTENT, { content: content.get() });
          break;
        }
        case MSG.MOVE:
          if (c.acc) c.input = { up: !!m.up, down: !!m.down, left: !!m.left, right: !!m.right };
          break;
        case MSG.CHAT: {
          if (!c.acc || !c.acc.canChat || c.acc.status !== STATUS.APPROVED) { send(ws, MSG.TOAST, { text: 'แอดมินยังไม่อนุญาตให้แชท', level: 'bad' }); break; }
          const text = String(m.text || '').slice(0, MAX_CHAT_LEN).trim();
          if (text) broadcast(MSG.CHAT_MSG, { from: c.acc.name, text, t: Date.now() }, (o) => o.acc && o.acc.map === c.acc.map);
          break;
        }
        case MSG.INTERACT: if (c.acc?.status === STATUS.APPROVED) handleInteract(c); break;
        case MSG.DIALOGUE_CHOICE: if (c.acc?.status === STATUS.APPROVED) handleChoice(c, m.index | 0); break;
        case MSG.AI_CHAT: if (c.acc?.status === STATUS.APPROVED) handleAiChat(c, String(m.npcId || ''), String(m.text || '').slice(0, 500).trim()); break;
      }
    });
    ws.on('close', () => live.delete(connId));
    ws.on('error', () => {});
  });
  setInterval(step, 1000 / TICK_HZ);
  content.onChange(() => pushContent());
  return { broadcast, live };
}

export function onlineIds() { return [...live.values()].filter((c) => c.id).map((c) => c.id); }
