import fs from 'node:fs';

const path = 'products/hydraulic-manifold-blocks/index.html';
let html = fs.readFileSync(path, 'utf8');

function replaceExact(oldText, newText, expectedCount = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} occurrence(s), found ${count}: ${oldText.slice(0, 140)}`);
  }
  html = html.split(oldText).join(newText);
}

const oldTitle = 'Hydraulic Manifold Blocks Manufacturer | Wei Xing Machinery';
const newTitle = 'Hydraulic Manifold Precision Machining & Custom Blocks | Wei Xing Machinery';
const oldDescription = 'Custom hydraulic manifold blocks CNC-machined to drawings with specified passages, valve cavities, ports, materials, cleanliness and inspection requirements.';
const newDescription = 'Hydraulic manifold precision machining for custom blocks with drawing-specified passages, valve cavities, ports, materials, cleanliness and inspection requirements.';

replaceExact(`<title>${oldTitle}</title>`, `<title>${newTitle}</title>`);
replaceExact(`<meta name="description" content="${oldDescription}">`, `<meta name="description" content="${newDescription}">`);
replaceExact(`<meta property="og:title" content="${oldTitle}">`, `<meta property="og:title" content="${newTitle}">`);
replaceExact(`<meta property="og:description" content="${oldDescription}">`, `<meta property="og:description" content="${newDescription}">`);
replaceExact(`<meta name="twitter:title" content="${oldTitle}">`, `<meta name="twitter:title" content="${newTitle}">`);
replaceExact(`<meta name="twitter:description" content="${oldDescription}">`, `<meta name="twitter:description" content="${newDescription}">`);
replaceExact('<h1>Custom Hydraulic Manifold Blocks</h1>', '<h1>Hydraulic Manifold Precision Machining & Custom Blocks</h1>');
replaceExact(
  '<p class="hero-lead">Custom hydraulic manifold blocks manufactured to approved drawings and circuit information for integrating internal passages, ports, valve cavities, mounting faces and closure locations.</p>',
  '<p class="hero-lead">Hydraulic manifold precision machining for custom blocks manufactured to approved drawings and circuit information, integrating internal passages, ports, valve cavities, mounting faces and closure locations.</p>'
);
replaceExact('<h2>Hydraulic Manifold Block Manufacturing</h2>', '<h2>Hydraulic Manifold Precision Machining</h2>');
replaceExact(
  '<p>Wei Xing Machinery provides custom hydraulic manifold machining to approved 2D drawings, 3D models, schematics and mating-component data. A verified sample can support dimensional review, but hidden routing, depths, restrictions, closures and revisions require approved internal information.</p>',
  '<p>Wei Xing Machinery provides hydraulic manifold precision machining and custom manifold block manufacturing to approved 2D drawings, 3D models, schematics and mating-component data. A verified sample can support dimensional review, but hidden routing, depths, restrictions, closures and revisions require approved internal information.</p>'
);
replaceExact('<h2 class="section-title">Hydraulic Manifold Block Manufacturing Capabilities</h2>', '<h2 class="section-title">Hydraulic Manifold Precision Machining Capabilities</h2>');
replaceExact(`"name": "${oldTitle}"`, `"name": "${newTitle}"`);
replaceExact(`"description": "${oldDescription}"`, `"description": "${newDescription}"`);
replaceExact('"name": "Hydraulic Manifold Blocks"', '"name": "Hydraulic Manifold Precision Machining and Custom Blocks"', 2);

if (!html.includes('<h1>Hydraulic Manifold Precision Machining & Custom Blocks</h1>')) {
  throw new Error('Target H1 was not applied.');
}
if (!html.includes('hydraulic manifold precision machining')) {
  throw new Error('Target search phrase is missing.');
}
const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
if (!jsonLdMatch) throw new Error('JSON-LD block not found.');
JSON.parse(jsonLdMatch[1]);

fs.writeFileSync(path, html);
console.log('Applied hydraulic manifold precision machining SEO patch and validated JSON-LD.');
