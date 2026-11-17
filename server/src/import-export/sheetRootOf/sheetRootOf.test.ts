// @vitest-environment node
//
// 67, Export paths, Phase 2 (issue #645): `sheetRootOf`.
//
// `sheetRootOf(sheetPath)` answers a run's **Sheet root**, the folder a
// sheet's path cells are joined to when the matched **Title folder** holds no
// such file: the folder holding the sheet's `Meta/` folder when the sheet lies
// in one (an Export's sheet answers its **Export folder**, a Library sheet its
// **Library folder**), else the sheet's own folder. Pure: a path in, a path
// out; nothing is read.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { sheetRootOf } from './sheetRootOf';

const BACKUPS = join('/', 'Backups');
const EXPORT = join(BACKUPS, 'familyflix-collection_15-11-2026');

describe('sheetRootOf: a sheet in a Meta/ folder', () => {
  it("answers the folder holding an Export's Meta/ folder", () => {
    expect(sheetRootOf(join(EXPORT, 'Meta', 'familyflix-library.csv'))).toBe(
      EXPORT
    );
  });

  it('answers the Library folder for a Library sheet', () => {
    const library = join('/', 'Movies');

    expect(sheetRootOf(join(library, 'Meta', 'familyflix-library.xlsx'))).toBe(
      library
    );
  });
});

describe('sheetRootOf: a sheet beside its folders', () => {
  it("answers the sheet's own folder", () => {
    expect(sheetRootOf(join(BACKUPS, 'library.csv'))).toBe(BACKUPS);
  });
});
