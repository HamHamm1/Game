// Spirit World MMORPG — single-process server.
// Serves the game client, the admin panel, a hot-reload content API,
// and the realtime WebSocket world. Run: `node server.js`
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STATUS } from './src/shared/constants.js';
import * as players from './src/server/players.js';
import * as content from './src/server/content.js';
import * as game from './src/server/gameServer.js';
import * as aiConfig from './src/server/aiConfig.js';
import { aiTest } from './src/server/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
// Change this! Set ADMIN_TOKEN in your environment before exposing the server.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-admin';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function serveStatic(req, res, baseDir, urlPath) {
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(baseDir, safe);
  if (file.endsWith('/') || safe === '') file = path.join(baseDir, 'index.html');
  if (!file.startsWith(baseDir)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = ''; req.on('data', (c) => (b += c));
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}
function requireAdmin(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '') || new URL(req.url, 'http://x').searchParams.get('token');
  return token === ADMIN_TOKEN;
}

async function handleApi(req, res, url) {
  // ---- Public: request to join (creates a PENDING account) ----
  if (req.method === 'POST' && url.pathname === '/api/join') {
    const body = await readBody(req);
    const id = String(body.id || '').slice(0, 40) || `guest-${Date.now().toString(36)}`;
    const acc = players.upsert(id, String(body.name || '').slice(0, 24));
    return json(res, 200, { id: acc.id, name: acc.name, status: acc.status });
  }

  // ---- Everything below is admin-only ----
  if (!url.pathname.startsWith('/api/admin')) return json(res, 404, { error: 'not found' });
  if (!requireAdmin(req)) return json(res, 401, { error: 'unauthorized' });

  if (req.method === 'GET' && url.pathname === '/api/admin/players') {
    const online = new Set(game.onlineIds());
    return json(res, 200, {
      players: players.all().map((p) => ({
        id: p.id, name: p.name, status: p.status, canChat: p.canChat,
        reputation: p.reputation, online: online.has(p.id), createdAt: p.createdAt,
      })),
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/decision') {
    const { id, action } = await readBody(req);
    const map = { approve: STATUS.APPROVED, reject: STATUS.BANNED, ban: STATUS.BANNED, pending: STATUS.PENDING };
    const status = map[action];
    if (!status || !players.get(id)) return json(res, 400, { error: 'bad request' });
    players.setStatus(id, status);
    game.enforce(id, status);
    return json(res, 200, { ok: true, id, status });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/chat') {
    const { id, canChat } = await readBody(req);
    if (!players.get(id)) return json(res, 400, { error: 'bad request' });
    players.setChat(id, !!canChat);
    game.notifyChat(id, !!canChat);
    return json(res, 200, { ok: true });
  }

  // Live content editing — push NPCs/quests/dialogues to the world instantly.
  if (req.method === 'GET' && url.pathname === '/api/admin/content') {
    return json(res, 200, content.get());
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/content') {
    const { kind, payload } = await readBody(req);
    if (!content.patch(kind, payload)) return json(res, 400, { error: 'bad kind' });
    return json(res, 200, { ok: true, version: content.get().version });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/reload') {
    content.reload();
    return json(res, 200, { ok: true, version: content.get().version });
  }

  // ---- AI connection + brain preset (connect your own model at runtime) ----
  if (req.method === 'GET' && url.pathname === '/api/admin/ai') {
    return json(res, 200, aiConfig.meta());
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/ai') {
    aiConfig.update(await readBody(req));
    return json(res, 200, { ok: true, ...aiConfig.meta() });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/ai/reset') {
    aiConfig.reset();
    return json(res, 200, { ok: true, ...aiConfig.meta() });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/ai/test') {
    try {
      const reply = await aiTest();
      return json(res, 200, { ok: true, reply });
    } catch (e) {
      return json(res, 200, { ok: false, error: String(e.message || e).slice(0, 300) });
    }
  }

  return json(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (url.pathname === '/admin' || url.pathname === '/admin/')
    return serveStatic(req, res, path.join(__dirname, 'public'), 'admin.html');
  if (url.pathname.startsWith('/shared/'))
    return serveStatic(req, res, path.join(__dirname, 'src', 'shared'), url.pathname.slice('/shared/'.length));
  return serveStatic(req, res, path.join(__dirname, 'public'), url.pathname);
});

content.reload();
content.watch();
game.attach(server);

server.listen(PORT, () => {
  console.log(`\n  🌸 Spirit World MMORPG — วายร้ายแห่งอเล็กเทียร์`);
  console.log(`  ▸ เกม:      http://localhost:${PORT}/`);
  console.log(`  ▸ แอดมิน:   http://localhost:${PORT}/admin  (token: ${ADMIN_TOKEN})`);
  console.log(`  ▸ กด Ctrl+C เพื่อหยุด\n`);
});
