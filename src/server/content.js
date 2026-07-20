// Hot-reloadable game content: NPCs, quests, dialogues, events.
// Admins can edit content/*.json (or POST /api/admin/content) and reload live.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, '..', '..', 'content');

let content = { npcs: [], quests: [], dialogues: {}, events: [], version: 0 };
const listeners = new Set();

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
  } catch (err) {
    console.warn(`[content] ${file}: ${err.message}`);
    return fallback;
  }
}

export function reload() {
  content = {
    npcs: readJson('npcs.json', []),
    quests: readJson('quests.json', []),
    dialogues: readJson('dialogues.json', {}),
    events: readJson('events.json', []),
    version: Date.now(),
  };
  console.log(`[content] loaded ${content.npcs.length} NPCs, ${content.quests.length} quests (v${content.version})`);
  for (const fn of listeners) fn(content);
  return content;
}

export function get() { return content; }

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Apply a live patch from the admin API and persist it.
export function patch(kind, payload) {
  if (kind === 'npcs' || kind === 'quests' || kind === 'events') {
    if (Array.isArray(payload)) content[kind] = payload;
  } else if (kind === 'dialogues') {
    content.dialogues = payload;
  } else {
    return false;
  }
  content.version = Date.now();
  fs.writeFileSync(path.join(CONTENT_DIR, `${kind}.json`),
    JSON.stringify(content[kind], null, 2));
  for (const fn of listeners) fn(content);
  return true;
}

// Watch files for external edits (edit JSON in your editor, world updates live).
export function watch() {
  try {
    fs.watch(CONTENT_DIR, { persistent: false }, (_evt, file) => {
      if (file && file.endsWith('.json')) {
        clearTimeout(watch._t);
        watch._t = setTimeout(reload, 250);
      }
    });
  } catch (err) {
    console.warn('[content] watch unavailable:', err.message);
  }
}
