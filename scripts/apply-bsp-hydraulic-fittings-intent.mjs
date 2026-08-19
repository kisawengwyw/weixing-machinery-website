import fs from 'node:fs';

const path = 'products/bsp-hydraulic-adapters/index.html';
let html = fs.readFileSync(path, 'utf8');

const replacements = [
  ['BSP Hydraulic Adapters Manufacturer | Wei Xing Machinery', 'BSP Hydraulic Fittings & Adapters Manufacturer | Wei Xing Machinery'],
  ['Custom BSP hydraulic adapters with BSPP, BSPT and conversion connections, CNC-machined to drawings with project-specific materials, finishes and inspection.', 'Custom BSP hydraulic fittings and adapters with BSPP, BSPT and conversion connections, CNC-machined to drawings for OEM hydraulic systems.'],
  ['<h1>Custom BSP Hydraulic Adapters</h1>', '<h1>Custom BSP Hydraulic Fittings & Adapters</h1>'],
  ['<p class="hero-lead">BSPP, BSPT and mixed-interface hydraulic adapters manufactured to customer drawings for ports, hose assemblies, tube connections and OEM hydraulic equipment.</p>', '<p class="hero-lead">BSP hydraulic fittings and adapters, including BSPP, BSPT and mixed-interface configurations, manufactured to customer drawings for ports, hose assemblies, tube connections and OEM hydraulic equipment.</p>'],
  ['<h2>BSP Hydraulic Adapter Manufacturing</h2>', '<h2>BSP Hydraulic Fittings & Adapter Manufacturing</h2>'],
  ['<h2 class="section-title">BSP Adapter Manufacturing Capabilities</h2>', '<h2 class="section-title">BSP Hydraulic Fittings & Adapter Manufacturing Capabilities</h2>'],
  ['"name": "Custom BSP Hydraulic Adapters"', '"name": "Custom BSP Hydraulic Fittings and Adapters"']
];

for (const [from, to] of replacements) {
  const count = html.split(from).length - 1;
  if (count < 1) throw new Error(`Expected text not found: ${from}`);
  html = html.split(from).join(to);
}

fs.writeFileSync(path, html);

const checks = [
  'BSP Hydraulic Fittings & Adapters Manufacturer | Wei Xing Machinery',
  '<h1>Custom BSP Hydraulic Fittings & Adapters</h1>',
  '<h2>BSP Hydraulic Fittings & Adapter Manufacturing</h2>',
  '<h2 class="section-title">BSP Hydraulic Fittings & Adapter Manufacturing Capabilities</h2>',
  '"name": "Custom BSP Hydraulic Fittings and Adapters"'
];
for (const check of checks) {
  if (!html.includes(check)) throw new Error(`Validation failed: ${check}`);
}

for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  JSON.parse(match[1]);
}

console.log('BSP hydraulic fittings intent update applied and JSON-LD validated.');
