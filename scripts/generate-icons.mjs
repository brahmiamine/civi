// Renders all installable PWA assets from the shared Civi brand icon.
// Run with `npm run icons`.
import sharp from 'sharp';

const source = 'public/brand-icon.svg';
const blue = '#2447A8';

await sharp(source).resize(32, 32).png().toFile('public/favicon-32x32.png');
await sharp(source).resize(192, 192).png().toFile('public/pwa-192x192.png');
await sharp(source).resize(512, 512).png().toFile('public/pwa-512x512.png');

// Maskable icons need artwork safely inside the central area and a full-bleed background.
const maskableMark = await sharp(source).resize(410, 410).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: blue },
})
  .composite([{ input: maskableMark, gravity: 'centre' }])
  .png()
  .toFile('public/maskable-512x512.png');

// Apple touch icons should not rely on transparency.
const appleMark = await sharp(source).resize(164, 164).png().toBuffer();
await sharp({
  create: { width: 180, height: 180, channels: 4, background: blue },
})
  .composite([{ input: appleMark, gravity: 'centre' }])
  .png()
  .toFile('public/apple-touch-icon.png');

console.log('Civi brand icons generated');
