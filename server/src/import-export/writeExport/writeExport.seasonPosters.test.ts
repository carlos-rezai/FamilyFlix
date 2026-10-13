// @vitest-environment node
//
// 39 — Season posters, Phase 3: the Export carries them (issue #324).
//
// With Images on, `writeExport` copies each planned **Season poster** through
// `Media.readStored` into its title's folder under `seasons\`, exactly as it
// copies stills, and skips one it cannot read without failing the Export —
// there is no cell to blank.
//
// Over a sandbox and a real `createMedia`, the stored files written into the
// media root by hand; asserted as the tree and the bytes on disk.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { SeriesDetail, StartExport } from '@/types';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { createMedia } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

/** 8 October 2026, midday, local. */
const NAME = 'familyflix-collection_08-10-2026';

/** Each stored file and the bytes it holds — season 1's poster is not here. */
const STORED: Record<string, string> = {
  'severance-2022/poster.jpg': 'severance poster',
  'severance-2022/season-02/poster.webp': 'season two poster',
};

/**
 * _Severance_, 2022–: two seasons, each with a poster recorded — season 2's
 * stored, season 1's gone from the media root.
 */
const SEVERANCE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['watched'], ['unwatched']], {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    posterPath: 'severance-2022/poster.jpg',
  });
  const posters: Record<number, string> = {
    1: 'severance-2022/season-01/poster.jpg',
    2: 'severance-2022/season-02/poster.webp',
  };
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      posterPath: posters[season.number] ?? null,
    })),
  };
})();

/** A media root holding {@link STORED}, and an empty destination beside it. */
function sandbox(): {
  media: ReturnType<typeof createMedia>;
  destination: string;
} {
  const dir = sandboxRoot('familyflix-write-export-season-posters-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Movies');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaPath, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  return { media: createMedia(mediaPath), destination };
}

const request = (destination: string): StartExport => ({
  format: 'csv',
  destination,
  images: true,
  subtitles: false,
  name: NAME,
});

describe('writeExport — a season poster under Images', () => {
  it('puts the planned season poster under seasons\\, its bytes intact', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: [],
      series: [SEVERANCE],
    });

    const seasons = join(destination, NAME, 'Severance (2022–)', 'seasons');
    expect(readFileSync(join(seasons, 'S02.webp'), 'utf8')).toBe(
      'season two poster'
    );
  });

  it('skips an unreadable season poster and copies the rest', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(media, request(destination), {
      movies: [],
      series: [SEVERANCE],
    });

    expect(outcome).toEqual({
      kind: 'written',
      folder: join(destination, NAME),
      movieCount: 0,
      seriesCount: 1,
    });
    const folder = join(destination, NAME, 'Severance (2022–)');
    expect(readdirSync(join(folder, 'seasons'))).toEqual(['S02.webp']);
    expect(readFileSync(join(folder, 'poster.jpg'), 'utf8')).toBe(
      'severance poster'
    );
  });
});
