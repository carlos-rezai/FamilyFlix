// @vitest-environment node
//
// The series fixture copy the importer's series suite starts its runs on,
// tested for what that suite relies on: a root holding the one Show folder, a
// sheet beside it in the spelling asked for, and a copy — so writing into it
// touches nothing checked in.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SERIES_FIXTURE, seriesFixture } from './seriesFixture';
import { sandboxRoot } from '../sandboxRoot/sandboxRoot';

describe('seriesFixture', () => {
  it('copies the fixture tree under the sandbox as its root', () => {
    const dir = sandboxRoot('familyflix-series-fixture-');

    const { root } = seriesFixture(dir);

    expect(root).toBe(join(dir, 'root'));
    expect(readdirSync(root)).toEqual(['Harbor & Vine (2021)']);
  });

  it('copies the xlsx sheet beside the root by default', () => {
    const dir = sandboxRoot('familyflix-series-fixture-');

    const { sheet } = seriesFixture(dir);

    expect(sheet).toBe(join(dir, 'library.xlsx'));
    expect(existsSync(sheet)).toBe(true);
  });

  it('copies the csv spelling when asked for it', () => {
    const dir = sandboxRoot('familyflix-series-fixture-');

    const { sheet } = seriesFixture(dir, 'library.csv');

    expect(sheet).toBe(join(dir, 'library.csv'));
    expect(existsSync(sheet)).toBe(true);
  });

  it('is a copy: writing into the root leaves the fixture untouched', () => {
    const dir = sandboxRoot('familyflix-series-fixture-');
    const { root } = seriesFixture(dir);

    writeFileSync(join(root, 'stray.txt'), '', 'utf8');

    expect(existsSync(join(SERIES_FIXTURE, 'root', 'stray.txt'))).toBe(false);
  });
});
