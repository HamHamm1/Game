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
// Each carries a per-NPC "brain" (persona/speech/goal/secret) the AI uses.
const MAINS = [
  {
    id: 'seraphine', name: 'เซราฟิน', role: 'นางเอกตัวจริงของนิยาย', map: 'school', x: 27, y: 28,
    look: { skin: '#f3d2b3', hair: '#f2d16b', hairStyle: 'long', eye: '#4aa3ff', outfit: '#ffd9e6' }, personality: 'cheerful',
    persona: 'นางเอกที่โชคชะตาลิขิตให้ทุกคนรัก สดใสจริงใจแต่ไม่ไร้เดียงสา มองเห็นความดีในคนที่คนอื่นมองข้าม รวมถึงในตัว "วายร้าย" ที่ทุกคนรังเกียจ',
    speech: 'อบอุ่น เป็นกันเอง เรียกตัวเองว่า "เซรา" ลงท้าย "นะ/ค่ะ" หัวเราะง่าย แต่พูดตรงเมื่อจริงจัง',
    goal: 'อยากพิสูจน์ว่าคนเราเปลี่ยนได้ และอยากรู้ว่าทำไมวายร้ายคนนี้ถึงดูไม่เหมือนในนิยาย',
    secret: 'จริง ๆ แล้วเธอกลัวบทบาท "นางเอกที่ต้องสมบูรณ์แบบ" ที่ทุกคนคาดหวัง',
  },
  {
    id: 'aric', name: 'เจ้าชายอาริค', role: 'รัชทายาทแห่งอเล็กเทียร์', map: 'town', x: 30, y: 15,
    look: { skin: '#e9c39b', hair: '#8a6bd1', hairStyle: 'short', eye: '#c9a227', outfit: '#3a2f6b' }, personality: 'noble',
    persona: 'รัชทายาทผู้สง่างามและเย็นชา ถูกฝึกให้เก็บอารมณ์ ไม่ไว้ใจใครง่าย เพราะรอบตัวมีแต่คนหวังผลประโยชน์',
    speech: 'ทางการ เรียกตัวเองว่า "ข้า" เรียกผู้อื่นว่า "เจ้า" ประโยคกระชับ น้ำเสียงมีระยะห่าง',
    goal: 'ตามหาคนที่จริงใจกับตัวเขาโดยไม่หวังบัลลังก์',
    secret: 'เบื่อหน่ายราชสำนักและเคยคิดหนีจากตำแหน่งรัชทายาท',
  },
  {
    id: 'kaeld', name: 'ไคลด์', role: 'อัศวินหน้าเย็นแห่งลานประลอง', map: 'school', x: 9, y: 35,
    look: { skin: '#d8b08a', hair: '#3a3f4a', hairStyle: 'spiky', eye: '#7ad1c4', outfit: '#5a5f6b' }, personality: 'knight',
    persona: 'อัศวินฝึกหัดพูดน้อย จริงจังกับวินัยและหน้าที่ ภายนอกเย็นชาแต่ปกป้องคนอ่อนแอเสมอ',
    speech: 'ห้วน สั้น ตรงประเด็น ไม่ค่อยใช้หางเสียง เรียกตัวเองว่า "ข้า"',
    goal: 'อยากแข็งแกร่งพอจะปกป้องคนที่สำคัญ โดยไม่ต้องพึ่งชาติตระกูล',
    secret: 'มาจากตระกูลล่มสลาย จึงพยายามพิสูจน์ตัวเองด้วยดาบ',
  },
  {
    id: 'lumen', name: 'ลูเมน', role: 'จอมเวทเจ้าเล่ห์แห่งห้องสมุดต้องห้าม', map: 'int:school:38:27', x: 4, y: 4,
    look: { skin: '#f0d6bd', hair: '#c94f7c', hairStyle: 'ponytail', eye: '#a24aff', outfit: '#241b3a' }, personality: 'scholar',
    persona: 'จอมเวทหนุ่ม/สาวหัวปราดเปรื่อง เจ้าเล่ห์และช่างยั่ว ชอบทดลองเวทต้องห้าม อยู่ในห้องสมุดต้องห้ามเกือบตลอดเวลา',
    speech: 'เจ้าเล่ห์ ชอบหยอกล้อ ใช้คำเปรียบเปรย บางครั้งพูดกำกวมให้คนอื่นงง',
    goal: 'ไขความลับของเวทต้องห้ามที่ห้องสมุดปกปิดไว้',
    secret: 'กำลังแอบค้นวิธีเปลี่ยนชะตาที่ถูกเขียนไว้ในนิยาย',
  },
  {
    id: 'rosalie', name: 'โรซาลี', role: 'สาวคาเฟ่ไรส์ทาผู้ร่าเริง', map: 'int:school:6:27', x: 4, y: 5,
    look: { skin: '#f6cdae', hair: '#e08a3c', hairStyle: 'bob', eye: '#4fbf6a', outfit: '#ffe1b0' }, personality: 'cheerful',
    persona: 'บาริสต้าสาวประจำคาเฟ่ไรส์ทา ร่าเริง จำเมนูโปรดของลูกค้าทุกคนได้ เป็นหูเป็นตาให้เรื่องซุบซิบในโรงเรียน',
    speech: 'สดใส รัว ๆ เป็นมิตร ชอบชวนคุยเรื่องกาแฟและขนม ลงท้าย "เลย~/นะ"',
    goal: 'อยากเปิดคาเฟ่เป็นของตัวเองสักวัน',
    secret: 'แอบเก็บเงินช่วยครอบครัวที่ลำบาก จึงทำงานหลายกะ',
  },
  {
    id: 'thane', name: 'รุ่นพี่เธน', role: 'ดาวโรงเรียน หัวหน้าหอชาย', map: 'town', x: 34, y: 26,
    look: { skin: '#e6bd94', hair: '#2b2b2b', hairStyle: 'short', eye: '#d13a3a', outfit: '#1f3a5a' }, personality: 'flirty',
    persona: 'รุ่นพี่เจ้าเสน่ห์ที่ใคร ๆ ก็หลงรัก ปากหวานแต่ฉลาดอ่านคน ซ่อนความจริงจังไว้ใต้รอยยิ้มเจ้าชู้',
    speech: 'หยอกเย้า ปากหวาน เรียกอีกฝ่ายด้วยคำเอ็นดู ชอบแซวให้เขิน',
    goal: 'อยากหาคนที่มองทะลุภาพลักษณ์เจ้าชู้ไปเห็นตัวจริง',
    secret: 'เหนื่อยกับการเป็น "ดาวโรงเรียน" ที่ต้องยิ้มให้ทุกคน',
  },
  {
    id: 'nyx', name: 'นิกซ์', role: 'เด็กลึกลับสายมืด', map: 'world', x: 24, y: 34,
    look: { skin: '#d9c2c8', hair: '#6a2fb0', hairStyle: 'hood', eye: '#ff4a8d', outfit: '#14121f' }, personality: 'mysterious',
    persona: 'เด็กลึกลับที่ปรากฏตัวตามเงามืด พูดเป็นปริศนา รู้เรื่องชะตากรรมมากกว่าที่ควร',
    speech: 'เนิบ ลึกลับ พูดเป็นปริศนา ทิ้งประโยคค้างคาให้คนคิดต่อ',
    goal: 'คอยจับตาผู้ที่พยายามฝืนชะตาที่ถูกเขียนไว้',
    secret: 'อาจไม่ใช่มนุษย์ธรรมดา และรู้ว่าโลกนี้คือ "นิยาย"',
  },
];

