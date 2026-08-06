#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export const PRODUCTION_ORIGIN = 'https://www.weixingmachinery.com';
const UA = 'WeixingProductionHealthCheck/1.0';
const FALLBACK = new Set([403, 405, 429]);
const BAD_BODY = [
  /website is suspended/i, /domain is not pointing/i, /hostinger[^<]{0,80}(?:error|default)/i,
  /(?:error 403|error 500|bad gateway|service unavailable|php fatal error|parse error|database connection error)/i,
  /warning:\s*(?:include|require|mysqli|pdo|undefined|failed)/i, /stack trace:/i,
  /there isn't a github pages site here/i, /余姚市我们有限公司/,
];
const MIME = new Map([
  ['.css', [/^text\/css$/i]],
  ['.js', [/^(?:text|application)\/javascript$/i, /^application\/x-javascript$/i]],
  ['.mjs', [/^(?:text|application)\/javascript$/i, /^application\/x-javascript$/i]],
  ['.webp', [/^image\/webp$/i]], ['.png', [/^image\/png$/i]],
  ['.jpg', [/^image\/jpeg$/i]], ['.jpeg', [/^image\/jpeg$/i]], ['.gif', [/^image\/gif$/i]],
  ['.svg', [/^image\/svg\+xml$/i]],
  ['.ico', [/^image\/(?:x-icon|vnd\.microsoft\.icon)$/i]],
]);
const FONT_EXTENSIONS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);

function attr(tag, name) { return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]; }
function tags(html, name) { return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || []; }
function extension(url) { return new URL(url).pathname.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() || ''; }
function issue(level, type, source, url, response, detail) {
  return { level, type, source, url, finalUrl: response?.url || '', status: response?.status || 0, detail };
}
export function safeUrl(raw, base) { try { return new URL(raw, base); } catch { return null; } }
export function safeNormalized(raw, base) {
  const url = safeUrl(raw, base); if (!url) return null;
  url.hash = '';
  if (!url.search && !url.pathname.endsWith('/') && !url.pathname.split('/').pop().includes('.')) url.pathname += '/';
  return url.href;
}

