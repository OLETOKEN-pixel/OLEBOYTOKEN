// Generate cropped, recolored brand assets (navbar wordmark + favicons) from the
// master OleBoy "OB" logo. The master art is a black mark sitting inside a huge
// 2000x2000 transparent canvas, which makes it render tiny everywhere. Here we:
//   1. binarize the alpha (drop the faint halo, keep the solid mark),
//   2. recolor the mark to white or black while preserving its alpha,
//   3. trim the transparent padding to the mark's tight bounding box,
//   4. emit a high-res navbar wordmark + square favicons / app icons.
//
// Run with: npm run assets:brand

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const brandDir = path.resolve(here, '..', 'public', 'figma-assets', 'brand');
const SOURCE = path.join(brandDir, 'logo-official.png');

// Pixels with alpha below this are treated as background (the faint green halo).
const ALPHA_THRESHOLD = 96;

/**
 * Recolor every visible pixel to `rgb`, binarizing alpha against ALPHA_THRESHOLD,
 * then trim the surrounding transparency to the mark's tight bounding box.
 * @returns {Promise<Buffer>} trimmed PNG buffer
 */
async function makeTrimmedMark(rgb) {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const visible = out[i + 3] >= ALPHA_THRESHOLD;
    out[i] = rgb[0];
    out[i + 1] = rgb[1];
    out[i + 2] = rgb[2];
    out[i + 3] = visible ? 255 : 0;
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .trim({ threshold: 1 })
    .toBuffer();
}

/** Pad a trimmed mark into a centered square (with a small breathing margin). */
async function toSquare(markBuffer, marginRatio = 0.12) {
  const meta = await sharp(markBuffer).metadata();
  const longest = Math.max(meta.width, meta.height);
  const size = Math.round(longest * (1 + marginRatio * 2));
  const top = Math.round((size - meta.height) / 2);
  const left = Math.round((size - meta.width) / 2);

  return sharp(markBuffer)
    .extend({
      top,
      bottom: size - meta.height - top,
      left,
      right: size - meta.width - left,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function writePng(buffer, name, { height, width, square } = {}) {
  let pipeline = sharp(buffer);
  if (square) pipeline = pipeline.resize(square, square, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  else if (height) pipeline = pipeline.resize({ height });
  else if (width) pipeline = pipeline.resize({ width });

  const target = path.join(brandDir, name);
  await pipeline.png().toFile(target);
  const meta = await sharp(target).metadata();
  console.log(`  ${name.padEnd(22)} ${meta.width}x${meta.height}`);
}

async function main() {
  console.log(`Source: ${SOURCE}`);

  const whiteMark = await makeTrimmedMark([255, 255, 255]);
  const blackMark = await makeTrimmedMark([0, 0, 0]);
  const whiteMeta = await sharp(whiteMark).metadata();
  console.log(`Trimmed mark bounding box: ${whiteMeta.width}x${whiteMeta.height}`);

  const whiteSquare = await toSquare(whiteMark);
  const blackSquare = await toSquare(blackMark);

  console.log('Generated:');
  // Navbar wordmark — white, high-res, aspect preserved.
  await writePng(whiteMark, 'logo-wordmark.png', { height: 220 });
  // Favicons — transparent OB, white for dark tabs, black for light tabs.
  await writePng(whiteSquare, 'favicon-dark.png', { square: 64 });
  await writePng(blackSquare, 'favicon-light.png', { square: 64 });
  // Apple touch + PWA icon — white OB.
  await writePng(whiteSquare, 'apple-touch-icon.png', { square: 180 });
  await writePng(whiteSquare, 'icon-512.png', { square: 512 });

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
