// Generic sprite-atlas: async image loading + region / grid slicing with
// caching. This is the shared backbone for the asset-based graphics (terrain,
// buildings, interiors, props, characters). All source art is 16px-tile pixel
// art; we slice regions and upscale (nearest) to the game's 32px tiles.
const atlases = {};          // name -> HTMLImageElement
const spriteCache = new Map();

export function loadAtlas(name, url) {
  if (atlases[name]) return;
  const img = new Image();
  img.src = url;
  atlases[name] = img;
}
export function atlasImg(name) { return atlases[name] || null; }
export function atlasReady(name) { const i = atlases[name]; return !!(i && i.complete && i.naturalWidth); }
export function atlasesReady(names) { return names.every(atlasReady); }

// Crop a pixel region and upscale it. Returns a cached canvas, or null if the
// atlas image hasn't loaded yet.
export function sprite(name, sx, sy, sw, sh, scale = 1) {
  const img = atlases[name];
  if (!img || !img.complete || !img.naturalWidth) return null;
  const key = `${name}:${sx},${sy},${sw},${sh}@${scale}`;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  spriteCache.set(key, c);
  return c;
}

// Grid helper: tile (col,row) spanning cw×ch tiles of TS px each, upscaled.
export function tile(name, col, row, cw = 1, ch = 1, TS = 16, scale = 1) {
  return sprite(name, col * TS, row * TS, cw * TS, ch * TS, scale);
}

// A row of frames (for animations): count frames of fw×fh from (col0,row).
export function frames(name, col0, row, count, fw = 16, fh = 16, scale = 1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = sprite(name, (col0 + i) * fw, row * fh, fw, fh, scale);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

// The cozy pack — loaded once at boot; used by later graphics steps.
export const COZY = { over: 'cozy_over', town: 'cozy_town', interior: 'cozy_int', nature: 'cozy_nature', char: 'cozy_char' };
export function preloadCozy() {
  loadAtlas(COZY.over, '/assets/cozy/overworld.png');
  loadAtlas(COZY.town, '/assets/cozy/town.png');
  loadAtlas(COZY.interior, '/assets/cozy/interior.png');
  loadAtlas(COZY.nature, '/assets/cozy/nature.png');
  loadAtlas(COZY.char, '/assets/cozy/char.png');
}
export function cozyReady() { return atlasesReady(Object.values(COZY)); }
