// Deterministic multi-map world: overworld continent, capital town, academy.
// ONE source of truth shared by server (collision/portals) and client (render).
import { T, SOLID_TILE } from './tiles.js';

export const TILE = 32;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const grid = (w, h, fill) => new Uint8Array(w * h).fill(fill);
function rect(t, w, x0, y0, rw, rh, code) {
  for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++)
    if (x >= 0 && y >= 0 && x < w && y < (t.length / w)) t[y * w + x] = code;
}
function road(t, w, h, x0, y0, x1, y1, code, width) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / steps), y = Math.round(y0 + (y1 - y0) * i / steps);
    rect(t, w, x - (width >> 1), y - (width >> 1), width, width, code);
  }
}

// ---------------- SCHOOL (Academy grounds) ----------------
function buildSchool() {
  const w = 52, h = 40, t = grid(w, h, T.GRASS), objects = [], portals = [];
  const r = rng(101);
  rect(t, w, 20, 16, 12, 9, T.PLAZA);                 // central plaza
  road(t, w, h, 26, 38, 26, 24, T.PATH, 3);           // south gate -> plaza
  road(t, w, h, 8, 20, 26, 20, T.PATH, 2);
  road(t, w, h, 44, 20, 26, 20, T.PATH, 2);
  road(t, w, h, 26, 16, 26, 8, T.PATH, 3);            // plaza -> academy
  road(t, w, h, 12, 30, 26, 24, T.PATH, 2);
  road(t, w, h, 40, 30, 26, 24, T.PATH, 2);

  objects.push({ t: 'building', x: 19, y: 3, w: 4, h: 2, style: 'academy', name: 'อาคารเรียนหลัก', door: 2 });
  objects.push({ t: 'building', x: 6, y: 14, w: 4, h: 2, style: 'dorm', name: 'หอพักหญิง', door: 2 });
  objects.push({ t: 'building', x: 37, y: 14, w: 4, h: 2, style: 'dorm2', name: 'หอพักชาย', door: 2 });
  objects.push({ t: 'building', x: 6, y: 27, w: 4, h: 2, style: 'cafe', name: 'คาเฟ่ไรส์ทา', door: 2 });
  objects.push({ t: 'building', x: 38, y: 27, w: 4, h: 2, style: 'library', name: 'ห้องสมุดต้องห้าม', door: 2 });
  objects.push({ t: 'prop', x: 25, y: 19, kind: 'fountain' });
  // gardens
  for (const [gx, gy] of [[17, 17], [33, 17], [17, 23], [33, 23]]) objects.push({ t: 'prop', x: gx, y: gy, kind: 'flowerbed' });
  for (const [lx, ly] of [[24, 25], [28, 25], [24, 15], [28, 15]]) objects.push({ t: 'prop', x: lx, y: ly, kind: 'lamp' });
  scatterTrees(objects, t, w, h, r, 22, [[19, 3, 14, 7], [6, 14, 9, 6], [37, 14, 9, 6], [6, 27, 8, 6], [38, 27, 8, 6], [20, 16, 12, 9]]);
  portals.push({ x: 25, y: 39, w: 3, h: 1, to: 'town', tx: 8, ty: 24, label: 'ออกสู่เมือง' });
  return { id: 'school', name: 'โรงเรียนเวทศิลป์อเล็กเทียร์', w, h, tiles: t, objects, portals, spawn: { x: 26, y: 36 } };
}

