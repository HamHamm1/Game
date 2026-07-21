// AI roleplay backend. Talks to an LLM so NPCs reply in-character to free text
// and remembers the conversation (memory persisted per player+NPC).
//
// The endpoint, key, model, sampling params and the NPC "brain" (system prompt)
// are all configured at RUNTIME from the admin panel — see aiConfig.js. Nothing
// here needs restarting when the admin connects a different model.
import * as cfg from './aiConfig.js';

export function aiEnabled() { return cfg.isReady(); }

function affTier(a) {
  if (a >= 100) return 'รักและผูกพันลึกซึ้ง';
  if (a >= 60) return 'สนิทสนม เริ่มมีใจให้';
  if (a >= 30) return 'เป็นมิตร เริ่มไว้ใจ';
  if (a >= 10) return 'เริ่มคุ้นเคยแต่ยังกันท่า';
  return 'เย็นชาและระแวง (เธอคือวายร้ายที่ผู้คนหวาดกลัว)';
}

// Dynamic, game-specific identity injected ahead of the editable brain modules.
function identityBlock(npc, player) {
  const aff = (player.affection && player.affection[npc.id]) || 0;
  return [
    `คุณกำลังสวมบทเป็น "${npc.name}" — ${npc.role || 'ผู้อยู่อาศัยคนหนึ่ง'} ในโลกของอเล็กเทียร์`,
    `โลกนี้คือสถาบันเวทมนตร์แฟนตาซีวิกตอเรียนในนิยายจีบสาว/หนุ่ม เป็นการโรลเพลย์ปลายเปิด ไม่มีฉากจบตายตัว`,
    `นิสัยหลักของ ${npc.name}: ${npc.personality || 'เป็นมิตร'}`,
    `คุณกำลังคุยกับ "${player.name || 'ผู้พเนจร'}" ผู้ตื่นมาพบว่าตัวเองกลายเป็น "วายร้ายที่ทุกคนเกลียดชัง" จากนิยายแฟนตาซีเกรดต่ำ และกำลังพยายามลิขิตชะตาตัวเองใหม่`,
    `ระดับความสัมพันธ์ที่ ${npc.name} มีต่อผู้เล่นตอนนี้: ${aff} — ${affTier(aff)}`,
    `คุณจำทุกอย่างที่เคยเกิดขึ้นในบทสนทนานี้ได้ อ้างอิงถึงเรื่องเก่า ๆ ที่เคยคุยกันเมื่อเหมาะสม`,
  ].join('\n');
}

// Compose the full system prompt: dynamic identity + enabled brain modules,
// with {{char}}/{{user}} placeholders filled in.
export function buildSystem(npc, player) {
  const c = cfg.get();
  const mods = (c.brain || []).filter((m) => m.enabled).map((m) => m.content);
  return [identityBlock(npc, player), ...mods]
    .join('\n\n')
    .split('{{char}}').join(npc.name)
    .split('{{user}}').join(player.name || 'ผู้เล่น');
}

const TIMEOUT = 25000;
async function callJSON(url, headers, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
    return await res.json();
  } finally { clearTimeout(t); }
}

async function callAnthropic(system, messages) {
  const c = cfg.resolved();
  const url = c.baseUrl.replace(/\/+$/, '') + '/v1/messages';
  const j = await callJSON(url,
    { 'content-type': 'application/json', 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01' },
    { model: c.model, max_tokens: c.max_tokens, temperature: c.temperature, top_p: c.top_p, system, messages });
  return (j.content?.map((x) => x.text).join('') || '').trim();
}
async function callOpenAI(system, messages) {
  const c = cfg.resolved();
  const url = c.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const j = await callJSON(url,
    { 'content-type': 'application/json', authorization: `Bearer ${c.apiKey}` },
    {
      model: c.model, max_tokens: c.max_tokens, temperature: c.temperature, top_p: c.top_p,
      frequency_penalty: c.frequency_penalty, presence_penalty: c.presence_penalty,
      messages: [{ role: 'system', content: system }, ...messages],
    });
  return (j.choices?.[0]?.message?.content || '').trim();
}

function callProvider(system, messages) {
  return cfg.get().provider === 'anthropic' ? callAnthropic(system, messages) : callOpenAI(system, messages);
}

const FB = {
  tsundere: ['ห..หึ ก็ไม่ได้อยากคุยกับเธอสักหน่อย...', 'อย่าเข้าใจผิดนะ ฉันแค่บังเอิญว่างเฉย ๆ'],
  cheerful: ['ว้าว เล่าให้ฟังอีกสิ~ !', 'อยู่กับเธอแล้วสนุกจังเลยนะ'],
  cool: ['...น่าสนใจดี', 'ฉันฟังอยู่ พูดต่อได้'],
  shy: ['เอ่อ...ก..ก็ดีนะ', '(พยักหน้าเบา ๆ)'],
  flirty: ['น่ารักจังเลยนะเธอเนี่ย~', 'อยากคุยกับฉันต่ออีกเหรอ? ก็ได้นะ'],
  noble: ['เจ้าพูดได้น่าสนใจ ข้าจะจดจำไว้', 'ต่อไปเจ้าตั้งใจจะทำสิ่งใด?'],
  mysterious: ['โชคชะตายังไม่ถูกลิขิต...เธอคิดเช่นนั้นจริงหรือ', 'บางเรื่องรู้แล้วก็ไม่อาจถอนคืน'],
  scholar: ['น่าสนใจในเชิงวิชาการทีเดียว', 'เล่ารายละเอียดให้ฟังอีกได้ไหม'],
  knight: ['พูดมาตรง ๆ ได้เลย', 'ข้ารับฟังอยู่'],
  merchant: ['อ๋อ ๆ เข้าใจแล้ว! แล้วไงต่อล่ะ', 'ลูกค้าคนสวย/หล่อ ว่ามาได้เลย'],
};
function fallback(npc) {
  const l = FB[npc.personality] || ['อืม...', 'เล่าต่อสิ'];
  return l[(Math.random() * l.length) | 0];
}

// history: [{role:'user'|'assistant', content}], returns reply text.
export async function aiReply(npc, player, history, userText) {
  const c = cfg.get();
  const messages = [...history.slice(-(c.memoryTurns || 24)), { role: 'user', content: userText }];
  try {
    if (cfg.isReady()) return (await callProvider(buildSystem(npc, player), messages)) || fallback(npc);
  } catch (e) { console.warn('[ai] reply failed:', e.message); }
  return fallback(npc);
}

// Admin "test connection" — a tiny round-trip to verify the endpoint works.
export async function aiTest() {
  if (!cfg.isReady()) throw new Error('ยังไม่ได้ตั้งค่า API key');
  const out = await callProvider(
    'You are a connection tester. Reply with a short friendly greeting in Thai.',
    [{ role: 'user', content: 'ทดสอบการเชื่อมต่อ ตอบสั้น ๆ ว่าเชื่อมต่อสำเร็จ' }]);
  return out || '(เชื่อมต่อได้ แต่โมเดลไม่ส่งข้อความกลับ)';
}
