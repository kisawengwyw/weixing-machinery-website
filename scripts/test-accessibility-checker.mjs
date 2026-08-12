import assert from 'node:assert/strict';
import { checkHtml } from './check-accessibility.mjs';

const valid = (lang = 'en') => `<!doctype html><html lang="${lang}"><body><a class="skip-link" href="#main-content">Skip</a><header><nav aria-label="Primary navigation"><a class="active" aria-current="page" href="/">Home</a></nav><button id="mobileMenuBtn" aria-label="Open navigation menu" aria-controls="mobileMenu" aria-expanded="false"><span>Menu</span></button><div id="mobileMenu" aria-hidden="true" inert><nav aria-label="Mobile navigation"><a href="/">Home</a></nav></div></header><main id="main-content"><h1>Title</h1><img src="x.webp" alt="Product"><form><label for="name">Name</label><input id="name"><label for="choice">Choice</label><select id="choice"><option>A</option></select><label for="notes">Notes</label><textarea id="notes"></textarea></form><table><thead><tr><th scope="col">Item</th></tr></thead><tbody><tr><th scope="row">A</th></tr></tbody></table><div class="product-gallery" role="region" aria-label="Product image gallery"><button class="gallery-prev" aria-label="Previous">P</button><button class="gallery-dot active" aria-label="Image 1" aria-current="true"></button><button class="gallery-dot" aria-label="Image 2" aria-current="false"></button><button class="gallery-next" aria-label="Next">N</button></div></main></body></html>`;
const cases = [
  ['img-alt', s => s.replace(' alt="Product"', '')],
  ['button-name', s => s.replace('<span>Menu</span>', '').replace(' aria-label="Open navigation menu"', '')],
  ['icon-link-name', s => s.replace('</main>', '<a href="/icon"><svg><path></path></svg></a></main>')],
  ['mobile-menu-aria-expanded', s => s.replace(' aria-expanded="false"', '')],
  ['aria-controls-target', s => s.replace('aria-controls="mobileMenu"', 'aria-controls="missing"')],
  ['duplicate-id', s => s.replace('</main>', '<div id="name"></div></main>')],
  ['form-control-name', s => s.replace('<label for="name">Name</label>', '')],
  ['label-target', s => s.replace('for="name"', 'for="missing"')],
  ['table-th-scope', s => s.replace(' scope="col"', '')],
  ['gallery-dot-current', s => s.replace('aria-current="false"', 'aria-current="true"')],
  ['skip-target', s => s.replace('href="#main-content"', 'href="#missing"')],
  ['target-blank-rel', s => s.replace('</main>', '<a href="https://example.com" target="_blank">External</a></main>')],
  ['positive-tabindex', s => s.replace('<input id="name"', '<input tabindex="1" id="name"')],
  ['empty-href', s => s.replace('href="/icon"', 'href="#"').replace('</main>', '<a href="#">Empty</a></main>')],
  ['javascript-href', s => s.replace('</main>', '<a href="javascript:void(0)">Bad</a></main>')]
  ,['invalid-table-structure', s => s.replace('<thead>', '<th scope="col"ead>')]
  ,['invalid-table-structure', s => s.replace('<thead>', '')]
  ,['table-th-scope-context', s => s.replace('<th scope="col">Item</th>', '<th scope="row">Item</th>')]
  ,['table-th-scope-context', s => s.replace('<th scope="row">A</th>', '<th scope="col">A</th>')]
  ,['duplicate-attribute', s => s.replace('<main id="main-content">', '<main id="main-content"><svg focusable="false" focusable="false"></svg>')]
];
for (const [code, mutate] of cases) {
  const found = checkHtml(mutate(valid())).map(error => error.code);
  assert(found.includes(code), `${code} fixture returned: ${found.join(', ')}`);
}
assert.deepEqual(checkHtml(valid('en')), [], 'valid English page should pass');
assert.deepEqual(checkHtml(valid('zh-CN')), [], 'valid Chinese page should pass');
const correctColumnHeader = valid().replace('<tbody><tr><th scope="row">A</th></tr></tbody>', '<tbody><tr><td>A</td></tr></tbody>');
assert.deepEqual(checkHtml(correctColumnHeader), [], 'correct thead column header should pass');
const correctRowHeader = valid().replace('<thead><tr><th scope="col">Item</th></tr></thead>', '');
assert.deepEqual(checkHtml(correctRowHeader), [], 'correct tbody row header should pass');
const valid404 = valid()
  .replace('class="active" aria-current="page" href="/"', 'href="/"')
  .replace('</nav><button', '</nav><a class="lang-switch active" href="/">EN</a><button');
assert.deepEqual(checkHtml(valid404, '404.html'), [], '404 local skip target and non-current language link should pass');
assert(checkHtml(valid404.replace('href="#main-content"', 'href="https://example.com/#main-content"'), '404.html').some(error => error.code === 'skip-target-page'), 'cross-page skip target should report skip-target-page');
assert(checkHtml(valid404.replace('class="lang-switch active" href="/"', 'class="lang-switch active" href="/" aria-current="page"'), '404.html').some(error => error.code === 'current-page-target'), '404 homepage language link must not be current page');
console.log(`Accessibility checker fixtures passed: ${cases.length + 2} failures and 5 valid structure/page cases.`);