export class HealthAudit {
  constructor(options = {}) {
    this.origin = options.origin || PRODUCTION_ORIGIN;
    this.fetch = options.fetch || globalThis.fetch;
    this.timeout = options.timeout || 15000;
    this.verbose = Boolean(options.verbose);
    this.errors = []; this.warnings = []; this.pages = new Map(); this.resources = new Set(); this.formEndpoints = new Set();
    this.counts = { sitemap: 0, html: 0, resources: 0, redirects: 0, pairs: 0, missing: 0, forms: 0 };
  }
  add(level, type, source, url, response, detail) { (level === 'ERROR' ? this.errors : this.warnings).push(issue(level, type, source, url, response, detail)); }
  async request(url, { method = 'GET', redirects = true } = {}) {
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.fetch(url, { method, redirect: redirects ? 'follow' : 'manual', signal: AbortSignal.timeout(this.timeout), headers: { 'User-Agent': UA, Accept: '*/*' }, credentials: 'omit' });
        if (method === 'HEAD' && FALLBACK.has(response.status)) return this.request(url, { method: 'GET', redirects });
        if (method === 'GET' && (response.status === 403 || response.status === 429)) this.add('WARNING', 'unverified', url, url, response, `GET returned ${response.status}; availability is unverified`);
        return response;
      } catch (error) { last = error; }
    }
    throw last;
  }
  async redirect(start, expected = `${this.origin}/`) {
    const chain = []; let current = start; const allowed = new Set(['weixingmachinery.com', 'www.weixingmachinery.com']);
    for (let redirects = 0; redirects <= 5; redirects++) {
      const parsed = safeUrl(current);
      if (!parsed) { this.add('ERROR', 'redirect-location', start, current, null, 'Redirect URL is malformed'); return; }
      if (parsed.username || parsed.password) { this.add('ERROR', 'redirect-credentials', start, current, null, 'Credentials are forbidden in redirects'); return; }
      if (this.origin === PRODUCTION_ORIGIN && (!['http:', 'https:'].includes(parsed.protocol) || !allowed.has(parsed.hostname))) {
        this.add('ERROR', 'redirect-host', start, current, null, `Unexpected redirect destination ${parsed.origin}`); return;
      }
      let response;
      try { response = await this.request(parsed.href, { redirects: false }); }
      catch (error) { this.add('ERROR', 'redirect-network', start, parsed.href, null, error.message); return; }
      const location = response.headers.get('location'); chain.push({ url: parsed.href, status: response.status, location });
      if (!(response.status >= 300 && response.status < 400 && location)) {
        this.counts.redirects++;
        if (safeNormalized(parsed.href) !== safeNormalized(expected)) this.add('ERROR', 'redirect-target', start, parsed.href, response, `Expected ${expected}; chain ${JSON.stringify(chain)}`);
        if (this.verbose) console.log('REDIRECT', start, chain);
        return;
      }
      const next = safeUrl(location, parsed.href);
      if (!next) { this.add('ERROR', 'redirect-location', start, location, response, 'Location header is malformed'); return; }
      if (chain.some((step) => step.url === next.href)) { this.add('ERROR', 'redirect-loop', start, next.href, response, JSON.stringify(chain)); return; }
      current = next.href;
    }
    this.add('ERROR', 'redirect-chain', start, current, null, 'Redirect chain exceeds 5 redirects');
  }
  parsePage(html) {
    const links = tags(html, 'link');
    const canonicalTag = links.find((tag) => /\brel\s*=\s*["'][^"']*canonical/i.test(tag));
    const alternates = Object.fromEntries(links.filter((tag) => /\brel\s*=\s*["'][^"']*alternate/i.test(tag)).map((tag) => [attr(tag, 'hreflang'), attr(tag, 'href')]));
    const resourceLinks = links.filter((tag) => /\brel\s*=\s*["'][^"']*(?:stylesheet|icon|preload|apple-touch-icon)/i.test(tag));
    const resources = [];
    for (const tag of [...resourceLinks, ...tags(html, 'script'), ...tags(html, 'img'), ...tags(html, 'source'), ...tags(html, 'video')]) {
      for (const name of ['src', 'href', 'poster']) { const value = attr(tag, name); if (value) resources.push(value); }
      const srcset = attr(tag, 'srcset'); if (srcset) resources.push(...srcset.split(',').map((item) => item.trim().split(/\s+/)[0]));
    }
    return { canonical: canonicalTag && attr(canonicalTag, 'href'), alternates, resources };
  }
  validateLanguageTargets(url, page, expectedEn, expectedZh) {
    for (const [lang, expected] of [['en', expectedEn], ['zh-CN', expectedZh], ['x-default', expectedEn]]) {
      const raw = page.parsed.alternates[lang]; if (!raw) continue;
      const actual = safeNormalized(raw, page.response.url || url);
      if (!actual) this.add('ERROR', 'invalid-hreflang-url', url, raw, page.response, `${lang} hreflang is malformed`);
      else if (actual !== safeNormalized(expected)) this.add('ERROR', 'hreflang-target', url, raw, page.response, `Expected ${expected}`);
    }
  }
  async checkPage(url, source = 'sitemap', expectedText) {
    let response;
    try { response = await this.request(url); } catch (error) { this.add('ERROR', 'page-network', source, url, null, error.message); return; }
    let html; try { html = await response.text(); } catch (error) { this.add('ERROR', 'page-network', source, url, response, `Could not read body: ${error.message}`); return; }
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 403 || response.status === 429) return;
    if (response.status !== 200) this.add('ERROR', 'page-status', source, url, response, 'Expected HTTP 200');
    if (!/text\/html/i.test(contentType)) this.add('ERROR', 'page-content-type', source, url, response, `Expected text/html, got ${contentType || '(missing)'}`);
    if (!html.trim()) this.add('ERROR', 'empty-page', source, url, response, 'HTML body is empty');
    if (!/<title\b[^>]*>\s*[^<]+/i.test(html)) this.add('ERROR', 'missing-title', source, url, response, 'Missing non-empty title');
    if (tags(html, 'h1').length !== 1) this.add('ERROR', 'h1', source, url, response, `Expected one H1, found ${tags(html, 'h1').length}`);
    if (/<meta\b[^>]*(?:name=["']robots["'][^>]*content=["'][^"']*noindex|content=["'][^"']*noindex[^>]*name=["']robots)/i.test(html)) this.add('ERROR', 'noindex', source, url, response, 'Indexable page contains noindex');
    for (const pattern of BAD_BODY) if (pattern.test(html)) this.add('ERROR', 'server-error-body', source, url, response, `Matched ${pattern}`);
    if (/(?:<title[^>]*>[^<]*404|<h1[^>]*>\s*(?:404|page not found))/i.test(html)) this.add('ERROR', 'unexpected-404-body', source, url, response, 'Indexable page looks like a 404');
    const parsed = this.parsePage(html); const base = response.url || url;
    if (!parsed.canonical) this.add('ERROR', 'canonical', source, url, response, 'Missing canonical');
    else {
      const canonical = safeNormalized(parsed.canonical, base);
      if (!canonical) this.add('ERROR', 'invalid-canonical-url', source, parsed.canonical, response, 'Canonical URL is malformed');
      else if (canonical !== safeNormalized(base) || (this.origin === PRODUCTION_ORIGIN && !canonical.startsWith(`${PRODUCTION_ORIGIN}/`))) this.add('ERROR', 'canonical', source, url, response, `Canonical ${canonical} does not match final URL`);
    }
    if (source === 'sitemap' && safeNormalized(url) !== safeNormalized(base)) this.add('ERROR', 'sitemap-final-url', source, url, response, `Sitemap URL redirected to ${base}`);
    for (const lang of ['en', 'zh-CN', 'x-default']) {
      if (!parsed.alternates[lang]) this.add('ERROR', 'hreflang', source, url, response, `Missing ${lang}`);
      else if (!safeUrl(parsed.alternates[lang], base)) this.add('ERROR', 'invalid-hreflang-url', source, parsed.alternates[lang], response, `${lang} hreflang is malformed`);
    }
    if (expectedText && !expectedText.some((text) => html.toLowerCase().includes(text.toLowerCase()))) this.add('ERROR', 'key-content', source, url, response, `Expected one of: ${expectedText.join(', ')}`);
    const origin = safeUrl(this.origin);
    for (const raw of parsed.resources) {
      const resource = safeUrl(raw, base);
      if (!resource) { this.add('ERROR', 'invalid-resource-url', url, raw, response, 'Resource URL is malformed'); continue; }
      if (resource.origin !== origin.origin || /(?:whatsapp|wa\.me)/i.test(resource.href)) continue;
      if (/\/zh\/assets\/|-w480-w480/i.test(resource.pathname)) this.add('ERROR', 'resource-path', url, resource.href, response, 'Known broken resource path pattern');
      this.resources.add(resource.href);
    }
    for (const tag of tags(html, 'form')) {
      const raw = attr(tag, 'action'); if (!raw) continue; const action = safeUrl(raw, base);
      if (!action) this.add('ERROR', 'invalid-form-endpoint-url', url, raw, response, 'Form action is malformed'); else this.formEndpoints.add(action.href);
    }
    this.pages.set(url, { response, html, parsed }); this.counts.html++;
  }
  async checkResource(raw) {
    const url = safeUrl(raw);
    if (!url) { this.add('ERROR', 'invalid-resource-url', 'HTML', raw, null, 'Resource URL is malformed'); return; }
    let response;
    try { response = await this.request(url.href, { method: 'HEAD' }); }
    catch (error) { this.add('ERROR', 'resource-network', 'HTML', url.href, null, error.message); return; }
    if (response.status === 403 || response.status === 429) return;
    let type = (response.headers.get('content-type') || '').split(';')[0].trim(); let bodyBytes;
    let lengthHeader = response.headers.get('content-length'); let length = lengthHeader === null ? NaN : Number(lengthHeader);
    if (response.status !== 200 || !type || !Number.isFinite(length) || length <= 0) {
      try {
        response = await this.request(url.href); type = (response.headers.get('content-type') || '').split(';')[0].trim();
        bodyBytes = new Uint8Array(await response.arrayBuffer()); length = bodyBytes.byteLength;
      } catch (error) { this.add('ERROR', 'resource-network', 'HTML', url.href, response, `GET fallback failed: ${error.message}`); return; }
    }
    if (response.status === 403 || response.status === 429) return;
    if (response.status !== 200) this.add('ERROR', 'resource-status', 'HTML', url.href, response, 'Expected HTTP 200');
    if (/text\/html/i.test(type)) this.add('ERROR', 'resource-html', 'HTML', url.href, response, 'Static resource returned HTML');
    else if (bodyBytes && /^\s*(?:<!doctype\s+html|<html\b)/i.test(new TextDecoder().decode(bodyBytes.slice(0, 512)))) this.add('ERROR', 'resource-html', 'HTML', url.href, response, 'Static resource body contains HTML');
    if (!length) this.add('ERROR', 'resource-empty', 'HTML', url.href, response, 'Static resource is empty');
    const ext = extension(url.href); const expected = MIME.get(ext);
    if (expected && !expected.some((pattern) => pattern.test(type))) {
      if (ext === '.ico' && /^image\//i.test(type)) this.add('WARNING', 'resource-content-type', 'HTML', url.href, response, `Unusual icon Content-Type ${type}`);
      else this.add('ERROR', 'resource-content-type', 'HTML', url.href, response, `Expected ${ext} MIME type, got ${type || '(missing)'}`);
    } else if (FONT_EXTENSIONS.has(ext)) {
      if (type === 'application/octet-stream') this.add('WARNING', 'resource-content-type', 'HTML', url.href, response, `Generic font Content-Type ${type}`);
      else if (!/^(?:font\/|application\/(?:font-|vnd\.ms-fontobject))/i.test(type)) this.add('ERROR', 'resource-content-type', 'HTML', url.href, response, `Unexpected font Content-Type ${type || '(missing)'}`);
    }
    this.counts.resources++;
  }
  async sitemap() {
    const sitemapUrl = `${this.origin}/sitemap.xml`; let response;
    try { response = await this.request(sitemapUrl); } catch (error) { this.add('ERROR', 'sitemap-network', 'sitemap', sitemapUrl, null, error.message); return { validUrls: [], allLocs: [] }; }
    let xml; try { xml = await response.text(); } catch (error) { this.add('ERROR', 'sitemap-network', 'sitemap', sitemapUrl, response, error.message); return { validUrls: [], allLocs: [] }; }
    if (response.status !== 200) this.add('ERROR', 'sitemap-status', 'sitemap', sitemapUrl, response, 'Expected HTTP 200');
    const type = (response.headers.get('content-type') || '').toLowerCase();
    const hasUrlset = /^\s*(?:<\?xml\b[^?]*\?>\s*)?<urlset\b[^>]*>[\s\S]*<\/urlset\s*>\s*$/i.test(xml);
    if (/text\/html/i.test(type) || /^\s*(?:<!doctype\s+html|<html\b)/i.test(xml)) this.add('ERROR', 'sitemap-content-type', 'sitemap', sitemapUrl, response, 'Sitemap returned HTML');
    else if (!/^(?:application|text)\/xml(?:\s*;|$)/i.test(type)) {
      if (/^application\/octet-stream(?:\s*;|$)/i.test(type) && hasUrlset) this.add('WARNING', 'sitemap-content-type', 'sitemap', sitemapUrl, response, 'Valid XML served as application/octet-stream');
      else this.add('ERROR', 'sitemap-content-type', 'sitemap', sitemapUrl, response, `Unexpected Content-Type ${type || '(missing)'}`);
    }
    if (!xml.trim()) this.add('ERROR', 'sitemap-empty', 'sitemap', sitemapUrl, response, 'Sitemap body is empty');
    if (!hasUrlset) this.add('ERROR', 'sitemap-urlset', 'sitemap', sitemapUrl, response, 'Missing valid urlset root element');
    for (const pattern of BAD_BODY) if (pattern.test(xml)) this.add('ERROR', 'sitemap-error-body', 'sitemap', sitemapUrl, response, `Matched ${pattern}`);
    const allLocs = [...xml.matchAll(/<loc(?:\s[^>]*)?>\s*([^<]*)\s*<\/loc>/gi)].map((match) => match[1].replace(/&amp;/g, '&').trim()).filter(Boolean);
    if (!allLocs.length) this.add('ERROR', 'sitemap-loc', 'sitemap', sitemapUrl, response, 'Sitemap must contain at least one non-empty loc');
    const validUrls = []; const seen = new Map();
    for (const raw of allLocs) {
      const url = safeUrl(raw); let valid = true;
      if (!url) { this.add('ERROR', 'invalid-sitemap-url', 'sitemap', raw, response, 'loc is not a parseable URL'); continue; }
      const key = safeNormalized(url.href);
      if (seen.has(key)) { this.add('ERROR', 'duplicate-sitemap-loc', 'sitemap', raw, response, `Duplicates ${seen.get(key)}`); valid = false; } else seen.set(key, raw);
      if (url.protocol !== 'https:' || url.origin !== this.origin || url.username || url.password || url.hash || /404/i.test(url.pathname) || /github\.io/i.test(url.hostname)) {
        this.add('ERROR', 'sitemap-url', 'sitemap', raw, response, 'loc is not a safe canonical production URL'); valid = false;
      }
      if (valid) validUrls.push(url.href);
    }
    this.counts.sitemap = allLocs.length; return { validUrls, allLocs };
  }
  async missing(raw) {
    const url = safeUrl(raw); if (!url) { this.add('ERROR', 'invalid-404-url', '404 audit', raw, null, '404 test URL is malformed'); return; }
    let response; try { response = await this.request(url.href); } catch (error) { this.add('ERROR', '404-network', '404 audit', url.href, null, error.message); return; }
    let html; try { html = await response.text(); } catch (error) { this.add('ERROR', '404-network', '404 audit', url.href, response, error.message); return; }
    const custom = /page not found|页面未找到|>\s*404\s*</i.test(html);
    if (response.status === 200 && custom) this.add('WARNING', 'soft-404', '404 audit', url.href, response, 'Custom 404 body returned HTTP 200; configure a real 404 status');
    else if (response.status !== 404 || !custom) this.add('ERROR', '404-page', '404 audit', url.href, response, 'Expected custom 404 response');
    for (const pattern of BAD_BODY) if (pattern.test(html)) this.add('ERROR', '404-server-template', '404 audit', url.href, response, `Matched ${pattern}`);
    const hrefs = [];
    for (const rawHref of tags(html, 'a').map((tag) => attr(tag, 'href')).filter(Boolean)) {
      const href = safeUrl(rawHref, response.url || url.href); if (!href) this.add('ERROR', 'invalid-404-link', '404 audit', rawHref, response, '404 link is malformed'); else hrefs.push(href.href);
    }
    for (const required of [`${this.origin}/`, `${this.origin}/zh/`, `${this.origin}/products/`, `${this.origin}/contact/`]) if (!hrefs.some((href) => safeNormalized(href) === safeNormalized(required))) this.add('ERROR', '404-link', '404 audit', url.href, response, `Missing absolute-safe link to ${required}`);
    for (const rawResource of this.parsePage(html).resources) {
      const resource = safeUrl(rawResource, response.url || url.href); if (!resource) this.add('ERROR', 'invalid-resource-url', url.href, rawResource, response, '404 resource URL is malformed'); else if (resource.origin === safeUrl(this.origin).origin) this.resources.add(resource.href);
    }
    this.counts.missing++;
  }
  async endpoint(raw) {
    const url = safeUrl(raw); if (!url) { this.add('ERROR', 'invalid-form-endpoint-url', 'contact form', raw, null, 'Endpoint URL is malformed'); return; }
    let response; try { response = await this.request(url.href, { method: 'HEAD' }); }
    catch (error) { this.add('WARNING', 'form-endpoint-network', 'contact form', url.href, null, error.message); return; }
    if (response.status === 404) this.add('ERROR', 'form-endpoint', 'contact form', url.href, response, 'Endpoint returned 404');
    else if (![200, 204, 405, 403, 429].includes(response.status)) this.add('WARNING', 'form-endpoint', 'contact form', url.href, response, 'Endpoint existence is uncertain');
    this.counts.forms++;
  }
}

async function pool(items, limit, fn, audit, type = 'audit-task') {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const item = items[cursor++]; try { await fn(item); } catch (error) { audit.add('ERROR', type, 'audit', String(item), null, `Unexpected isolated error: ${error.message}`); } }
  }));
}

export async function runAudit(options = {}) {
  const audit = new HealthAudit(options); const started = Date.now(); const single = options.url;
  if (!single) for (const start of ['http://weixingmachinery.com/', 'http://www.weixingmachinery.com/', 'https://weixingmachinery.com/', `${audit.origin}/`]) await audit.redirect(start);
  const sitemapResult = single ? { validUrls: [], allLocs: [] } : await audit.sitemap(); const sitemapUrls = sitemapResult.validUrls;
  const keys = new Map([
    [`${audit.origin}/`, ['hydraulic', '液压']], [`${audit.origin}/zh/`, ['液压']], [`${audit.origin}/products/`, ['products', '产品']], [`${audit.origin}/zh/products/`, ['产品']],
    [`${audit.origin}/contact/`, ['contact']], [`${audit.origin}/zh/contact/`, ['联系']], [`${audit.origin}/products/orfs-hydraulic-fittings/`, ['orfs']], [`${audit.origin}/zh/products/orfs-hydraulic-fittings/`, ['orfs']],
    [`${audit.origin}/products/custom-cnc-parts/`, ['cnc']], [`${audit.origin}/zh/products/custom-cnc-parts/`, ['cnc']],
  ]);
  const pageUrls = single ? [single] : [...new Set([...sitemapUrls, ...keys.keys()])];
  await pool(pageUrls, 5, (url) => audit.checkPage(url, sitemapUrls.includes(url) ? 'sitemap' : 'key page', keys.get(url)), audit, 'page-task');
  if (!single) {
    const set = new Set(sitemapUrls.map((url) => safeNormalized(url)));
    for (const url of sitemapUrls) {
      const parsedUrl = safeUrl(url); if (!parsedUrl) continue; const chinese = parsedUrl.pathname === '/zh/' || parsedUrl.pathname.startsWith('/zh/');
      const counterpart = `${audit.origin}${chinese ? parsedUrl.pathname.replace(/^\/zh/, '') || '/' : `/zh${parsedUrl.pathname}`}`;
      if (!set.has(safeNormalized(counterpart))) audit.add('ERROR', 'language-pair', 'sitemap', url, audit.pages.get(url)?.response, `Missing sitemap counterpart ${counterpart}`); else audit.counts.pairs += chinese ? 0 : 1;
      const page = audit.pages.get(url); if (page) audit.validateLanguageTargets(url, page, chinese ? counterpart : url, chinese ? url : counterpart);
    }
    for (const resource of ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/css/style.css', '/js/main.js', '/assets/images/logo.svg']) audit.resources.add(audit.origin + resource);
    await pool(['/health-check-missing-page/', '/a/b/health-check-missing/', '/zh/a/b/health-check-missing/'].map((path) => audit.origin + path), 3, (url) => audit.missing(url), audit, '404-task');
  }
  await pool([...audit.resources], 5, (url) => audit.checkResource(url), audit, 'resource-task');
  const localOrigin = safeUrl(audit.origin)?.origin;
  const endpoints = [...audit.formEndpoints].filter((raw) => { const url = safeUrl(raw); return url && url.origin === localOrigin && /\.php$/i.test(url.pathname); });
  await pool(endpoints, 5, (url) => audit.endpoint(url), audit, 'form-endpoint-task');
  return { audit, duration: Date.now() - started };
}

export function printReport({ audit, duration }) {
  console.log('Production health audit'); console.log(`Timestamp UTC: ${new Date().toISOString()}`);
  console.log(`Sitemap pages: ${audit.counts.sitemap}\nHTML pages checked: ${audit.counts.html}\nResources checked: ${audit.counts.resources}\nRedirects checked: ${audit.counts.redirects}\nLanguage pairs checked: ${audit.counts.pairs}\n404 URLs checked: ${audit.counts.missing}\nForm endpoints checked: ${audit.counts.forms}\nErrors: ${audit.errors.length}\nWarnings: ${audit.warnings.length}\nDuration: ${(duration / 1000).toFixed(2)}s`);
  for (const item of [...audit.errors, ...audit.warnings]) console.log(`\n${item.level} [${item.type}]\nSource: ${item.source}\nURL: ${item.url}\nFinal URL: ${item.finalUrl}\nStatus: ${item.status}\nDetail: ${item.detail}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2); const index = args.indexOf('--url'); const raw = index >= 0 ? args[index + 1] : undefined; const page = raw && safeUrl(raw);
    if (index >= 0 && (!page || page.origin !== PRODUCTION_ORIGIN || page.username || page.password)) throw new Error('--url must be a safe URL on the production origin');
    const result = await runAudit({ verbose: args.includes('--verbose'), url: page?.href }); printReport(result); process.exitCode = result.audit.errors.length ? 1 : 0;
  } catch (error) { console.error(`Production health audit failed unexpectedly: ${error.message}`); process.exitCode = 1; }
}
