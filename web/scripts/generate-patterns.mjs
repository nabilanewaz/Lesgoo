// Generates the CSS data-URI patterns used in src/app/globals.css (--flower-border, --swirl).
// Run: node scripts/generate-patterns.mjs, then paste the two values into :root.
// Kept as a script because hand-encoding SVG inside CSS is error-prone.

const OUTLINE = '#0a1f1c';

const encode = (svg) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
    .replace(/%2C/g, ',')}")`;

// A six-petal painted daisy centred at (cx, cy).
const daisy = (cx, cy, colour) =>
  `<g transform="translate(${cx} ${cy})">` +
  `<g fill="${colour}" stroke="${OUTLINE}" stroke-width=".6">` +
  [0, 60, 120, 180, 240, 300].map((a) => `<ellipse cy="-4.2" rx="2.5" ry="4.4" transform="rotate(${a})"/>`).join('') +
  `</g><circle r="2.3" fill="#ffc21a" stroke="${OUTLINE}" stroke-width=".5"/><circle r=".9" fill="#fff"/></g>`;

// border-image source: a 3×3 grid of 18px cells. Corners pink, top/bottom gold, sides blue.
const cells = [
  ['#ff4f9a', '#ffc21a', '#ff4f9a'],
  ['#4fb3ff', null, '#4fb3ff'],
  ['#ff4f9a', '#ffc21a', '#ff4f9a'],
];
const flowers = cells.flatMap((row, r) => row.map((c, col) => (c ? daisy(9 + col * 18, 9 + r * 18, c) : ''))).join('');
const border = `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54"><rect width="54" height="54" fill="${OUTLINE}"/>${flowers}</svg>`;

// Background tile: swirling leaf strokes, a shade lighter than the teal ground.
const swirl = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><g fill="none" stroke="#124a42" stroke-width="3" stroke-linecap="round">
<path d="M-10 30 C 20 0, 40 60, 80 30 S 140 0, 170 30"/><path d="M-10 110 C 20 80, 40 140, 80 110 S 140 80, 170 110"/>
<path d="M12 70 q 10 -12 20 0 t 20 0"/><path d="M92 152 q 10 -12 20 0 t 20 0"/>
<path d="M104 64 q 8 -10 16 0"/><path d="M34 142 q 8 -10 16 0"/></g></svg>`;

console.log(`--flower-border: ${encode(border)};`);
console.log(`--swirl: ${encode(swirl)};`);
