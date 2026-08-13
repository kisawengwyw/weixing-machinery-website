import { readFile, writeFile } from 'node:fs/promises';

const file = 'products/hydraulic-valve-bodies/index.html';
let html = await readFile(file, 'utf8');

const replacements = [
  [
    '<title>Custom Hydraulic Valve Body Machining | Wei Xing Machinery</title>',
    '<title>Hydraulic Valve Machining & Custom Valve Bodies | Wei Xing Machinery</title>'
  ],
  [
    '<meta name="description" content="Custom hydraulic valve body machining in carbon steel, stainless steel and aluminum. Precision bores, ports, cavities and finishes to customer drawings.">',
    '<meta name="description" content="Hydraulic valve machining and custom valve body CNC services for spool bores, ports, cartridge cavities and internal passages in steel, stainless steel and aluminum.">'
  ],
  [
    '<meta property="og:title" content="Custom Hydraulic Valve Body Machining | Wei Xing Machinery">',
    '<meta property="og:title" content="Hydraulic Valve Machining & Custom Valve Bodies | Wei Xing Machinery">'
  ],
  [
    '<meta property="og:description" content="Custom hydraulic valve body machining in carbon steel, stainless steel and aluminum. Precision bores, ports, cavities and finishes to customer drawings.">',
    '<meta property="og:description" content="Hydraulic valve machining and custom valve body CNC services for spool bores, ports, cartridge cavities and internal passages in steel, stainless steel and aluminum.">'
  ],
  [
    '<meta name="twitter:title" content="Custom Hydraulic Valve Body Machining | Wei Xing Machinery">',
    '<meta name="twitter:title" content="Hydraulic Valve Machining & Custom Valve Bodies | Wei Xing Machinery">'
  ],
  [
    '<meta name="twitter:description" content="Custom hydraulic valve body machining in carbon steel, stainless steel and aluminum. Precision bores, ports, cavities and finishes to customer drawings.">',
    '<meta name="twitter:description" content="Hydraulic valve machining and custom valve body CNC services for spool bores, ports, cartridge cavities and internal passages in steel, stainless steel and aluminum.">'
  ],
  [
    '<h1>Custom Hydraulic Valve Body Machining</h1>',
    '<h1>Hydraulic Valve Machining & Custom Valve Bodies</h1>'
  ],
  [
    '<p class="hero-lead">Precision CNC-machined hydraulic valve bodies with spool bores, cartridge cavities, threaded ports, internal oil passages, sealing faces and mounting features, manufactured to customer drawings, 3D models or approved samples.</p>',
    '<p class="hero-lead">Precision CNC hydraulic valve machining for custom valve bodies with spool bores, cartridge cavities, threaded ports, internal oil passages, sealing faces and mounting features, manufactured to customer drawings, 3D models or approved samples.</p>'
  ],
  [
    '<p>Machining processes may include CNC milling, drilling, tapping, precision boring, reaming, cavity machining, cross-hole deburring, cleaning and drawing-specified secondary operations. Material, tolerances, surface finish and inspection requirements are reviewed for each project before quotation.</p>',
    '<p>Machining processes may include CNC milling, drilling, tapping, precision boring, reaming, hydraulic valve bore finishing, cavity machining, cross-hole deburring, cleaning and drawing-specified secondary operations. Material, tolerances, surface finish and inspection requirements are reviewed for each project before quotation.</p>'
  ],
  [
    'precision boring or reaming, valve spool bore machining, cartridge cavity machining, hydraulic valve port machining',
    'precision boring or reaming, hydraulic valve bore finishing, valve spool bore machining, cartridge cavity machining, hydraulic valve port machining'
  ],
  [
    '<div class="feature-item"><h4>Precision Boring and Reaming</h4><p>Valve body precision boring and reaming are used for functional bore features when specified.</p></div>',
    '<div class="feature-item"><h4>Precision Boring, Reaming and Valve Bore Finishing</h4><p>Hydraulic valve bore finishing may use precision boring, reaming and drawing-specified secondary finishing methods to control functional bore geometry and surface condition.</p></div>'
  ],
  [
    '<p><strong>How are valve bores, ports and internal passages inspected?</strong><br>Inspection follows the drawing and agreed inspection plan, covering critical bores, cavity features, port positions, passage relationships, sealing interfaces and final dimensions.</p><p><strong>How are cross-hole burrs and cleanliness controlled?</strong>',
    '<p><strong>How are valve bores, ports and internal passages inspected?</strong><br>Inspection follows the drawing and agreed inspection plan, covering critical bores, cavity features, port positions, passage relationships, sealing interfaces and final dimensions.</p><p><strong>How are hydraulic valve bores finished?</strong><br>Valve bore finishing is selected from the approved drawing and mating-component requirements. Depending on the design, the process may use precision boring, reaming or another drawing-specified finishing operation, followed by inspection of the required bore geometry and surface condition.</p><p><strong>How are cross-hole burrs and cleanliness controlled?</strong>'
  ],
  [
    '"name": "Custom Hydraulic Valve Body Machining | Wei Xing Machinery",',
    '"name": "Hydraulic Valve Machining & Custom Valve Bodies | Wei Xing Machinery",'
  ],
  [
    '"description": "Custom hydraulic valve body machining in carbon steel, stainless steel and aluminum. Precision bores, ports, cavities and finishes to customer drawings.",',
    '"description": "Hydraulic valve machining and custom valve body CNC services for spool bores, ports, cartridge cavities and internal passages in steel, stainless steel and aluminum.",'
  ],
  [
    '"about": {"@type": "Thing", "name": "Hydraulic valve body machining"}',
    '"about": {"@type": "Thing", "name": "Hydraulic valve machining and custom valve body machining"}'
  ],
  [
    '{"@type": "Question", "name": "How are valve bores, ports and internal passages inspected?", "acceptedAnswer": {"@type": "Answer", "text": "Inspection follows the drawing and agreed inspection plan, covering critical bores, cavity features, port positions, passage relationships, sealing interfaces and final dimensions."}},\n        {"@type": "Question", "name": "How are cross-hole burrs and cleanliness controlled?"',
    '{"@type": "Question", "name": "How are valve bores, ports and internal passages inspected?", "acceptedAnswer": {"@type": "Answer", "text": "Inspection follows the drawing and agreed inspection plan, covering critical bores, cavity features, port positions, passage relationships, sealing interfaces and final dimensions."}},\n        {"@type": "Question", "name": "How are hydraulic valve bores finished?", "acceptedAnswer": {"@type": "Answer", "text": "Valve bore finishing is selected from the approved drawing and mating-component requirements. Depending on the design, the process may use precision boring, reaming or another drawing-specified finishing operation, followed by inspection of the required bore geometry and surface condition."}},\n        {"@type": "Question", "name": "How are cross-hole burrs and cleanliness controlled?"'
  ]
];

for (const [before, after] of replacements) {
  const count = html.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one match, found ${count}: ${before.slice(0, 120)}`);
  }
  html = html.replace(before, after);
}

await writeFile(file, html);
console.log(`Applied ${replacements.length} guarded SEO replacements to ${file}`);
