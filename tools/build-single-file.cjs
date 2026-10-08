/* ============================================================
   tools/build-single-file.cjs
   Bundles the ENTIRE game into ONE self-contained .html file
   (inline CSS + inline JS, zero external assets).
   Perfect for: sharing with a friend, GitHub web upload, itch.io.
   Run: npm run build:single
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }

const html = read('index.html');
const css = read('css/style.css');
const order = ['js/audio.js', 'js/levels.js', 'js/engine.js', 'js/game.js'];

let out = html;

// inline the stylesheet
if (!out.includes('<link rel="stylesheet" href="css/style.css">')) {
  throw new Error('stylesheet link tag not found in index.html');
}
out = out.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>');

// inline the scripts (in dependency order)
for (const p of order) {
  const src = read(p);
  if (src.includes('</script')) throw new Error(p + ' contains a closing script tag — cannot inline safely');
  const tag = '<script src="' + p + '"></script>';
  if (!out.includes(tag)) throw new Error('script tag not found in index.html: ' + tag);
  out = out.replace(tag, '<script>\n' + src + '\n</script>');
}

out = out.replace('<title>Trap Devil: Rage Edition 😈</title>',
  '<title>Trap Devil: Rage Edition 😈 (single-file)</title>');

const dest = path.join(root, 'trap-devil-single-file.html');
fs.writeFileSync(dest, out);
console.log('✅ wrote trap-devil-single-file.html (' + Math.round(out.length / 1024) + ' KB, fully self-contained)');
