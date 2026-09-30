// @vitest-environment node
//
// Issue #223 — straight to Downloads, no dialog. `will-download` saves into
// `app.getPath('downloads')` under the file's own name, deduplicated the way
// Chromium does it: `family-library.csv`, then `family-library (1).csv`, then
// `(2)`. Pure: the directory is a string and the disk is an `exists` predicate.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { downloadPath } from './downloadPath';

const DIR = join('C:', 'Users', 'Family', 'Downloads');

/** A Downloads folder holding exactly these names. */
function holding(...names: string[]): (path: string) => boolean {
  const taken = new Set(names.map((name) => join(DIR, name)));
  return (path) => taken.has(path);
}

describe('downloadPath', () => {
  it('keeps the name as it is when nothing holds it', () => {
    expect(downloadPath(DIR, 'family-library.csv', holding())).toBe(
      join(DIR, 'family-library.csv')
    );
  });

  it('adds (1) before the extension when the name is taken', () => {
    expect(
      downloadPath(DIR, 'family-library.csv', holding('family-library.csv'))
    ).toBe(join(DIR, 'family-library (1).csv'));
  });

  it('goes on to (2) when (1) is taken too', () => {
    expect(
      downloadPath(
        DIR,
        'family-library.csv',
        holding('family-library.csv', 'family-library (1).csv')
      )
    ).toBe(join(DIR, 'family-library (2).csv'));
  });

  it('appends the number to a name with no extension', () => {
    expect(downloadPath(DIR, 'README', holding('README'))).toBe(
      join(DIR, 'README (1)')
    );
  });

  it('numbers a dotted name before its last extension only', () => {
    expect(
      downloadPath(
        DIR,
        'family.library.v2.xlsx',
        holding('family.library.v2.xlsx')
      )
    ).toBe(join(DIR, 'family.library.v2 (1).xlsx'));
  });

  it('keeps a dotted name whole when it is free', () => {
    expect(downloadPath(DIR, 'family.library.v2.xlsx', holding())).toBe(
      join(DIR, 'family.library.v2.xlsx')
    );
  });

  it('asks the disk only about paths inside the directory it was given', () => {
    const asked: string[] = [];
    downloadPath(DIR, 'family-library.csv', (path) => {
      asked.push(path);
      return asked.length < 3;
    });

    expect(asked).toEqual([
      join(DIR, 'family-library.csv'),
      join(DIR, 'family-library (1).csv'),
      join(DIR, 'family-library (2).csv'),
    ]);
  });
});
