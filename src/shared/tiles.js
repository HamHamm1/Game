// Terrain tile codes shared by server & client.
export const T = {
  GRASS: 0, PATH: 1, WATER: 2, SAND: 3, FLOOR: 4, PLAZA: 5,
  DIRT: 6, ROAD: 7, SNOW: 8, ROCK: 9, TALLGRASS: 10, CARPET: 11, DEEPWATER: 12,
};

// Terrain that blocks movement on its own (objects add more via footprints).
export const SOLID_TILE = new Set([T.WATER, T.DEEPWATER, T.ROCK]);

// Which terrains "blob" (rounded auto-tile edges) over the grass base.
export const OVERLAY = new Set([T.PATH, T.SAND, T.FLOOR, T.PLAZA, T.ROAD, T.DIRT, T.SNOW, T.CARPET]);