// ---------------- TOWN (Capital Alektier) ----------------
function buildTown() {
  const w = 60, h = 48, t = grid(w, h, T.GRASS), objects = [], portals = [];
  const r = rng(202);
  rect(t, w, 0, 0, w, h, T.GRASS);
  rect(t, w, 46, 0, 14, h, T.WATER);                  // eastern river/sea
  rect(t, w, 44, 0, 3, h, T.SAND);
  road(t, w, h, 30, 47, 30, 4, T.ROAD, 4);            // main avenue N-S
  road(t, w, h, 2, 24, 54, 24, T.ROAD, 4);            // main avenue E-W (reaches west gate)
  rect(t, w, 24, 18, 13, 12, T.PLAZA);                // grand plaza
  // ring roads
  road(t, w, h, 14, 12, 46, 12, T.PATH, 2);
  road(t, w, h, 14, 36, 46, 36, T.PATH, 2);
  road(t, w, h, 44, 24, 45, 24, T.SAND, 3);           // to bridge
  rect(t, w, 44, 23, 4, 3, T.PATH);                   // bridge deck

  objects.push({ t: 'prop', x: 29, y: 22, kind: 'statue' });
  // north: palace + academy district
  objects.push({ t: 'building', x: 22, y: 4, w: 6, h: 3, style: 'palace', name: 'พระราชวังอเล็กเทียร์', door: 3 });
  objects.push({ t: 'building', x: 8, y: 6, w: 5, h: 2, style: 'opera', name: 'โรงละครโอเปร่า', door: 2 });
  objects.push({ t: 'building', x: 40, y: 6, w: 4, h: 2, style: 'library', name: 'หอสมุดแห่งปัญญา', door: 2 });
  // shops row
  objects.push({ t: 'building', x: 8, y: 28, w: 4, h: 2, style: 'shop', name: 'ร้านเวทมนตร์', door: 2 });
  objects.push({ t: 'building', x: 17, y: 30, w: 4, h: 2, style: 'shop2', name: 'ร้านเครื่องประดับ', door: 2 });
  objects.push({ t: 'building', x: 38, y: 30, w: 4, h: 2, style: 'inn', name: 'โรงแรมลอเรล', door: 2 });
  objects.push({ t: 'building', x: 10, y: 40, w: 4, h: 2, style: 'house', name: 'บ้านตระกูลอยุก', door: 2 });
  objects.push({ t: 'building', x: 22, y: 40, w: 4, h: 2, style: 'house2', name: 'บ้านตระกูลมาร์ควิส', door: 2 });
  objects.push({ t: 'building', x: 34, y: 40, w: 4, h: 2, style: 'house', name: 'บ้านตระกูลเคานต์', door: 2 });
  objects.push({ t: 'building', x: 8, y: 18, w: 4, h: 2, style: 'cafe', name: 'คาเฟ่ไรส์ทา', door: 2 });
  // market stalls around plaza
  for (const [sx, sy, c] of [[25, 31, 'red'], [28, 31, 'blue'], [31, 31, 'green'], [34, 31, 'yellow']])
    objects.push({ t: 'prop', x: sx, y: sy, kind: 'stall', color: c });
  for (const [lx, ly] of [[23, 17], [37, 17], [23, 30], [37, 30], [28, 16], [32, 16]]) objects.push({ t: 'prop', x: lx, y: ly, kind: 'lamp' });
  for (const [bx, by] of [[26, 26], [34, 26]]) objects.push({ t: 'prop', x: bx, y: by, kind: 'bench' });
  scatterTrees(objects, t, w, h, r, 40, buildingRects(objects).concat([[24, 18, 13, 12]]));
  objects.push({ t: 'prop', x: 41, y: 24, kind: 'boat' });

  portals.push({ x: 29, y: 47, w: 4, h: 1, to: 'world', tx: 16, ty: 33, label: 'ออกสู่โลกกว้าง' });
  portals.push({ x: 1, y: 22, w: 1, h: 4, to: 'school', tx: 26, ty: 36, label: 'ไปโรงเรียน' });
  return { id: 'town', name: 'เมืองหลวงอเล็กเทียร์', w, h, tiles: t, objects, portals, spawn: { x: 30, y: 42 } };
}

