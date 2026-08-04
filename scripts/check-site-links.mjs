import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd(), origin = 'https://www.weixingmachinery.com', preview = 'https://sundaylee3100-ljl.github.io/weixing-machinery-website';
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const tracked = new Set(files), pages = files.filter(f => f.endsWith('.html') && !/(^|\/)(dist|build|coverage|vendor|fixtures?|templates?)(\/|$)/.test(f));
const text = new Map(pages.map(f => [f, readFileSync(f, 'utf8')]));
const ids = new Map([...text].map(([f,s]) => [f, new Set([...s.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map(m => m[2]))]));
const errors = [], warnings = [], links = [], resources = [], fragments = [], forms = [], external = new Set(), inbound = new Map(pages.map(f => [f, 0]));
const fail = (kind, source, raw, target, detail='') => errors.push({kind, source, raw, target, detail});
function attrs(tag) { const o={}; for (const m of tag.matchAll(/([:\w-]+)\s*=\s*(?:(["'])(.*?)\2|([^\s>]+))/gs)) o[m[1].toLowerCase()]=m[3]??m[4]; return o; }
function classify(raw) {
  if (/^(mailto:|tel:|data:|blob:)/i.test(raw)) return 'special';
  if (/^javascript:/i.test(raw)) return 'javascript';
  if (raw.startsWith(origin) || raw.startsWith(preview)) return 'internal-absolute';
  if (/^https?:\/\//i.test(raw)) return 'external';
  return 'internal';
}
function resolve(source, raw) {
  let u=raw;
  if (u.startsWith(origin)) u=u.slice(origin.length)||'/';
  if (u.startsWith(preview)) u=u.slice(preview.length).replace(/^\/weixing-machinery-website(?=\/|$)/,'')||'/';
  const hash=u.indexOf('#'), query=u.indexOf('?');
  const fragment=hash>=0 ? decodeURIComponent(u.slice(hash+1)) : '';
  const queryText=query>=0 ? u.slice(query, hash>=0&&hash>query?hash:undefined) : '';
  let clean=u.split(/[?#]/)[0];
  try { clean=decodeURIComponent(clean); } catch { fail('encoding',source,raw,'','unsafe percent encoding'); }
  let target=clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(source),clean||path.posix.basename(source)));
  if (!clean && fragment) target=source;
  if (clean.endsWith('/') || target==='') target=path.posix.join(target,'index.html');
  if (!path.posix.extname(target) && tracked.has(path.posix.join(target,'index.html'))) target=path.posix.join(target,'index.html');
  return {target,fragment,queryText};
}
function check(source, element, attribute, raw, resource=false) {
  if (!raw) return;
  const kind=classify(raw);
  if (kind==='special') return;
  if (kind==='javascript') return fail('javascript URL',source,raw,'','prohibited URL scheme');
  if (kind==='external') { external.add(raw); return; }
  const r=resolve(source,raw), exists=tracked.has(r.target);
  const row={source,element,attribute,raw,...r,exists}; (resource?resources:links).push(row);
  if (!exists) fail(resource?'resource':'link',source,raw,r.target,'target is not tracked');
  if (!resource && exists && r.target.endsWith('.html')) inbound.set(r.target,(inbound.get(r.target)||0)+1);
  if (!resource && /(^|\/)404\.html$/.test(r.target) && source!=='404.html') fail('404 link',source,raw,r.target,'ordinary page links to 404');
  if (/(^|\/)(zh\/zh|products\/products|guides\/guides|zh\/(assets|css|js))(\/|$)/.test('/'+r.target)) fail('invalid path',source,raw,r.target,'duplicated or invalid directory');
  if (r.fragment) { const ok=exists && ids.get(r.target)?.has(r.fragment); fragments.push({...row,ok}); if (!ok) fail('fragment',source,raw,r.target+'#'+r.fragment,'target id is absent'); }
  if (!resource && raw==='#') fail('empty fragment',source,raw,r.target,'empty fragment');
}
for (const [source,html] of text) {
  for (const m of html.matchAll(/<(a|area|link|img|source|script|video|audio|iframe|input|object|form)\b[^>]*>/gi)) {
    const el=m[1].toLowerCase(), a=attrs(m[0]);
    if (['a','area'].includes(el) && a.href) check(source,el,'href',a.href,false);
    if (el==='link' && a.href) check(source,el,'href',a.href,true);
    for (const key of ['src','poster','data']) if (a[key]) check(source,el,key,a[key],true);
    if (el==='form' && a.action) { forms.push({source,url:a.action}); check(source,el,'action',a.action,true); }
    for (const key of ['srcset']) if (a[key]) for (const candidate of a[key].split(',').map(x=>x.trim()).filter(Boolean)) { const [url,desc]=candidate.split(/\s+/); if(desc&&!/^(\d+w|\d+(?:\.\d+)?x)$/.test(desc)) fail('srcset descriptor',source,candidate,'',desc); check(source,el,key,url,true); }
  }
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) { const a=attrs(m[0]), key=(a.property||a.name||'').toLowerCase(); if(['og:url','og:image','twitter:image'].includes(key)&&a.content) check(source,'meta','content',a.content,key!=='og:url'); }
  const duplicate=[...ids.get(source)].filter(id => (html.match(new RegExp(`\\bid\\s*=\\s*["']${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["']`,'g'))||[]).length>1); for(const id of duplicate) fail('duplicate id',source,'#'+id,source+'#'+id,'duplicate id');
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) try { const walk=v=>{ if(typeof v==='string'&&(v.startsWith(origin)||v.startsWith(preview))) check(source,'script','JSON-LD',v.split('#')[0],/\.(?:png|jpe?g|gif|webp|svg|ico)(?:[?#]|$)/i.test(v)); else if(v&&typeof v==='object') Object.values(v).forEach(walk); }; walk(JSON.parse(m[1])); } catch { fail('JSON-LD',source,'application/ld+json','','invalid JSON'); }
}
let cssRefs=0; for(const source of files.filter(f=>f.endsWith('.css'))) { const css=readFileSync(source,'utf8'); for(const m of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)|@import\s+(["'])(.*?)\3/gi)){ const raw=m[2]??m[4]; if(raw&&!raw.startsWith('data:')) { cssRefs++; check(source,'css',m[4]?'@import':'url',raw,true); } } }
const indexable=pages.filter(f=>f!=='404.html'&&!/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(text.get(f)));
const sitemap=readFileSync('sitemap.xml','utf8'), locs=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].trim());
for(const p of indexable){ const canonical=[...text.get(p).matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)].map(m=>attrs(m[0]).href)[0]; if(!canonical) fail('canonical',p,'','', 'missing canonical'); else { const r=resolve(p,canonical); if(r.target!==p) fail('canonical',p,canonical,r.target,'canonical mismatch'); if(!locs.includes(canonical)) fail('sitemap',p,canonical,p,'canonical absent from sitemap'); } }
for(const loc of locs){ if(!loc.startsWith(origin+'/')&&loc!==origin+'/') fail('sitemap','sitemap.xml',loc,'','non-production URL'); else { const r=resolve('sitemap.xml',loc); if(!indexable.includes(r.target)) fail('sitemap','sitemap.xml',loc,r.target,'non-indexable or missing target'); } }
if(new Set(locs).size!==locs.length) fail('sitemap','sitemap.xml','duplicate loc','','duplicate URL');
const robots=readFileSync('robots.txt','utf8'); if(!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) fail('robots','robots.txt','Sitemap',`${origin}/sitemap.xml`,'missing/incorrect Sitemap');
for(const p of pages.filter(p=>p!=='404.html')) { const pair=p.startsWith('zh/')?p.slice(3):'zh/'+p; if(!tracked.has(pair)) fail('language pair',p,pair,pair,'counterpart missing'); }
const orphans=indexable.filter(p=>!['index.html','products/index.html','guides/index.html','zh/index.html','zh/products/index.html','zh/guides/index.html'].includes(p)&&(inbound.get(p)||0)===0);
for(const p of orphans) fail('orphan',p,'',p,'no inbound internal page link');
if(/(?:href|src)=["'](?!https?:\/\/|\/|#|mailto:|tel:|data:|blob:)/i.test(text.get('404.html'))) fail('404 nesting','404.html','relative URL','','relative URL is unsafe at nested error paths');
if (process.argv.includes('--check-external')) for (const url of external) {
  let verified=false, last='';
  for (let attempt=0; attempt<3&&!verified; attempt++) for (const method of ['HEAD','GET']) try {
    const response=await fetch(url,{method,redirect:'follow',signal:AbortSignal.timeout(8000),headers:{'user-agent':'WeixingSiteAudit/1.0'}});
    last=`HTTP ${response.status}`;
    if ([403,405,429].includes(response.status)) { warnings.push(`${url}: unverified (${last})`); verified=true; break; }
    if (response.ok) { console.log(`EXTERNAL ${url} -> ${response.url} (${last})`); verified=true; break; }
    if (method==='GET'&&attempt===2) warnings.push(`${url}: failed (${last})`);
  } catch (error) { last=error.name||'network error'; if(method==='GET'&&attempt===2) warnings.push(`${url}: unverified (${last})`); }
}
console.log(`Site link audit: ${pages.length} public HTML; ${indexable.length} indexable; ${pages.filter(p=>p.startsWith('zh/')).length} Chinese; ${pages.filter(p=>!p.startsWith('zh/')).length} English`);
console.log(`Checked: ${links.length} internal links; ${resources.length} resource references; ${fragments.length} fragments; ${cssRefs} CSS references; ${forms.length} form paths; ${locs.length} sitemap URLs; ${external.size} external URLs`);
for(const e of errors) console.error(`ERROR [${e.kind}] ${e.source}: ${e.raw||'(none)'} -> ${e.target||'(none)'} (${e.detail})`);
for(const w of warnings) console.warn(`WARNING ${w}`);
console.log(`Result: ${errors.length} deterministic error(s); ${orphans.length} orphan page(s); ${warnings.length} warning(s).`);
process.exitCode=errors.length?1:0;
