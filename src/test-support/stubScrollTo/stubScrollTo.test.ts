import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stubScrollTo } from './stubScrollTo';

/**
 * 19 — Back-to-top FAB refactor (issue #169).
 *
 * jsdom implements `scrollTo` on `window` and on no element —
 * `Element.prototype.scrollTo` is `undefined`, absent rather than inert — so a
 * control that rides a container back to its top cannot be observed in a
 * test, and would throw before it was.
 *
 * So this is scaffolding, and the claims below are the ones `BackToTop`'s and
 * `MainLayout`'s press leaves lean on: an element asked for a position is
 * recorded with what it was asked, two elements asked are two requests in
 * order, nothing asked is nothing — and, the reason it is shared, a DOM left
 * exactly as it was found once the installing block is over.
 *
 * It follows `stubFullscreen` in shape, with the same difference forced by the
 * DOM: jsdom defines none of this, so cleanup **deletes** rather than
 * restores. Leaving it behind would hand every later file in the worker an
 * element that can scroll — the opposite of the one the control has to cope
 * with.
 */
describe('stubScrollTo — inside the block that installed it', () => {
  const scrolling = stubScrollTo();

  it('gives jsdom the method it does not have', () => {
    expect(
      Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo')
    ).toBeDefined();
  });

  it('records an element asked for a position, with what it was asked', () => {
    const container = document.createElement('div');

    container.scrollTo({ top: 0, behavior: 'smooth' });

    expect(scrolling.requests()).toEqual([
      { element: container, options: { top: 0, behavior: 'smooth' } },
    ]);
  });

  it('records two elements asked as two requests, in order', () => {
    const first = document.createElement('div');
    const second = document.createElement('section');

    first.scrollTo({ top: 1240 });
    second.scrollTo({ top: 0, behavior: 'smooth' });

    expect(scrolling.requests().map((request) => request.element)).toEqual([
      first,
      second,
    ]);
  });

  it('records nothing when nothing was asked', () => {
    // The blocks above asked; if this saw them, every assertion about a press
    // would be reading the last test's leftovers.
    expect(scrolling.requests()).toEqual([]);
  });
});

describe('stubScrollTo — after that block has finished', () => {
  it('hands the DOM back to jsdom exactly as it was found', () => {
    // Which for this method means: gone. A worker left with elements that can
    // scroll would quietly pass a control that asked the document for the top.
    expect(
      Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo')
    ).toBeUndefined();
  });
});

/**
 * The `test-support/` rung's one rule, checked rather than trusted: these
 * doubles are never imported by shipping code.
 */
describe('stubScrollTo — the rung’s rule', () => {
  it('is imported by no shipping file', () => {
    const shipping = sourceFiles('src').concat(sourceFiles('server/src'));

    const importers = shipping.filter((file) =>
      readFileSync(file, 'utf8').includes('stubScrollTo')
    );

    expect(importers).toEqual([]);
  });
});

/**
 * Every `.ts`/`.tsx` file under `root` that ships — tests excluded, and the
 * whole `test-support/` rung excluded with them, since a double importing
 * another double is the rung working rather than the rule breaking.
 */
function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map((entry) => join(root, entry))
    .filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        !/\.(test|spec)\.tsx?$/.test(file) &&
        !file.includes('test-support')
    );
}
