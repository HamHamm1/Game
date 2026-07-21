// Per-map collision against the shared, deterministic maps.
import { TILE, getMap, getSolid } from '../shared/maps.js';

const R = 9; // player half-box
export function isSolid(mapId, px, py) {
  const m = getMap(mapId), s = getSolid(mapId);
  for (const [ox, oy] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
    const tx = Math.floor((px + ox) / TILE), ty = Math.floor((py + oy) / TILE);
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    if (s[ty * m.w + tx]) return true;
  }
  return false;
}

// Returns a portal if the player's centre is standing on one, else null.
export function portalAt(mapId, px, py) {
  const m = getMap(mapId), tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  for (const p of m.portals) {
    if (tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) return p;
  }
  return null;
}
