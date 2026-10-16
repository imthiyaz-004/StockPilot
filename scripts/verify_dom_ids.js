const fs = require('fs');
const js = fs.readFileSync('public/js/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');

const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = regex.exec(js)) !== null) {
  ids.add(match[1]);
}

console.log('Total getElementById targets:', ids.size);
const missing = [];
for (const id of ids) {
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    missing.push(id);
  }
}

if (missing.length === 0) {
  console.log('PASS: All ' + ids.size + ' IDs exist in public/index.html!');
  process.exit(0);
} else {
  console.error('FAIL: Missing IDs in HTML:', missing);
  process.exit(1);
}
