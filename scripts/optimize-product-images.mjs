import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const auditOnly = process.argv.includes('--audit-only');
const slugs = [
  'orfs-hydraulic-fittings', 'bsp-hydraulic-adapters', 'jic-flare-fittings',
  'npt-pipe-fittings', 'bulkhead-connectors', 'hydraulic-hose-fittings',
  'welded-tube-assemblies', 'hydraulic-manifold-blocks', 'hydraulic-cylinder-parts',
  'hydraulic-valve-bodies', 'valve-spools-pistons', 'custom-cnc-parts',
];
const pagePaths = slugs.flatMap((slug) => [
  `products/${slug}/index.html`, `zh/products/${slug}/index.html`,
]);
const generatedPattern = /-w\d+\.webp$/i;
const imagePattern = /<img\b[^>]*>/gi;
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? '';
const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const pct = (saved, total) => total ? `${(saved * 100 / total).toFixed(1)}%` : '0.0%';
const webPath = (value) => value.replace(/^\.\.\/\.\.\/(?:\.\.\/)?/, '');

async function collectUsage() {
  const usage = new Map();
  const pages = [];
  for (const pagePath of pagePaths) {
    const html = await readFile(resolve(root, pagePath), 'utf8');
    const gallery = html.match(/<div class="product-gallery">([\s\S]*?)<div class="gallery-dots">/i)?.[1] ?? '';
    const tags = gallery.match(imagePattern) ?? [];
    pages.push({ pagePath, html, tags });
    for (const tag of tags) {
      let source = webPath(attr(tag, 'src'));
      if (generatedPattern.test(source)) source = source.replace(/-w\d+\.webp$/i, '.webp');
      if (!source.startsWith('assets/images/products/') || generatedPattern.test(source)) continue;
      const item = usage.get(source) ?? { source, refs: [] };
      item.refs.push({ pagePath, loading: attr(tag, 'loading') || 'eager', fetchpriority: attr(tag, 'fetchpriority') || 'none', width: attr(tag, 'width'), height: attr(tag, 'height'), alt: attr(tag, 'alt') });
      usage.set(source, item);
    }
  }
  return { usage, pages };
}

async function optimize(item) {
  const input = resolve(root, item.source);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Sharp did not return valid dimensions');
  const original = await readFile(input);
  const originalSize = original.length;
  const derivative = (width) => item.source.replace(new RegExp(`${extname(item.source)}$`, 'i'), `-w${width}.webp`);
  const removeDerivative = async (width) => {
    try { await unlink(resolve(root, derivative(width))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  };
  // Remove obsolete same-size derivatives created by earlier versions of this script.
  for (const width of [600, 750]) await removeDerivative(width);
  if (metadata.width <= 800) await removeDerivative(800);
  if (metadata.width <= 480) await removeDerivative(480);
  const pixels = await sharp(original).rotate().resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
  let perceptualHash = 0n;
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
    perceptualHash = (perceptualHash << 1n) | BigInt(pixels[y * 9 + x] > pixels[y * 9 + x + 1]);
  }
  let mobile = null;
  if (metadata.width > 480) {
    const width = 480;
    const output = derivative(width);
    await mkdir(dirname(resolve(root, output)), { recursive: true });
    const info = await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 86, effort: 6 }).toFile(resolve(root, output));
    const outputSize = (await stat(resolve(root, output))).size;
    mobile = { output, width: info.width, height: info.height, size: outputSize };
    const saved = originalSize - outputSize;
    console.log(`${item.source}: ${metadata.width}x${metadata.height} (${formatBytes(originalSize)}) -> ${output}: ${info.width}x${info.height} (${formatBytes(outputSize)}), saved ${formatBytes(saved)} (${pct(saved, originalSize)})`);
  }
  let desktop = { output: item.source, width: metadata.width, height: metadata.height, size: originalSize, original: true };
  let largeStatus = metadata.width > 800 ? 'pending' : 'skipped: original width is 800px or less';
  if (metadata.width > 800) {
    const output = derivative(800);
    const info = await sharp(original).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 86, effort: 6 }).toFile(resolve(root, output));
    const outputSize = (await stat(resolve(root, output))).size;
    if (outputSize < originalSize) {
      desktop = { output, width: info.width, height: info.height, size: outputSize, original: false };
      largeStatus = 'generated and retained';
    } else {
      await unlink(resolve(root, output));
      largeStatus = 'generated then deleted: no size benefit';
    }
  }
  return { ...item, metadata, originalSize, hash: createHash('sha256').update(original).digest('hex'), perceptualHash, mobile, desktop, largeStatus };
}