// ---------------- WORLD (Continent of Alektier) ----------------
function buildWorld() {
  const w = 64, h = 48, t = grid(w, h, T.DEEPWATER), objects = [], portals = [];
  const r = rng(303);
  // landmass blob
  rect(t, w, 6, 6, 52, 36, T.GRASS);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x - w / 2) / (w / 2), ny = (y - h / 2) / (h / 2);
    if (nx * nx + ny * ny > 0.92 + (r() - 0.5) * 0.12) t[y * w + x] = T.DEEPWATER;
    else if (nx * nx + ny * ny > 0.82) t[y * w + x] = T.WATER;
  }
  // sandy coast ring
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (t[y * w + x] === T.GRASS) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (t[(y + dy) * w + x + dx] === T.WATER) { t[y * w + x] = T.SAND; break; }
    }
  }
  rect(t, w, 40, 30, 12, 10, T.SAND);                 // southern desert
  rect(t, w, 12, 8, 14, 8, T.SNOW);                   // northern snow
  const lake = [46, 20]; rect(t, w, lake[0], lake[1], 7, 6, T.WATER);  // cursed lake
  // roads between POIs
  road(t, w, h, 24, 30, 30, 22, T.DIRT, 2);           // town -> center
  road(t, w, h, 30, 22, 44, 14, T.DIRT, 2);
  road(t, w, h, 30, 22, 16, 30, T.DIRT, 2);
  road(t, w, h, 30, 22, 30, 12, T.DIRT, 2);

  // mountains (Austria range) & forests
  objects.push({ t: 'mountain', x: 30, y: 34, w: 8, h: 5 });
  objects.push({ t: 'mountain', x: 20, y: 20, w: 5, h: 4 });
  forest(objects, t, w, h, r, [[8, 22, 12, 10], [44, 24, 12, 10], [10, 10, 8, 6], [48, 34, 10, 6]]);

  // POI nodes (each is a town-like building + portal to town for now)
  objects.push({ t: 'building', x: 22, y: 26, w: 6, h: 3, style: 'palace', name: 'เมืองหลวงอเล็กเทียร์', door: 3 });
  objects.push({ t: 'prop', x: 44, y: 12, kind: 'signpost', label: 'อาณาจักรโรเซเลีย' });
  objects.push({ t: 'prop', x: 14, y: 30, kind: 'signpost', label: 'เมืองท่าเบลวิน' });
  objects.push({ t: 'prop', x: 30, y: 11, kind: 'signpost', label: 'ป่าการคืนชีพ' });
  portals.push({ x: 21, y: 32, w: 6, h: 1, to: 'town', tx: 30, ty: 44, label: 'เข้าเมืองหลวง' });
  return { id: 'world', name: 'ทวีปอเล็กเทียร์', w, h, tiles: t, objects, portals, spawn: { x: 16, y: 33 } };
}

function buildingRects(objects) {
  return objects.filter(o => o.t === 'building').map(o => [o.x, o.y, o.w, o.h]);
}
function overlaps(x, y, rects, pad = 0) {
  return rects.some(([rx, ry, rw, rh]) => x >= rx - pad && x < rx + rw + pad && y >= ry - pad && y < ry + rh + pad);
}
function scatterTrees(objects, t, w, h, r, n, avoid) {
  let placed = 0, tries = 0;
  while (placed < n && tries < n * 12) {
    tries++;
    const x = 2 + (r() * (w - 4)) | 0, y = 2 + (r() * (h - 4)) | 0;
    const code = t[y * w + x];
    if (code !== T.GRASS && code !== T.SNOW) continue;
    if (overlaps(x, y, avoid, 1)) continue;
    objects.push({ t: 'tree', x, y, variant: (r() * 3) | 0, code });
    placed++;
  }
}
function forest(objects, t, w, h, r, patches) {
  for (const [px, py, pw, ph] of patches)
    for (let i = 0; i < pw * ph * 0.5; i++) {
      const x = px + (r() * pw) | 0, y = py + (r() * ph) | 0;
      if (t[y * w + x] === T.GRASS) objects.push({ t: 'tree', x, y, variant: (r() * 3) | 0, code: T.GRASS });
    }
}

