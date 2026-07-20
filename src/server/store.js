// Tiny JSON persistence layer — no database needed, Termux-friendly.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function load(name, fallback) {
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`[store] failed to read ${name}:`, err.message);
    return fallback;
  }
}

let queued = {};
export function save(name, data) {
  ensureDir();
  // Debounce writes so a chatty world doesn't hammer the disk.
  clearTimeout(queued[name]);
  queued[name] = setTimeout(() => {
    const file = path.join(DATA_DIR, `${name}.json`);
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (err) {
      console.warn(`[store] failed to write ${name}:`, err.message);
    }
  }, 400);
}
