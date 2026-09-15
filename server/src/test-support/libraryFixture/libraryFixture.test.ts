// @vitest-environment node
//
// The fixture copy the two import suites start their runs on, tested for what
// they rely on: a root holding the fixture's two Source folders, a sheet
// beside it in the spelling asked for, and a copy — so writing into it
// touches nothing checked in.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LIBRARY_FIXTURE, libraryFixture } from './libraryFixture';
import { sandboxRoot } from '../sandboxRoot/sandboxRoot';

describe('libraryFixture', () => {
  it('copies the fixture tree under the sandbox as its root', () => {
    const dir = sandboxRoot('familyflix-fixture-');

    const { root } = libraryFixture(dir);

    expect(root).toBe(join(dir, 'root'));
    expect(readdirSync(root).sort()).toEqual(
      readdirSync(join(LIBRARY_FIXTURE, 'root')).sort()
    );
  });

  it('copies the xlsx sheet beside the root by default', () => {
    const dir = sandboxRoot('familyflix-fixture-');

    const { sheet } = libraryFixture(dir);

    expect(sheet).toBe(join(dir, 'library.xlsx'));
    expect(existsSync(sheet)).toBe(true);
  });

  it('copies the csv spelling when asked for it', () => {
    const dir = sandboxRoot('familyflix-fixture-');

    const { sheet } = libraryFixture(dir, 'library.csv');

    expect(sheet).toBe(join(dir, 'library.csv'));
    expect(existsSync(sheet)).toBe(true);
  });

  it('is a copy: writing into the root leaves the fixture untouched', () => {
    const dir = sandboxRoot('familyflix-fixture-');
    const { root } = libraryFixture(dir);

    writeFileSync(join(root, 'stray.txt'), '', 'utf8');

    expect(existsSync(join(LIBRARY_FIXTURE, 'root', 'stray.txt'))).toBe(false);
  });
});
