// @vitest-environment node
//
// 71, Busy overlay, Phase 7 (issue #682): the **Dialog loader** is a layer
// of `Modal`, drawn over a dialog's own card through its `loader` prop. No
// dialog draws one of its own, and no dialog early-returns a second `Modal`
// for its loader: a dialog that passes `loader` renders exactly one `Modal`,
// so its card keeps its size as the loader shows.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The frontend's source root, from here. */
const SRC = fileURLToPath(new URL('../../', import.meta.url));

/** Where `Modal` and the loader itself live: the only places it may be drawn. */
const OWNERS = [
  ['components', 'Modal'].join(sep),
  ['components', 'DialogLoader'].join(sep),
];

/** Every shipping `.tsx` under `dir`: no tests, no test-support. */
function shippingTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'test-support' ? [] : shippingTsx(path);
    }
    return name.endsWith('.tsx') && !name.includes('.test.') ? [path] : [];
  });
}

const SOURCES = shippingTsx(SRC)
  .map((path) => ({
    file: relative(SRC, path),
    text: readFileSync(path, 'utf8'),
  }))
  .filter(({ file }) => !OWNERS.some((owner) => file.startsWith(owner)));

describe('DialogLoader: drawn only through a Modal’s loader', () => {
  it('is rendered by no dialog of its own', () => {
    const drawing = SOURCES.filter(({ text }) => /<DialogLoader\b/.test(text));

    expect(drawing.map(({ file }) => file)).toEqual([]);
  });

  it('is given to one Modal per dialog: no second Modal for the loader', () => {
    const twoCards = SOURCES.filter(
      ({ text }) =>
        /\bloader=/.test(text) && (text.match(/<Modal\b/g) ?? []).length !== 1
    );

    expect(twoCards.map(({ file }) => file)).toEqual([]);
  });
});
