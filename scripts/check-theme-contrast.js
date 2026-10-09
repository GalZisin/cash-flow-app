// Checks WCAG contrast of every theme palette (src/themes/palettes/_*.scss), light and dark.
// Run: npm run themes:check   (exit code 1 if any pair fails)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src', 'themes', 'palettes');
const L = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join('');
  const c = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function parse(file) {
  const s = fs.readFileSync(file, 'utf8'); const out = {};
  for (const mode of ['light', 'dark']) {
    const m = s.match(new RegExp(mode + ':\\s*\\(([\\s\\S]*?)\\),\\s*(?:dark:|\\);)'));
    out[mode] = Object.fromEntries([...m[1].matchAll(/([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})/g)].map(x => [x[1], x[2]]));
  }
  return out;
}
// [label, fg, bg, minimum]
const CHECKS = [
  ['text on bg', 'text', 'bg', 7], ['text on surface', 'text', 'surface', 7],
  ['text-2 on surface', 'text-2', 'surface', 4.5], ['text-3 on surface', 'text-3', 'surface', 4.5],
  ['text-3 on surface-3', 'text-3', 'surface-3', 4.5], ['text-4 on surface (hints)', 'text-4', 'surface', 3],
  ['on-primary on primary', 'on-primary', 'primary', 4.5], ['primary-text on surface', 'primary-text', 'surface', 4.5],
  ['primary-text on primary-soft', 'primary-text', 'primary-soft', 4.5], ['accent on surface', 'accent', 'surface', 3],
  ['success on success-soft', 'success', 'success-soft', 4.5], ['danger on danger-soft', 'danger', 'danger-soft', 4.5],
  ['warning on warning-soft', 'warning', 'warning-soft', 4.5], ['success on surface', 'success', 'surface', 4.5],
  ['danger on surface', 'danger', 'surface', 4.5], ['warning on surface', 'warning', 'surface', 4.5],
  ['white on danger-solid', null, 'danger-solid', 4.5]
];
let fails = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.scss'))) {
  const p = parse(path.join(dir, f));
  for (const mode of ['light', 'dark']) {
    const t = p[mode]; const bad = [];
    for (const [label, fg, bg, min] of CHECKS) {
      const a = fg ? t[fg] : '#ffffff', b = t[bg];
      if (!a || !b) { bad.push(`${label}: MISSING`); continue; }
      const r = cr(a, b); if (r < min) bad.push(`${label} ${r.toFixed(2)} < ${min}`);
    }
    const sep = cr(t.surface, t.bg).toFixed(2);
    fails += bad.length;
    console.log(`${f.replace(/^_|\.scss$/g, '').padEnd(9)} ${mode.padEnd(5)} surface/bg ${sep}  ${bad.length ? 'FAIL: ' + bad.join(' | ') : 'all pass'}`);
  }
}
console.log(fails ? `\n${fails} failing pairs` : '\nall pairs pass');
process.exit(fails ? 1 : 0);
