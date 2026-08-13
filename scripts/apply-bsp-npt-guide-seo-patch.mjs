import fs from 'node:fs';

const path = 'guides/bsp-vs-npt-threads/index.html';
let html = fs.readFileSync(path, 'utf8');

function replaceExact(oldText, newText, expectedCount = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} occurrence(s), found ${count}: ${oldText.slice(0, 140)}`);
  }
  html = html.split(oldText).join(newText);
}

replaceExact(
  '<meta name="description" content="Compare BSP and NPT threads by thread form, sealing method, identification steps and selection information.">',
  '<meta name="description" content="Compare BSPP vs NPT and BSPT vs NPT threads by thread angle, taper, sealing method, identification steps and adapter selection.">'
);
replaceExact(
  '"description":"Compare BSP and NPT threads by thread form, sealing method, identification steps and selection information."',
  '"description":"Compare BSPP vs NPT and BSPT vs NPT threads by thread angle, taper, sealing method, identification steps and adapter selection."'
);
replaceExact('"dateModified":"2026-07-13"', '"dateModified":"2026-08-13"');
replaceExact(
  '<p>A practical guide to BSPP, BSPT and NPT thread identification and selection.</p>',
  '<p>A practical guide to BSPP vs NPT and BSPT vs NPT thread differences, sealing, identification and adapter selection.</p>'
);
replaceExact(
  '<h2>BSPP vs BSPT</h2><p>BSPP is parallel and may seal through a bonded washer, O-ring, cone seat or another specified sealing interface. BSPT is tapered and normally relies on tapered thread engagement with a suitable sealing method where required.</p><h2>What Is NPT?</h2>',
  '<h2>BSPP vs BSPT</h2><p>BSPP is parallel and may seal through a bonded washer, O-ring, cone seat or another specified sealing interface. BSPT is tapered and normally relies on tapered thread engagement with a suitable sealing method where required.</p><h2 id="bspp-vs-npt">BSPP vs NPT</h2><p>BSPP and NPT differ in both thread geometry and sealing approach. BSPP uses a parallel 55-degree Whitworth thread form, while NPT uses a tapered 60-degree thread form. A BSPP connection normally seals at a washer, O-ring, cone seat or another specified interface; NPT normally seals through tapered thread engagement with suitable sealant where required. Similar nominal sizes should not be treated as interchangeable.</p><h2 id="bspt-vs-npt">BSPT vs NPT</h2><p>BSPT and NPT are both tapered pipe threads, but they use different thread forms: BSPT uses the 55-degree Whitworth profile and NPT uses a 60-degree profile. Pitch and diameter relationships can also differ by size, so a BSPT male thread should not be assumed to fit or seal correctly in an NPT female port. Confirm the thread family with a gauge, diameter and pitch measurements, taper check and the mating-port specification.</p><h2>What Is NPT?</h2>'
);
replaceExact(
  '<details><summary>What is the difference between BSPP and BSPT?</summary><p>BSPP is a parallel thread, while BSPT is a tapered thread. Both use a 55-degree Whitworth thread form.</p></details>',
  '<details><summary>What is the difference between BSPP and BSPT?</summary><p>BSPP is a parallel thread, while BSPT is a tapered thread. Both use a 55-degree Whitworth thread form.</p></details><details><summary>What is the difference between BSPP and NPT?</summary><p>BSPP is a parallel 55-degree Whitworth thread and typically seals at a separate sealing interface, while NPT is a tapered 60-degree thread that normally seals through tapered thread engagement with suitable sealant where required.</p></details><details><summary>Are BSPT and NPT the same?</summary><p>No. Both are tapered pipe threads, but BSPT uses a 55-degree Whitworth thread form and NPT uses a 60-degree thread form. Their pitch and diameter relationships can also differ by size.</p></details>'
);
replaceExact(
  '{"@type":"Question","name":"What is the difference between BSPP and BSPT?","acceptedAnswer":{"@type":"Answer","text":"BSPP is a parallel thread, while BSPT is a tapered thread. Both use a 55-degree Whitworth thread form."}},',
  '{"@type":"Question","name":"What is the difference between BSPP and BSPT?","acceptedAnswer":{"@type":"Answer","text":"BSPP is a parallel thread, while BSPT is a tapered thread. Both use a 55-degree Whitworth thread form."}},{"@type":"Question","name":"What is the difference between BSPP and NPT?","acceptedAnswer":{"@type":"Answer","text":"BSPP is a parallel 55-degree Whitworth thread and typically seals at a separate sealing interface, while NPT is a tapered 60-degree thread that normally seals through tapered thread engagement with suitable sealant where required."}},{"@type":"Question","name":"Are BSPT and NPT the same?","acceptedAnswer":{"@type":"Answer","text":"No. Both are tapered pipe threads, but BSPT uses a 55-degree Whitworth thread form and NPT uses a 60-degree thread form. Their pitch and diameter relationships can also differ by size."}},'
);
replaceExact(
  '<time datetime="2026-07-13">2026-07-13</time>',
  '<time datetime="2026-08-13">Updated 2026-08-13</time>'
);

if (!html.includes('id="bspp-vs-npt"') || !html.includes('id="bspt-vs-npt"')) {
  throw new Error('Target comparison sections were not applied.');
}
if (!html.includes('What is the difference between BSPP and NPT?')) {
  throw new Error('Target FAQ was not applied.');
}

const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
if (!jsonLdMatch) throw new Error('JSON-LD block not found.');
JSON.parse(jsonLdMatch[1]);

fs.writeFileSync(path, html);
console.log('Applied BSP/NPT guide SEO patch and validated JSON-LD.');
