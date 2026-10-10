// @vitest-environment node
//
// 31 — Export options, Phase 4: subtitles (issue #279).
//
// With Subtitles on, `writeExport` pipes each subtitle `exportRows` planned out
// of `Media.readStored` into the **Export folder**: `Heat (1995)\English.srt`
// beside the poster, and an episode's under the series' `subtitles\` as
// `S01E02 English.srt`. The four combinations of the two Include toggles each
// leave their own tree on disk; with both off the export is the sheet files
// alone; and no video file is ever written, though every video is stored.
//
// Over a sandbox and a real `createMedia`, the stored files written into the
// media root by hand; asserted as the tree and the bytes on disk.

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Episode, Movie, SeriesDetail, StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { createMedia } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

/** 8 October 2026, midday, local. */
const NAME = 'familyflix-collection_08-10-2026';

/** Each stored file and the bytes it holds — the videos among them. */
const STORED: Record<string, string> = {
  'heat-1995/heat.mkv': 'heat video',
  'heat-1995/poster.jpg': 'heat poster',
  'heat-1995/heat.en.srt': 'heat english',
  'severance-2022/poster.jpg': 'severance poster',
  'severance-2022/season-01/e1.mp4': 'severance video 1',
  'severance-2022/season-01/e2.mp4': 'severance video 2',
  'severance-2022/season-01/e2.en.srt': 'severance english',
};

const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  videoPath: 'heat-1995/heat.mkv',
  posterPath: 'heat-1995/poster.jpg',
  backdropPath: null,
  subtitles: [
    {
      id: 'heat-en',
      path: 'heat-1995/heat.en.srt',
      language: 'English',
      position: 0,
    },
  ],
});

const SEVERANCE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['watched', 'unwatched']], {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    posterPath: 'severance-2022/poster.jpg',
  });
  const stored = (episode: Episode): Episode => ({
    ...episode,
    videoPath: `severance-2022/season-01/e${episode.number}.mp4`,
    subtitles:
      episode.number === 2
        ? [
            {
              id: 'severance-e2-en',
              path: 'severance-2022/season-01/e2.en.srt',
              language: 'English',
              position: 0,
            },
          ]
        : [],
  });
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map(stored),
    })),
  };
})();

/** A media root holding {@link STORED}, and an empty destination beside it. */
function sandbox(): {
  media: ReturnType<typeof createMedia>;
  destination: string;
} {
  const dir = sandboxRoot('familyflix-write-export-subtitles-');
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

const request = (
  destination: string,
  images: boolean,
  subtitles: boolean
): StartExport => ({
  format: 'csv',
  destination,
  images,
  subtitles,
  name: NAME,
});

/** Every file under `root`, relative and forward-slashed, sorted. */
function tree(root: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  return walk(root)
    .map((file) => relative(root, file).split('\\').join('/'))
    .sort();
}

/** Export the whole library with the given toggles; the Export folder's tree. */
async function exported(images: boolean, subtitles: boolean) {
  const { media, destination } = sandbox();
  await writeExport(media, request(destination, images, subtitles), {
    movies: [HEAT],
    series: [SEVERANCE],
  });
  const folder = join(destination, NAME);
  return { folder, files: tree(folder) };
}

const SHEETS = [`${NAME}-episodes.csv`, `${NAME}.csv`];

describe('writeExport — the four combinations of Include', () => {
  it('writes the sheet files alone with both toggles off', async () => {
    const { files } = await exported(false, false);

    expect(files).toEqual([...SHEETS].sort());
  });

  it('writes the art and no subtitle with Images alone', async () => {
    const { files } = await exported(true, false);

    expect(files).toEqual(
      [
        ...SHEETS,
        'Heat (1995)/poster.jpg',
        'Severance (2022–)/poster.jpg',
      ].sort()
    );
  });

  it('writes the subtitles and no art with Subtitles alone', async () => {
    const { files } = await exported(false, true);

    expect(files).toEqual(
      [
        ...SHEETS,
        'Heat (1995)/English.srt',
        'Severance (2022–)/subtitles/S01E02 English.srt',
      ].sort()
    );
  });

  it('writes the art and the subtitles together with both on', async () => {
    const { files } = await exported(true, true);

    expect(files).toEqual(
      [
        ...SHEETS,
        'Heat (1995)/English.srt',
        'Heat (1995)/poster.jpg',
        'Severance (2022–)/poster.jpg',
        'Severance (2022–)/subtitles/S01E02 English.srt',
      ].sort()
    );
  });
});

describe('writeExport — Subtitles on', () => {
  it('copies a film’s track beside its poster, byte for byte', async () => {
    const { folder } = await exported(true, true);

    expect(
      readFileSync(join(folder, 'Heat (1995)', 'English.srt'), 'utf8')
    ).toBe('heat english');
  });

  it('copies an episode’s track under subtitles\\, byte for byte', async () => {
    const { folder } = await exported(false, true);

    expect(
      readFileSync(
        join(folder, 'Severance (2022–)', 'subtitles', 'S01E02 English.srt'),
        'utf8'
      )
    ).toBe('severance english');
  });
});

describe('writeExport — a video never travels', () => {
  it('writes no video file under any combination', async () => {
    for (const [images, subtitles] of [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ] as const) {
      const { folder, files } = await exported(images, subtitles);

      expect(files.filter((file) => /\.(mkv|mp4|avi)$/.test(file))).toEqual([]);
      const bytes = files.map((file) =>
        readFileSync(join(folder, ...file.split('/')), 'utf8')
      );
      expect(bytes.some((content) => content.includes('video'))).toBe(false);
    }
  });
});
