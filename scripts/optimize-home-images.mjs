import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');

const jobs = [
  ...[
    ['bsp-hydraulic-adapters', 'assets/images/products/bsp-hydraulic-adapters/bsp-hydraulic-adapters-1.png'],
    ['custom-cnc-parts', 'assets/images/products/custom-cnc-parts/custom-cnc-parts-1.png'],
    ['hydraulic-valve-bodies', 'assets/images/products/hydraulic-valve-bodies/hydraulic-valve-bodies-1.png'],
    ['hydraulic-cylinder-parts', 'assets/images/products/hydraulic-cylinder-parts/hydraulic-cylinder-parts-1.png'],
  ].flatMap(([name, input]) => [400, 800].map((width) => ({
    input,
    output: `assets/images/home/cards/${name}-${width}.webp`,
    resize: { width, height: width * 0.75, fit: 'contain', withoutEnlargement: true },
    webp: { quality: 82, effort: 6 },
  }))),
  ...[768, 1280, 1600].map((width) => ({
    input: 'assets/images/hero.webp',
    output: `assets/images/home/hero/hero-${width}.webp`,
    resize: { width, withoutEnlargement: true },
    webp: { quality: 80, effort: 6 },
  })),
  ...[768, 1600].map((width) => ({
    input: 'assets/images/process/process-bg.webp',
    output: `assets/images/home/process/process-bg-${width}.webp`,
    resize: { width, withoutEnlargement: true },
    webp: { quality: 72, effort: 6 },
  })),
];

async function optimize(job) {
  const input = resolve(root, job.input);
  const output = resolve(root, job.output);
  await mkdir(dirname(output), { recursive: true });

  // Sharp strips metadata by default. The source is only read and is never modified.
  const info = await sharp(input)
    .resize(job.resize)
    .webp(job.webp)
    .toFile(output);
  const { size } = await stat(output);
  console.log(`${job.output}: ${info.width}x${info.height}, ${(size / 1024).toFixed(1)} KiB`);
}

try {
  for (const job of jobs) await optimize(job);
  console.log(`Generated ${jobs.length} optimized homepage images.`);
} catch (error) {
  console.error('Homepage image optimization failed:', error);
  process.exitCode = 1;
}
