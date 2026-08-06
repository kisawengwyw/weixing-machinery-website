import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditSite, PROD } from './check-site-links.mjs';
const page=(lang='en')=>`<!doctype html><html lang="${lang}"><head><meta name="robots" content="index,follow"><link href="${PROD}${lang==='zh-CN'?'/zh/':'/'}" rel="canonical"><link hreflang="en" href="${PROD}/" rel="alternate"><link rel="alternate" href="${PROD}/zh/" hreflang="zh-CN"><link rel="alternate" hreflang="x-default" href="${PROD}/"><meta content="${PROD}${lang==='zh-CN'?'/zh/':'/'}" property="og:url"></head><body id="top"><a class="lang-switch" href="${lang==='zh-CN'?'../':'zh/'}">${lang==='zh-CN'?'EN':'中文'}</a><a href="${lang==='zh-CN'?'../':'zh/'}">pair</a><img src="${lang==='zh-CN'?'../':''}img.svg" alt="x"></body></html>`;
function base(){const r=mkdtempSync(path.join(tmpdir(),'site-checker-'));mkdirSync(path.join(r,'zh'));mkdirSync(path.join(r,'js'));writeFileSync(path.join(r,'index.html'),page());writeFileSync(path.join(r,'zh/index.html'),page('zh-CN'));writeFileSync(path.join(r,'img.svg'),'x');writeFileSync(path.join(r,'favicon.ico'),'x');writeFileSync(path.join(r,'404.html'),`<meta name="robots" content="noindex"><link href="${PROD}/favicon.ico" rel="icon"><a href="${PROD}/">Home</a>`);writeFileSync(path.join(r,'js/app.js'),'fetch(form.action);');writeFileSync(path.join(r,'sitemap.xml'),`<urlset><url><loc>${PROD}/</loc></url><url><loc>${PROD}/zh/</loc></url></urlset>`);writeFileSync(path.join(r,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${PROD}/sitemap.xml\n`);return r;}
const mutate=(fn)=>{const r=base();fn(r);return auditSite(r)};
const edit=(r,f,fn)=>{const p=path.join(r,f);writeFileSync(p,fn(readFileSync(p,'utf8')))};
const has=(result,kind)=>result.errors.some(e=>e.kind===kind);
const cases=[
 ['missing HTML link','missing link',r=>edit(r,'index.html',s=>s.replace('href="zh/">pair','href="missing/">pair'))],
 ['missing image','missing resource',r=>edit(r,'index.html',s=>s.replace('img.svg','missing.svg'))],
 ['bad fragment','missing fragment',r=>edit(r,'index.html',s=>s.replace('</body>','<a href="#absent">x</a></body>'))],
 ['duplicate id','duplicate id',r=>edit(r,'index.html',s=>s.replace('</body>','<div id="top"></div></body>'))],
 ['wrong hreflang slug','hreflang route mismatch',r=>edit(r,'index.html',s=>s.replace(`${PROD}/zh/\" hreflang=\"zh-CN`,`${PROD}/wrong/\" hreflang=\"zh-CN`))],
 ['missing x-default','missing hreflang',r=>edit(r,'index.html',s=>s.replace(/<link rel="alternate" hreflang="x-default"[^>]+>/,''))],
 ['wrong canonical','canonical mismatch',r=>edit(r,'index.html',s=>s.replace(`href="${PROD}/" rel="canonical"`,`href="${PROD}/zh/" rel="canonical"`))],
 ['sitemap missing page','sitemap missing page',r=>edit(r,'sitemap.xml',s=>s.replace(`<url><loc>${PROD}/zh/</loc></url>`,''))],
 ['sitemap extra page','sitemap extra page',r=>edit(r,'sitemap.xml',s=>s.replace('</urlset>',`<url><loc>${PROD}/gone/</loc></url></urlset>`))],
 ['robots blocks products','robots blocks public path',r=>edit(r,'robots.txt',s=>`User-agent: *\nDisallow: /products/\nSitemap: ${PROD}/sitemap.xml`)],
 ['page links 404','404 link',r=>edit(r,'index.html',s=>s.replace('</body>','<a href="404.html">bad</a></body>'))],
 ['zh assets path','invalid path',r=>edit(r,'zh/index.html',s=>s.replace('../img.svg','assets/img.svg'))],
 ['javascript link','javascript URL',r=>edit(r,'index.html',s=>s.replace('</body>','<a href="javascript:void(0)">bad</a></body>'))],
 ['unsafe target blank','unsafe target blank',r=>edit(r,'index.html',s=>s.replace('</body>','<a href="https://example.com" target="_blank">x</a></body>'))],
 ['self-only orphan','orphan page',r=>{mkdirSync(path.join(r,'solo'));mkdirSync(path.join(r,'zh/solo'));const solo=page().replaceAll(`${PROD}/`,`${PROD}/solo/`).replace('href="zh/"','href="./"').replace('href="zh/">pair','href="./">self');writeFileSync(path.join(r,'solo/index.html'),solo);writeFileSync(path.join(r,'zh/solo/index.html'),page('zh-CN'));edit(r,'sitemap.xml',s=>s.replace('</urlset>',`<url><loc>${PROD}/solo/</loc></url><url><loc>${PROD}/zh/solo/</loc></url></urlset>`));}],
 ['404 preview favicon','404 non-production origin',r=>edit(r,'404.html',s=>s.replace(`${PROD}/favicon.ico`,'https://sundaylee3100-ljl.github.io/weixing-machinery-website/favicon.ico'))],
 ['404 external Home','404 non-production origin',r=>edit(r,'404.html',s=>s.replace(`${PROD}/">Home`,'https://example.com/">Home'))],
 ['404 lookalike origin','404 non-production origin',r=>edit(r,'404.html',s=>s.replace(`${PROD}/">Home`,'https://www.weixingmachinery.com.evil.example/">Home'))],
 ['404 HTTP production origin','404 insecure protocol',r=>edit(r,'404.html',s=>s.replace(`${PROD}/">Home`,'http://www.weixingmachinery.com/">Home'))],
 ['404 root-relative URL','404 relative URL',r=>edit(r,'404.html',s=>s.replace(`${PROD}/favicon.ico`,'/favicon.ico'))],
 ['404 nested relative resource','404 relative URL',r=>edit(r,'404.html',s=>s.replace(`${PROD}/favicon.ico`,'../../favicon.ico'))],
 ['malformed percent survives','malformed encoding',r=>edit(r,'index.html',s=>s.replace('</body>','<a href="%E0%A4%A">bad</a></body>'))]
];
for(const [name,kind,fn] of cases){const result=mutate(fn);assert.ok(result.errors.length>0,`${name} fixture must fail`);assert.ok(has(result,kind),`${name} should report ${kind}; got ${result.errors.map(e=>e.kind)}`);console.log(`PASS mutation: ${name}`);}
const dynamic=auditSite(base());assert.equal(dynamic.stats.jsStatic,0);assert.ok(dynamic.runtime.some(x=>x.expression==='form.action'&&/HTML form action/.test(x.covered)));console.log('PASS mutation: dynamic fetch is a runtime dependency');
const good=auditSite(base());assert.equal(good.errors.length,0,good.errors.map(e=>`${e.kind}: ${e.detail}`).join('\n'));console.log('PASS fixture: correct site');
console.log(`All ${cases.length+2} site-link checker tests passed.`);
