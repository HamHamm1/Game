// AI roleplay backend. Talks to an LLM so NPCs reply in-character to free
// text, and remembers the conversation (memory is persisted per player+NPC).
//
// Configure with ONE of these (set in your environment before `node server.js`):
//   ANTHROPIC_API_KEY=sk-ant-...          (uses Claude; AI_MODEL optional)
//   OPENAI_API_KEY=sk-...                 (OpenAI or any compatible endpoint)
//     AI_BASE_URL=https://api.openai.com/v1   (override for compatible APIs)
//   AI_MODEL=...                          (override the model id)
// With no key set, NPCs fall back to short in-character canned lines so the
// game still works offline.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
const MODEL = process.env.AI_MODEL || (ANTHROPIC_KEY ? 'claude-3-5-haiku-latest' : 'gpt-4o-mini');

export function aiEnabled() { return !!(ANTHROPIC_KEY || OPENAI_KEY); }

function persona(npc, player) {
  const aff = (player.affection && player.affection[npc.id]) || 0;
  return [
    `You are "${npc.name}", ${npc.role || 'a resident'} in the world of Alektier —`,
    `a fantasy magic-academy dating RPG. This is an open-ended roleplay with no fixed ending.`,
    `Your personality: ${npc.personality || 'friendly'}.`,
    `You are talking to ${player.name}, who woke up as "the villain everyone fears" from a trashy`,
    `fantasy novel and is trying to rewrite their fate. Current affection toward the player: ${aff} (higher = warmer).`,
    `Rules: stay fully in character; never say you are an AI or a language model; keep replies short`,
    `(1–3 sentences), warm and vivid; remember earlier moments in this conversation and refer back to them;`,
    `reply in Thai unless the player clearly uses another language, then match it.`,
  ].join(' ');
}

const TIMEOUT = 20000;
async function callJSON(url, headers, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 200));
    return await res.json();
  } finally { clearTimeout(t); }
}

async function anthropic(system, messages) {
  const j = await callJSON('https://api.anthropic.com/v1/messages',
    { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    { model: MODEL, max_tokens: 220, system, messages });
  return (j.content?.map((c) => c.text).join('') || '').trim();
}
async function openai(system, messages) {
  const j = await callJSON(`${OPENAI_BASE}/chat/completions`,
    { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
    { model: MODEL, max_tokens: 220, messages: [{ role: 'system', content: system }, ...messages] });
  return (j.choices?.[0]?.message?.content || '').trim();
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
  const messages = [...history.slice(-24), { role: 'user', content: userText }];
  try {
    if (ANTHROPIC_KEY) return await anthropic(persona(npc, player), messages) || fallback(npc);
    if (OPENAI_KEY) return await openai(persona(npc, player), messages) || fallback(npc);
  } catch (e) { console.warn('[ai] reply failed:', e.message); }
  return fallback(npc);
}
