// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 1: the pure coercers get folders
// and tests.
//
// **These two are a security boundary**, which is why the tests below spend
// most of their length on what is refused rather than on what is accepted.
// `GET /api/images` is `express.static` over the managed media directory, so a
// stored `.html` is a page served from the app's own origin — the `accept`
// attribute on the picker stops an honest maintainer picking one, and stops a
// client this route did not write from nothing at all.
//
// The case that matters most is the double extension. `poster.png.html` is a
// name that reads as a picture to a person skimming it and is served as a
// document by `express.static`, and a check written as "contains" rather than
// "ends with" would pass it.

import { describe, expect, it } from 'vitest';

import { isImageFilename, isSubtitleFilename } from './fileKinds';

describe('isImageFilename', () => {
  it.each(['poster.jpg', 'poster.jpeg', 'poster.png', 'poster.webp'])(
    'accepts %s',
    (filename) => {
      expect(isImageFilename(filename)).toBe(true);
    }
  );

  it('accepts a name the operating system upper-cased', () => {
    expect(isImageFilename('POSTER.JPG')).toBe(true);
  });

  it('accepts a name with dots and spaces in it', () => {
    expect(isImageFilename('Northwind (2018).poster.final.png')).toBe(true);
  });

  it('refuses a name with no extension at all', () => {
    expect(isImageFilename('poster')).toBe(false);
  });

  // The one that would be served from the app's own origin.
  it('refuses a double extension ending in one express.static would serve as a page', () => {
    expect(isImageFilename('poster.png.html')).toBe(false);
  });

  it.each(['poster.html', 'poster.svg', 'poster.gif', 'poster.exe'])(
    'refuses %s',
    (filename) => {
      expect(isImageFilename(filename)).toBe(false);
    }
  );

  it('refuses a subtitle offered as a poster', () => {
    expect(isImageFilename('northwind.srt')).toBe(false);
  });

  it('refuses a name that merely contains an allowed extension', () => {
    expect(isImageFilename('.png.evil')).toBe(false);
  });
});

describe('isSubtitleFilename', () => {
  it.each(['northwind.srt', 'northwind.vtt', 'northwind.ass', 'northwind.sub'])(
    'accepts %s',
    (filename) => {
      expect(isSubtitleFilename(filename)).toBe(true);
    }
  );

  it('accepts a name the operating system upper-cased', () => {
    expect(isSubtitleFilename('NORTHWIND.SRT')).toBe(true);
  });

  it('refuses a name with no extension at all', () => {
    expect(isSubtitleFilename('northwind')).toBe(false);
  });

  it('refuses a double extension ending in one express.static would serve as a page', () => {
    expect(isSubtitleFilename('northwind.srt.html')).toBe(false);
  });

  it.each(['northwind.txt', 'northwind.ssa', 'northwind.idx'])(
    'refuses %s',
    (filename) => {
      expect(isSubtitleFilename(filename)).toBe(false);
    }
  );

  it('refuses a poster offered as a subtitle', () => {
    expect(isSubtitleFilename('poster.png')).toBe(false);
  });
});
