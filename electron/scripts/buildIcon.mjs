// `node electron/scripts/buildIcon.mjs` — render the **App mark** from
// `docs/handoff/brand/familyflix-mark.svg` into everything that shows it.
// Issue #219.
//
// - `electron/assets/icon.ico` at 16, 24, 32, 48, 64, 128 and 256: the title
//   bar, the taskbar, Alt+Tab and a pinned shortcut.
// - `public/favicon.ico` at 16, 32 and 48: the browser tab under `npm run dev`,
//   each image byte for byte `icon.ico`'s at that size.
// - The preview PNGs at 256, 512 and 1024 beside the SVG.
//
// Run by hand when the mark changes; its outputs are committed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../..', import.meta.url));
const brand = join(root, 'docs', 'handoff', 'brand');
const svg = readFileSync(join(brand, 'familyflix-mark.svg'));

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
const FAVICON_SIZES = [16, 32, 48];
const PREVIEW_SIZES = [256, 512, 1024];

/** The mark at one size, as PNG bytes. */
function render(size) {
  return sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

/** An `.ico` whose every image is a PNG, in the order given. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, bytes }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(bytes.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += bytes.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.bytes)]);
}

function write(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

const images = await Promise.all(
  ICON_SIZES.map(async (size) => ({ size, bytes: await render(size) }))
);

write(join(root, 'electron', 'assets', 'icon.ico'), ico(images));
write(
  join(root, 'public', 'favicon.ico'),
  ico(images.filter((image) => FAVICON_SIZES.includes(image.size)))
);
for (const size of PREVIEW_SIZES) {
  write(join(brand, `familyflix-mark-${size}.png`), await render(size));
}
