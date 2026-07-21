// DOM overlays: join / approval gates, dialogue, chat, quests, toasts.
import { drawPortrait } from './renderer.js';

const $ = (id) => document.getElementById(id);

export function screen(name) {
  for (const s of ['creator-screen', 'join-screen', 'pending-screen', 'banned-screen'])
    $(s).classList.toggle('show', s === name);
  $('game-ui').classList.toggle('show', name === null);
}

export function toast(text, level = 'ok') {
  const el = $('toast');
  el.textContent = text;
  el.className = 'show ' + level;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.className = ''), 2600);
}

export function chatLog(from, text) {
  const log = $('chat-log');
  const line = document.createElement('div');
  line.className = 'chat-line';
  line.innerHTML = `<b>${escape(from)}</b> ${escape(text)}`;
  log.appendChild(line);
  while (log.children.length > 40) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

let onChoose = null;
export function showDialogue(m, chooseCb) {
  onChoose = chooseCb;
  $('dlg-name').textContent = m.npc.name;
  $('dlg-role').textContent = m.npc.role || '';
  $('dlg-aff').textContent = `♥ ${m.affection || 0}`;
  const cv = $('dlg-portrait');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawPortrait(ctx, m.npc.portrait, 6, 4, 84);
  const lines = $('dlg-lines');
  lines.innerHTML = m.lines.map((l) => `<p>${escape(l)}</p>`).join('');
  const ch = $('dlg-choices');
  ch.innerHTML = '';
  m.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.textContent = c.text;
    b.onclick = () => { onChoose?.(i); hideDialogue(); };
    ch.appendChild(b);
  });
  $('dialogue').classList.add('show');
}
export function hideDialogue() { $('dialogue').classList.remove('show'); }

export function renderQuests(quests, progress, affection, npcs, reputation) {
  $('rep-value').textContent = reputation ?? 0;
  const q = $('quest-list');
  q.innerHTML = quests.map((quest) => {
    const st = progress?.[quest.id]?.state || 'active';
    return `<div class="quest ${st}"><h4>${escape(quest.title)}</h4>
      <p>${escape(quest.desc)}</p><span class="reward">🎁 ${escape(quest.reward)}</span></div>`;
  }).join('') || '<p class="muted">ยังไม่มีภารกิจ</p>';

  const rel = $('rel-list');
  const byId = Object.fromEntries((npcs || []).map((n) => [n.id, n]));
  const entries = Object.entries(affection || {}).sort((a, b) => b[1] - a[1]);
  rel.innerHTML = entries.length
    ? entries.map(([id, v]) => {
        const n = byId[id];
        const hearts = '♥'.repeat(Math.min(5, Math.ceil(v / 3))) || '·';
        return `<div class="rel"><span>${escape(n?.name || id)}</span>
          <b class="hearts">${hearts} <small>${v}</small></b></div>`;
      }).join('')
    : '<p class="muted">ออกไปทำความรู้จักผู้คนสิ!</p>';
}

export function togglePanel() { $('quest-panel').classList.toggle('show'); }

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
