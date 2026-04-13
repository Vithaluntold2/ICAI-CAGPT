const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node show-unused-imports.cjs <file>');
  process.exit(1);
}

const fullPath = path.resolve(filePath);
if (!fs.existsSync(fullPath)) {
  console.log('File not found');
  process.exit(1);
}

const content = fs.readFileSync(fullPath, 'utf-8');

// Extract all imports
const imports = [];
const importRegex = /import\s+(?:(?:(\w+)|{\s*([^}]+)\s*}|(\w+)\s*,\s*{\s*([^}]+)\s*})\s+from\s+['"][^'"]+['"]|['"][^'"]+['"])/g;

let match;
while ((match = importRegex.exec(content)) !== null) {
  if (match[1]) imports.push(match[1].trim());
  if (match[2]) match[2].split(',').forEach(i => {
    const name = i.trim().split(/\s+as\s+/)[1] || i.trim().split(/\s+as\s+/)[0];
    if (name) imports.push(name.trim());
  });
  if (match[3]) imports.push(match[3].trim());
  if (match[4]) match[4].split(',').forEach(i => {
    const name = i.trim().split(/\s+as\s+/)[1] || i.trim().split(/\s+as\s+/)[0];
    if (name) imports.push(name.trim());
  });
}

// Find unused
const unused = [];
const contentWithoutImports = content.replace(/import\s+.*?from\s+['"][^'"]+['"];?/gs, '');

imports.forEach(imp => {
  if (!imp || imp === 'type') return;
  const regex = new RegExp('\\b' + imp + '\\b', 'g');
  const matches = contentWithoutImports.match(regex);
  if (!matches || matches.length === 0) {
    unused.push(imp);
  }
});

if (unused.length > 0) {
  console.log(unused.length + ' unused: ' + unused.join(', '));
} else {
  console.log('0 unused');
}
