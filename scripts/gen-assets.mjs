// Derives transparent brand marks, favicons and the OG image from the official logo.
// Run once after the source logo changes: npm run assets
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const src = fileURLToPath(new URL('src/assets/brand/logo.jpg', root));
const out = (p) => fileURLToPath(new URL(`public/${p}`, root));

await mkdir(out('brand'), { recursive: true });

const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// Ink coverage turns into alpha so the mark works on any background.
function bounds(y0, y1) {
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] < 235) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  const pad = 4;
  return {
    left: Math.max(0, minX - pad), top: Math.max(0, minY - pad),
    width: Math.min(W, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(H, maxY + pad) - Math.max(0, minY - pad),
  };
}

function tint(region, rgb, scale = 1) {
  const buf = Buffer.alloc(region.width * region.height * 4);
  for (let y = 0; y < region.height; y++) {
    for (let x = 0; x < region.width; x++) {
      const g = data[(region.top + y) * W + region.left + x];
      const a = Math.max(0, Math.min(255, Math.round((255 - g) * 1.08)));
      const i = (y * region.width + x) * 4;
      buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2]; buf[i + 3] = a;
    }
  }
  return sharp(buf, { raw: { width: region.width, height: region.height, channels: 4 } })
    .resize({ width: Math.round(region.width * scale) });
}

const mark = bounds(120, 346);
const wordmark = bounds(346, 480);
const full = bounds(120, 480);

const LIGHT = [240, 238, 234];
const DARK = [14, 14, 16];

// Widths cover the largest rendered size at 2x density.
await tint(mark, LIGHT).resize({ width: 400 }).webp({ quality: 82, alphaQuality: 90 }).toFile(out('brand/mark-light.webp'));
await tint(mark, LIGHT).resize({ width: 72 }).webp({ quality: 85 }).toFile(out('brand/mark-light-sm.webp'));
await tint(mark, DARK).resize({ width: 560 }).webp({ quality: 75 }).toFile(out('brand/mark-dark.webp'));
await tint(wordmark, LIGHT).resize({ width: 440 }).webp({ quality: 85 }).toFile(out('brand/wordmark-light.webp'));

// Square app icons: dark tile with the light mark centred.
async function icon(size, file) {
  const inner = Math.round(size * 0.72);
  const m = await tint(mark, LIGHT, 4).resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#0b0b0c' } })
    .composite([{ input: m, gravity: 'center' }])
    .png().toFile(out(file));
}
await icon(32, 'favicon-32.png');
await icon(180, 'apple-touch-icon.png');
await icon(512, 'icon-512.png');

// Open Graph card 1200x630.
const ogLogo = await tint(full, LIGHT, 1).resize({ height: 400 }).png().toBuffer();
const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><radialGradient id="g" cx="50%" cy="48%" r="55%">
    <stop offset="0" stop-color="#2a2a2e"/><stop offset="1" stop-color="#0b0b0c"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <line x1="600" y1="0" x2="600" y2="630" stroke="#ffffff" stroke-opacity=".06"/>
</svg>`);
await sharp(glow)
  .composite([{ input: ogLogo, gravity: 'center' }])
  .png({ compressionLevel: 9 }).toFile(out('og.png'));

console.log('assets generated', { mark, wordmark, full });
