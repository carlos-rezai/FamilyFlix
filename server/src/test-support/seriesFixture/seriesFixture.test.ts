// @vitest-environment node
//
// The series fixture copy the importer's series suite starts its runs on,
// tested for what that suite relies on: a root holding the two Show folders, a
// sheet beside it in the spelling asked for, and a copy — so writing into it
// touches nothing checked in.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SERIES_FIXTURE, seriesFixture } from './seriesFixture';
import { sandboxRoot } from '../sandboxRoot/sandboxRoot';
import { readTitleFolder } from '../../media/readTitleFolder/readTitleFolder';

/**
 * 58, Folder layout, Phase 3 (issue #536): the fixture moved to the layout.
 * Both shows are **Title folders** of `Season 01/`, each with a track in
 * `Season 01/Subtitles/S01E01/`; Tidewater's season also carries its **Season
 * poster** and a **Still**. Read off the checked-in tree, which nothing writes.
 */
describe('seriesFixture, in the Folder layout', () => {
  /** A fixture show's scan, checked to be a series. */
  async function seriesOf(show: string) {
    const scan = await readTitleFolder(join(SERIES_FIXTURE, 'root', show));
    expect(scan).toMatchObject({ kind: 'series' });
    return scan as Extract<typeof scan, { kind: 'series' }>;
  }

  it.each([['Harbor & Vine (2021)'], ['Tidewater (2018)']])(
    'reads %s as a series of Season 01 with its two episodes',
    async (show) => {
      const scan = await seriesOf(show);

      expect(scan.seasons).toHaveLength(1);
      expect(scan.seasons[0]).toMatchObject({ name: 'Season 01', number: 1 });
      expect(scan.seasons[0].videos).toHaveLength(2);
    }
  );

  it.each([['Harbor & Vine (2021)'], ['Tidewater (2018)']])(
    'gives %s a track in Season 01/Subtitles/S01E01/',
    async (show) => {
      const [season] = (await seriesOf(show)).seasons;

      expect(
        season.subtitles.map((track) => basename(dirname(track.path)))
      ).toContain('S01E01');
    }
  );

  it('gives Tidewater (2018) its Season poster and a Still', async () => {
    const [season] = (await seriesOf('Tidewater (2018)')).seasons;

    expect(season.poster).not.toBeNull();
    expect(Object.keys(season.stills)).not.toEqual([]);
  });
});

describe('seriesFixture', () => {
  it('copies the fixture tree under the sandbox as its root', () => {
    const dir = sandboxRoot('familyflix-series-fixture-');

    const { root } = seriesFixture(dir);

    expect(root).toBe(join(dir, 'root'));
    expect(readdirSync(root).sort()).toEqual([
      'Harbor & Vine (2021)',
      'Tidewater (2018)',
    ]);
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
