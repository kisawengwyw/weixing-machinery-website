import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROD = 'https://www.weixingmachinery.com';
export const PREVIEW = 'https://sundaylee3100-ljl.github.io/weixing-machinery-website';
const excluded = /(^|\/)(node_modules|\.git|dist|build|coverage|vendor|fixtures?|templates?|backup)(\/|$)/i;
const attrs = tag => { const out={}; for(const m of tag.matchAll(/([:\w-]+)\s*=\s*(?:(["'])([\s\S]*?)\2|([^\s>]+))/g)) out[m[1].toLowerCase()]=m[3]??m[4]; return out; };
const tags = html => [...html.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)].map(m=>({name:m[1].toLowerCase(),raw:m[0],attrs:attrs(m[0]),index:m.index}));
const sourceText=(file,tag,html)=>{const s=html.get(file), end=s.indexOf('</a>',tag.index);return end<0?'':s.slice(tag.index+tag.raw.length,end).replace(/<[^>]*>/g,'').trim()};
function discover(root){
  if(existsSync(path.join(root,'.git'))) return execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const out=[]; const walk=d=>{ for(const n of readdirSync(path.join(root,d))){ const f=path.posix.join(d,n), st=statSync(path.join(root,f)); if(excluded.test(f))continue; st.isDirectory()?walk(f):out.push(f); } }; walk(''); return out;
}
function safeDecode(value, add, source, raw){ try{return decodeURIComponent(value)}catch{add('malformed encoding',source,raw,'','percent encoding is invalid');return value} }
function classify(raw){ if(/^(mailto:|tel:|data:|blob:)/i.test(raw))return 'special'; if(/^javascript:/i.test(raw))return 'javascript'; if(raw.startsWith(PROD)||raw.startsWith(PREVIEW))return 'internal-absolute'; if(/^https?:\/\//i.test(raw))return 'external'; return 'internal'; }
function localTarget(source,raw,add){
  let u=raw;
  if(u.startsWith(PROD))u=u.slice(PROD.length)||'/';
  if(u.startsWith(PREVIEW))u=u.slice(PREVIEW.length).replace(/^\/weixing-machinery-website(?=\/|$)/,'')||'/';
  const hash=u.indexOf('#'), q=u.indexOf('?');
  const fragment=hash<0?'':safeDecode(u.slice(hash+1),add,source,raw);
  const query=q<0?'':u.slice(q,hash>q?hash:undefined);
  let clean=safeDecode(u.split(/[?#]/)[0],add,source,raw);
  const joined=clean.startsWith('/')?clean.slice(1):path.posix.join(path.posix.dirname(source),clean||path.posix.basename(source));
  let target=path.posix.normalize(joined);
  if(target==='..'||target.startsWith('../')||path.posix.isAbsolute(target)){ add('path traversal',source,raw,target,'URL escapes repository root'); return {target,fragment,query,escaped:true}; }
  if(clean.endsWith('/')||target==='')target=path.posix.join(target,'index.html');
  return {target,fragment,query,escaped:false};
}
export function auditSite(root=process.cwd()){
  const files=discover(root), tracked=new Set(files), folded=new Map(files.map(f=>[f.toLowerCase(),f]));
  const pages=files.filter(f=>f.endsWith('.html')&&!excluded.test(f));
  const html=new Map(pages.map(f=>[f,readFileSync(path.join(root,f),'utf8')]));
  const parsed=new Map([...html].map(([f,s])=>[f,tags(s)]));
  const ids=new Map([...parsed].map(([f,ts])=>[f,ts.map(t=>t.attrs.id).filter(x=>x!==undefined)]));
  const errors=[],warnings=[],runtime=[], external=new Set(), inbound=new Map(pages.map(p=>[p,new Set()])), outbound=new Map(pages.map(p=>[p,new Set()]));
  const add=(kind,source,raw,target,detail)=>errors.push({kind,source,raw,target,detail});
  const stats={internalLinks:0,resources:0,fragments:0,css:0,forms:0,jsStatic:0};
  function check(source,element,attribute,raw,{resource=false,seo=false,countGraph=false}={}){
    if(raw===undefined)return; if(raw===''){add('empty URL',source,raw,'','URL attribute is empty');return;}
    if(source==='404.html'){
      if(raw==='https://wa.me/85262235101')return;
      let url;
      try{url=new URL(raw)}catch{
        const absolute=/^[a-z][a-z\d+.-]*:/i.test(raw);
        add(absolute?'404 invalid production URL':'404 relative URL',source,raw,'',absolute?'URL cannot be parsed':'404 URLs must be absolute');
        return;
      }
      if(url.protocol!=='https:'){add('404 insecure protocol',source,raw,url.href,'404 URLs must use HTTPS');return;}
      if(url.origin!==PROD){add('404 non-production origin',source,raw,url.origin,`origin must equal ${PROD}`);return;}
    }
    const kind=classify(raw);
    if(kind==='javascript'){add('javascript URL',source,raw,'','prohibited scheme');return;}
    if(kind==='special'){
      if(/^mailto:/i.test(raw)&&!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+(?:\?.*)?$/i.test(raw))add('invalid mailto',source,raw,'','invalid email');
      if(/^tel:/i.test(raw)&&!/^tel:\+?[0-9 ().-]{7,25}$/i.test(raw))add('invalid tel',source,raw,'','invalid phone characters');
      return;
    }
    if(kind==='external'){external.add(raw); if(/^https?:\/\/wa\.me\//i.test(raw)&&!/^https:\/\/wa\.me\/[1-9]\d{6,14}(?:\?.*)?$/i.test(raw))add('invalid WhatsApp',source,raw,'','invalid wa.me format'); return;}
    const r=localTarget(source,raw,add); if(r.escaped)return;
    if(!seo && raw.startsWith('/') && source!=='404.html') add('preview incompatible',source,raw,r.target,'root-relative URL leaves the GitHub Pages project path');
    const directoryCandidate=path.posix.join(r.target,'index.html'); if(!path.posix.extname(r.target)&&tracked.has(directoryCandidate))r.target=directoryCandidate;
    const exists=tracked.has(r.target);
    if(resource)stats.resources++;else stats.internalLinks++;
    if(!exists){ const actual=folded.get(r.target.toLowerCase()); add(actual?'case mismatch':resource?'missing resource':'missing link',source,raw,r.target,actual?`tracked case is ${actual}`:'target is not tracked'); }
    if(/(^|\/)(zh\/zh|products\/products|guides\/guides|zh\/(assets|css|js))(\/|$)/.test('/'+r.target))add('invalid path',source,raw,r.target,'duplicated or invalid directory');
    if(!resource&&r.target==='404.html'&&source!=='404.html')add('404 link',source,raw,r.target,'ordinary page links to 404');
    if(r.fragment){stats.fragments++; const matches=(ids.get(r.target)||[]).filter(x=>x===r.fragment).length; if(matches!==1)add(matches?'duplicate fragment target':'missing fragment',source,raw,`${r.target}#${r.fragment}`,matches?'target id is duplicated':'target id is absent');}
    if(raw==='#')add('empty fragment',source,raw,r.target,'href=# is not a valid navigation target');
    if(countGraph&&exists&&r.target.endsWith('.html')&&r.target!==source&&source!=='404.html'){ inbound.get(r.target)?.add(source); outbound.get(source)?.add(r.target); }
    return r;
  }
  for(const source of pages){
    const ts=parsed.get(source), sourceHtml=html.get(source);
    for(const id of new Set(ids.get(source)))if(ids.get(source).filter(x=>x===id).length>1)add('duplicate id',source,'#'+id,source+'#'+id,'id occurs more than once');
    for(const t of ts){ const a=t.attrs;
      if((t.name==='a'||t.name==='area')&&'href'in a){ check(source,t.name,'href',a.href,{countGraph:true}); if((a.target||'').toLowerCase()==='_blank'){const rel=new Set((a.rel||'').toLowerCase().split(/\s+/));if(!rel.has('noopener')||!rel.has('noreferrer'))add('unsafe target blank',source,a.href,'','rel must contain noopener noreferrer');}}
      if(t.name==='link'&&'href'in a)check(source,t.name,'href',a.href,{resource:!['canonical','alternate'].includes((a.rel||'').toLowerCase()),seo:['canonical','alternate'].includes((a.rel||'').toLowerCase())});
      for(const key of ['src','poster','data'])if(key in a)check(source,t.name,key,a[key],{resource:true});
      if(t.name==='form'&&'action'in a){stats.forms++;check(source,t.name,'action',a.action,{resource:true});}
      for(const key of ['srcset'])if(key in a)for(const candidate of a[key].split(',').map(x=>x.trim()).filter(Boolean)){const [url,desc]=candidate.split(/\s+/);if(desc&&!/^(\d+w|\d+(?:\.\d+)?x)$/.test(desc))add('srcset descriptor',source,candidate,'',`invalid ${desc}`);check(source,t.name,key,url,{resource:true});}
    }
    const metas=ts.filter(t=>t.name==='meta');
    for(const key of ['og:url','og:image','twitter:image']){const found=metas.filter(t=>(t.attrs.property||t.attrs.name||'').toLowerCase()===key);if(key==='og:url'&&found.length>1)add('duplicate og:url',source,key,'','more than one og:url');for(const t of found)check(source,'meta','content',t.attrs.content,{resource:key!=='og:url',seo:true});}
    for(const sm of sourceHtml.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{const walk=v=>{if(typeof v==='string'&&(v.startsWith(PROD)||v.startsWith(PREVIEW)))check(source,'script','JSON-LD',v.split('#')[0],{resource:/\.(png|jpe?g|webp|svg|ico)([?#]|$)/i.test(v),seo:true});else if(v&&typeof v==='object')Object.values(v).forEach(walk)};walk(JSON.parse(sm[1]));}catch{add('invalid JSON-LD',source,'application/ld+json','','JSON parse failed');}
  }
  const indexable=pages.filter(p=>{if(p==='404.html')return false;const robot=parsed.get(p).filter(t=>t.name==='meta'&&(t.attrs.name||'').toLowerCase()==='robots');return !robot.some(t=>(t.attrs.content||'').toLowerCase().split(/\s*,\s*/).includes('noindex'));});
  const canonicals=new Map();
  for(const p of indexable){
    const links=parsed.get(p).filter(t=>t.name==='link'), cs=links.filter(t=>(t.attrs.rel||'').toLowerCase().split(/\s+/).includes('canonical'));
    if(cs.length!==1)add(cs.length?'duplicate canonical':'missing canonical',p,'canonical','',`found ${cs.length}`);
    const canonical=cs[0]?.attrs.href; canonicals.set(p,canonical); if(canonical){const r=localTarget(p,canonical,add);if(r.target!==p)add('canonical mismatch',p,canonical,r.target,'canonical must identify current page');}
    const og=parsed.get(p).filter(t=>t.name==='meta'&&(t.attrs.property||'').toLowerCase()==='og:url');if(og.length>1)add('duplicate og:url',p,'og:url','',`found ${og.length}`);else if(og.length===1&&og[0].attrs.content!==canonical)add('og:url mismatch',p,og[0].attrs.content,canonical,'og:url must equal canonical');
    const alts=links.filter(t=>(t.attrs.rel||'').toLowerCase().split(/\s+/).includes('alternate'));
    const by=new Map(); for(const t of alts){const lang=t.attrs.hreflang;if(!lang||!['en','zh-CN','x-default'].includes(lang))add('invalid hreflang',p,t.attrs.href||'',lang||'','unknown or empty language');else if(by.has(lang))add('duplicate hreflang',p,t.attrs.href||'',lang,'language occurs more than once');else by.set(lang,t.attrs.href);}
    for(const lang of ['en','zh-CN','x-default'])if(!by.has(lang))add('missing hreflang',p,lang,'',`missing ${lang}`);
    const en=p.startsWith('zh/')?p.slice(3):p, zh='zh/'+en;
    for(const [lang,target] of [['en',en],['zh-CN',zh],['x-default',en]])if(by.has(lang)){const r=localTarget(p,by.get(lang),add);if(r.target!==target)add('hreflang route mismatch',p,by.get(lang),r.target,`${lang} must target ${target}`);}
    const own=p.startsWith('zh/')?'zh-CN':'en';if(by.get(own)!==canonical)add('hreflang canonical mismatch',p,by.get(own)||'',canonical,`${own} must equal canonical`);
    const switches=parsed.get(p).filter(t=>t.name==='a'&&(/\blang-switch\b/.test(t.attrs.class||'')||/^\s*(EN|English|中文)\s*$/.test(sourceText(p,t,html))));
    for(const t of switches){const label=sourceText(p,t,html).trim(), expected=/中文/.test(label)?zh:en;const r=localTarget(p,t.attrs.href||'',add);if(r.target!==expected)add('language switch mismatch',p,t.attrs.href||'',r.target,`must target ${expected}`);}
  }
  for(const source of files.filter(f=>f.endsWith('.css'))){const css=readFileSync(path.join(root,source),'utf8');for(const m of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)|@import\s+(["'])(.*?)\3/gi)){const raw=m[2]??m[4];if(raw&&!raw.startsWith('data:')){stats.css++;check(source,'css',m[4]?'@import':'url',raw,{resource:true});}}}
  const sitemapText=readFileSync(path.join(root,'sitemap.xml'),'utf8'), locs=[...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].trim());
  if(new Set(locs).size!==locs.length)add('duplicate sitemap URL','sitemap.xml','loc','','duplicate loc');
  for(const p of indexable){const c=canonicals.get(p);if(c&&!locs.includes(c))add('sitemap missing page',p,c,p,'canonical absent from sitemap');}
  for(const loc of locs){if(!loc.startsWith(PROD+'/')&&loc!==PROD+'/')add('invalid sitemap origin','sitemap.xml',loc,'','must use production HTTPS origin');else{const r=localTarget('sitemap.xml',loc,add);if(!indexable.includes(r.target))add('sitemap extra page','sitemap.xml',loc,r.target,'not an indexable page');}}
  const robotsText=readFileSync(path.join(root,'robots.txt'),'utf8'), directives=[];
  for(const [i,line] of robotsText.split(/\r?\n/).entries()){const clean=line.replace(/#.*$/,'').trim();if(!clean)continue;const m=clean.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);if(!m){add('robots syntax','robots.txt',line,'',`invalid line ${i+1}`);continue;}const key=m[1].toLowerCase(),value=m[2].trim();if(!['user-agent','allow','disallow','sitemap'].includes(key))warnings.push({kind:'robots directive',source:'robots.txt',detail:`unrecognized ${key}`});directives.push({key,value});}
  const sms=directives.filter(d=>d.key==='sitemap');if(sms.length<1||sms.some(d=>d.value!==`${PROD}/sitemap.xml`))add('robots sitemap','robots.txt',sms.map(x=>x.value).join(', '),`${PROD}/sitemap.xml`,'missing or incorrect sitemap');
  const blocked=['/zh/','/products/','/guides/','/css/','/js/','/assets/','/favicon.ico','/sitemap.xml'];for(const d of directives.filter(x=>x.key==='disallow'&&x.value))if(d.value==='/'||blocked.some(p=>p.startsWith(d.value)||d.value.startsWith(p)))add('robots blocks public path','robots.txt',`Disallow: ${d.value}`,d.value,'public content may be blocked');
  for(const source of files.filter(f=>f.endsWith('.js')&&!f.endsWith('check-site-links.mjs')&&!f.endsWith('test-site-link-checker.mjs'))){const js=readFileSync(path.join(root,source),'utf8');
    for(const m of js.matchAll(/\bfetch\s*\(\s*(["'])(.*?)\1|\.open\s*\(\s*[^,]+,\s*(["'])(.*?)\3|new\s+URL\s*\(\s*(["'])(.*?)\5|(?:window\.)?location(?:\.href)?\s*=\s*(["'])(.*?)\7/g)){const raw=m[2]??m[4]??m[6]??m[8];stats.jsStatic++;check(source,'script','static URL',raw,{resource:false});}
    for(const m of js.matchAll(/\bfetch\s*\(\s*([^"'`][^,)]*)/g)){const expr=m[1].trim();runtime.push({source,expression:expr,covered:/form\.action/.test(expr)?'HTML form action is checked':'runtime validation required'});}
  }
  const simulations=[`${PROD}/missing/`,`${PROD}/a/b/missing/`,`${PROD}/products/a/b/missing/`,`${PROD}/zh/a/b/missing/`,`${PREVIEW}/missing/`,`${PREVIEW}/a/b/missing/`];
  const orphans=indexable.filter(p=>!['index.html','products/index.html','guides/index.html','zh/index.html','zh/products/index.html','zh/guides/index.html'].includes(p)&&(inbound.get(p)?.size||0)===0);for(const p of orphans)add('orphan page',p,'',p,'no inbound <a>/<area> link from another public page');
  const deadEnds=indexable.filter(p=>(outbound.get(p)?.size||0)===0);for(const p of deadEnds)add('dead-end page',p,'',p,'no internal page outlink to another page');
  for(const [center,prefix] of [['products/index.html','products/'],['zh/products/index.html','zh/products/'],['guides/index.html','guides/'],['zh/guides/index.html','zh/guides/']])for(const p of indexable.filter(x=>x.startsWith(prefix)&&x!==center))if(!inbound.get(p)?.has(center))add('missing center entry',p,'',center,`detail is not linked from ${center}`);
  return {files,pages,indexable,locs,errors,warnings,runtime,external:[...external],inbound,outbound,orphans,deadEnds,simulations,stats};
}
export function formatResult(r){const zh=r.pages.filter(p=>p.startsWith('zh/')).length;const lines=[`Site link audit: ${r.pages.length} public HTML; ${r.indexable.length} indexable; ${zh} Chinese; ${r.pages.length-zh} English`,`Checked: ${r.stats.internalLinks} internal links; ${r.stats.resources} resource references; ${r.stats.fragments} fragments; ${r.stats.css} CSS references; ${r.stats.forms} form paths; ${r.stats.jsStatic} static JavaScript URLs; ${r.runtime.length} runtime URL dependencies; ${r.locs.length} sitemap URLs; ${r.external.length} external URLs; ${r.simulations.length} 404 simulations`];for(const e of r.errors)lines.push(`ERROR [${e.kind}] ${e.source}: ${e.raw||'(none)'} -> ${e.target||'(none)'} (${e.detail})`);for(const w of r.warnings)lines.push(`WARNING [${w.kind}] ${w.source}: ${w.detail}`);for(const d of r.runtime)lines.push(`RUNTIME ${d.source}: ${d.expression} (${d.covered})`);lines.push(`Result: ${r.errors.length} deterministic error(s); ${r.orphans.length} orphan page(s); ${r.deadEnds.length} dead-end page(s); ${r.warnings.length} warning(s).`);return lines.join('\n');}
async function checkExternal(urls){for(const url of urls){let done=false,last='network error';for(let retry=0;retry<3&&!done;retry++)for(const method of ['HEAD','GET'])try{const response=await fetch(url,{method,redirect:'follow',signal:AbortSignal.timeout(8000),headers:{'user-agent':'WeixingSiteAudit/2.0'}});last=`HTTP ${response.status}`;if([403,405,429].includes(response.status)){console.warn(`EXTERNAL UNVERIFIED ${url} (${last})`);done=true;break}if(response.ok){console.log(`EXTERNAL VERIFIED ${url} -> ${response.url} (${last})`);done=true;break}}catch(error){last=error.name||last}if(!done)console.warn(`EXTERNAL UNVERIFIED ${url} (${last})`);}}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(isMain){const arg=process.argv.indexOf('--root'),root=arg>=0?path.resolve(process.argv[arg+1]):process.cwd();const result=auditSite(root);console.log(formatResult(result));if(process.argv.includes('--check-external'))await checkExternal(result.external);process.exitCode=result.errors.length?1:0;}
