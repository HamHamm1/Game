// Generates 100 distinct NPCs spread across the school, town and world maps.
// Run once: `node scripts/genNpcs.mjs` -> writes content/npcs.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { walkableCells } from '../src/shared/maps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const r = rng(777);
const pick = (a) => a[(r() * a.length) | 0];

// Seven hand-authored main love interests (dialogues.json matches these ids).
const MAINS = [
  { id: 'seraphine', name: 'เซราฟิน', role: 'นางเอกตัวจริงของนิยาย', map: 'school', hairStyle: 'long', look: { skin: '#f3d2b3', hair: '#f2d16b', eye: '#4aa3ff', outfit: '#ffd9e6' }, personality: 'cheerful' },
  { id: 'aric', name: 'เจ้าชายอาริค', role: 'รัชทายาทแห่งอเล็กเทียร์', map: 'town', hairStyle: 'short', look: { skin: '#e9c39b', hair: '#8a6bd1', eye: '#c9a227', outfit: '#3a2f6b' }, personality: 'noble' },
  { id: 'kaeld', name: 'ไคลด์', role: 'อัศวินหน้าเย็นแห่งลานประลอง', map: 'school', hairStyle: 'spiky', look: { skin: '#d8b08a', hair: '#3a3f4a', eye: '#7ad1c4', outfit: '#5a5f6b' }, personality: 'knight' },
  { id: 'lumen', name: 'ลูเมน', role: 'จอมเวทเจ้าเล่ห์แห่งห้องสมุดต้องห้าม', map: 'school', hairStyle: 'ponytail', look: { skin: '#f0d6bd', hair: '#c94f7c', eye: '#a24aff', outfit: '#241b3a' }, personality: 'scholar' },
  { id: 'rosalie', name: 'โรซาลี', role: 'สาวคาเฟ่ไรส์ทาผู้ร่าเริง', map: 'school', hairStyle: 'bob', look: { skin: '#f6cdae', hair: '#e08a3c', eye: '#4fbf6a', outfit: '#ffe1b0' }, personality: 'cheerful' },
  { id: 'thane', name: 'รุ่นพี่เธน', role: 'ดาวโรงเรียน หัวหน้าหอชาย', map: 'town', hairStyle: 'short', look: { skin: '#e6bd94', hair: '#2b2b2b', eye: '#d13a3a', outfit: '#1f3a5a' }, personality: 'flirty' },
  { id: 'nyx', name: 'นิกซ์', role: 'เด็กลึกลับสายมืด', map: 'world', hairStyle: 'hood', look: { skin: '#d9c2c8', hair: '#6a2fb0', eye: '#ff4a8d', outfit: '#14121f' }, personality: 'mysterious' },
];

const GIVEN = ['อาริน', 'เซเลน', 'ไคออน', 'มิรา', 'เวลกา', 'ลิอาน', 'ซินเธีย', 'ราเวน', 'อีเดน', 'ฟลอรา', 'ดันเต้', 'ยูริ', 'คาลิกซ์', 'เอลาร่า', 'ธีโอ', 'นวล', 'ไอริส', 'เฟรย่า', 'ออร์ริน', 'เลโอ', 'ซาช่า', 'มิลก้า', 'เรน', 'ไวโอเล็ต', 'แคสเปียน', 'ลูน่า', 'อีธาน', 'เซฟิร์', 'มายา', 'โรแลนด์', 'อีวา', 'กาเบรียล', 'นิน่า', 'ออกัส', 'เพิร์ล', 'ไทเรล', 'เอสเทล', 'บรูโน', 'คลารา', 'เฟลิกซ์', 'ซีลีน', 'ฮิวโก้', 'มารีน', 'โจเซฟ', 'อลิซ', 'เดเมียน', 'โรซ่า', 'เอนโซ่', 'ลีนา', 'วิคเตอร์'];
const SUR = ['อยุก', 'มาร์ควิส', 'เคานต์', 'เดอเวลิส', 'นาร์เคีย', 'เบลวิน', 'ออสเทรีย', 'โรเซเลีย', 'ฮาซาน', 'นิรันดร์', 'คริสตัล', 'เวเลนไทน์', 'แบล็กวูด', 'ซิลเวอร์', 'ดอว์น'];
const ROLES = ['นักเรียนเวทศิลป์', 'ทหารองครักษ์', 'พ่อค้าเร่', 'ศิลปินข้างถนน', 'ขุนนางหนุ่ม', 'ขุนนางสาว', 'บรรณารักษ์', 'นักผจญภัย', 'หมอดูไพ่', 'ช่างตีเหล็ก', 'นักร้องโอเปร่า', 'พ่อครัว', 'ชาวสวน', 'นักเล่นแร่แปรธาตุ', 'ยาม', 'พ่อมดฝึกหัด', 'แม่มดสาว', 'นักดาบพเนจร', 'กวี', 'พ่อค้าดอกไม้'];

const SKINS = ['#f3d2b3', '#e9c39b', '#e6bd94', '#d8b08a', '#c68642', '#a9714b', '#f6cdae', '#d9c2c8', '#8d5524'];
const HAIRS = ['#2b2b2b', '#3a3f4a', '#5a3b22', '#8a6bd1', '#c94f7c', '#e08a3c', '#f2d16b', '#6a2fb0', '#2b8f6b', '#c94f3a', '#d1a12b', '#9fb0c9', '#b0413a'];
const EYES = ['#4aa3ff', '#c9a227', '#7ad1c4', '#a24aff', '#4fbf6a', '#d13a3a', '#ff4a8d', '#6b8cff'];
const OUTFITS = ['#3a2f6b', '#5a5f6b', '#241b3a', '#ffe1b0', '#1f3a5a', '#7a2f4a', '#2b5a3a', '#5a2f6b', '#8a5a2b', '#334', '#6b2f2f'];
const HAIRSTYLES = ['short', 'long', 'ponytail', 'spiky', 'bun', 'hood', 'bob', 'braids'];
const OUTFITSTYLES = ['uniform', 'robe', 'dress', 'noble', 'casual'];
const PERSONS = ['tsundere', 'cheerful', 'cool', 'shy', 'flirty', 'noble', 'mysterious', 'scholar', 'knight', 'merchant'];

const DISTRIB = { school: 34, town: 40, world: 19 }; // + 7 mains = 100
const npcs = [...MAINS];
const usedNames = new Set(MAINS.map((m) => m.name));

for (const [map, count] of Object.entries(DISTRIB)) {
  const cells = walkableCells(map).slice();
  // shuffle deterministically
  for (let i = cells.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0;[cells[i], cells[j]] = [cells[j], cells[i]]; }
  let ci = 0;
  for (let i = 0; i < count; i++) {
    let name;
    do { name = `${pick(GIVEN)} ${pick(SUR)}`; } while (usedNames.has(name) && usedNames.size < GIVEN.length * SUR.length);
    usedNames.add(name);
    const [x, y] = cells[ci++ % cells.length];
    npcs.push({
      id: `npc_${map}_${i}`, name, role: pick(ROLES), map, x, y, romanceable: true,
      personality: pick(PERSONS),
      look: { skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(HAIRSTYLES), eye: pick(EYES), outfit: pick(OUTFITS), outfitStyle: pick(OUTFITSTYLES) },
    });
  }
}

fs.writeFileSync(path.join(__dirname, '..', 'content', 'npcs.json'), JSON.stringify(npcs, null, 1));
console.log(`Wrote ${npcs.length} NPCs -> content/npcs.json`);
console.log('per map:', Object.fromEntries(['school', 'town', 'world'].map((m) => [m, npcs.filter((n) => n.map === m).length])));
