import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { HealthAudit, runAudit } from './check-production-site.mjs';

let origin; const requests = [];
const page = (path = '/', extraHead = '', extraBody = '') => `<!doctype html><html><head><title>Fixture</title><link rel="canonical" href="${origin}${path}"><link rel="alternate" hreflang="en" href="${origin}/"><link rel="alternate" hreflang="zh-CN" href="${origin}/zh/"><link rel="alternate" hreflang="x-default" href="${origin}/">${extraHead}</head><body><h1>Hydraulic products</h1>${extraBody}</body></html>`;
const links404 = '<a href="/">Home</a><a href="/zh/">中文</a><a href="/products/">Products</a><a href="/contact/">Contact</a>';
const server = http.createServer((req, res) => {
  requests.push(`${req.method} ${req.url}`);
  const send = (status, type, body = '', headers = {}) => { res.writeHead(status, { 'content-type': type, ...headers }); req.method === 'HEAD' ? res.end() : res.end(body); };
  if (req.url === '/') return send(200, 'text/html; charset=utf-8', page('/', '<link rel="stylesheet" href="/good.css"><script src="/good.js"></script><link rel="icon" href="/icon.png">', '<img src="/good.png" srcset="/good.png 1x"><form action="/rfq.php"></form>'));
  if (req.url === '/zh/') return send(200, 'text/html', page('/zh/').replace(`href="${origin}/"`, `href="${origin}/zh/"`));
  if (req.url === '/missing-title/') return send(200, 'text/html', page('/missing-title/').replace(/<title>.*?<\/title>/, ''));
  if (req.url === '/missing-h1/') return send(200, 'text/html', page('/missing-h1/').replace(/<h1>.*?<\/h1>/, ''));
  if (req.url === '/bad-canonical/') return send(200, 'text/html', page('/bad-canonical/').replace(`${origin}/bad-canonical/`, 'http://[bad'));
  if (req.url === '/bad-hreflang/') return send(200, 'text/html', page('/bad-hreflang/').replace(`${origin}/zh/`, 'http://[bad'));
  if (req.url === '/wrong-hreflang/') return send(200, 'text/html', page('/wrong-hreflang/').replace(`${origin}/zh/`, `${origin}/wrong/`));
  if (req.url === '/noindex/') return send(200, 'text/html', page('/noindex/', '<meta name="robots" content="noindex">'));
  if (req.url === '/hostinger/') return send(200, 'text/html', page('/hostinger/', '', 'Website is suspended — Hostinger default error'));
  if (req.url === '/php/') return send(200, 'text/html', page('/php/', '', 'PHP Fatal error: failure'));
  if (req.url === '/resource-404-page/') return send(200, 'text/html', page('/resource-404-page/', '', '<img src="/missing.png">'));
  if (req.url === '/html-resource-page/') return send(200, 'text/html', page('/html-resource-page/', '', '<script src="/html.js"></script>'));
  if (req.url === '/bad-resource-page/') return send(200, 'text/html', page('/bad-resource-page/', '', '<img src="http://[bad">'));
  if (req.url === '/redirect-one') return send(301, 'text/plain', '', { location: '/redirect-two' });
  if (req.url === '/redirect-two') return send(302, 'text/plain', '', { location: '/' });
  if (req.url === '/external-redirect') return send(302, 'text/plain', '', { location: 'https://example.com/' });
  if (req.url === '/loop-a') return send(302, 'text/plain', '', { location: '/loop-b' });
  if (req.url === '/loop-b') return send(302, 'text/plain', '', { location: '/loop-a' });
  if (req.url === '/page-redirect') return send(301, 'text/plain', '', { location: '/' });
  if (req.url === '/hard') return send(404, 'text/html', `<h1>Page Not Found</h1>${links404}`);
  if (req.url === '/soft') return send(200, 'text/html', `<h1>Page Not Found</h1>${links404}`);
  if (req.url === '/bad-404-link') return send(404, 'text/html', `<h1>Page Not Found</h1>${links404}<a href="http://[bad">Bad</a>`);
  if (req.url === '/good.png' || req.url === '/icon.png') return send(200, 'image/png', 'png', { 'content-length': '3' });
  if (req.url === '/wrong.png') return send(200, 'text/plain', 'png', { 'content-length': '3' });
  if (req.url === '/good.css') return send(200, 'text/css; charset=utf-8', 'a{}', { 'content-length': '3' });
  if (req.url === '/wrong.css') return send(200, 'image/png', 'a{}', { 'content-length': '3' });
  if (req.url === '/good.js') return send(200, 'application/javascript; charset=utf-8', 'x=1', { 'content-length': '3' });
  if (req.url === '/html.js') return send(200, 'text/html', '<h1>Error</h1>', { 'content-length': '14' });
  if (req.url === '/head-405') return req.method === 'HEAD' ? send(405, 'text/plain') : send(200, 'text/plain', 'ok');
  if (req.url === '/limited') return send(429, 'text/plain', 'limited');
  if (req.url === '/slow') return setTimeout(() => send(200, 'text/plain', 'late'), 150);
  if (req.url === '/rfq.php') return send(405, 'text/plain', 'Method Not Allowed');
  send(404, 'text/plain', 'missing');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening'); origin = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`ok - ${name}`); } catch (error) { console.error(`not ok - ${name}`); throw error; } }
const pageAudit = async (path) => { const audit = new HealthAudit({ origin }); await audit.checkPage(origin + path); return audit; };
const sitemapAudit = async (body, type = 'application/xml') => { const audit = new HealthAudit({ origin, fetch: async () => new Response(body, { status: 200, headers: { 'content-type': type } }) }); const result = await audit.sitemap(); return { audit, result }; };
const has = (audit, type) => assert(audit.errors.some((item) => item.type === type), `missing ${type}: ${JSON.stringify(audit.errors)}`);

try {
  await test('normal 200 HTML', async () => assert.equal((await pageAudit('/')).errors.length, 0));
  await test('two-step non-www style redirect passes', async () => { const audit = new HealthAudit({ origin }); await audit.redirect(origin + '/redirect-one', origin + '/'); assert.equal(audit.errors.length, 0); });
  await test('redirect loop reports exact type', async () => { const audit = new HealthAudit({ origin }); await audit.redirect(origin + '/loop-a'); has(audit, 'redirect-loop'); });
  await test('redirect through external domain fails', async () => { const audit = new HealthAudit({ fetch: async () => new Response('', { status: 302, headers: { location: 'https://example.com/' } }) }); await audit.redirect('http://weixingmachinery.com/'); has(audit, 'redirect-host'); });
  await test('custom 404 passes', async () => { const audit = new HealthAudit({ origin }); await audit.missing(origin + '/hard'); assert.equal(audit.errors.length, 0); });
  await test('soft 404 warns', async () => { const audit = new HealthAudit({ origin }); await audit.missing(origin + '/soft'); assert(audit.warnings.some((item) => item.type === 'soft-404')); });
  for (const [name, path, type] of [['missing title', '/missing-title/', 'missing-title'], ['missing H1', '/missing-h1/', 'h1'], ['noindex', '/noindex/', 'noindex'], ['Hostinger body', '/hostinger/', 'server-error-body'], ['PHP fatal body', '/php/', 'server-error-body'], ['malformed canonical', '/bad-canonical/', 'invalid-canonical-url'], ['malformed hreflang', '/bad-hreflang/', 'invalid-hreflang-url'], ['malformed resource', '/bad-resource-page/', 'invalid-resource-url']]) await test(name, async () => has(await pageAudit(path), type));
  await test('hreflang target validator reports error', async () => { const audit = await pageAudit('/wrong-hreflang/'); const record = audit.pages.get(origin + '/wrong-hreflang/'); audit.validateLanguageTargets(origin + '/wrong-hreflang/', record, origin + '/', origin + '/zh/'); has(audit, 'hreflang-target'); });
  await test('malformed 404 href reports exact error', async () => { const audit = new HealthAudit({ origin }); await audit.missing(origin + '/bad-404-link'); has(audit, 'invalid-404-link'); });
  await test('empty sitemap fails', async () => has((await sitemapAudit('')).audit, 'sitemap-empty'));
  await test('HTML sitemap response fails', async () => has((await sitemapAudit('<html><h1>Home</h1></html>', 'text/html')).audit, 'sitemap-content-type'));
  await test('sitemap without urlset fails', async () => has((await sitemapAudit('<root><loc>x</loc></root>')).audit, 'sitemap-urlset'));
  await test('sitemap without loc fails', async () => has((await sitemapAudit('<urlset></urlset>')).audit, 'sitemap-loc'));
  await test('sitemap with valid and empty loc reports empty loc', async () => { const { audit } = await sitemapAudit(`<urlset><url><loc>${origin}/</loc></url><url><loc> </loc></url></urlset>`); has(audit, 'empty-sitemap-loc'); });
  await test('malformed sitemap URL fails without crash', async () => has((await sitemapAudit('<urlset><url><loc>http://[bad</loc></url></urlset>')).audit, 'invalid-sitemap-url'));
  await test('external sitemap URL excluded and never requested', async () => { let external = 0; const xml = '<urlset><url><loc>https://example.com/</loc></url></urlset>'; const audit = new HealthAudit({ origin, fetch: async (url) => { if (url.startsWith('https://example.com')) external++; return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } }); } }); const result = await audit.sitemap(); has(audit, 'sitemap-url'); assert.deepEqual(result.validUrls, []); assert.equal(external, 0); });
  await test('GitHub Pages sitemap URL excluded', async () => { const { audit, result } = await sitemapAudit('<urlset><url><loc>https://owner.github.io/site/</loc></url></urlset>'); has(audit, 'sitemap-url'); assert.deepEqual(result.validUrls, []); });
  await test('normalized duplicate sitemap loc fails', async () => { const xml = `<urlset><url><loc>${origin}/same</loc></url><url><loc>${origin}/same/</loc></url></urlset>`; has((await sitemapAudit(xml)).audit, 'duplicate-sitemap-loc'); });
  await test('octet-stream valid XML warns', async () => { const { audit } = await sitemapAudit(`<urlset><url><loc>${origin}/</loc></url></urlset>`, 'application/octet-stream'); assert(audit.warnings.some((item) => item.type === 'sitemap-content-type')); });
  await test('sitemap redirect to different final URL fails', async () => { const audit = new HealthAudit({ origin }); await audit.checkPage(origin + '/page-redirect', 'sitemap'); has(audit, 'sitemap-final-url'); });
  await test('sitemap missing English home reports key page', async () => { const audit = new HealthAudit({ origin }); audit.checkSitemapKeyPages({ validUrls: [origin + '/zh/'], formatValid: true, unverified: false }, [origin + '/', origin + '/zh/']); has(audit, 'sitemap-missing-key-page'); });
  await test('sitemap missing Chinese Contact reports key page', async () => { const audit = new HealthAudit({ origin }); audit.checkSitemapKeyPages({ validUrls: [origin + '/contact/'], formatValid: true, unverified: false }, [origin + '/contact/', origin + '/zh/contact/']); assert(audit.errors.some((item) => item.type === 'sitemap-missing-key-page' && item.url.endsWith('/zh/contact/'))); });
  await test('unverified sitemap skips key-page errors', async () => { const audit = new HealthAudit({ origin }); audit.checkSitemapKeyPages({ validUrls: [], formatValid: false, unverified: true }, [origin + '/']); assert.equal(audit.errors.length, 0); });
  await test('sitemap GET 429 only warns', async () => { const audit = new HealthAudit({ origin, fetch: async () => new Response('limited', { status: 429 }) }); const result = await audit.sitemap(); assert.equal(audit.errors.length, 0); assert.equal(audit.warnings.filter((item) => item.type === 'unverified').length, 1); assert.equal(result.unverified, true); });
  await test('404 GET 429 only warns', async () => { const audit = new HealthAudit({ origin, fetch: async () => new Response('limited', { status: 429 }) }); await audit.missing(origin + '/missing'); assert.equal(audit.errors.length, 0); assert.equal(audit.warnings.filter((item) => item.type === 'unverified').length, 1); });
  await test('redirect GET 429 only warns', async () => { const audit = new HealthAudit({ origin, fetch: async () => new Response('limited', { status: 429 }) }); await audit.redirect(origin + '/start', origin + '/'); assert.equal(audit.errors.length, 0); assert.equal(audit.warnings.filter((item) => item.type === 'unverified').length, 1); });
  await test('resource 404 reports only status', async () => {
    const audit = await pageAudit('/resource-404-page/');
    await audit.checkResource([...audit.resources][0]);
    has(audit, 'resource-status');
    assert.equal(audit.errors.filter(({ type }) => ['resource-status', 'resource-html', 'resource-content-type'].includes(type)).length, 1);
    assert.equal(audit.errors.some(({ type }) => type === 'resource-html' || type === 'resource-content-type'), false);
  });
  await test('resource HTML reports HTML error', async () => { const audit = await pageAudit('/html-resource-page/'); await audit.checkResource([...audit.resources][0]); has(audit, 'resource-html'); });
  await test('PNG text/plain MIME fails', async () => { const audit = new HealthAudit({ origin }); await audit.checkResource(origin + '/wrong.png'); has(audit, 'resource-content-type'); });
  await test('CSS image/png MIME fails', async () => { const audit = new HealthAudit({ origin }); await audit.checkResource(origin + '/wrong.css'); has(audit, 'resource-content-type'); });
  await test('JavaScript application/javascript passes', async () => { const audit = new HealthAudit({ origin }); await audit.checkResource(origin + '/good.js'); assert.equal(audit.errors.length, 0); });
  await test('HEAD 405 falls back to GET', async () => { const audit = new HealthAudit({ origin }); assert.equal((await audit.request(origin + '/head-405', { method: 'HEAD' })).status, 200); });
  await test('429 is an unverified warning', async () => { const audit = new HealthAudit({ origin }); await audit.request(origin + '/limited', { method: 'HEAD' }); assert(audit.warnings.some((item) => item.type === 'unverified')); });
  await test('page and resource 429 only warn and later work continues', async () => { const audit = new HealthAudit({ origin }); await audit.checkPage(origin + '/limited'); await audit.checkResource(origin + '/limited'); await audit.checkResource(origin + '/good.js'); assert.equal(audit.errors.length, 0); assert.equal(audit.counts.resources, 1); assert.equal(audit.warnings.filter((item) => item.type === 'unverified').length, 2); });
  await test('request timeout retries and rejects', async () => { const audit = new HealthAudit({ origin, timeout: 20 }); await assert.rejects(audit.request(origin + '/slow')); });
  await test('404 network failure is isolated', async () => { const audit = new HealthAudit({ origin, fetch: async () => { throw new Error('offline'); } }); await audit.missing(origin + '/one'); await audit.missing(origin + '/two'); assert.equal(audit.errors.filter((item) => item.type === '404-network').length, 2); });
  await test('resource network failure is isolated', async () => { const audit = new HealthAudit({ origin, fetch: async () => { throw new Error('offline'); } }); await audit.checkResource(origin + '/a.png'); await audit.checkResource(origin + '/b.png'); assert.equal(audit.errors.filter((item) => item.type === 'resource-network').length, 2); });
  await test('form endpoint network failure is isolated', async () => { const audit = new HealthAudit({ origin, fetch: async () => { throw new Error('offline'); } }); await audit.endpoint(origin + '/a.php'); await audit.endpoint(origin + '/b.php'); assert.equal(audit.warnings.filter((item) => item.type === 'form-endpoint-network').length, 2); });
  await test('single-page mode checks resources and endpoint', async () => { requests.length = 0; const { audit } = await runAudit({ origin, url: origin + '/' }); assert.equal(audit.errors.length, 0, JSON.stringify(audit.errors)); assert(requests.some((item) => item.includes('/good.css'))); assert(requests.some((item) => item.includes('/good.js'))); assert(requests.some((item) => item.includes('/good.png'))); assert(requests.some((item) => item.includes('/rfq.php'))); assert(!requests.some((item) => item.startsWith('POST '))); });
  for (const [name, method] of [['sitemap cross-origin redirect', 'sitemap'], ['page cross-origin redirect', 'page'], ['image cross-origin redirect', 'resource'], ['PHP endpoint cross-origin redirect', 'endpoint']]) await test(name, async () => {
    let externalRequests = 0; const audit = new HealthAudit({ fetch: async (raw) => { if (String(raw).startsWith('https://example.com')) externalRequests++; return new Response('', { status: 302, headers: { location: 'https://example.com/' } }); } });
    if (method === 'sitemap') await audit.sitemap(); else if (method === 'page') await audit.checkPage('https://www.weixingmachinery.com/test/'); else if (method === 'resource') await audit.checkResource('https://www.weixingmachinery.com/test.png'); else await audit.endpoint('https://www.weixingmachinery.com/rfq.php');
    has(audit, 'cross-origin-redirect'); assert.equal(externalRequests, 0);
  });
  await test('normal same-origin redirect passes', async () => { let calls = 0; const audit = new HealthAudit({ fetch: async () => ++calls === 1 ? new Response('', { status: 302, headers: { location: '/final' } }) : new Response('ok', { status: 200 }) }); const response = await audit.request('https://www.weixingmachinery.com/start'); assert.equal(response.status, 200); assert.equal(audit.errors.length, 0); });
  await test('full correct site fixture passes', async () => {
    const fetched = [];
    const fixtureFetch = async (raw, init = {}) => {
      const url = new URL(raw); fetched.push(`${init.method || 'GET'} ${url.href}`);
      if (url.protocol === 'http:' || url.hostname === 'weixingmachinery.com') return new Response('', { status: 301, headers: { location: 'https://www.weixingmachinery.com/' } });
      if (url.pathname === '/sitemap.xml') { const paths = ['/', '/zh/', '/products/', '/zh/products/', '/contact/', '/zh/contact/', '/products/orfs-hydraulic-fittings/', '/zh/products/orfs-hydraulic-fittings/', '/products/custom-cnc-parts/', '/zh/products/custom-cnc-parts/']; return new Response(`<urlset>${paths.map((path) => `<url><loc>https://www.weixingmachinery.com${path}</loc></url>`).join('')}</urlset>`, { status: 200, headers: { 'content-type': 'application/xml' } }); }
      if (url.pathname.includes('health-check-missing')) return new Response(`<h1>Page Not Found</h1>${links404}`, { status: 404, headers: { 'content-type': 'text/html' } });
      if (/\.(?:ico|svg|png|css|js)$/.test(url.pathname)) {
        const ext = url.pathname.split('.').pop(); const types = { ico: 'image/x-icon', svg: 'image/svg+xml', png: 'image/png', css: 'text/css', js: 'application/javascript' };
        return new Response(init.method === 'HEAD' ? null : 'abc', { status: 200, headers: { 'content-type': types[ext], 'content-length': '3' } });
      }
      const chinese = url.pathname === '/zh/' || url.pathname.startsWith('/zh/'); const enPath = chinese ? url.pathname.replace(/^\/zh/, '') || '/' : url.pathname; const zhPath = chinese ? url.pathname : `/zh${url.pathname}`;
      const html = `<!doctype html><title>Fixture</title><link rel="canonical" href="${url.href}"><link rel="alternate" hreflang="en" href="https://www.weixingmachinery.com${enPath}"><link rel="alternate" hreflang="zh-CN" href="https://www.weixingmachinery.com${zhPath}"><link rel="alternate" hreflang="x-default" href="https://www.weixingmachinery.com${enPath}"><h1>${chinese ? '液压 产品 联系' : 'Hydraulic Products Contact ORFS CNC'}</h1>`;
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    };
    const { audit } = await runAudit({ fetch: fixtureFetch }); assert.equal(audit.errors.length, 0, JSON.stringify(audit.errors)); assert(!fetched.some((request) => request.startsWith('POST ')));
  });
  await test('complete fixture page resources pass', async () => { const audit = await pageAudit('/'); await Promise.all([...audit.resources].map((url) => audit.checkResource(url))); await Promise.all([...audit.formEndpoints].map((url) => audit.endpoint(url))); assert.equal(audit.errors.length, 0, JSON.stringify(audit.errors)); });
  console.log(`\n${passed} production health checker fixture tests passed`);
} finally { server.close(); await once(server, 'close'); }