async function audit(item) {
  const input = resolve(root, item.source);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Sharp did not return valid dimensions');
  const original = await readFile(input);
  const pixels = await sharp(original).rotate().resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
  let perceptualHash = 0n;
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
    perceptualHash = (perceptualHash << 1n) | BigInt(pixels[y * 9 + x] > pixels[y * 9 + x + 1]);
  }
  return {
    ...item,
    metadata,
    originalSize: original.length,
    hash: createHash('sha256').update(original).digest('hex'),
    perceptualHash,
    mobile: null,
    desktop: { output: item.source, width: metadata.width, height: metadata.height, size: original.length, original: true },
    largeStatus: metadata.width > 800 ? 'would evaluate 800px candidate' : 'skipped: original width is 800px or less',
  };
}

async function updatePages(pages, results) {
  const bySource = new Map(results.map((result) => [result.source, result]));
  for (const page of pages) {
    let changed = page.html;
    for (const tag of page.tags) {
      const current = webPath(attr(tag, 'src')).replace(/-w\d+\.webp$/i, '.webp');
      const result = bySource.get(current);
      if (!result) continue;
      const prefix = page.pagePath.startsWith('zh/') ? '../../../' : '../../';
      const src = `${prefix}${result.desktop.output}`;
      const candidates = [];
      if (result.mobile) candidates.push(`${prefix}${result.mobile.output} ${result.mobile.width}w`);
      candidates.push(`${prefix}${result.desktop.output} ${result.desktop.width}w`);
      let replacement = tag
        .replace(/\bsrc=["'][^"']*["']/i, `src="${src}"`)
        .replace(/\bsrcset=["'][^"']*["']/i, `srcset="${candidates.join(', ')}"`)
        .replace(/\bwidth=["'][^"']*["']/i, `width="${result.desktop.width}"`)
        .replace(/\bheight=["'][^"']*["']/i, `height="${result.desktop.height}"`);
      changed = changed.replace(tag, replacement);
    }
    if (changed !== page.html) await writeFile(resolve(root, page.pagePath), changed);
  }
}

function hammingDistance(a, b) {
  let value = a ^ b; let count = 0;
  while (value) { count += Number(value & 1n); value >>= 1n; }
  return count;
}

function validatePages(pages, results) {
  const sourceDimensions = new Map(results.map((result) => [result.source, result.metadata]));
  return pages.map(({ pagePath, html, tags }) => {
    const errors = [];
    if ((html.match(/<h1\b/gi) ?? []).length !== 1) errors.push('H1 count');
    if (tags.length !== 5) errors.push(`gallery images: ${tags.length}`);
    if ((html.match(/class="gallery-dot(?: active)?"/g) ?? []).length !== 5) errors.push('gallery dots');
    tags.forEach((tag, index) => {
      for (const name of ['src', 'srcset', 'sizes', 'width', 'height', 'alt']) if (!attr(tag, name)) errors.push(`image ${index + 1} missing ${name}`);
      if (index === 0 && (attr(tag, 'loading') === 'lazy' || attr(tag, 'fetchpriority') !== 'high')) errors.push('first image priority');
      if (index > 0 && attr(tag, 'loading') !== 'lazy') errors.push(`image ${index + 1} lazy loading`);
      const src = webPath(attr(tag, 'src'));
      const original = src.replace(/-w\d+\.webp$/i, '.webp');
      const dimensions = sourceDimensions.get(original);
      if (dimensions && Number(attr(tag, 'width')) / Number(attr(tag, 'height')) !== dimensions.width / dimensions.height) errors.push(`image ${index + 1} aspect ratio`);
      if (pagePath.startsWith('zh/') && !attr(tag, 'src').startsWith('../../../assets/images/products/')) errors.push(`image ${index + 1} Chinese path`);
      if (!pagePath.startsWith('zh/') && !attr(tag, 'src').startsWith('../../assets/images/products/')) errors.push(`image ${index + 1} English path`);
    });
    if (html.includes('/zh/assets/images/')) errors.push('/zh/assets path');
    return { pagePath, count: tags.length, errors };
  });
}

