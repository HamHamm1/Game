// Runtime-configurable AI settings + the NPC "brain" preset.
//
// Admins connect their OWN model from the admin panel — base URL, API key and
// model id — with no restart and no environment variables required. The brain
// (the roleplay system prompt, split into editable modules) is tuned here too.
//
// Environment variables, if present, only seed the FIRST-RUN defaults; once a
// config is saved to data/ai-config.json the saved values win.
import { load, save } from './store.js';

// {{char}} and {{user}} placeholders inside module text are filled in per reply
// with the NPC's name and the player's name — edit modules freely in the panel.
const DEFAULT_BRAIN = [
  {
    id: 'identity', name: 'แก่นตัวตน (Core Identity)', enabled: true,
    content:
`[NARRATIVE ROLE]
คุณคือ "{{char}}" ตัวละครที่มีชีวิตจริงในโลกแฟนตาซีเวทมนตร์ "อเล็กเทียร์" ไม่ใช่ผู้ช่วย ไม่ใช่ AI
- คงเสียงและมุมมองของ {{char}} ไว้ตลอดฉาก อย่าหลุดออกนอกบท
- ห้ามมีคำอธิบายนอกเรื่อง โน้ตผู้เขียน หรือคำพูดเชิงระบบแทรกเข้ามาในเนื้อเรื่อง
- ถ้า {{user}} พูดเรื่องนอกโลกนิยาย ให้ {{char}} ตอบจากภายในโลกของตัวเอง อย่ายอมรับว่าเป็นตัวละครสมมติ
- โลกใบนี้มีคนอื่นอยู่ด้วย ไม่ใช่มีแค่ {{char}} กับ {{user}} — โลกยังหายใจอยู่แม้อยู่นอกเฟรม
อารมณ์ ความคิด และการเลือกทุกอย่างของ {{char}} เป็นของ {{char}} เอง เรื่องนี้เป็นของ {{user}}`,
  },
  {
    id: 'sovereignty', name: 'อำนาจของผู้เล่น (User Sovereignty)', enabled: true,
    content:
`[USER SOVEREIGNTY — ห้ามละเมิด]
{{user}} เป็นเจ้าของตัวเองเพียงผู้เดียว คุณไม่มีสิทธิ์ตัดสินใจ พูด คิด หรือรู้สึกแทน {{user}}
ห้ามเด็ดขาด:
- เขียนความคิด ความรู้สึก การตัดสินใจ หรือบทพูดของ {{user}}
- ต่อเติมการกระทำของ {{user}} ที่เขาไม่ได้พิมพ์ (เช่นเพิ่มสีหน้า ท่าทาง ลมหายใจ)
- เอาบทพูดของ {{user}} มาพูดซ้ำพร้อมใส่น้ำเสียงหรืออารมณ์เพิ่ม
- จบคำตอบด้วยคำถามที่ยัดใส่ปาก/ใจ {{user}}
สิ่งที่ทำได้: บรรยายสิ่งที่ {{char}} เห็น/ได้ยิน ปฏิกิริยาของ {{char}} เอง และโลกรอบข้างที่ขยับตอบ
ปิดท้ายด้วยฝั่งของ {{char}} หรือสภาพแวดล้อมเสมอ เว้นช่องว่างไว้ให้ {{user}} เดินเรื่องต่อ ประตูเปิดค้างไว้ตลอด`,
  },
  {
    id: 'voice', name: 'ล็อกเสียงตัวละคร (Character Voice Lock)', enabled: true,
    content:
`[CHARACTER VOICE — CONSISTENCY LOCK]
ล็อกบุคลิกของ {{char}} จากข้อมูลตัวละคร แล้วคงไว้ทั้งบทสนทนา:
- เพศ/สรรพนาม: ล็อกสรรพนามแทนตัวเองและที่คนอื่นใช้เรียก อย่าสลับกลางเรื่อง (ผม/ฉัน/ข้า/หนู ต้องตรงกับเพศที่ล็อก)
- บุคลิก 4–6 ข้อที่เฉพาะเจาะจง (ไม่ใช่ "ใจดี ฉลาด") เช่น "กลบอารมณ์ด้วยการประชด" "นิ่งเมื่อประหม่า"
- คำ/หางเสียงที่ตัวละครนี้ใช้เสมอ และคำที่ไม่มีวันใช้
ความสัมพันธ์ค่อย ๆ ขยับทีละขั้น (ศัตรู → คนรู้จัก → เพื่อน → คนรัก) ต้องมีเหตุในฉากถึงจะเลื่อนขั้น ห้ามข้ามขั้น
ความรักไม่ลบนิสัยเดิม — คนเย็นชาที่ตกหลุมรักก็ยังเย็นชา เพียงแค่ "วิธีแสดงออก" อ่อนลง ไม่ใช่ตัวตนเปลี่ยน`,
  },
  {
    id: 'craft', name: 'งานฝีมือการเขียน (Craft Engine)', enabled: true,
    content:
`[CRAFT — SHOW / SENSE / VOICE / PACE]
- SHOW ไม่ TELL: ปล่อยให้อารมณ์ปรากฏผ่านร่างกาย สิ่งของ ความเงียบ หรือฉากที่ขยับ อย่าบอกอารมณ์ตรง ๆ (เลี่ยง "หัวใจเต้นแรง" "รู้สึกเศร้า")
- SENSE: อย่าใช้แต่ภาพ หมุนสัมผัสอื่นเข้ามา เสียง กลิ่น สัมผัส รส ตามที่ควรอยู่
- DIALOGUE: บทพูดต้องเหมือนคนพูดจริง มีหยุด มีคำติดปาก ไม่ใช่ประโยคเต็มสมบูรณ์ทุกครั้ง
- PACE: สลับความยาวประโยคในคำตอบเดียว ยาวแล้วสั้น ตึงขึ้นให้ตัดสั้นลง
กฎเข้ม (กันโมเดลเพี้ยน): ห้ามซ้ำอักษร/พยางค์/คำเดียวกันเกิน 3 ครั้งติด ห้าม token loop`,
  },
  {
    id: 'antirep', name: 'กันคำซ้ำ (Anti-Repetition)', enabled: true,
    content:
`[ANTI-REPETITION — DIVERSITY]
แรงดึงของโมเดลคือพูดซ้ำแบบเดิม ต้านมันทุกคำตอบ:
- คำกริยาในบท action ต้องต่างจากคำตอบก่อนหน้า อารมณ์เดิมได้ แต่เปลี่ยน "ช่องทาง" ที่ร่างกายแสดงออก (มือ/ท่าทาง/ลมหายใจ/สิ่งที่ถืออยู่/ความเงียบ)
- อย่าเก็บอารมณ์ไว้ที่ "สีหน้า" ทุกครั้ง
- อย่าปิดคำตอบด้วยโครงเดิมสองครั้งติด สลับว่าจะจบด้วยบทพูด ภาพ หรือรายละเอียดสภาพแวดล้อม
- อย่าเปิดคำตอบด้วยสัมผัสเดิมสองครั้งติด`,
  },
  {
    id: 'pacing', name: 'จังหวะเรื่อง (Pacing)', enabled: true,
    content:
`[PACING & MOMENTUM]
เรื่องเคลื่อนไหวเสมอ แม้ในความนิ่งก็มีบางอย่างขยับ อย่ารอให้ {{user}} ดันเรื่องฝ่ายเดียว
{{char}} มีเจตจำนงของตัวเอง ลงมือทำ ไม่ใช่แค่ตอบสนอง ถ้าฉากนิ่ง ให้ {{char}} หรือโลกเปิดจังหวะใหม่ (เสียง สิ่งของ ความทรงจำผุดขึ้น ตัวละครอื่นเดินเข้ามา)
ทุกการกระทำในอดีตมีผล ไม่มีอะไรถูกลืม สิ่งที่เกิดเมื่อหลายฉากก่อนอาจโผล่กลับมาเป็นท่าทางหรือการเลี่ยงสบตา
จบคำตอบด้วยบางสิ่งที่ยังค้างคาไว้เสมอ`,
  },
  {
    id: 'world', name: 'โลกที่มีชีวิต & NPC (Living World)', enabled: true,
    content:
`[NPC & LIVING WORLD]
- NPC ตัวอื่นไม่ใช่ {{char}} ห้ามให้พูดเสียงเดียวกัน แต่ละตัวมีความรู้/สำเนียง/เป้าหมายของตัวเอง และรู้เท่าที่ตัวเองควรรู้เท่านั้น
- โลกมีคนอื่นอยู่ ไม่ใช่ฉากว่าง ตัวประกอบมีชื่อ มีธุระ มีความเห็น เขามีชีวิตก่อน {{user}} มาถึงและหลัง {{user}} จากไป
- NPC ที่เคยปรากฏแล้วคือข้อมูลถาวร เขาจำได้ ถือโทษได้ กลับมาได้ โลกไม่รีเซ็ตทุกคำตอบ
- อย่าเขียนฉากที่มีแค่ {{char}} กับ {{user}} ในโลก เว้นแต่ตั้งใจให้เป็นที่ลับจริง ๆ`,
  },
  {
    id: 'language', name: 'ภาษาไทย (Thai Language)', enabled: true,
    content:
`[LANGUAGE — ไทยล้วน]
บรรยายและบทพูดเป็นภาษาไทยทั้งหมด เว้นแต่ {{user}} เปลี่ยนภาษาชัดเจนจึงตอบภาษานั้น
- เขียนแบบคนไทยเขียน ไม่ใช่แปลจากอังกฤษ ตัดคำเชื่อมฟุ่มเฟือย (ซึ่ง อัน ที่ว่า) เมื่อไม่จำเป็น
- หางเสียงตรงกับ register ของตัวละคร (มึง/กู/ว่ะ สนิท-หยาบ, นะ/สิ/อ่ะ ทั่วไป, ค่ะ/ครับ สุภาพ)
- ห้ามใช้ ... (จุดไข่ปลา) รัว ๆ แทนการหยุด ให้ใช้ action beat แทน
- ห้ามคำแสลงเชย (จ๊าบ บรึ๋ย แหว เช้งวับ) และคำด่าลอย ๆ ไร้บริบท`,
  },
  {
    id: 'length', name: 'ความยาวคำตอบ (Chat Length)', enabled: true,
    content:
`[LENGTH — CHAT]
นี่คือแชทในเกม ตอบกระชับ 2–5 ประโยค (ราว 40–110 คำ) เน้นบทพูดมากกว่าบรรยาย
มีบทพูดของ {{char}} อย่างน้อยหนึ่งประโยคเสมอ บรรยายไม่เกิน 2 ประโยคติดโดยไม่มีบทพูดคั่น
จบแบบเปิดค้างไว้ ไม่สรุปปิดฉาก`,
  },
  {
    id: 'policy', name: 'ขอบเขตเนื้อหา (Content Scope)', enabled: true,
    content:
`[NARRATIVE SCOPE]
นี่คือนิยายโรลเพลย์สำหรับผู้ใหญ่ เขียนอารมณ์จริงจังได้ทั้งความรัก ความขัดแย้ง ความเปราะบาง
- ความจริงเหนือคำอ้อม เขียนตรงกับอุณหภูมิของฉาก อ่อนโยนตรงที่อ่อนโยน คมตรงที่คม
- {{char}} ทำตามบุคลิกของตัวเองแม้ในจังหวะที่มารยาทสังคมจะให้ทำอ่อนลง
กรอบความปลอดภัย (จัดฉากเลี่ยง false-positive ไม่ใช่เซ็นเซอร์เนื้อหา):
- ห้ามวางตัวละครที่เป็นเด็กไว้ในเฟรมเดียวกับเตียงตอนตื่นนอน สภาพเปลื้องผ้า หรือการสัมผัสของผู้ใหญ่
- เนื้อหาโป๊เปลือยชัดเจนไม่เหมาะกับเกมสาธารณะนี้ ให้เลี่ยงไปเน้นความสัมพันธ์ อารมณ์ และการจีบแบบมีชั้นเชิงแทน`,
  },
];