// ---------------- Assemble & collision ----------------
const _maps = { school: buildSchool(), town: buildTown(), world: buildWorld() };
const SOLID_PROPS = new Set(['fountain', 'statue', 'well', 'stall', 'signpost', 'boat']);
const _solid = {};

export function getMaps() { return _maps; }
export function getMap(id) {
  if (_maps[id]) return _maps[id];
  if (_interiors[id]) return _interiors[id];
  // Resolve an interior id (`int:<fromMap>:<x>:<y>`) on demand — this lets the
  // client rebuild the exact same room the server generated, from the id alone.
  if (typeof id === 'string' && id.startsWith('int:')) {
    const [, fromMapId, sx, sy] = id.split(':');
    const from = _maps[fromMapId];
    const b = from && from.objects.find((o) => o.t === 'building' && o.x === +sx && o.y === +sy);
    if (b) return getInterior(fromMapId, b);
  }
  return _maps.school;
}

export function getSolid(id) {
  if (_solid[id]) return _solid[id];
  const m = getMap(id);
  if (m.solid) { _solid[id] = m.solid; return m.solid; }   // interiors carry their own solid grid
  const s = new Uint8Array(m.w * m.h);
  for (let i = 0; i < s.length; i++) if (SOLID_TILE.has(m.tiles[i])) s[i] = 1;
  for (const o of m.objects) {
    if (o.t === 'building') {
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) s[y * m.w + x] = 1;
      s[(o.y + o.h - 1) * m.w + (o.x + o.door)] = 0;   // doorway open
    } else if (o.t === 'mountain') {
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) s[y * m.w + x] = 1;
    } else if (o.t === 'tree') {
      s[o.y * m.w + o.x] = 1;
    } else if (o.t === 'prop' && SOLID_PROPS.has(o.kind)) {
      const fw = o.kind === 'fountain' || o.kind === 'statue' ? 2 : 1;
      for (let y = o.y; y < o.y + fw; y++) for (let x = o.x; x < o.x + fw; x++) if (x < m.w && y < m.h) s[y * m.w + x] = 1;
    }
  }
  _solid[id] = s;
  return s;
}

// ---------------- INTERIORS (entered through building doors) ----------------
const _interiors = {};
const SOLID_FURN = new Set(['table', 'counter', 'bookshelf', 'bed', 'fireplace', 'throne', 'barrel', 'crate', 'shelf', 'wardrobe', 'desk', 'stage', 'chalkboard', 'stove', 'cauldron', 'piano', 'seatrow', 'plant', 'chair', 'stool', 'bench2']);

