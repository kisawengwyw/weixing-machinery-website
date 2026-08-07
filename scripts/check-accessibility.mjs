import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const attr = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(v => v !== undefined);
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(m => m[0]);
const textOf = value => value.replace(/<svg\b[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, '').replace(/&(?:nbsp|#160);/gi, ' ').trim();
const openingTags = html => [...html.matchAll(/<[a-z][a-z0-9:-]*\b[^>]*>/gi)].map(match => match[0]);

function checkTable(table, add) {
  const lower = table.toLowerCase();
  if (/<th\b[^>]*\bscope\s*=\s*["'](?:col|row)["']ead\b/i.test(table)) {
    add('invalid-table-structure', 'thead was parsed as a malformed th element');
  }
  const counts = (name) => [
    (lower.match(new RegExp(`<${name}\\b`, 'g')) || []).length,
    (lower.match(new RegExp(`</${name}\\s*>`, 'g')) || []).length,
  ];
  const [theadOpen, theadClose] = counts('thead');
  const [tbodyOpen, tbodyClose] = counts('tbody');
  if (theadOpen !== theadClose || tbodyOpen !== tbodyClose) add('invalid-table-structure', 'table section tags are unbalanced');

  const sections = [...lower.matchAll(/<\/?(thead|tbody)\b[^>]*>/g)];
  const stack = [];
  let lastSection = '';
  for (const match of sections) {
    const closing = match[0].startsWith('</');
    if (!closing) {
      if (stack.length || (match[1] === 'thead' && lastSection === 'tbody')) add('invalid-table-structure', 'table section order is invalid');
      stack.push(match[1]);
      lastSection = match[1];
    } else if (stack.pop() !== match[1]) add('invalid-table-structure', `unmatched closing ${match[1]}`);
  }
  if (stack.length) add('invalid-table-structure', 'table section is not closed');

  for (const match of table.matchAll(/<thead\b[^>]*>([\s\S]*?)<\/thead>/gi)) {
    for (const th of tags(match[1], 'th')) if (attr(th, 'scope') !== 'col') add('table-th-scope-context', 'thead th must use scope="col"');
  }
  for (const match of table.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)) {
    for (const th of tags(match[1], 'th')) if (attr(th, 'scope') !== 'row') add('table-th-scope-context', 'tbody row header th must use scope="row"');
  }
}

export function checkHtml(html, file = 'fixture.html') {
  const errors = [];
  const add = (code, message) => errors.push({ code, file, message });
  const ids = new Map();
  for (const tag of openingTags(html)) {
    if (/(?:="[^"]*"|='[^']*')[A-Za-z_:][\w:.-]*/.test(tag)) add('malformed-html-attribute', 'attribute must be followed by whitespace or the tag end');
    const names = [...tag.matchAll(/\s([A-Za-z_:][\w:.-]*)\s*(?==|\/?>)/g)].map(match => match[1].toLowerCase());
    const seen = new Set();
    for (const name of names) {
      if (seen.has(name)) add('duplicate-attribute', `opening tag repeats attribute: ${name}`);
      seen.add(name);
    }
  }
  for (const tag of tags(html, '[a-z][a-z0-9-]*')) {
    const id = attr(tag, 'id');
    if (id) ids.set(id, (ids.get(id) || 0) + 1);
  }
  if (!attr(tags(html, 'html')[0] || '', 'lang')) add('html-lang', 'html element needs lang');
  if ((html.match(/<h1\b/gi) || []).length !== 1) add('h1-count', 'page must contain exactly one h1');
  for (const tag of tags(html, 'img')) if (attr(tag, 'alt') === undefined) add('img-alt', 'img needs alt');
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    if (!attr(match[0], 'aria-label') && !attr(match[0], 'aria-labelledby') && !textOf(match[2])) add('button-name', 'button needs an accessible name');
  }
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const tag = match[0], href = attr(tag, 'href');
    if (!textOf(match[2]) && !attr(tag, 'aria-label') && !attr(tag, 'aria-labelledby') && !attr(tags(match[2], 'img')[0] || '', 'alt')) add('icon-link-name', 'icon-only link needs aria-label');
    if (attr(tag, 'target') === '_blank') {
      const rel = (attr(tag, 'rel') || '').split(/\s+/);
      if (!rel.includes('noopener') || !rel.includes('noreferrer')) add('target-blank-rel', 'target=_blank needs noopener noreferrer');
    }
    if (href === '#') add('empty-href', 'href="#" is not allowed');
    if (/^javascript:/i.test(href || '')) add('javascript-href', 'javascript: href is not allowed');
    if (/\bactive\b/.test(attr(tag, 'class') || '') && attr(tag, 'aria-current') !== 'page') add('current-link', 'active link needs aria-current="page"');
  }
  const menuButton = tags(html, 'button').find(tag => attr(tag, 'id') === 'mobileMenuBtn');
  if (menuButton) for (const name of ['aria-expanded', 'aria-controls', 'aria-label']) if (attr(menuButton, name) === undefined) add(`mobile-menu-${name}`, `mobile menu button needs ${name}`);
  const menu = tags(html, 'div').find(tag => attr(tag, 'id') === 'mobileMenu');
  if (menu && attr(menu, 'aria-hidden') === undefined) add('mobile-menu-hidden', 'mobileMenu needs aria-hidden');
  for (const tag of tags(html, 'nav')) if (!attr(tag, 'aria-label') && !attr(tag, 'aria-labelledby')) add('nav-name', 'nav needs an accessible name');
  if ((html.match(/<main\b/gi) || []).length !== 1) add('main-count', 'page must contain exactly one main');
  const skip = [...html.matchAll(/<a\b[^>]*class="[^"]*\bskip-link\b[^"]*"[^>]*>/gi)][0]?.[0];
  if (!skip) add('skip-link', 'page needs a skip link');
  else {
    const target = (attr(skip, 'href') || '').split('#')[1] || '';
    if (!target || !ids.has(target)) add('skip-target', 'skip link target does not exist');
  }
  for (const [id, count] of ids) if (count > 1) add('duplicate-id', `duplicate id: ${id}`);
  for (const label of html.matchAll(/<label\b[^>]*>/gi)) {
    const target = attr(label[0], 'for');
    if (target && !ids.has(target)) add('label-target', `label target does not exist: ${target}`);
  }
  const labels = new Set([...html.matchAll(/<label\b[^>]*>/gi)].map(m => attr(m[0], 'for')).filter(Boolean));
  for (const tag of [...tags(html, 'input'), ...tags(html, 'select'), ...tags(html, 'textarea')]) {
    if ((attr(tag, 'type') || '').toLowerCase() === 'hidden') continue;
    const id = attr(tag, 'id');
    if (!(id && labels.has(id)) && !attr(tag, 'aria-label') && !attr(tag, 'aria-labelledby')) add('form-control-name', 'form control needs a label');
  }
  for (const tag of tags(html, 'th')) if (!['col', 'row'].includes(attr(tag, 'scope'))) add('table-th-scope', 'th needs scope="col" or scope="row"');
  for (const table of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) checkTable(table[0], add);
  const tableOpen = (html.match(/<table\b/gi) || []).length;
  const tableClose = (html.match(/<\/table\s*>/gi) || []).length;
  if (tableOpen !== tableClose) add('invalid-table-structure', 'table tags are unbalanced');
  for (const tag of tags(html, 'button').filter(t => /gallery-(?:prev|next|dot)/.test(attr(t, 'class') || ''))) if (!attr(tag, 'aria-label')) add('gallery-control-name', 'gallery control needs aria-label');
  const dots = tags(html, 'button').filter(t => /\bgallery-dot\b/.test(attr(t, 'class') || ''));
  for (const dot of dots) {
    const active = /\bactive\b/.test(attr(dot, 'class') || '');
    if (attr(dot, 'aria-current') !== String(active)) add('gallery-dot-current', 'gallery dot aria-current must match active state');
  }
  for (const tag of tags(html, '[a-z][a-z0-9-]*')) {
    const tabindex = attr(tag, 'tabindex');
    if (tabindex && Number(tabindex) > 0) add('positive-tabindex', 'positive tabindex is not allowed');
    for (const name of ['aria-controls', 'aria-describedby']) {
      for (const target of (attr(tag, name) || '').split(/\s+/).filter(Boolean)) if (!ids.has(target)) add(`${name}-target`, `${name} target does not exist: ${target}`);
    }
  }
  return errors;
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z', '--', '*.html'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const errors = files.flatMap(file => checkHtml(readFileSync(file, 'utf8'), file));
  if (errors.length) {
    for (const error of errors) console.error(`${error.file}: [${error.code}] ${error.message}`);
    console.error(`Accessibility check failed with ${errors.length} error(s) across ${files.length} public HTML pages.`);
    process.exitCode = 1;
  } else console.log(`Accessibility check passed: ${files.length} public HTML pages, 0 errors.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
