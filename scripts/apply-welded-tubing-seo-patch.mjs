import fs from 'node:fs';

const path = 'products/welded-tube-assemblies/index.html';
let html = fs.readFileSync(path, 'utf8');

function replaceExact(oldText, newText, expectedCount = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} occurrence(s), found ${count}: ${oldText.slice(0, 120)}`);
  }
  html = html.split(oldText).join(newText);
}

const oldDescription = 'Custom welded tube assemblies for hydraulic and industrial equipment, with tube routing, machined fittings, welded joints and inspection to customer drawings.';
const newDescription = 'Custom welded tubing assemblies for hydraulic and industrial equipment, with rigid tube routing, machined fittings, welded joints and inspection to customer drawings.';
const oldTitle = 'Custom Welded Tube Assemblies Manufacturer | Wei Xing Machinery';
const newTitle = 'Custom Welded Tubing Assemblies Manufacturer | Wei Xing Machinery';

replaceExact(`<title>${oldTitle}</title>`, `<title>${newTitle}</title>`);
replaceExact(`<meta name="description" content="${oldDescription}">`, `<meta name="description" content="${newDescription}">`);
replaceExact(`<meta property="og:title" content="${oldTitle}">`, `<meta property="og:title" content="${newTitle}">`);
replaceExact(`<meta property="og:description" content="${oldDescription}">`, `<meta property="og:description" content="${newDescription}">`);
replaceExact(`<meta name="twitter:title" content="${oldTitle}">`, `<meta name="twitter:title" content="${newTitle}">`);
replaceExact(`<meta name="twitter:description" content="${oldDescription}">`, `<meta name="twitter:description" content="${newDescription}">`);
replaceExact('<h1>Custom Welded Tube Assemblies</h1>', '<h1>Custom Welded Tubing Assemblies</h1>');
replaceExact(
  '<p>Drawing-specific rigid tube assemblies combining straight or bent tubing, CNC-machined weld fittings, bosses, flanges and mounting brackets for hydraulic and industrial fluid routing.</p>',
  '<p>Drawing-specific welded tubing assemblies combining straight or bent rigid tubing, CNC-machined weld fittings, bosses, flanges and mounting brackets for hydraulic and industrial fluid routing.</p>'
);
replaceExact('<h2>Custom Welded Tube Assembly Manufacturing</h2>', '<h2>Custom Welded Tubing Assembly Manufacturing</h2>');
replaceExact('What is a welded tube assembly?', 'What is a welded tubing assembly?', 2);
replaceExact(
  'A welded tube assembly is a drawing-specific rigid fluid-routing component made from straight or bent tubing, machined fittings, bosses, branches, flanges or mounting brackets.',
  'A welded tubing assembly is a drawing-specific rigid fluid-routing component made from straight or bent tubing, machined fittings, bosses, branches, flanges or mounting brackets.',
  2
);
replaceExact(`"name": "${oldTitle}"`, `"name": "${newTitle}"`);
replaceExact(`"description": "${oldDescription}"`, `"description": "${newDescription}"`);
replaceExact('"name": "Custom welded tube assemblies"', '"name": "Custom welded tubing assemblies"');

if (!html.includes('<h1>Custom Welded Tubing Assemblies</h1>')) {
  throw new Error('Target H1 was not applied.');
}
if (!html.includes('welded tubing assemblies')) {
  throw new Error('Target search phrase is missing.');
}

const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
if (!jsonLdMatch) throw new Error('JSON-LD block not found.');
JSON.parse(jsonLdMatch[1]);

fs.writeFileSync(path, html);
console.log('Applied welded tubing assemblies SEO patch and validated JSON-LD.');
