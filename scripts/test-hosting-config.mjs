import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const exists = (file) => existsSync(resolve(root, file));
const htaccess = read('.htaccess');

assert.match(htaccess, /^RewriteEngine On$/m);
assert.match(htaccess, /^RewriteCond %\{HTTP_HOST\} \^weixingmachinery\\\.com\$ \[NC\]$/m);
assert.match(htaccess, /^RewriteRule \^ https:\/\/www\.weixingmachinery\.com%\{REQUEST_URI\} \[R=301,L,NE\]$/m);
assert.equal((htaccess.match(/^RewriteCond /gm) || []).length, 1, 'only the exact apex host may be matched');
assert.doesNotMatch(htaccess, /!\^www|github\.io|hostinger(?:app|site)|000webhost/i);
assert.match(htaccess, /^ErrorDocument 404 \/404\.html$/m);
for (const file of ['404.html', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png']) assert.ok(exists(file), `${file} must exist`);

const svg = read('favicon.svg');
assert.match(svg, /viewBox="98\.932 -5\.851 800 800"/);
assert.match(svg, /fill="#0F2640"/);
assert.equal((svg.match(/<path\b/g) || []).length, 2, 'favicon.svg must contain exactly the two brand paths');
assert.doesNotMatch(svg, /base64|icc|inkscape|<image\b/i);

const png = readFileSync(resolve(root, 'apple-touch-icon.png'));
assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'Apple icon must have a PNG signature');

const files = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const iconPattern = /<link\s+rel="(icon|apple-touch-icon|shortcut icon)"\s+href="([^"]+)"(?:\s+type="image\/svg\+xml"|\s+sizes="(?:any|180x180)")?>/g;
for (const file of files) {
  const html = read(file);
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert.ok(head, `${file}: missing head`);
  const links = [...head.matchAll(iconPattern)].map((match) => ({ rel: match[1], href: match[2], raw: match[0] }));
  assert.equal(links.length, 4, `${file}: expected exactly four icon links`);
  const prefix = file === '404.html' ? 'https://www.weixingmachinery.com/' : '../'.repeat(file.split('/').length - 1);
  const expected = [
    `<link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="${prefix}favicon.ico" sizes="any">`,
    `<link rel="apple-touch-icon" href="${prefix}apple-touch-icon.png" sizes="180x180">`,
    `<link rel="shortcut icon" href="${prefix}favicon.ico">`,
  ];
  assert.deepEqual(links.map(({ raw }) => raw), expected, `${file}: incorrect icon order or attributes`);
  if (file !== '404.html') {
    for (const { href } of links) assert.equal(posix.normalize(posix.join(posix.dirname(file), href)), posix.basename(href), `${file}: ${href} must resolve to repository root`);
    assert.ok(links.every(({ href }) => !href.startsWith('/')), `${file}: icon links must not be root-relative`);
  } else {
    assert.ok(links.every(({ href }) => href.startsWith('https://www.weixingmachinery.com/')), '404 icons must use production absolute URLs');
    for (const required of ['https://www.weixingmachinery.com/', 'https://www.weixingmachinery.com/zh/', 'https://www.weixingmachinery.com/products/', 'https://www.weixingmachinery.com/contact/']) assert.ok(html.includes(`href="${required}"`), `404.html: missing ${required}`);
  }
}
console.log(`Validated Hostinger routing, two-path brand SVG, PNG signature, and icon links in ${files.length} tracked public HTML files.`);
console.log('.htaccess validation is static; final behavior is verified by the production health workflow after Hostinger deployment.');
