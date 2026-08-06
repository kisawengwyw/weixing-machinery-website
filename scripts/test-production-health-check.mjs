import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { HealthAudit } from './check-production-site.mjs';

const complete = (origin, extra = '') => `<!doctype html><html><head><title>Fixture</title><link rel="canonical" href="${origin}/"><link rel="alternate" hreflang="en" href="${origin}/"><link rel="alternate" hreflang="zh-CN" href="${origin}/zh/"><link rel="alternate" hreflang="x-default" href="${origin}/"></head><body><h1>Hydraulic products</h1>${extra}</body></html>`;
let origin;
const server = http.createServer((req, res) => {
  const send = (status, type, body, headers = {}) => { res.writeHead(status, { 'content-type': type, ...headers }); if (req.method !== 'HEAD') res.end(body); else res.end(); };
  const pages = {
    '/': complete(origin, '<img src="/ok.png">'),
    '/missing-title/': complete(origin).replace(/<title>.*?<\/title>/, ''),
    '/missing-h1/': complete(origin).replace(/<h1>.*?<\/h1>/, ''),
    '/bad-canonical/': complete(origin).replace(`${origin}/"`, `${origin}/wrong/"`),
    '/noindex/': complete(origin).replace('</head>', '<meta name="robots" content="noindex"></head>'),
    '/hostinger/': complete(origin, 'Website is suspended — Hostinger default error'),
    '/php/': complete(origin, 'PHP Fatal error: failure'),
    '/bad-hreflang/': complete(origin).replace(`${origin}/zh/`, `${origin}/wrong/`),
    '/resource-404-page/': complete(origin, '<img src="/missing.png">'),
    '/resource-html-page/': complete(origin, '<script src="/html-resource.js"></script>'),
  };
  if (pages[req.url]) return send(200, 'text/html; charset=utf-8', pages[req.url]);
  if (req.url === '/redirect') return send(301, 'text/plain', '', { location: `${origin}/` });
  if (req.url === '/loop-a') return send(302, 'text/plain', '', { location: '/loop-b' });
  if (req.url === '/loop-b') return send(302, 'text/plain', '', { location: '/loop-a' });
  if (req.url === '/soft') return send(200, 'text/html', '<h1>Page Not Found</h1><a href="/">Home</a><a href="/zh/">中文</a><a href="/products/">Products</a><a href="/contact/">Contact</a>');
  if (req.url === '/hard') return send(404, 'text/html', '<h1>Page Not Found</h1><a href="/">Home</a><a href="/zh/">中文</a><a href="/products/">Products</a><a href="/contact/">Contact</a>');
  if (req.url === '/ok.png') return send(200, 'image/png', 'png');
  if (req.url === '/html-resource.js') return send(200, 'text/html', '<h1>Error</h1>');
  if (req.url === '/head-405') return req.method === 'HEAD' ? send(405, 'text/plain', '') : send(200, 'text/plain', 'ok');
  if (req.url === '/limited') return send(429, 'text/plain', 'limited');
  if (req.url === '/slow') return setTimeout(() => send(200, 'text/plain', 'late'), 150);
  send(404, 'text/plain', 'missing');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening'); origin = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`ok - ${name}`); } catch (error) { console.error(`not ok - ${name}`); throw error; } }
const pageErrors = async (path) => { const a = new HealthAudit({ origin }); await a.checkPage(origin + path); return a; };

try {
  await test('normal 200 HTML', async () => assert.equal((await pageErrors('/')).errors.length, 0));
  await test('301 reaches expected origin', async () => { const a = new HealthAudit({ origin }); await a.redirect(origin + '/redirect', origin + '/'); assert.equal(a.errors.length, 0); });
  await test('redirect loop', async () => { const a = new HealthAudit({ origin }); await a.redirect(origin + '/loop-a'); assert(a.errors.some((x) => x.type === 'redirect-loop')); });
  await test('custom 404', async () => { const a = new HealthAudit({ origin }); await a.missing(origin + '/hard'); assert.equal(a.errors.length, 0); });
  await test('soft 404 warning', async () => { const a = new HealthAudit({ origin }); await a.missing(origin + '/soft'); assert(a.warnings.some((x) => x.type === 'soft-404')); });
  for (const [name, path, type] of [['missing title','/missing-title/','missing-title'],['missing H1','/missing-h1/','h1'],['wrong canonical','/bad-canonical/','canonical'],['noindex','/noindex/','noindex'],['Hostinger default text','/hostinger/','server-error-body'],['PHP Fatal error','/php/','server-error-body']]) await test(name, async () => assert((await pageErrors(path)).errors.some((x) => x.type === type)));
  await test('resource 404', async () => { const a = await pageErrors('/resource-404-page/'); await a.checkResource([...a.resources][0]); assert(a.errors.some((x) => x.type === 'resource-status')); });
  await test('resource HTML error page', async () => { const a = await pageErrors('/resource-html-page/'); await a.checkResource([...a.resources][0]); assert(a.errors.some((x) => x.type === 'resource-html')); });
  await test('hreflang target error can be detected', async () => { const a = await pageErrors('/bad-hreflang/'); assert.notEqual(a.pages.get(origin + '/bad-hreflang/').parsed.alternates['zh-CN'], `${origin}/zh/`); });
  await test('duplicate sitemap loc', async () => { const a = new HealthAudit({ origin, fetch: async () => new Response(`<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/</loc></url></urlset>`, { status: 200 }) }); await a.sitemap(); assert(a.errors.some((x) => x.type === 'duplicate-sitemap-loc')); });
  await test('HTTP non-www wrong redirect target', async () => { const a = new HealthAudit({ origin }); await a.redirect(origin + '/redirect', origin + '/different/'); assert(a.errors.some((x) => x.type === 'redirect-target')); });
  await test('request timeout retries then fails', async () => { const a = new HealthAudit({ origin, timeout: 20 }); await assert.rejects(a.request(origin + '/slow')); });
  await test('HEAD 405 falls back to GET', async () => { const a = new HealthAudit({ origin }); assert.equal((await a.request(origin + '/head-405', { method: 'HEAD' })).status, 200); });
  await test('429 is unverified warning', async () => { const a = new HealthAudit({ origin }); await a.request(origin + '/limited', { method: 'HEAD' }); assert(a.warnings.some((x) => x.type === 'unverified')); });
  await test('normal complete fixture including resource passes', async () => { const a = await pageErrors('/'); await Promise.all([...a.resources].map((x) => a.checkResource(x))); assert.equal(a.errors.length, 0, JSON.stringify(a.errors)); });
  console.log(`\n${passed} production health checker fixture tests passed`);
} finally { server.close(); await once(server, 'close'); }
