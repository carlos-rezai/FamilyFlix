import { describe, it, expect } from 'vitest';

import { saveToComputer } from './saveToComputer';
import { stubDownload } from '@/test-support/stubDownload/stubDownload';

/**
 * 14 — Export, Phase 1: "the tracer bullet" (issue #137).
 *
 * **Save to computer**: the blob the export route answered, handed to the
 * browser as a download under the **Export file**'s name — an object URL on
 * an anchor carrying `download`, clicked, revoked. A DOM side effect, and so
 * its own unit under `import-export` rather than `utils/`, which has one rule.
 *
 * jsdom implements neither object URLs nor the anchor's navigation, so what
 * the browser was handed is read through `stubDownload`: which blob, under
 * which name, and whether the URL was let go of afterwards. Navigating the
 * page to the URL instead was rejected — a `500` would replace the app with a
 * JSON body — and under Electron the same blob download raises `will-download`
 * and the shell's save dialog.
 */
describe('saveToComputer', () => {
  const browser = stubDownload();

  const csv = () =>
    new Blob(['\uFEFFTitle,Year\nDie Hard,1988\n'], {
      type: 'text/csv; charset=utf-8',
    });

  it('hands the blob to the browser under the filename', () => {
    const blob = csv();

    saveToComputer(blob, 'family-library.csv');

    expect(browser.downloads()).toHaveLength(1);
    expect(browser.downloads()[0]).toMatchObject({
      blob,
      filename: 'family-library.csv',
    });
  });

  it('points the anchor at an object URL minted for that blob', () => {
    saveToComputer(csv(), 'family-library.csv');

    const [download] = browser.downloads();
    expect(download.url).toMatch(/^blob:/);
    expect(browser.mintedUrls()).toEqual([download.url]);
  });

  it('saves under whichever name it is given', () => {
    saveToComputer(csv(), 'family-library.xlsx');

    expect(browser.downloads()[0].filename).toBe('family-library.xlsx');
  });

  it('revokes the object URL once the anchor has been pressed', () => {
    saveToComputer(csv(), 'family-library.csv');

    const [download] = browser.downloads();
    expect(browser.revoked(download.url)).toBe(true);
  });

  it('leaves no anchor behind in the document', () => {
    saveToComputer(csv(), 'family-library.csv');

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('saves each call as its own download', () => {
    saveToComputer(csv(), 'family-library.csv');
    saveToComputer(csv(), 'family-library.csv');

    expect(browser.downloads()).toHaveLength(2);
    expect(browser.downloads()[0].url).not.toBe(browser.downloads()[1].url);
  });
});