function furnFor(style, w, h) {
  const midx = w >> 1, list = [];
  const put = (kind, x, y) => list.push({ t: 'furn', kind, x: Math.max(1, Math.min(w - 2, x | 0)), y: Math.max(2, Math.min(h - 2, y | 0)) });
  put('rug', midx, h - 4);
  if (style === 'cafe' || style === 'inn') {
    for (let x = 2; x < w - 2; x++) put('counter', x, 2);
    put('stove', w - 3, 2); put('shelf', 2, 2);
    for (const [tx, ty] of [[3, h - 4], [w - 4, h - 4], [midx - 2, h - 3], [midx + 2, h - 3]]) { put('table', tx, ty); put('stool', tx, ty + 1); put('stool', tx, ty - 1); }
    put('plant', 2, h - 2); put('barrel', w - 3, h - 2); put('fireplace', midx, 2);
  } else if (style === 'library' || style === 'academy') {
    for (let x = 2; x < w - 2; x += 2) { put('bookshelf', x, 2); }
    put(style === 'academy' ? 'chalkboard' : 'bookshelf', midx, 2);
    for (let y = 4; y < h - 2; y += 2) for (let x = 3; x < w - 2; x += 3) { put('desk', x, y); put('chair', x, y + 1); }
    put('bookshelf', 2, h - 3); put('bookshelf', w - 3, h - 3);
  } else if (style === 'shop' || style === 'shop2') {
    for (let x = 2; x < w - 2; x++) put('shelf', x, 2);
    for (let x = 3; x < w - 3; x += 2) put('counter', x, h - 4);
    put('crate', 2, h - 2); put('crate', 3, h - 2); put('barrel', w - 3, h - 2); put('cauldron', w - 3, 3);
  } else if (style === 'palace') {
    for (let y = 2; y < h - 1; y++) put('rug', midx, y);
    put('throne', midx, 2); put('plant', 2, 3); put('plant', w - 3, 3);
    for (let y = 4; y < h - 2; y += 2) { put('column', 3, y); put('column', w - 4, y); }
  } else if (style === 'opera') {
    for (let x = 1; x < w - 1; x++) put('stage', x, 2);
    for (let y = 4; y < h - 1; y++) for (let x = 2; x < w - 2; x += 2) put('seatrow', x, y);
  } else { // houses & dorms
    put('bed', 2, 3); put('wardrobe', w - 3, 3); put('fireplace', midx, 2);
    put('table', midx, h - 4); put('chair', midx - 1, h - 4); put('chair', midx + 1, h - 4);
    put('bookshelf', 2, h - 3); put('plant', w - 3, h - 2);
  }
  put('chandelier', midx, 3);   // decorative (hangs, non-solid)
  return list;
}

export function getInterior(fromMapId, obj) {
  const id = `int:${fromMapId}:${obj.x}:${obj.y}`;
  if (_interiors[id]) return _interiors[id];
  const w = Math.max(9, Math.min(15, obj.w + 1)), h = Math.max(8, Math.min(11, obj.h + 2));
  const tiles = new Uint8Array(w * h).fill(T.FLOOR);
  const solid = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) { solid[x] = 1; solid[1 * w + x] = 1; solid[(h - 1) * w + x] = 1; }
  for (let y = 0; y < h; y++) { solid[y * w] = 1; solid[y * w + w - 1] = 1; }
  const ex = w >> 1; solid[(h - 1) * w + ex] = 0;                     // doorway
  const objects = furnFor(obj.style, w, h);
  for (const f of objects) if (SOLID_FURN.has(f.kind)) solid[f.y * w + f.x] = 1;
  const portals = [{ x: ex, y: h - 1, w: 1, h: 1, to: fromMapId, tx: obj.x + obj.door, ty: obj.y + obj.h, label: 'ออกไปข้างนอก' }];
  _interiors[id] = { id, interior: true, style: obj.style, name: obj.name || 'ภายในอาคาร', w, h, tiles, solid, objects, portals, spawn: { x: ex, y: h - 3 } };
  return _interiors[id];
}

// Building whose doorway the player is standing in front of (for entering).
export function doorNear(mapId, px, py) {
  const m = getMap(mapId); if (!m.objects) return null;
  const tx = px / TILE, ty = py / TILE;
  for (const o of m.objects) {
    if (o.t !== 'building') continue;
    const dx = o.x + o.door + 0.5, dy = o.y + o.h + 0.3;
    if (Math.hypot(dx - tx, dy - ty) < 1.6) return o;
  }
  return null;
}

// List of walkable cells on a map suitable for placing NPCs (near roads/plaza).
export function walkableCells(id) {
  const m = getMap(id), s = getSolid(id), cells = [];
  const good = new Set([T.PATH, T.ROAD, T.PLAZA, T.FLOOR, T.GRASS, T.DIRT, T.SAND]);
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++)
    if (!s[y * m.w + x] && good.has(m.tiles[y * m.w + x])) cells.push([x, y]);
  return cells;
}
