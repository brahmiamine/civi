// Renders the PWA icons from one SVG source. Run with `npm run icons`.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

// Bleu de France tile with the app's tricolour mark and a white landmark glyph.
// `pad` shrinks the artwork toward the centre so maskable icons stay inside the safe zone.
const svg = (pad = 0, rounded = true) => {
  const s = 1 - pad * 2;
  const t = (v) => 512 * pad + v * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#2447A8"/>
  <g transform="translate(${t(0)} ${t(0)}) scale(${s})">
    <rect x="148" y="104" width="64" height="16" fill="#8AA5FF"/>
    <rect x="224" y="104" width="64" height="16" fill="#FFFFFF"/>
    <rect x="300" y="104" width="64" height="16" fill="#D42A3A"/>
    <g transform="translate(112 148) scale(12)" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/>
      <line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>
    </g>
  </g>
</svg>`;
};

writeFileSync('public/favicon.svg', svg());
const out = [
  ['public/pwa-192x192.png', 192, svg()],
  ['public/pwa-512x512.png', 512, svg()],
  ['public/maskable-512x512.png', 512, svg(0.1, false)],
  ['public/apple-touch-icon.png', 180, svg(0.04, false)],
];
for (const [file, size, src] of out) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(file);
  console.log('wrote', file);
}
