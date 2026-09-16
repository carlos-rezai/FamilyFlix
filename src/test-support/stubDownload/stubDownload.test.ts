import { describe, it, expect } from 'vitest';

import { stubDownload } from './stubDownload';

/**
 * 14 — Export, Phase 1: "the tracer bullet" (issue #137).
 *
 * jsdom has no object URLs at all — `URL.createObjectURL` and
 * `URL.revokeObjectURL` are absent, not inert — and an anchor's `click()` is a
 * navigation it does not implement. A unit that hands a blob to the browser
 * to save cannot be observed in a test, and would throw before it was.
 *
 * So this is scaffolding, and the claims below are the ones `saveToComputer`,
 * `useExport` and the Export dialog's own suites lean on: a blob can be minted
 * a URL, a press on an anchor pointing at one is recorded under the anchor's
 * `download` name, a revoked URL is remembered — and, the reason it is shared,
 * a DOM left exactly as it was found once the installing block is over.
 */
describe('stubDownload — inside the block that installs it', () => {
  const browser = stubDownload();

  it('mints a distinct object URL for each blob', () => {
    const one = URL.createObjectURL(new Blob(['one']));
    const two = URL.createObjectURL(new Blob(['two']));

    expect(one).toMatch(/^blob:/);
    expect(two).toMatch(/^blob:/);
    expect(one).not.toBe(two);
  });

  it('records a press on an anchor pointing at a minted URL as a download', () => {
    const blob = new Blob(['Title,Year\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'family-library.csv';

    anchor.click();

    expect(browser.downloads()).toEqual([
      { blob, url, filename: 'family-library.csv' },
    ]);
  });

  it('records nothing for a press on an anchor pointing elsewhere', () => {
    const anchor = document.createElement('a');
    anchor.href = '/settings';

    anchor.click();

    expect(browser.downloads()).toEqual([]);
  });

  it('remembers which URLs were revoked', () => {
    const url = URL.createObjectURL(new Blob(['one']));
    expect(browser.revoked(url)).toBe(false);

    URL.revokeObjectURL(url);

    expect(browser.revoked(url)).toBe(true);
  });

  it('starts every test empty', () => {
    // The tests above minted and pressed; none of it is visible here.
    expect(browser.downloads()).toEqual([]);
    expect(browser.mintedUrls()).toEqual([]);
  });
});

describe('stubDownload — outside the block', () => {
  it('leaves the URL statics as it found them, not as the stub', () => {
    // The environment's own `createObjectURL` is Node's, which mints
    // `blob:nodedata:` URLs and cannot take a jsdom blob at all; whichever it
    // does here, it is not the stub's `blob:familyflix/` naming.
    let minted: string | null = null;
    try {
      minted = URL.createObjectURL(new Blob(['one']));
    } catch {
      minted = null;
    }

    expect(minted === null || !minted.startsWith('blob:familyflix/')).toBe(
      true
    );
  });

  it('leaves the anchor’s click as the prototype’s own', () => {
    expect(
      Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'click')
    ).toBeUndefined();
    expect(typeof document.createElement('a').click).toBe('function');
  });
});
