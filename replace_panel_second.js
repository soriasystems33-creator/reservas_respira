const fs = require('fs');
const path = require('path');

const root = 'D:\\DBOZA\\OneDrive\\Escritorio\\GitHub\\panel_respira';
// Replace any occurrence of Estetica Respira (case‑insensitive) and also Estetica Respira‑VICEN variants
const regex = /Estetica Respira[-\\s]?VICEN|Estetica Respira/gi;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name.startsWith('.')) continue; // skip hidden
      walk(full);
    } else {
      const content = fs.readFileSync(full, 'utf8');
      if (regex.test(content)) {
        const newContent = content.replace(regex, 'Estetica Respira');
        fs.writeFileSync(full, newContent, 'utf8');
        console.log(`Updated ${full}`);
      }
    }
  }
}

walk(root);