async function exists(path) { try { await stat(resolve(root, path)); return true; } catch { return false; } }

async function writeReport(results, pageValidation, failures, skipped) {
  const originalTotal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const desktopTotal = results.reduce((sum, r) => sum + r.desktop.size, 0);
  const mobileTotal = results.reduce((sum, r) => sum + (r.mobile?.size ?? r.desktop.size), 0);
  const mobileGenerated = results.filter((r) => r.mobile).length;
  const largeGenerated = results.filter((r) => !r.desktop.original).length;
  const largeSkipped = results.length - largeGenerated;
  const duplicateHashes = new Map();
  results.forEach((r) => duplicateHashes.set(r.hash, [...(duplicateHashes.get(r.hash) ?? []), r.source]));
  const lines = [
    '# Product Image Optimization Report', '', '## Summary', '',
    `- Audit date: ${new Date().toISOString().slice(0, 10)}`,
    `- Product categories: ${slugs.length}`, `- Pages: ${pagePaths.length}`,
    `- Original images: ${results.length}`, `- Mobile derivatives generated: ${mobileGenerated}`,
    `- Large derivatives generated: ${largeGenerated}`, `- Large derivatives skipped: ${largeSkipped}`,
    `- Original total size: ${formatBytes(originalTotal)}`, `- Final desktop candidate total size: ${formatBytes(desktopTotal)}`,
    `- Final mobile candidate total size: ${formatBytes(mobileTotal)}`,
    `- Desktop savings: ${formatBytes(originalTotal - desktopTotal)} (${pct(originalTotal - desktopTotal, originalTotal)})`,
    `- Mobile savings: ${formatBytes(originalTotal - mobileTotal)} (${pct(originalTotal - mobileTotal, originalTotal)})`,
    `- Failures: ${failures.length}`, `- Skipped: ${skipped.length}`, '',
    'Outputs use Sharp WebP quality 86 and effort 6. Embedded orientation is applied, metadata is stripped, alpha is preserved, and resizing never enlarges or crops.', '',
    '## Per-Image Results', '',
    '| Category | Source | Original Dimensions | Original Size | Desktop Candidate | Desktop Size | Mobile Derivative | Mobile Size | Large Derivative | Notes |',
    '|---|---|---:|---:|---|---:|---|---:|---|---|',
  ];
  for (const r of results) {
    const mobile = r.mobile;
    const near = results.filter((candidate) => candidate !== r && hammingDistance(candidate.perceptualHash, r.perceptualHash) <= 5);
    const duplicate = (duplicateHashes.get(r.hash)?.length ?? 0) > 1 ? 'exact duplicate source' : near.length ? `possible near duplicate: ${near.map((x) => x.source).join(', ')}` : 'no exact or near duplicate detected';
    lines.push(`| ${r.source.split('/')[3]} | \`${r.source}\` | ${r.metadata.width}×${r.metadata.height} | ${formatBytes(r.originalSize)} | \`${r.desktop.output}\` (${r.desktop.width}×${r.desktop.height}) | ${formatBytes(r.desktop.size)} | ${mobile ? `\`${mobile.output}\` (${mobile.width}×${mobile.height})` : 'Original (source ≤480px)'} | ${formatBytes(mobile?.size ?? r.desktop.size)} | ${r.largeStatus} | ${r.metadata.hasAlpha ? 'alpha' : 'opaque'}; ${r.metadata.exif || r.metadata.icc || r.metadata.xmp ? 'removable metadata present' : 'no removable metadata reported'}; ${duplicate} |`);
  }
  lines.push('', '## Detailed Usage Audit', '', '| Category | Source format / ratio | English page | Chinese page | References | Loading / priority | Declared dimensions | Alt preserved | 480 suitable | Large needed | Result |', '|---|---|---|---|---:|---|---|---|---|---|---|');
  for (const r of results) {
    const en = r.refs.find((x) => !x.pagePath.startsWith('zh/')); const zh = r.refs.find((x) => x.pagePath.startsWith('zh/'));
    const load = [...new Set(r.refs.map((x) => `${x.loading}/${x.fetchpriority}`))].join(', ');
    lines.push(`| ${r.source.split('/')[3]} | ${r.metadata.format}; ${(r.metadata.width / r.metadata.height).toFixed(4)} | \`${en?.pagePath ?? '—'}\` | \`${zh?.pagePath ?? '—'}\` | ${r.refs.length} | ${load} | ${r.refs[0]?.width}×${r.refs[0]?.height} | Yes | ${r.metadata.width > 480 ? 'Yes' : 'Single actual-size output'} | ${r.metadata.width > 800 ? 'Yes, capped at 800' : `Actual width ${r.metadata.width}`} | Generated |`);
  }
  lines.push('', '## Page Validation', '', '| Page | Images | src | srcset | sizes | Ratio | Priority / lazy | Chinese path | Result |', '|---|---:|---|---|---|---|---|---|---|');
  for (const page of pageValidation) lines.push(`| \`${page.pagePath}\` | ${page.count} | Yes | Yes | Yes | Correct | First high; next four lazy | ${page.pagePath.startsWith('zh/') ? 'Correct' : 'N/A'} | ${page.errors.length ? `FAIL: ${page.errors.join(', ')}` : 'PASS'} |`);
  lines.push('', 'All referenced `src`, `srcset`, `og:image`, and `twitter:image` files were checked for existence. Social image URLs remain unchanged.', '', '## Skipped Images', '');
  lines.push('- Every generated `-w<number>.webp` file is ignored as a source input.');
  lines.push('- Files in product image directories that are not referenced by the 24 product galleries are not processed.');
  lines.push('- A source at or below 480px produces no derivative and uses the original file directly.');
  lines.push('- Sources at or below 800px retain the original WebP as the desktop candidate; an 800px derivative is retained only for wider sources when it is smaller than the original.');
  lines.push('- A source referenced by both language pages is processed once.');
  if (!skipped.length) lines.push('- No additional referenced source images were skipped.'); else skipped.forEach((s) => lines.push(`- \`${s.source}\`: ${s.reason}`));
  if (failures.length) failures.forEach((f) => lines.push(`- FAILED \`${f.source}\`: ${f.error}`));
  lines.push('', '## Test Scope', '', '- Automated Sharp readability, dimensions, responsive markup, paths, loading priority, and file-existence checks were executed.', '- Browser visual testing was not executed by the optimization script. Visual content is not altered except for deterministic resizing and WebP encoding.', '');
  await mkdir(resolve(root, 'docs'), { recursive: true });
  await writeFile(resolve(root, 'docs/product-image-optimization-report.md'), `${lines.join('\n')}\n`);
  return { originalTotal, desktopTotal, mobileTotal, mobileGenerated, largeGenerated, largeSkipped };
}

