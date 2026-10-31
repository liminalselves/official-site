// Copies the Aliya Pet web embed (Aliya_pet repo: `npm run build:embed` in redesign/ui) into
// public/pet/, so the download site runs the real Live2D model with the app's own code.
// The 2048px texture is re-encoded as lossless WebP (same pixels, about half the bytes) and
// a still poster is rendered from it for the placeholder shown while the model loads.
// usage: node scripts/sync-pet-embed.mjs <path-to>/Aliya_pet/redesign/ui/dist-embed
import sharp from 'sharp';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/sync-pet-embed.mjs <dist-embed dir>');
const out = fileURLToPath(new URL('../public/pet/', import.meta.url));

await rm(out, { recursive: true, force: true });
await cp(src, out, { recursive: true });

const modelJson = path.join(out, 'live2d/aliya/16.model3.json');
const model = JSON.parse(await readFile(modelJson, 'utf8'));
model.FileReferences.Textures = await Promise.all(model.FileReferences.Textures.map(async (rel) => {
  const png = path.join(out, 'live2d/aliya', rel);
  const webp = png.replace(/\.png$/i, '.webp');
  await sharp(png).webp({ lossless: true, effort: 6 }).toFile(webp);
  await rm(png);
  return rel.replace(/\.png$/i, '.webp');
}));
await writeFile(modelJson, `${JSON.stringify(model, null, 2)}\n`);
console.log('textures', model.FileReferences.Textures);
