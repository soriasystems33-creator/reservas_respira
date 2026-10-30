const fs = require('fs');
const path = require('path');

const root = 'D:\\DBOZA\\OneDrive\\Escritorio\\GitHub\\panel_respira';
const regex = /Estetica Respira/gi;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name.startsWith('.')) continue;
      walk(full);
    } else {
      const content = fs.readFileSync(full, 'utf8');
      if (regex.test(content)) {
        console.log(`Found Estetica Respira in ${full}`);
      }
    }
  }
}

walk(root);
