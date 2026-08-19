import fs from 'node:fs';

const path = 'products/npt-pipe-fittings/index.html';
let html = fs.readFileSync(path, 'utf8');

const replacements = [
  ['NPT Pipe Fittings Manufacturer | Wei Xing Machinery', 'NPT Hydraulic Fittings & Adapters Manufacturer | Wei Xing Machinery'],
  ['Custom NPT pipe fittings and adapters, CNC-machined to drawings with specified taper threads, materials, finishes and inspection requirements.', 'Custom NPT hydraulic fittings and adapters with tapered pipe threads, CNC-machined to drawings for hydraulic ports, fluid lines and OEM equipment.'],
  ['<h1>Custom NPT Pipe Fittings</h1>', '<h1>Custom NPT Hydraulic Fittings & Adapters</h1>'],
  ['<p class="hero-lead">NPT tapered pipe fittings and mixed-interface adapters manufactured to customer drawings for hydraulic ports, instrumentation, fluid lines and OEM equipment.</p>', '<p class="hero-lead">NPT hydraulic fittings and adapters with tapered pipe threads, manufactured to customer drawings for hydraulic ports, instrumentation, fluid lines and OEM equipment.</p>'],
  ['<h2>NPT Pipe Fitting Manufacturing</h2>', '<h2>NPT Hydraulic Fitting & Adapter Manufacturing</h2>'],
  ['<h2 class="section-title">NPT Fitting Manufacturing Capabilities</h2>', '<h2 class="section-title">NPT Hydraulic Fitting Manufacturing Capabilities</h2>'],
  ['"name": "NPT Pipe Fittings"', '"name": "NPT Hydraulic Fittings and Adapters"']
];

for (const [from, to] of replacements) {
  const count = html.split(from).length - 1;
  if (count < 1) throw new Error(`Expected text not found: ${from}`);
  html = html.split(from).join(to);
}

fs.writeFileSync(path, html);

const checks = [
  'NPT Hydraulic Fittings & Adapters Manufacturer | Wei Xing Machinery',
  '<h1>Custom NPT Hydraulic Fittings & Adapters</h1>',
  '<h2>NPT Hydraulic Fitting & Adapter Manufacturing</h2>',
  '<h2 class="section-title">NPT Hydraulic Fitting Manufacturing Capabilities</h2>',
  '"name": "NPT Hydraulic Fittings and Adapters"'
];
for (const check of checks) {
  if (!html.includes(check)) throw new Error(`Validation failed: ${check}`);
}

for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  JSON.parse(match[1]);
}

console.log('NPT hydraulic fittings intent update applied and JSON-LD validated.');
