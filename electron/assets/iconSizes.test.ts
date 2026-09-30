// @vitest-environment node
//
// Issue #219 — the App mark in the app. The build-icon script renders the
// amended `familyflix-mark.svg` into `electron/assets/icon.ico` and
// `public/favicon.ico`, and both are committed. This suite reads what was
// committed rather than running the script: the `.ico` header is the contract
// Windows reads for the title bar, the taskbar, Alt+Tab and a pinned shortcut,
// and the favicon is what the browser tab shows under `npm run dev`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface IcoImage {
  size: number;
  bytes: Buffer;
}

/** An `.ico` file's directory: each image's size (0 in the header is 256) and its bytes. */
function readIco(path: string): IcoImage[] {
  const file = readFileSync(path);
  expect(file.readUInt16LE(0)).toBe(0);
  expect(file.readUInt16LE(2)).toBe(1);
  const count = file.readUInt16LE(4);

  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    const width = file.readUInt8(entry) || 256;
    const height = file.readUInt8(entry + 1) || 256;
    expect(height).toBe(width);
    const length = file.readUInt32LE(entry + 8);
    const offset = file.readUInt32LE(entry + 12);
    return { size: width, bytes: file.subarray(offset, offset + length) };
  });
}

const APP_ICON = fileURLToPath(new URL('./icon.ico', import.meta.url));
const FAVICON = fileURLToPath(
  new URL('../../public/favicon.ico', import.meta.url)
);

describe('iconSizes', () => {
  it('carries the App mark at all seven sizes Windows asks for', () => {
    const sizes = readIco(APP_ICON).map((image) => image.size);

    expect([...sizes].sort((a, b) => a - b)).toEqual([
      16, 24, 32, 48, 64, 128, 256,
    ]);
  });

  it('serves the App mark as the favicon: every image is icon.ico’s at that size', () => {
    const app = new Map(
      readIco(APP_ICON).map((image) => [image.size, image.bytes])
    );
    const favicon = readIco(FAVICON);

    expect(favicon.map((image) => image.size)).toEqual(
      expect.arrayContaining([16, 32])
    );
    for (const image of favicon) {
      expect(app.get(image.size)?.equals(image.bytes)).toBe(true);
    }
  });
});
