// @vitest-environment node
//
// 31 — Export options, Phase 3: images (issue #278).
//
// With Images on, `writeExport` pipes each file `exportRows` planned out of
// `Media.readStored` into the **Export folder**: `Heat (1995)\poster.jpg`,
// its backdrop, a series' poster and its episodes' stills under `stills\`.
// With Images off, the Export folder holds the sheet and no title folders.
//
// Over a sandbox and a real `createMedia`, the stored files written into the
// media root by hand; asserted as the tree and the bytes on disk.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Episode, Movie, SeriesDetail, StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { createMedia } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

/** 8 October 2026, midday, local. */
const NAME = 'familyflix-collection_08-10-2026';

/** Each stored file and the bytes it holds. */
const STORED: Record<string, string> = {
  'heat-1995/poster.jpg': 'heat poster',
  'heat-1995/fanart.png': 'heat backdrop',
  'severance-2022/poster.jpg': 'severance poster',
  'severance-2022/season-01/still-e2.jpg': 'severance still',
};

const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  posterPath: 'heat-1995/poster.jpg',
  backdropPath: 'heat-1995/fanart.png',
});

const SEVERANCE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['watched', 'unwatched']], {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    posterPath: 'severance-2022/poster.jpg',
  });
  const still = (episode: Episode): Episode =>
    episode.number === 2
      ? { ...episode, stillPath: 'severance-2022/season-01/still-e2.jpg' }
      : episode;
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map(still),
    })),
  };
})();

/** A media root holding {@link STORED}, and an empty destination beside it. */
function sandbox(): {
  media: ReturnType<typeof createMedia>;
  destination: string;
} {
  const dir = sandboxRoot('familyflix-write-export-images-');
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

const request = (destination: string, images: boolean): StartExport => ({
  format: 'csv',
  destination,
  images,
  subtitles: false,
  name: NAME,
});

describe('writeExport — Images on', () => {
  it('puts a film’s poster and backdrop in its title folder', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination, true), {
      movies: [HEAT],
      series: [SEVERANCE],
    });

    const folder = join(destination, NAME, 'Heat (1995)');
    expect(readdirSync(folder).sort()).toEqual(['backdrop.png', 'poster.jpg']);
    expect(readFileSync(join(folder, 'poster.jpg'), 'utf8')).toBe(
      'heat poster'
    );
    expect(readFileSync(join(folder, 'backdrop.png'), 'utf8')).toBe(
      'heat backdrop'
    );
  });

  it('puts a series’ poster and its stills under stills\\', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination, true), {
      movies: [HEAT],
      series: [SEVERANCE],
    });

    const folder = join(destination, NAME, 'Severance (2022–)');
    expect(readFileSync(join(folder, 'poster.jpg'), 'utf8')).toBe(
      'severance poster'
    );
    expect(readdirSync(join(folder, 'stills'))).toEqual(['S01E02.jpg']);
    expect(readFileSync(join(folder, 'stills', 'S01E02.jpg'), 'utf8')).toBe(
      'severance still'
    );
  });

  it('holds the sheet beside the title folders', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination, true), {
      movies: [HEAT],
      series: [SEVERANCE],
    });

    expect(readdirSync(join(destination, NAME)).sort()).toEqual(
      [
        `${NAME}-episodes.csv`,
        `${NAME}.csv`,
        'Heat (1995)',
        'Severance (2022–)',
      ].sort()
    );
  });

  it('writes the Poster cell’s path into the sheet', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination, true), {
      movies: [HEAT],
      series: [],
    });

    const sheet = readFileSync(join(destination, NAME, `${NAME}.csv`), 'utf8');
    expect(sheet).toContain('Heat (1995)/poster.jpg');
  });
});

describe('writeExport — Images off', () => {
  it('writes no title folders, though the art is stored', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination, false), {
      movies: [HEAT],
      series: [SEVERANCE],
    });

    expect(readdirSync(join(destination, NAME)).sort()).toEqual(
      [`${NAME}-episodes.csv`, `${NAME}.csv`].sort()
    );
    expect(existsSync(join(destination, NAME, 'Heat (1995)'))).toBe(false);
  });
});
