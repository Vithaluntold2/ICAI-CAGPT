const fs = require('fs');
const path = require('path');

function countUnusedImports(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let unusedCount = 0;
  
  for (const line of lines) {
    if (!line.trim().startsWith('import ')) continue;
    if (line.includes('import type')) continue; // Skip type-only imports
    
    // Extract named imports: import { a, b, c } from 'x'
    let match = line.match(/import\s*\{([^}]+)\}/);
    if (match) {
      const imports = match[1].split(',').map(s => {
        const parts = s.trim().split(/\s+as\s+/);
        return parts.length > 1 ? parts[1].trim() : parts[0].trim();
      });
      for (const imp of imports) {
        if (!imp || imp === 'type') continue;
        const regex = new RegExp('\\b' + imp + '\\b', 'g');
        const matches = content.match(regex);
        if (!matches || matches.length <= 1) unusedCount++;
      }
    } else {
      // Default import: import X from 'y'
      match = line.match(/import\s+([A-Za-z_][A-Za-z0-9_]*)\s+from/);
      if (match) {
        const imp = match[1];
        const regex = new RegExp('\\b' + imp + '\\b', 'g');
        const matches = content.match(regex);
        if (!matches || matches.length <= 1) unusedCount++;
      }
    }
  }
  return unusedCount;
}

const file = process.argv[2];
if (file) {
  console.log(countUnusedImports(file));
}