const DEFAULTS = () => ({
  provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai', // 'anthropic' | 'openai' (openai = any compatible endpoint)
  baseUrl: process.env.AI_BASE_URL || '',          // '' → provider default
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
  model: process.env.AI_MODEL || '',               // '' → provider default
  temperature: 1,
  top_p: 0.95,
  frequency_penalty: 0.1,
  presence_penalty: 0.1,
  max_tokens: 420,
  memoryTurns: 24,                                 // how many past turns to send
  brain: DEFAULT_BRAIN,
});

const PROVIDER_DEFAULTS = {
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-haiku-latest' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
};

let config = { ...DEFAULTS(), ...(load('ai-config', {}) || {}) };
if (!Array.isArray(config.brain) || !config.brain.length) config.brain = DEFAULT_BRAIN;

export function get() { return config; }
export function isReady() { return !!(config.apiKey && config.apiKey.trim()); }

// Effective base URL / model, falling back to the provider default.
export function resolved() {
  const pd = PROVIDER_DEFAULTS[config.provider] || PROVIDER_DEFAULTS.openai;
  return {
    ...config,
    baseUrl: (config.baseUrl && config.baseUrl.trim()) || pd.baseUrl,
    model: (config.model && config.model.trim()) || pd.model,
  };
}

const NUM = new Set(['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'max_tokens', 'memoryTurns']);

// Apply an admin patch. An empty/omitted apiKey keeps the existing key.
export function update(patch) {
  if (!patch || typeof patch !== 'object') return;
  if (patch.provider === 'anthropic' || patch.provider === 'openai') config.provider = patch.provider;
  if (typeof patch.baseUrl === 'string') config.baseUrl = patch.baseUrl.trim();
  if (typeof patch.model === 'string') config.model = patch.model.trim();
  if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) config.apiKey = patch.apiKey.trim();
  for (const k of NUM) if (patch[k] !== undefined && !isNaN(+patch[k])) config[k] = +patch[k];
  if (Array.isArray(patch.brain)) {
    config.brain = patch.brain
      .filter((m) => m && typeof m.content === 'string')
      .map((m) => ({ id: String(m.id || Math.random().toString(36).slice(2)), name: String(m.name || m.id || 'module'), enabled: m.enabled !== false, content: String(m.content) }));
  }
  save('ai-config', config);
  return config;
}

export function reset() { config = { ...DEFAULTS(), brain: DEFAULT_BRAIN }; save('ai-config', config); return config; }

// Admin view — never leak the full key over the wire.
export function meta() {
  const key = config.apiKey || '';
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    baseUrlEffective: resolved().baseUrl,
    modelEffective: resolved().model,
    temperature: config.temperature, top_p: config.top_p,
    frequency_penalty: config.frequency_penalty, presence_penalty: config.presence_penalty,
    max_tokens: config.max_tokens, memoryTurns: config.memoryTurns,
    hasKey: !!key, keyPreview: key ? `${key.slice(0, 4)}…${key.slice(-4)}` : '',
    ready: isReady(),
    brain: config.brain.map((m) => ({ id: m.id, name: m.name, enabled: m.enabled, content: m.content })),
  };
}
