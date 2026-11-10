// @vitest-environment node
//
// 59, Rebuild whole, Phase 8 (issue #555): a path cell fills an empty place.
//
// `filmWithCells` and `showWithCells` read a **Sheet row**'s **Path cells**
// into the places a Title folder's read left empty: a poster, a backdrop, a
// **Season poster**, a **Still**, a track. The read always wins, a track is
// never added twice, and a cell naming a file that is not there fills
// nothing.
//
// Against real files under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { filmWithCells, showWithCells } from './pathCellFills';
import type { FilmScan } from '../../media/readTitleFolder/readTitleFolder';
import type { ShowScan } from '../numberShow/numberShow';
import type { SheetRow } from '../readSheet/readSheet';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

const row = (cells: Partial<SheetRow>): SheetRow => ({
  type: 'Movie',
  folder: 'Heat (1995)',
  season: null,
  episode: null,
  title: 'Heat',
  year: 1995,
  endYear: 1995,
  genres: [],
  director: null,
  cast: [],
  synopsis: null,
  rating: null,
  watched: false,
  airDate: null,
  runtime: null,
  tmdbScore: null,
  tmdbId: null,
  favorite: false,
  video: null,
  subtitles: [],
  poster: null,
  backdrop: null,
  still: null,
  ...cells,
});

/** A Library folder holding `Heat (1995)/` with `files` in it. */
function library(...files: string[]): string {
  const root = sandboxRoot('familyflix-path-cell-fills-');
  mkdirSync(join(root, 'Heat (1995)'));
  for (const file of files) {
    writeFileSync(join(root, 'Heat (1995)', file), file);
  }
  return root;
}

const film = (root: string, cells: Partial<FilmScan> = {}): FilmScan => ({
  dir: join(root, 'Heat (1995)'),
  name: 'Heat (1995)',
  videos: [join(root, 'Heat (1995)', 'heat.mp4')],
  subtitles: [],
  poster: null,
  backdrop: null,
  ...cells,
});

describe('filmWithCells: a film’s empty places', () => {
  it('fills an empty place from a cell naming a file that is there', async () => {
    const root = library('heat.jpg', 'heat.fr.srt');
    const filled = await filmWithCells(
      film(root),
      row({
        poster: 'Heat (1995)/heat.jpg',
        backdrop: 'Heat (1995)/gone.jpg',
        subtitles: ['Heat (1995)/heat.fr.srt'],
      })
    );
    expect(filled.poster).toBe(join(root, 'Heat (1995)', 'heat.jpg'));
    expect(filled.backdrop).toBeNull();
    expect(filled.subtitles.map(({ path }) => path)).toEqual([
      join(root, 'Heat (1995)', 'heat.fr.srt'),
    ]);
  });

  it('never beats a file the read found, nor adds a track twice', async () => {
    const root = library('heat.jpg', 'heat.en.srt');
    const track = join(root, 'Heat (1995)', 'heat.en.srt');
    const scan = film(root, {
      poster: join(root, 'Heat (1995)', 'Images', 'poster.jpg'),
      subtitles: [{ path: track, language: 'en' }],
    });
    const filled = await filmWithCells(
      scan,
      row({
        poster: 'Heat (1995)/heat.jpg',
        subtitles: ['Heat (1995)/heat.en.srt'],
      })
    );
    expect(filled.poster).toBe(scan.poster);
    expect(filled.subtitles).toEqual(scan.subtitles);
  });
});

describe('showWithCells: a series’ empty places', () => {
  it('fills a Season poster and a Still from their rows', async () => {
    const root = library('cover.jpg', 'still.jpg');
    const show: ShowScan = {
      dir: join(root, 'Heat (1995)'),
      name: 'Heat (1995)',
      episodes: [
        {
          season: 1,
          episode: 1,
          title: null,
          video: join(root, 'Heat (1995)', 'S01E01.mp4'),
          subtitles: [],
          still: null,
        },
      ],
      unplaced: [],
      straySubtitles: [],
      poster: null,
      backdrop: null,
      seasons: [{ number: 1, poster: null }],
    };
    const filled = await showWithCells(show, row({ type: 'Series' }), [
      row({ type: 'Season', season: 1, poster: 'Heat (1995)/cover.jpg' }),
      row({
        type: 'Episode',
        season: 1,
        episode: 1,
        still: 'Heat (1995)/still.jpg',
      }),
    ]);
    expect(filled.seasons[0].poster).toBe(
      join(root, 'Heat (1995)', 'cover.jpg')
    );
    expect(filled.episodes[0].still).toBe(
      join(root, 'Heat (1995)', 'still.jpg')
    );
  });
});
