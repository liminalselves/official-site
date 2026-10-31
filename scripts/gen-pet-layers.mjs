// Builds the download-site Aliya layers from frames rendered out of the Aliya Pet UI
// (see README "Aliya 形象素材"). Base = full body; a pose that only repaints pixels is a
// cropped patch laid over the base, while a pose that moves the silhouette (where the base
// would show through) ships as a full frame that replaces the base while visible.
// usage: node scripts/gen-pet-layers.mjs <framesDir>
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/gen-pet-layers.mjs <framesDir>');
const out = fileURLToPath(new URL('../public/pet/', import.meta.url));
const manifestFile = fileURLToPath(new URL('../sites/aliyapet/data/pet-layers.json', import.meta.url));
const POSES = ['blink', 'happy', 'shy', 'surprised', 'smug', 'sleepy', 'worried', 'hit', 'ear', 'wave1', 'wave2'];
const PAD = 6;

const load = async (name) => sharp(path.join(src, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const base = await load('neutral');
const { width: W, height: H } = base.info;

// Trim the transparent margin shared by all frames.
let crop = [W, H, 0, 0];
const grow = (data) => {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 4) {
      const p = (i - 3) / 4, x = p % W, y = (p / W) | 0;
      crop = [Math.min(crop[0], x), Math.min(crop[1], y), Math.max(crop[2], x), Math.max(crop[3], y)];
    }
  }
};
const frames = { neutral: base.data };
for (const n of POSES) frames[n] = (await load(n)).data;
Object.values(frames).forEach(grow);
const [cx0, cy0] = [Math.max(0, crop[0] - PAD), Math.max(0, crop[1] - PAD)];
const cw = Math.min(W, crop[2] + PAD + 1) - cx0;
const ch = Math.min(H, crop[3] + PAD + 1) - cy0;

await mkdir(out, { recursive: true });
const webp = { quality: 88, alphaQuality: 95, effort: 6 };
const raw = { raw: { width: W, height: H, channels: 4 } };
await sharp(base.data, raw).extract({ left: cx0, top: cy0, width: cw, height: ch }).webp(webp).toFile(path.join(out, 'base.webp'));

const layers = {};
for (const n of POSES) {
  const f = frames[n];
  let b = [W, H, -1, -1];
  let ghost = 0;
  for (let i = 0; i < f.length; i += 4) {
    if (base.data[i + 3] - f[i + 3] > 40) ghost++;
    const d = Math.abs(f[i] - base.data[i]) + Math.abs(f[i + 1] - base.data[i + 1]) + Math.abs(f[i + 2] - base.data[i + 2]) + Math.abs(f[i + 3] - base.data[i + 3]);
    if (d > 18) {
      const p = i / 4, x = p % W, y = (p / W) | 0;
      b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
    }
  }
  if (b[2] < 0) continue;
  if (ghost > 200) {
    await sharp(f, raw).extract({ left: cx0, top: cy0, width: cw, height: ch }).webp(webp).toFile(path.join(out, `${n}.webp`));
    layers[n] = { x: 0, y: 0, w: cw, h: ch, full: true };
    continue;
  }
  const left = Math.max(cx0, b[0] - PAD), top = Math.max(cy0, b[1] - PAD);
  const width = Math.min(cx0 + cw, b[2] + PAD + 1) - left, height = Math.min(cy0 + ch, b[3] + PAD + 1) - top;
  await sharp(f, raw).extract({ left, top, width, height }).webp(webp).toFile(path.join(out, `${n}.webp`));
  layers[n] = { x: left - cx0, y: top - cy0, w: width, h: height };
}

await writeFile(manifestFile, `${JSON.stringify({ width: cw, height: ch, layers }, null, 2)}\n`);
console.log('base', cw, ch, Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, `${v.w}x${v.h}`])));
