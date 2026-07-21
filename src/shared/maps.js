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

  objects.push({ t: 'building', x: 19, y: 3, w: 14, h: 7, style: 'academy', name: 'อาคารเรียนหลัก', door: 7 });
  objects.push({ t: 'building', x: 6, y: 14, w: 9, h: 6, style: 'dorm', name: 'หอพักหญิง', door: 4 });
  objects.push({ t: 'building', x: 37, y: 14, w: 9, h: 6, style: 'dorm2', name: 'หอพักชาย', door: 4 });
  objects.push({ t: 'building', x: 6, y: 27, w: 8, h: 6, style: 'cafe', name: 'คาเฟ่ไรส์ทา', door: 4 });
  objects.push({ t: 'building', x: 38, y: 27, w: 8, h: 6, style: 'library', name: 'ห้องสมุดต้องห้าม', door: 3 });
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
  objects.push({ t: 'building', x: 24, y: 4, w: 12, h: 7, style: 'palace', name: 'พระราชวังอเล็กเทียร์', door: 6 });
  objects.push({ t: 'building', x: 8, y: 6, w: 8, h: 6, style: 'opera', name: 'โรงละครโอเปร่า', door: 4 });
  objects.push({ t: 'building', x: 40, y: 6, w: 8, h: 6, style: 'library', name: 'หอสมุดแห่งปัญญา', door: 3 });
  // shops row
  objects.push({ t: 'building', x: 8, y: 28, w: 7, h: 5, style: 'shop', name: 'ร้านเวทมนตร์', door: 3 });
  objects.push({ t: 'building', x: 17, y: 30, w: 6, h: 5, style: 'shop2', name: 'ร้านเครื่องประดับ', door: 3 });
  objects.push({ t: 'building', x: 38, y: 30, w: 7, h: 5, style: 'inn', name: 'โรงแรมลอเรล', door: 3 });
  objects.push({ t: 'building', x: 10, y: 40, w: 8, h: 5, style: 'house', name: 'บ้านตระกูลอยุก', door: 4 });
  objects.push({ t: 'building', x: 22, y: 40, w: 7, h: 5, style: 'house2', name: 'บ้านตระกูลมาร์ควิส', door: 3 });
  objects.push({ t: 'building', x: 34, y: 40, w: 8, h: 5, style: 'house', name: 'บ้านตระกูลเคานต์', door: 4 });
  objects.push({ t: 'building', x: 8, y: 18, w: 6, h: 5, style: 'cafe', name: 'คาเฟ่ไรส์ทา', door: 3 });
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
  objects.push({ t: 'building', x: 22, y: 26, w: 6, h: 5, style: 'palace', name: 'เมืองหลวงอเล็กเทียร์', door: 3 });
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
export function getMap(id) { return _maps[id] || _maps.school; }

export function getSolid(id) {
  if (_solid[id]) return _solid[id];
  const m = getMap(id), s = new Uint8Array(m.w * m.h);
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

// List of walkable cells on a map suitable for placing NPCs (near roads/plaza).
export function walkableCells(id) {
  const m = getMap(id), s = getSolid(id), cells = [];
  const good = new Set([T.PATH, T.ROAD, T.PLAZA, T.FLOOR, T.GRASS, T.DIRT, T.SAND]);
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++)
    if (!s[y * m.w + x] && good.has(m.tiles[y * m.w + x])) cells.push([x, y]);
  return cells;
}
