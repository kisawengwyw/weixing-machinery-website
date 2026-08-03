import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const excluded = /(^|\/)(node_modules|\.git|dist|build|coverage|fixtures?|templates?|backups?|vendor)(\/|$)/i;
const pages = execFileSync('git', ['ls-files', '*.html'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).filter((file) => !excluded.test(file));
const pageSet = new Set(pages);
let failureCount = 0;

const canonical = {
  en: {
    description: 'Weixing connects global industrial systems with master craftsmanship and strives to become a trusted partner in precision manufacturing.',
    address: 'No. 91-1, Wengjiahe West, Wengfang Village, Hemudu Town, Yuyao City, Zhejiang Province',
    copyright: '&copy; 2026 Yuyao Wei Xing Machinery Co., Ltd. All rights reserved.',
    products: ['Hydraulic Fittings', 'Welding Parts', 'Valve Components', 'Custom CNC Machining'],
    company: [['About Us', 'about'], ['Quality Assurance', 'quality'], ['Contact Us', 'contact']],
  },
  zh: {
    description: '威兴以匠心连接全球工业体系，致力于成为值得信赖的精密制造伙伴。',
    address: '浙江省余姚市河姆渡镇翁方村翁家河西91-1号',
    copyright: '&copy; 2026 余姚市威兴机械有限公司 版权所有',
    products: ['液压接头', '焊接件', '阀体零部件', '定制CNC加工'],
    company: [['关于我们', 'about'], ['品质保证', 'quality'], ['联系我们', 'contact']],
  },
};

function resolveLocal(page, href) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(href)) return null;
  const clean = href.split(/[?#]/)[0];
  let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(page), clean));
  if (clean.endsWith('/') || !path.posix.extname(resolved)) resolved = path.posix.join(resolved, 'index.html');
  return resolved.replace(/^\.\//, '');
}

function links(fragment) {
  return [...fragment.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => {
    const attrs = match[1];
    const get = (name) => attrs.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? '';
    return { text: match[2].replace(/<[^>]*>/g, '').trim(), href: get('href'), className: get('class'), target: get('target'), rel: get('rel') };
  });
}

function expectedPair(page, isZh) {
  const candidate = isZh ? page.slice(3) : `zh/${page}`;
  return pageSet.has(candidate) ? candidate : (isZh ? 'index.html' : 'zh/index.html');
}

for (const page of pages) {
  const html = readFileSync(path.join(root, page), 'utf8');
  const footerMatches = [...html.matchAll(/<footer\b[^>]*\bclass=["'][^"']*\bfooter\b[^"']*["'][^>]*>[\s\S]*?<\/footer>/gi)];
  const errors = [];
  if (footerMatches.length !== 1) errors.push(`expected one footer.footer, found ${footerMatches.length}`);
  if (footerMatches.length === 1) {
    const footer = footerMatches[0][0];
    const isZh = page.startsWith('zh/');
    const lang = isZh ? canonical.zh : canonical.en;
    const anchorList = links(footer);
    const requireText = (value, label = value) => { if (!footer.includes(value)) errors.push(`missing ${label}`); };
    requireText(lang.description, 'canonical description');
    requireText(lang.address, 'canonical address');
    requireText(lang.copyright, 'canonical copyright');
    requireText('kisaweng@outlook.com', 'email');
    requireText('+86 188 6871 1458', 'telephone');
    requireText('https://wa.me/85262235101', 'WhatsApp URL');
    requireText(isZh ? '<h4>产品中心</h4>' : '<h4>Products</h4>', 'products heading');
    requireText(isZh ? '<h4>公司信息</h4>' : '<h4>Company</h4>', 'company heading');
    for (const text of lang.products) requireText(`>${text}</a>`, `${text} link`);
    for (const [text] of lang.company) requireText(`>${text}</a>`, `${text} link`);
    if (footer.includes('余姚市我们有限公司')) errors.push('obsolete Chinese company name');
    if (isZh && footer.includes('Yuyao Wei Xing Machinery Co., Ltd.')) errors.push('English copyright on Chinese page');
    if (!isZh && footer.includes('余姚市威兴机械有限公司')) errors.push('Chinese copyright on English page');

    const expectedTargets = new Map();
    expectedTargets.set('WEI XINGMACHINERY', isZh ? 'zh/index.html' : 'index.html');
    for (const text of lang.products) expectedTargets.set(text, `${isZh ? 'zh/' : ''}products/index.html`);
    for (const [text, target] of lang.company) expectedTargets.set(text, `${isZh ? 'zh/' : ''}${target}/index.html`);
    for (const [text, target] of expectedTargets) {
      const anchor = anchorList.find((item) => item.text === text);
      if (!anchor) continue;
      const actual = resolveLocal(page, anchor.href);
      if (actual !== target) errors.push(`${text} resolves to ${actual}, expected ${target}`);
      if (!actual || !pageSet.has(actual)) errors.push(`${text} target does not exist: ${actual}`);
    }

    const english = anchorList.find((item) => item.text === 'English');
    const chinese = anchorList.find((item) => item.text === '中文');
    if (!english || !chinese) errors.push('missing language switch links');
    else {
      const active = (anchor) => anchor.className.split(/\s+/).includes('active');
      if (active(english) !== !isZh || active(chinese) !== isZh) errors.push('incorrect active language state');
      const other = isZh ? english : chinese;
      const pair = expectedPair(page, isZh);
      if (resolveLocal(page, other.href) !== pair) errors.push(`language pair resolves to ${resolveLocal(page, other.href)}, expected ${pair}`);
      if (!pageSet.has(resolveLocal(page, other.href))) errors.push('language pair target does not exist');
    }
    for (const anchor of anchorList.filter((item) => item.target === '_blank')) {
      const rel = new Set(anchor.rel.split(/\s+/));
      if (!rel.has('noopener') || !rel.has('noreferrer')) errors.push(`unsafe target=_blank link: ${anchor.href}`);
    }
    const whatsapp = anchorList.find((item) => item.href === 'https://wa.me/85262235101');
    if (!whatsapp || whatsapp.target !== '_blank' || whatsapp.rel !== 'noopener noreferrer') errors.push('WhatsApp safety attributes are not canonical');
    if ((footer.match(/<svg\b/g) ?? []).length !== 1 || (footer.match(/<path\b/g) ?? []).length !== 2) errors.push('footer logo SVG structure changed');
    if ((footer.match(/<footer\b/g) ?? []).length !== 1 || (footer.match(/<\/footer>/g) ?? []).length !== 1) errors.push('footer nesting/closure error');
  }
  failureCount += errors.length;
  console.log(`${errors.length ? 'FAIL' : 'PASS'} ${page}${errors.length ? `\n  - ${errors.join('\n  - ')}` : ''}`);
}

console.log(`\nScanned ${pages.length} public HTML pages: ${pages.filter((p) => p.startsWith('zh/')).length} Chinese, ${pages.filter((p) => !p.startsWith('zh/')).length} English.`);
if (failureCount) {
  console.error(`${failureCount} footer validation failure(s).`);
  process.exitCode = 1;
} else {
  console.log('All sitewide footer checks passed.');
}
