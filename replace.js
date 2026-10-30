const fs = require('fs');
const path = require('path');

const root = 'D:\\DBOZA\\OneDrive\\Escritorio\\GitHub\\panel_respira';
const regex = /Estetica Respira[-\s]?VICEN/gi;

function walk(dir) {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
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
