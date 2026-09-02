import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stubFullscreen } from './stubFullscreen';

/**
 * 10 — Video player, Phase 8 (issue #91).
 *
 * jsdom has no Fullscreen API at all — not an inert one, an absent one: no
 * `requestFullscreen` on an element, no `exitFullscreen` on the document, no
 * `fullscreenElement` to read and no `fullscreenchange` to fire. A hook that
 * drives them cannot be observed in a test, and would not even run.
 *
 * So this is scaffolding, and the claims below are the ones `useFullscreen` and
 * the player's own suite lean on: an element that can be asked to fill the
 * screen, a document that remembers which one did, both transitions announcing
 * themselves, a browser that refuses — and, the reason it is shared, a DOM left
 * exactly as it was found once the installing block is over.
 *
 * It follows `stubMediaElement` in shape, with one difference forced by the
 * DOM: jsdom defines none of these, so cleanup **deletes** rather than
 * restores. Leaving them behind would hand every later file in the worker a
 * browser that supports fullscreen — the opposite of the one the player has to
 * cope with.
 */
const DOCUMENT_PROPERTIES = [
  'fullscreenElement',
  'fullscreenEnabled',
  'exitFullscreen',
] as const;

const ELEMENT_PROPERTIES = ['requestFullscreen'] as const;

/** Every `fullscreenchange` the document fired, counted. */
function countChanges(): { calls: number } {
  const seen = { calls: 0 };
  document.addEventListener('fullscreenchange', () => {
    seen.calls += 1;
  });
  return seen;
}

describe('stubFullscreen — inside the block that installed it', () => {
  stubFullscreen();

  it('gives jsdom the API it does not have', () => {
    for (const property of DOCUMENT_PROPERTIES) {
      expect(
        Object.getOwnPropertyDescriptor(Document.prototype, property)
      ).toBeDefined();
    }
    for (const property of ELEMENT_PROPERTIES) {
      expect(
        Object.getOwnPropertyDescriptor(Element.prototype, property)
      ).toBeDefined();
    }
  });

  it('starts with nothing filling the screen', () => {
    expect(document.fullscreenElement).toBeNull();
    expect(document.fullscreenEnabled).toBe(true);
  });

  it('remembers which element was asked to fill the screen', async () => {
    const stage = document.createElement('div');

    await stage.requestFullscreen();

    expect(document.fullscreenElement).toBe(stage);
  });

  it('announces entering it through the event a hook listens for', async () => {
    const stage = document.createElement('div');
    const changes = countChanges();

    await stage.requestFullscreen();

    expect(changes.calls).toBe(1);
  });

  it('puts the document back, and announces that too', async () => {
    const stage = document.createElement('div');
    await stage.requestFullscreen();
    const changes = countChanges();

    await document.exitFullscreen();

    expect(document.fullscreenElement).toBeNull();
    expect(changes.calls).toBe(1);
  });

  it('refuses to leave a fullscreen nothing is in, as a browser does', async () => {
    // Not a silent no-op: a player that called this blindly would log an
    // unhandled rejection on every press, which is a real defect this double
    // has to be able to catch.
    await expect(document.exitFullscreen()).rejects.toThrow();
  });

  it('does not carry one test’s fullscreen into the next', () => {
    // The block above left an element in fullscreen and never took it out. If
    // this saw it, every assertion about entering would be reading the last
    // test's leftovers.
    expect(document.fullscreenElement).toBeNull();
  });
});

describe('stubFullscreen — a block where the browser refuses', () => {
  stubFullscreen({ request: 'refused' });

  it('rejects the request, and leaves nothing filling the screen', async () => {
    const stage = document.createElement('div');

    await expect(stage.requestFullscreen()).rejects.toThrow();

    expect(document.fullscreenElement).toBeNull();
  });

  it('announces nothing, because nothing changed', async () => {
    const stage = document.createElement('div');
    const changes = countChanges();

    await stage.requestFullscreen().catch(() => undefined);

    expect(changes.calls).toBe(0);
  });
});

describe('stubFullscreen — after those blocks have finished', () => {
  it('hands the DOM back to jsdom exactly as it was found', () => {
    // Which for this API means: gone. A worker left with a document that
    // supports fullscreen would quietly pass the one test that matters most —
    // the player on a browser that does not.
    for (const property of DOCUMENT_PROPERTIES) {
      expect(
        Object.getOwnPropertyDescriptor(Document.prototype, property)
      ).toBeUndefined();
    }
    for (const property of ELEMENT_PROPERTIES) {
      expect(
        Object.getOwnPropertyDescriptor(Element.prototype, property)
      ).toBeUndefined();
    }
  });
});

/**
 * The `test-support/` rung's one rule, checked rather than trusted: these
 * doubles are never imported by shipping code.
 */
describe('stubFullscreen — the rung’s rule', () => {
  it('is imported by no shipping file', () => {
    const shipping = sourceFiles('src').concat(sourceFiles('server/src'));

    const importers = shipping.filter((file) =>
      readFileSync(file, 'utf8').includes('stubFullscreen')
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
