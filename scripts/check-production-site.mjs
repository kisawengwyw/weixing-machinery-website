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

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
}
function tags(html, name) { return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || []; }
function normalized(url) {
  const u = new URL(url); u.hash = '';
  if (!u.search && !u.pathname.endsWith('/') && !u.pathname.split('/').pop().includes('.')) u.pathname += '/';
  return u.href;
}
function issue(level, type, source, url, response, detail) {
  return { level, type, source, url, finalUrl: response?.url || '', status: response?.status || 0, detail };
}

export class HealthAudit {
  constructor(options = {}) {
    this.origin = options.origin || PRODUCTION_ORIGIN;
    this.fetch = options.fetch || globalThis.fetch;
    this.timeout = options.timeout || 15000;
    this.verbose = Boolean(options.verbose);
    this.errors = []; this.warnings = []; this.pages = new Map(); this.resources = new Set();
    this.counts = { sitemap: 0, html: 0, resources: 0, redirects: 0, pairs: 0, missing: 0, forms: 0 };
  }
  add(level, type, source, url, response, detail) {
    (level === 'ERROR' ? this.errors : this.warnings).push(issue(level, type, source, url, response, detail));
  }
  async request(url, { method = 'GET', redirects = true } = {}) {
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.fetch(url, { method, redirect: redirects ? 'follow' : 'manual', signal: AbortSignal.timeout(this.timeout), headers: { 'User-Agent': UA, Accept: '*/*' }, credentials: 'omit' });
        if (method === 'HEAD' && FALLBACK.has(response.status)) return this.request(url, { method: 'GET', redirects });
        if (method === 'GET' && (response.status === 403 || response.status === 429)) this.add('WARNING', 'unverified', url, url, response, `GET returned ${response.status}; availability was not treated as permanently broken`);
        return response;
      } catch (error) { last = error; }
    }
    throw last;
  }
  async redirect(start, expected = `${this.origin}/`) {
    const chain = []; let current = start;
    for (let n = 0; n <= 5; n++) {
      let response;
      try { response = await this.request(current, { redirects: false }); }
      catch (e) { this.add('ERROR', 'redirect-network', start, current, null, e.message); return; }
      const location = response.headers.get('location'); chain.push({ url: current, status: response.status, location });
      if (response.status < 300 || response.status >= 400 || !location) {
        this.counts.redirects++;
        if (normalized(current) !== normalized(expected)) this.add('ERROR', 'redirect-target', start, current, response, `Expected ${expected}; chain ${JSON.stringify(chain)}`);
        if (this.verbose) console.log('REDIRECT', start, chain);
        return;
      }
      current = new URL(location, current).href;
      if (chain.some((step) => step.url === current)) { this.add('ERROR', 'redirect-loop', start, current, response, JSON.stringify(chain)); return; }
      const host = new URL(current).hostname;
      if (this.origin === PRODUCTION_ORIGIN && host !== 'www.weixingmachinery.com') { this.add('ERROR', 'redirect-host', start, current, response, `Unexpected redirect host ${host}`); return; }
    }
    this.add('ERROR', 'redirect-chain', start, current, null, 'Redirect chain exceeds 5 steps');
  }
  parsePage(html, pageUrl) {
    const links = tags(html, 'link');
    const canonical = links.find((t) => /\brel\s*=\s*["'][^"']*canonical/i.test(t));
    const alternates = Object.fromEntries(links.filter((t) => /\brel\s*=\s*["'][^"']*alternate/i.test(t)).map((t) => [attr(t, 'hreflang'), attr(t, 'href')]));
    const resourceValues = [];
    const resourceLinks = links.filter((t) => /\brel\s*=\s*["'][^"']*(?:stylesheet|icon|preload|apple-touch-icon)/i.test(t));
    for (const tag of [...resourceLinks, ...tags(html, 'script'), ...tags(html, 'img'), ...tags(html, 'source'), ...tags(html, 'video')]) {
      for (const name of ['src', 'href', 'poster']) { const value = attr(tag, name); if (value) resourceValues.push(value); }
      for (const name of ['srcset']) { const value = attr(tag, name); if (value) resourceValues.push(...value.split(',').map((x) => x.trim().split(/\s+/)[0])); }
    }
    return { canonical: canonical && attr(canonical, 'href'), alternates, resources: resourceValues.map((v) => { try { return new URL(v, pageUrl).href; } catch { return null; } }).filter(Boolean) };
  }
  async checkPage(url, source = 'sitemap', expectedText) {
    let response;
    try { response = await this.request(url); } catch (e) { this.add('ERROR', 'page-network', source, url, null, e.message); return; }
    const html = await response.text(); const contentType = response.headers.get('content-type') || '';
    if (response.status === 403 || response.status === 429) return;
    if (response.status !== 200) this.add('ERROR', 'page-status', source, url, response, 'Expected HTTP 200');
    if (!/text\/html/i.test(contentType)) this.add('ERROR', 'page-content-type', source, url, response, `Expected text/html, got ${contentType}`);
    if (!html.trim()) this.add('ERROR', 'empty-page', source, url, response, 'HTML body is empty');
    if (!/<title\b[^>]*>\s*[^<]+/i.test(html)) this.add('ERROR', 'missing-title', source, url, response, 'Missing non-empty title');
    if (tags(html, 'h1').length !== 1) this.add('ERROR', 'h1', source, url, response, `Expected one H1, found ${tags(html, 'h1').length}`);
    if (/<meta\b[^>]*(?:name=["']robots["'][^>]*content=["'][^"']*noindex|content=["'][^"']*noindex[^>]*name=["']robots)/i.test(html)) this.add('ERROR', 'noindex', source, url, response, 'Indexable page contains noindex');
    for (const pattern of BAD_BODY) if (pattern.test(html)) this.add('ERROR', 'server-error-body', source, url, response, `Matched ${pattern}`);
    if (/(?:<title[^>]*>[^<]*404|<h1[^>]*>\s*(?:404|page not found))/i.test(html)) this.add('ERROR', 'unexpected-404-body', source, url, response, 'Indexable page looks like a 404');
    const parsed = this.parsePage(html, response.url || url);
    if (!parsed.canonical) this.add('ERROR', 'canonical', source, url, response, 'Missing canonical');
    else if (normalized(parsed.canonical) !== normalized(response.url || url) || (this.origin === PRODUCTION_ORIGIN && !parsed.canonical.startsWith(`${PRODUCTION_ORIGIN}/`))) this.add('ERROR', 'canonical', source, url, response, `Canonical ${parsed.canonical} does not match final URL`);
    for (const lang of ['en', 'zh-CN', 'x-default']) if (!parsed.alternates[lang]) this.add('ERROR', 'hreflang', source, url, response, `Missing ${lang}`);
    if (expectedText && !expectedText.some((x) => html.toLowerCase().includes(x.toLowerCase()))) this.add('ERROR', 'key-content', source, url, response, `Expected one of: ${expectedText.join(', ')}`);
    for (const resource of parsed.resources) {
      const u = new URL(resource); if (u.origin !== new URL(this.origin).origin || /(?:whatsapp|wa\.me)/i.test(resource)) continue;
      if (/\/zh\/assets\/|-w480-w480/i.test(u.pathname)) this.add('ERROR', 'resource-path', url, resource, response, 'Known broken resource path pattern');
      this.resources.add(resource);
    }
    for (const tag of tags(html, 'form')) { const action = attr(tag, 'action'); if (action) this.formEndpoints ??= new Set(), this.formEndpoints.add(new URL(action, url).href); }
    this.pages.set(url, { response, html, parsed }); this.counts.html++;
  }
  async checkResource(url) {
    let response; try { response = await this.request(url, { method: 'HEAD' }); } catch (e) { this.add('ERROR', 'resource-network', 'HTML', url, null, e.message); return; }
    if (response.status === 403 || response.status === 429) return;
    if (response.status !== 200) this.add('ERROR', 'resource-status', 'HTML', url, response, 'Expected HTTP 200');
    let type = response.headers.get('content-type') || ''; let length = Number(response.headers.get('content-length'));
    if (length === 0) {
      response = await this.request(url); type = response.headers.get('content-type') || type;
      length = (await response.arrayBuffer()).byteLength;
    }
    if (/text\/html/i.test(type)) this.add('ERROR', 'resource-html', 'HTML', url, response, 'Static resource returned HTML');
    if (Number.isFinite(length) && length === 0) this.add('ERROR', 'resource-empty', 'HTML', url, response, 'Static resource is empty');
    this.counts.resources++;
  }
  async sitemap() {
    const url = `${this.origin}/sitemap.xml`; let response;
    try { response = await this.request(url); } catch (e) { this.add('ERROR', 'sitemap-network', 'sitemap', url, null, e.message); return []; }
    const xml = await response.text(); if (response.status !== 200) this.add('ERROR', 'sitemap-status', 'sitemap', url, response, 'Expected HTTP 200');
    for (const p of BAD_BODY) if (p.test(xml)) this.add('ERROR', 'sitemap-error-body', 'sitemap', url, response, `Matched ${p}`);
    const urls = [...xml.matchAll(/<loc(?:\s[^>]*)?>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&').trim());
    const duplicates = urls.filter((x, i) => urls.indexOf(x) !== i); if (duplicates.length) this.add('ERROR', 'duplicate-sitemap-loc', 'sitemap', url, response, [...new Set(duplicates)].join(', '));
    for (const item of urls) if (!item.startsWith(`${this.origin}/`) || /404|github\.io/i.test(item)) this.add('ERROR', 'sitemap-url', 'sitemap', item, response, 'Sitemap URL is not a valid production URL');
    this.counts.sitemap = urls.length; return [...new Set(urls)];
  }
  async missing(url) {
    const response = await this.request(url); const html = await response.text(); const custom = /page not found|页面未找到|>\s*404\s*</i.test(html);
    if (response.status === 200 && custom) this.add('WARNING', 'soft-404', '404 audit', url, response, 'Custom 404 body returned HTTP 200; configure a real 404 status');
    else if (response.status !== 404 || !custom) this.add('ERROR', '404-page', '404 audit', url, response, 'Expected custom 404 response');
    for (const p of BAD_BODY) if (p.test(html)) this.add('ERROR', '404-server-template', '404 audit', url, response, `Matched ${p}`);
    const hrefs = tags(html, 'a').map((t) => attr(t, 'href')).filter(Boolean).map((x) => new URL(x, url).href);
    for (const required of [`${this.origin}/`, `${this.origin}/zh/`, `${this.origin}/products/`, `${this.origin}/contact/`]) if (!hrefs.some((x) => normalized(x) === normalized(required))) this.add('ERROR', '404-link', '404 audit', url, response, `Missing absolute-safe link to ${required}`);
    for (const resource of this.parsePage(html, response.url || url).resources) if (new URL(resource).origin === new URL(this.origin).origin) this.resources.add(resource);
    this.counts.missing++;
  }
  async endpoint(url) {
    const response = await this.request(url, { method: 'HEAD' });
    if (response.status === 404) this.add('ERROR', 'form-endpoint', 'contact form', url, response, 'Endpoint returned 404');
    else if (![200, 204, 405].includes(response.status) && response.status !== 403 && response.status !== 429) this.add('WARNING', 'form-endpoint', 'contact form', url, response, 'Endpoint existence is uncertain');
    this.counts.forms++;
  }
}

async function pool(items, limit, fn) { let cursor = 0; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (cursor < items.length) { const i = cursor++; await fn(items[i]); } })); }

export async function runAudit(options = {}) {
  const audit = new HealthAudit(options); const started = Date.now();
  const single = options.url;
  if (!single) {
    for (const start of ['http://weixingmachinery.com/', 'http://www.weixingmachinery.com/', 'https://weixingmachinery.com/', `${audit.origin}/`]) await audit.redirect(start);
  }
  const sitemapUrls = single ? [] : await audit.sitemap();
  const keys = new Map([
    [`${audit.origin}/`, ['hydraulic', '液压']], [`${audit.origin}/zh/`, ['液压']], [`${audit.origin}/products/`, ['products', '产品']], [`${audit.origin}/zh/products/`, ['产品']],
    [`${audit.origin}/contact/`, ['contact']], [`${audit.origin}/zh/contact/`, ['联系']], [`${audit.origin}/products/orfs-hydraulic-fittings/`, ['orfs']], [`${audit.origin}/zh/products/orfs-hydraulic-fittings/`, ['orfs']],
    [`${audit.origin}/products/custom-cnc-parts/`, ['cnc']], [`${audit.origin}/zh/products/custom-cnc-parts/`, ['cnc']],
  ]);
  const pageUrls = single ? [single] : [...new Set([...sitemapUrls, ...keys.keys()])];
  await pool(pageUrls, 5, (url) => audit.checkPage(url, sitemapUrls.includes(url) ? 'sitemap' : 'key page', keys.get(url)));
  if (!single) {
    const set = new Set(sitemapUrls);
    for (const url of sitemapUrls) {
      const u = new URL(url), chinese = u.pathname === '/zh/' || u.pathname.startsWith('/zh/');
      const counterpart = `${audit.origin}${chinese ? u.pathname.replace(/^\/zh/, '') || '/' : `/zh${u.pathname}`}`;
      if (!set.has(counterpart)) audit.add('ERROR', 'language-pair', 'sitemap', url, audit.pages.get(url)?.response, `Missing sitemap counterpart ${counterpart}`); else audit.counts.pairs += chinese ? 0 : 1;
      const page = audit.pages.get(url); if (page) {
        const expectedEn = chinese ? counterpart : url, expectedZh = chinese ? url : counterpart;
        if (page.parsed.alternates.en && normalized(page.parsed.alternates.en) !== normalized(expectedEn)) audit.add('ERROR', 'hreflang-target', url, page.parsed.alternates.en, page.response, `Expected ${expectedEn}`);
        if (page.parsed.alternates['zh-CN'] && normalized(page.parsed.alternates['zh-CN']) !== normalized(expectedZh)) audit.add('ERROR', 'hreflang-target', url, page.parsed.alternates['zh-CN'], page.response, `Expected ${expectedZh}`);
        if (page.parsed.alternates['x-default'] && normalized(page.parsed.alternates['x-default']) !== normalized(expectedEn)) audit.add('ERROR', 'hreflang-target', url, page.parsed.alternates['x-default'], page.response, `Expected ${expectedEn}`);
      }
    }
    for (const resource of ['/favicon.ico','/favicon.svg','/apple-touch-icon.png','/css/style.css','/js/main.js','/assets/images/logo.svg']) audit.resources.add(audit.origin + resource);
    await pool(['/health-check-missing-page/','/a/b/health-check-missing/','/zh/a/b/health-check-missing/'].map((x) => audit.origin + x), 3, (url) => audit.missing(url));
    await pool([...audit.resources], 5, (url) => audit.checkResource(url));
    await pool([...(audit.formEndpoints || [])].filter((x) => new URL(x).origin === new URL(audit.origin).origin && /\.php(?:$|\?)/i.test(x)), 5, (url) => audit.endpoint(url));
  }
  return { audit, duration: Date.now() - started };
}

export function printReport({ audit, duration }) {
  console.log('Production health audit'); console.log(`Timestamp UTC: ${new Date().toISOString()}`);
  console.log(`Sitemap pages: ${audit.counts.sitemap}\nHTML pages checked: ${audit.counts.html}\nResources checked: ${audit.counts.resources}\nRedirects checked: ${audit.counts.redirects}\nLanguage pairs checked: ${audit.counts.pairs}\n404 URLs checked: ${audit.counts.missing}\nForm endpoints checked: ${audit.counts.forms}\nErrors: ${audit.errors.length}\nWarnings: ${audit.warnings.length}\nDuration: ${(duration / 1000).toFixed(2)}s`);
  for (const item of [...audit.errors, ...audit.warnings]) console.log(`\n${item.level} [${item.type}]\nSource: ${item.source}\nURL: ${item.url}\nFinal URL: ${item.finalUrl}\nStatus: ${item.status}\nDetail: ${item.detail}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); const index = args.indexOf('--url');
  if (index >= 0 && (!args[index + 1] || !args[index + 1].startsWith(`${PRODUCTION_ORIGIN}/`))) { console.error('--url must be a URL on the production origin'); process.exit(2); }
  const result = await runAudit({ verbose: args.includes('--verbose'), url: index >= 0 ? args[index + 1] : undefined }); printReport(result); process.exitCode = result.audit.errors.length ? 1 : 0;
}