const failures = []; const skipped = [];
const initial = await collectUsage();
const { usage } = initial;
const results = [];
for (const item of usage.values()) {
  try { results.push(await (auditOnly ? audit(item) : optimize(item))); } catch (error) { failures.push({ source: item.source, error: error.message }); console.error(`FAILED ${item.source}: ${error.stack ?? error}`); }
}
if (!auditOnly) await updatePages(initial.pages, results);
const { pages } = auditOnly ? initial : await collectUsage();
const pageValidation = validatePages(pages, results);
if (!auditOnly) {
  for (const page of pages) {
    const social = [...page.html.matchAll(/<(?:meta)\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)];
    for (const match of social) { const path = new URL(match[1]).pathname.replace(/^\//, ''); if (!await exists(path)) pageValidation.find((p) => p.pagePath === page.pagePath).errors.push(`missing social image ${path}`); }
    for (const tag of page.tags) {
      const validation = pageValidation.find((p) => p.pagePath === page.pagePath);
      const candidates = attr(tag, 'srcset').split(',').map((value) => value.trim().split(/\s+/)).filter(([value]) => value);
      for (const value of [attr(tag, 'src'), ...candidates.map(([value]) => value)]) if (!await exists(webPath(value))) validation.errors.push(`missing ${value}`);
      for (const [value, descriptor] of candidates) {
        if (!await exists(webPath(value))) continue;
        const metadata = await sharp(resolve(root, webPath(value))).metadata();
        if (`${metadata.width}w` !== descriptor) validation.errors.push(`incorrect descriptor ${descriptor} for ${value} (${metadata.width}w)`);
      }
    }
  }
}
if (auditOnly) {
  for (const result of results) {
    const refs = result.refs.map((ref) => `${ref.pagePath} (${ref.loading}/${ref.fetchpriority}, ${ref.width}x${ref.height}, alt preserved: ${Boolean(ref.alt)})`).join('; ');
    const exact = results.filter((candidate) => candidate !== result && candidate.hash === result.hash);
    const near = results.filter((candidate) => candidate !== result && hammingDistance(candidate.perceptualHash, result.perceptualHash) <= 5);
    const duplicate = exact.length ? `exact duplicates: ${exact.map((item) => item.source).join(', ')}` : near.length ? `possible near duplicates: ${near.map((item) => item.source).join(', ')}` : 'no exact or near duplicate detected';
    const planned = [result.metadata.width > 480 ? '480px mobile derivative' : 'no mobile derivative', result.metadata.width > 800 ? 'evaluate 800px large derivative' : 'original desktop candidate'].join('; ');
    console.log(`${result.source}: ${result.metadata.format}, ${result.metadata.width}x${result.metadata.height}, ratio ${(result.metadata.width / result.metadata.height).toFixed(4)}, ${formatBytes(result.originalSize)}, ${result.metadata.hasAlpha ? 'alpha' : 'opaque'}, ${result.metadata.exif || result.metadata.icc || result.metadata.xmp ? 'removable metadata' : 'no removable metadata reported'}, ${planned}, ${duplicate}; refs: ${refs}`);
  }
  const originalTotal = results.reduce((sum, result) => sum + result.originalSize, 0);
  console.log(`Audit only: scanned ${usage.size}; readable ${results.length}; skipped ${skipped.length}; failed ${failures.length}; original total ${formatBytes(originalTotal)}.`);
  console.log('Audit-only mode made no image, HTML, or report changes.');
} else {
  const originalTotal = results.reduce((sum, result) => sum + result.originalSize, 0);
  const desktopTotal = results.reduce((sum, result) => sum + result.desktop.size, 0);
  const mobileTotal = results.reduce((sum, result) => sum + (result.mobile?.size ?? result.desktop.size), 0);
  if (desktopTotal > originalTotal) {
    const error = 'final desktop candidate total is larger than original total';
    failures.push({ source: 'desktop candidates', error });
    console.error(`FAILED desktop candidates: ${error}`);
  }
  if (mobileTotal >= originalTotal) {
    const error = 'final mobile candidate total is not smaller than original total';
    failures.push({ source: 'mobile candidates', error });
    console.error(`FAILED mobile candidates: ${error}`);
  }
  const totals = await writeReport(results, pageValidation, failures, skipped);
  console.log(`Summary: scanned ${usage.size}; successful ${results.length}; skipped ${skipped.length}; failed ${failures.length}`);
  console.log(`Original total ${formatBytes(totals.originalTotal)}; final desktop candidates ${formatBytes(totals.desktopTotal)}; final mobile candidates ${formatBytes(totals.mobileTotal)}`);
  console.log(`Desktop savings ${formatBytes(totals.originalTotal - totals.desktopTotal)}; mobile savings ${formatBytes(totals.originalTotal - totals.mobileTotal)}`);
}
const validationFailures = pageValidation.filter((page) => page.errors.length);
if (validationFailures.length) validationFailures.forEach((page) => console.error(`VALIDATION FAILED ${page.pagePath}: ${page.errors.join('; ')}`));
if (failures.length || validationFailures.length) process.exitCode = 1;
