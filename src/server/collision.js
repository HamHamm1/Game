// Server-side collision against the shared, deterministic map.
import { TILE, MAP_W, MAP_H } from '../shared/constants.js';
import { generateMap, SOLID } from '../shared/worldgen.js';

const { tiles } = generateMap();

// Treat the player as a small box so corners don't clip into walls.
const R = 9;
export function isSolid(px, py) {
  for (const [ox, oy] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
    const tx = Math.floor((px + ox) / TILE);
    const ty = Math.floor((py + oy) / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    if (SOLID.has(tiles[ty * MAP_W + tx])) return true;
  }
  return false;
}
