// Player account registry: identity, approval status, progress, affection.
// Persisted to data/players.json so progress survives restarts.
import { load, save } from './store.js';
import { STATUS } from '../shared/constants.js';

const accounts = load('players', {}); // id -> account

export function persist() { save('players', accounts); }

export function get(id) { return accounts[id]; }
export function all() { return Object.values(accounts); }

export function upsert(id, name) {
  let acc = accounts[id];
  if (!acc) {
    acc = accounts[id] = {
      id,
      name: name || `ผู้พเนจร-${id.slice(0, 4)}`,
      status: STATUS.PENDING,
      canChat: false,
      createdAt: Date.now(),
      // Spawn near the academy gate.
      x: 30 * 32, y: 34 * 32, dir: 'down',
      affection: {},   // npcId -> points
      quests: {},      // questId -> { state, progress }
      flags: {},       // story flags
      reputation: 0,   // starts hated; rises as you win people over
    };
    persist();
  } else if (name && acc.status === STATUS.PENDING) {
    acc.name = name;
  }
  return acc;
}

export function setStatus(id, status) {
  const acc = accounts[id];
  if (!acc) return null;
  acc.status = status;
  if (status === STATUS.APPROVED) acc.canChat = true;
  persist();
  return acc;
}

export function setChat(id, canChat) {
  const acc = accounts[id];
  if (!acc) return null;
  acc.canChat = !!canChat;
  persist();
  return acc;
}

export function addAffection(id, npcId, delta) {
  const acc = accounts[id];
  if (!acc) return 0;
  acc.affection[npcId] = (acc.affection[npcId] || 0) + delta;
  acc.reputation = Math.min(100, acc.reputation + Math.max(0, delta));
  persist();
  return acc.affection[npcId];
}

export function setQuest(id, questId, patch) {
  const acc = accounts[id];
  if (!acc) return null;
  acc.quests[questId] = { ...(acc.quests[questId] || {}), ...patch };
  persist();
  return acc.quests[questId];
}
