// Deterministic world generator — ONE source of truth shared by server & client.
// Server imports it directly; the client imports it from /shared/worldgen.js,
// so every player renders (and collides with) exactly the same Alektier grounds.
import { MAP_W, MAP_H } from './constants.js';

// Tile codes
export const T = {
  GRASS: 0, PATH: 1, WATER: 2, TREE: 3, WALL: 4, FLOOR: 5,
  FLOWER: 6, FOUNTAIN: 7, HEDGE: 8, SAND: 9, ROOF: 10, DOOR: 11, RUG: 12,
};
export const SOLID = new Set([T.WATER, T.TREE, T.WALL, T.FOUNTAIN, T.HEDGE, T.ROOF]);

const idx = (x, y) => y * MAP_W + x;

function rect(t, x0, y0, w, h, code) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) t[idx(x, y)] = code;
}

// A building: floor interior, wall ring, roof cap row, and a door on the south side.
function building(t, x0, y0, w, h, doorDx) {
  rect(t, x0, y0, w, h, T.FLOOR);
  for (let x = x0; x < x0 + w; x++) { t[idx(x, y0)] = T.WALL; t[idx(x, y0 + h - 1)] = T.WALL; }
  for (let y = y0; y < y0 + h; y++) { t[idx(x0, y)] = T.WALL; t[idx(x0 + w - 1, y)] = T.WALL; }
  rect(t, x0, y0 - 1, w, 1, T.ROOF);           // roof cap
  const dx = x0 + (doorDx ?? Math.floor(w / 2));
  t[idx(dx, y0 + h - 1)] = T.DOOR;             // walkable entrance
  rect(t, dx, y0 + 1, 1, h - 2, T.RUG);        // aisle rug inside
}

function line(t, x0, y0, x1, y1, code, width = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    for (let w = 0; w < width; w++) {
      if (x + w < MAP_W) t[idx(x + w, y)] = code;
      if (y + w < MAP_H) t[idx(x, y + w)] = code;
    }
  }
}

export function generateMap() {
  const t = new Uint8Array(MAP_W * MAP_H).fill(T.GRASS);

  // Forest border framing the grounds.
  for (let x = 0; x < MAP_W; x++) { t[idx(x, 0)] = T.TREE; t[idx(x, 1)] = T.TREE; t[idx(x, MAP_H - 1)] = T.TREE; }
  for (let y = 0; y < MAP_H; y++) { t[idx(0, y)] = T.TREE; t[idx(MAP_W - 1, y)] = T.TREE; }

  // Cursed lake, bottom-right (ทะเลสาบต้องสาป).
  rect(t, MAP_W - 14, MAP_H - 12, 12, 10, T.WATER);
  rect(t, MAP_W - 16, MAP_H - 9, 3, 6, T.WATER);

  // Sandy training yard, bottom-left (ลานฝึกดวล).
  rect(t, 4, MAP_H - 11, 12, 8, T.SAND);

  // The Grand Academy — big hall, top-center (อาคารเรียนหลัก).
  building(t, 22, 4, 16, 9, 8);
  rect(t, 26, 2, 8, 2, T.ROOF);       // spires
  rect(t, 24, 6, 4, 4, T.RUG);
  rect(t, 32, 6, 4, 4, T.RUG);

  // Central art plaza with fountain (จัตุรัสศิลปะ).
  rect(t, 24, 22, 12, 8, T.FLOOR);
  rect(t, 29, 25, 2, 2, T.FOUNTAIN);

  // Girls' & boys' dorms (หอพัก) flanking the plaza.
  building(t, 8, 16, 10, 7, 5);
  building(t, 42, 16, 10, 7, 5);
  // Library of forbidden books, right (ห้องสมุดต้องห้าม).
  building(t, 44, 28, 9, 7, 4);
  // Café "ไรส์ทา" & shops, left.
  building(t, 8, 28, 9, 7, 4);

  // Main avenues (stone paths).
  line(t, 30, 34, 30, 30, T.PATH, 2);   // gate -> plaza
  line(t, 24, 26, 12, 19, T.PATH, 2);   // plaza -> left dorm
  line(t, 36, 26, 48, 19, T.PATH, 2);   // plaza -> right dorm
  line(t, 30, 22, 30, 13, T.PATH, 2);   // plaza -> academy
  line(t, 12, 31, 30, 26, T.PATH, 2);   // café -> plaza
  line(t, 48, 31, 36, 26, T.PATH, 2);   // library -> plaza

  // Gardens: hedges & flowerbeds around the plaza.
  for (const [gx, gy] of [[20, 20], [37, 20], [20, 31], [37, 31]]) {
    rect(t, gx, gy, 3, 2, T.FLOWER);
    t[idx(gx - 1, gy)] = T.HEDGE; t[idx(gx + 3, gy + 1)] = T.HEDGE;
  }

  // Scattered decorative trees on the lawns.
  const seeds = [[6, 6], [14, 8], [46, 7], [52, 10], [6, 24], [52, 24], [18, 37], [40, 38], [10, 13], [50, 33]];
  for (const [sx, sy] of seeds) {
    t[idx(sx, sy)] = T.TREE;
    if (t[idx(sx + 1, sy)] === T.GRASS) t[idx(sx + 1, sy)] = T.FLOWER;
  }

  return { tiles: t, w: MAP_W, h: MAP_H };
}

// Named landmarks the client draws as banners (matches the reference maps).
export const LANDMARKS = [
  { x: 30, y: 3, label: 'อาคารเรียนหลัก' },
  { x: 30, y: 21, label: 'จัตุรัสศิลปะ' },
  { x: 13, y: 15, label: 'หอพักหญิง' },
  { x: 47, y: 15, label: 'หอพักชาย' },
  { x: 48, y: 27, label: 'ห้องสมุดต้องห้าม' },
  { x: 12, y: 27, label: 'คาเฟ่ไรส์ทา' },
  { x: 10, y: MAP_H - 12, label: 'ลานฝึกดวล' },
  { x: MAP_W - 9, y: MAP_H - 13, label: 'ทะเลสาบต้องสาป' },
  { x: 30, y: MAP_H - 5, label: 'ประตูเมืองทิศใต้' },
];
