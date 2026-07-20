// Authoritative realtime world: live players, movement, chat, NPC interaction.
import { WebSocketServer } from 'ws';
import {
  MSG, STATUS, TICK_HZ, PLAYER_SPEED, MAP_W, MAP_H, TILE, MAX_CHAT_LEN,
} from '../shared/constants.js';
import * as players from './players.js';
import * as content from './content.js';
import { isSolid } from './collision.js';

let nextConnId = 1;
const live = new Map(); // connId -> { ws, id, input, acc }

function send(ws, type, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data }));
}
function broadcast(type, data, filter) {
  const packet = JSON.stringify({ type, ...data });
  for (const c of live.values()) {
    if (filter && !filter(c)) continue;
    if (c.ws.readyState === 1) c.ws.send(packet);
  }
}

// Public helper used by the admin API to enforce decisions immediately.
export function enforce(id, status) {
  for (const c of live.values()) {
    if (c.id !== id) continue;
    send(c.ws, MSG.STATUS, { status, canChat: c.acc.canChat });
    if (status === STATUS.BANNED) {
      send(c.ws, MSG.KICK, { reason: 'ถูกแอดมินระงับการเข้าเล่น' });
      c.ws.close();
    }
  }
}
export function notifyChat(id, canChat) {
  for (const c of live.values()) {
    if (c.id === id) send(c.ws, MSG.STATUS, { status: c.acc.status, canChat });
  }
}
export function pushContent() {
  broadcast(MSG.CONTENT, { content: content.get() });
}

function handleInteract(c) {
  const acc = c.acc;
  const npcs = content.get().npcs;
  // Find the closest NPC within one tile of the player.
  let best = null, bestD = Infinity;
  for (const npc of npcs) {
    const dx = npc.x * TILE - acc.x;
    const dy = npc.y * TILE - acc.y;
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = npc; }
  }
  if (!best || bestD > TILE * 1.6) return;

  const dlg = content.get().dialogues[best.id];
  const aff = acc.affection[best.id] || 0;
  send(c.ws, MSG.DIALOGUE, {
    npc: { id: best.id, name: best.name, role: best.role, portrait: best.portrait },
    affection: aff,
    lines: dlg?.lines || [`${best.name}: "...เธอมาทำอะไรที่นี่ ตัวร้าย?"`],
    choices: dlg?.choices || [
      { text: 'ทักทายอย่างสุภาพ (+2 ♥)', affection: 2 },
      { text: 'ยิ้มลึกลับ (+1 ♥)', affection: 1 },
      { text: 'เดินจากไป', affection: 0 },
    ],
  });
}

function handleChoice(c, choiceIndex) {
  const acc = c.acc;
  // Resolve the last offered dialogue against the nearest NPC again (stateless & safe).
  const npcs = content.get().npcs;
  let best = null, bestD = Infinity;
  for (const npc of npcs) {
    const d = Math.hypot(npc.x * TILE - acc.x, npc.y * TILE - acc.y);
    if (d < bestD) { bestD = d; best = npc; }
  }
  if (!best) return;
  const dlg = content.get().dialogues[best.id];
  const choices = dlg?.choices || [
    { text: '', affection: 2 }, { text: '', affection: 1 }, { text: '', affection: 0 },
  ];
  const choice = choices[choiceIndex];
  if (!choice) return;
  if (choice.affection) {
    const total = players.addAffection(acc.id, best.id, choice.affection);
    c.acc = players.get(acc.id);
    send(c.ws, MSG.TOAST, {
      text: `${best.name}: ความสัมพันธ์ ${total} ♥`,
      level: choice.affection > 1 ? 'good' : 'ok',
      affection: { [best.id]: total },
      reputation: c.acc.reputation,
    });
  }
}

function step() {
  for (const c of live.values()) {
    const acc = c.acc;
    if (acc.status !== STATUS.APPROVED) continue;
    const inp = c.input;
    let dx = 0, dy = 0;
    if (inp.up) dy -= 1;
    if (inp.down) dy += 1;
    if (inp.left) dx -= 1;
    if (inp.right) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const nx = acc.x + (dx / len) * PLAYER_SPEED;
      const ny = acc.y + (dy / len) * PLAYER_SPEED;
      // Axis-separated collision so you slide along walls.
      if (!isSolid(nx, acc.y)) acc.x = nx;
      if (!isSolid(acc.x, ny)) acc.y = ny;
      acc.x = Math.max(TILE, Math.min((MAP_W - 1) * TILE, acc.x));
      acc.y = Math.max(TILE, Math.min((MAP_H - 1) * TILE, acc.y));
      acc.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right')
                                            : (dy < 0 ? 'up' : 'down');
      acc.moving = true;
    } else {
      acc.moving = false;
    }
  }

  // Broadcast a compact snapshot of everyone who is playing.
  const snapshot = [];
  for (const c of live.values()) {
    if (c.acc.status !== STATUS.APPROVED) continue;
    snapshot.push({
      id: c.acc.id, name: c.acc.name,
      x: Math.round(c.acc.x), y: Math.round(c.acc.y),
      dir: c.acc.dir, moving: !!c.acc.moving, rep: c.acc.reputation,
    });
  }
  broadcast(MSG.STATE, { players: snapshot, t: Date.now() });
}

export function attach(server, adminHooks) {
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
          const acc = players.upsert(id, String(m.name || '').slice(0, 24));
          c.id = id; c.acc = acc;
          send(ws, MSG.WELCOME, {
            self: { id: acc.id, name: acc.name, x: acc.x, y: acc.y, dir: acc.dir },
            status: acc.status, canChat: acc.canChat,
            affection: acc.affection, quests: acc.quests, reputation: acc.reputation,
          });
          send(ws, MSG.CONTENT, { content: content.get() });
          adminHooks.onPresence?.();
          break;
        }
        case MSG.MOVE:
          if (c.acc) c.input = {
            up: !!m.up, down: !!m.down, left: !!m.left, right: !!m.right,
          };
          break;
        case MSG.CHAT: {
          if (!c.acc || !c.acc.canChat || c.acc.status !== STATUS.APPROVED) {
            send(ws, MSG.TOAST, { text: 'แอดมินยังไม่อนุญาตให้แชท', level: 'bad' });
            break;
          }
          const text = String(m.text || '').slice(0, MAX_CHAT_LEN).trim();
          if (text) broadcast(MSG.CHAT_MSG, { from: c.acc.name, text, t: Date.now() });
          break;
        }
        case MSG.INTERACT:
          if (c.acc?.status === STATUS.APPROVED) handleInteract(c);
          break;
        case MSG.DIALOGUE_CHOICE:
          if (c.acc?.status === STATUS.APPROVED) handleChoice(c, m.index | 0);
          break;
      }
    });

    ws.on('close', () => { live.delete(connId); adminHooks.onPresence?.(); });
    ws.on('error', () => {});
  });

  setInterval(step, 1000 / TICK_HZ);
  content.onChange(() => pushContent());
  return { broadcast, live };
}

export function onlineIds() {
  return [...live.values()].filter((c) => c.id).map((c) => c.id);
}