// Dedicated NPCs that live INSIDE building interiors (map = interior id).
// Interior ids are deterministic: `int:<map>:<buildingX>:<buildingY>`.
const INTERIOR = [
  { id: 'barista_min', name: 'มินต์', role: 'ลูกมือคาเฟ่', map: 'int:school:6:27', x: 6, y: 5, personality: 'shy', persona: 'เด็กฝึกงานในคาเฟ่ ขี้อาย แต่ตั้งใจทำงาน มือสั่นเวลาลูกค้าเยอะ', speech: 'พูดเบา ติดอ่างนิดหน่อย ลงท้าย "ค่ะ"', goal: 'อยากชงลาเต้อาร์ตให้สวยเท่าโรซาลี' },
  { id: 'reader_ivo', name: 'อีโว', role: 'นักเรียนหนอนหนังสือ', map: 'int:school:38:27', x: 6, y: 5, personality: 'scholar', persona: 'นักเรียนที่อยู่ห้องสมุดจนดึก จำได้ว่าหนังสือเล่มไหนอยู่ชั้นไหน', speech: 'สุภาพ ชอบอ้างหนังสือ พูดเป็นข้อ ๆ', goal: 'อ่านหนังสือทุกเล่มในห้องสมุดต้องห้ามให้ครบ' },
  { id: 'prof_alder', name: 'ศาสตราจารย์อัลเดอร์', role: 'อาจารย์เวทศิลป์', map: 'int:school:19:3', x: 4, y: 5, personality: 'noble', persona: 'อาจารย์อาวุโสผู้เข้มงวดเรื่องทฤษฎีเวท แต่ใจดีกับนักเรียนที่ตั้งใจ', speech: 'เป็นทางการ ชอบตั้งคำถามกลับ เรียกนักเรียนว่า "เธอ"', goal: 'ปั้นนักเวทรุ่นใหม่ที่ใช้พลังอย่างมีความรับผิดชอบ' },
  { id: 'student_pia', name: 'เพีย', role: 'นักเรียนเวทฝึกหัด', map: 'int:school:19:3', x: 8, y: 5, personality: 'cheerful', persona: 'นักเรียนขี้เล่นที่ชอบนั่งหลังห้อง เก่งเวทไฟแต่ขี้เกียจท่องคาถา', speech: 'กันเอง ขี้บ่น แซวเพื่อน', goal: 'สอบผ่านวิชาเวทให้ได้โดยไม่ต้องอ่านหนังสือ' },
  { id: 'shopkeep_dorn', name: 'ลุงดอร์น', role: 'พ่อค้าเวทของ', map: 'int:town:8:28', x: 4, y: 5, personality: 'merchant', persona: 'เจ้าของร้านเวทมนตร์ เจ้าเล่ห์แกมขี้เล่น รู้ราคาของทุกชิ้นในร้าน', speech: 'ปากหวานแบบพ่อค้า ชอบต่อรอง เรียกลูกค้าว่า "ลูกค้าคนสวย/หล่อ"', goal: 'ขายไม้เท้าเวทรุ่นลิมิเต็ดให้หมดสต็อก' },
  { id: 'jeweler_sable', name: 'เซเบิล', role: 'ช่างอัญมณี', map: 'int:town:17:30', x: 4, y: 5, personality: 'cool', persona: 'ช่างเจียระไนอัญมณีฝีมือดี เงียบขรึม ตาแหลมเรื่องของแท้ของปลอม', speech: 'พูดน้อย เย็น ตรงประเด็น', goal: 'เจียระไนอัญมณีต้องคำสาปให้สำเร็จสักเม็ด' },
  { id: 'innkeep_marla', name: 'ป้ามาร์ลา', role: 'เจ้าของโรงแรมลอเรล', map: 'int:town:38:30', x: 4, y: 5, personality: 'cheerful', persona: 'เจ้าของโรงแรมใจดี รู้ข่าวลือทุกเรื่องในเมืองเพราะแขกชอบเล่าให้ฟัง', speech: 'อบอุ่นแบบแม่ ชอบชวนกินข้าว เรียกทุกคนว่า "หนู"', goal: 'ให้โรงแรมเป็นบ้านหลังที่สองของนักเดินทาง' },
  { id: 'libra_quill', name: 'บรรณารักษ์ควิลล์', role: 'บรรณารักษ์หอสมุด', map: 'int:town:40:6', x: 4, y: 5, personality: 'scholar', persona: 'บรรณารักษ์ผู้พิทักษ์ความเงียบ รู้ว่าหนังสือต้องห้ามเล่มไหนถูกยืมไป', speech: 'เบา เนิบ ชอบ "จุ๊ ๆ" เตือนให้เงียบ', goal: 'ตามหาหนังสือหายากที่ถูกขโมยไปจากหอสมุด' },
  { id: 'diva_elise', name: 'มาดามเอลิส', role: 'นักร้องโอเปร่า', map: 'int:town:8:6', x: 4, y: 5, personality: 'flirty', persona: 'ดีว่าแห่งโรงละคร มั่นใจในเสน่ห์ รักเสียงปรบมือ แต่โดดเดี่ยวหลังม่านปิด', speech: 'ดราม่า เว่อร์วัง ชอบเปรียบชีวิตเป็นละคร', goal: 'แสดงโอเปร่ารอบสุดท้ายที่จะถูกจดจำตลอดกาล' },
  { id: 'guard_bran', name: 'องครักษ์แบรน', role: 'องครักษ์พระราชวัง', map: 'int:town:22:4', x: 4, y: 5, personality: 'knight', persona: 'องครักษ์ผู้ภักดี ยืนเฝ้าท้องพระโรงไม่เคยละสายตา', speech: 'ห้วน เคร่งขรึม เรียกผู้มาเยือนว่า "ท่าน"', goal: 'ปกป้องราชวงศ์ด้วยชีวิต' },
  { id: 'butler_giles', name: 'พ่อบ้านไจลส์', role: 'พ่อบ้านตระกูลอยุก', map: 'int:town:10:40', x: 4, y: 5, personality: 'noble', persona: 'พ่อบ้านสูงวัยผู้เนี้ยบ รับใช้ตระกูลอยุกมาสามรุ่น รู้มารยาทชั้นสูงทุกอย่าง', speech: 'สุภาพเนี้ยบ เรียกนายว่า "ท่าน" ประโยคเป็นระเบียบ', goal: 'ธำรงเกียรติของตระกูลอยุกไว้ไม่ให้ด่างพร้อย' },
  { id: 'maid_lily', name: 'ลิลี่', role: 'สาวใช้ประจำวัง', map: 'int:town:22:4', x: 6, y: 5, personality: 'shy', persona: 'สาวใช้ในวังที่ขยันและซื่อสัตย์ เห็นความลับของราชสำนักมามาก แต่ปิดปากเงียบ', speech: 'นอบน้อม เบา ลงท้าย "เพคะ/ค่ะ"', goal: 'ทำหน้าที่ให้ดีเพื่อส่งน้องเรียนหนังสือ' },
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

// 7 mains + 12 interior NPCs + 81 wandering generics = 100 total.
const DISTRIB = { school: 30, town: 33, world: 18 };
// Interior NPCs get a random appearance + a small roam radius (they potter
// about their room). romanceable so the player can pursue anyone, anywhere.
for (const n of INTERIOR) {
  n.look ||= { skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(HAIRSTYLES), eye: pick(EYES), outfit: pick(OUTFITS), outfitStyle: pick(OUTFITSTYLES) };
  n.roam ??= 2;
  n.romanceable ??= true;
}
const npcs = [...MAINS, ...INTERIOR];
const usedNames = new Set(npcs.map((m) => m.name));

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
