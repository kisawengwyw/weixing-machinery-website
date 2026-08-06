import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'favicon.svg');
const destination = path.join(root, 'apple-touch-icon.png');
const check = process.argv.slice(2).includes('--check');

async function render() {
  const svg = await readFile(source);
  const logo = await sharp(svg, { density: 288 })
    .resize(140, 140, { fit: 'contain' })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
  return sharp({
    create: { width: 180, height: 180, channels: 3, background: '#FFFFFF' },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .withMetadata({ icc: 'srgb' })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

const expected = await render();
let current;
try { current = await readFile(destination); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

if (check) {
  if (!current) throw new Error('apple-touch-icon.png does not exist');
  const metadata = await sharp(current).metadata();
  if (metadata.format !== 'png' || metadata.width !== 180 || metadata.height !== 180) {
    throw new Error(`apple-touch-icon.png must be a 180x180 PNG (got ${metadata.format} ${metadata.width}x${metadata.height})`);
  }
  if (!current.equals(expected)) throw new Error('apple-touch-icon.png is not the deterministic output of favicon.svg');
  console.log(`apple-touch-icon.png verified: 180x180 PNG, ${(await stat(destination)).size} bytes`);
} else if (current?.equals(expected)) {
  console.log(`apple-touch-icon.png unchanged: 180x180 PNG, ${current.length} bytes`);
} else {
  await writeFile(destination, expected);
  console.log(`apple-touch-icon.png generated: 180x180 PNG, ${expected.length} bytes`);
}
