// @vitest-environment node
//
// 64, Rescan a folder, Phase 5 (issue #622): the Export agrees.
//
// An **Export** lays out the household's folder names. A show held from
// `Death Note/Season 1/` has its Season poster, Stills and tracks planned
// under `Death Note/Season 1/`, the folder its Video cells name: every
// season-scoped **Layout place** carries its `seasonFolder`, which
// `exportRows` reads through `seasonFolderOf`. A **Title folder**'s name is
// its **Source folder**, else `spellFolderKey`: a yearless title with none is
// named by its title alone, never `Heat ()`. Two titles with one key are
// still numbered, with a Warning line.

import { describe, expect, it } from 'vitest';

import type { Movie, SeriesDetail } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  exportRows,
  type ExportTable,
  type LayoutPlace,
  type PathCells,
} from '../exportRows/exportRows';
import { filePlan, type ExportFile } from './filePlan';

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

/** The Export's table, its File plan's files and its Warning lines. */
function exported(
  movies: readonly Movie[],
  series: readonly SeriesDetail[],
  sourceFolders: ReadonlyMap<string, string> = new Map()
): { rows: Record<string, string>[]; files: ExportFile[]; warnings: string[] } {
  const plan = filePlan({ images: true, subtitles: true });
  const { table, warnings } = exportRows(
    movies,
    series,
    plan.cells,
    sourceFolders
  );
  return { rows: byColumn(table), files: plan.files, warnings };
}

function byColumn(table: ExportTable): Record<string, string>[] {
  const [header = [], ...body] = table;
  return body.map((row) =>
    Object.fromEntries(
      header.map((name, index) => [text(name), text(row[index])])
    )
  );
}

/** _Death Note_, two episodes held at `Season 1/`, every file stored. */
const DEATH_NOTE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['unwatched', 'unwatched']], {
    id: 'death-note',
    title: 'Death Note',
    year: 2006,
    endYear: 2007,
    posterPath: 'death-note/poster.jpg',
    backdropPath: null,
  });
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      posterPath: 'death-note/season-1/poster.jpg',
      episodes: season.episodes.map((episode) => ({
        ...episode,
        videoPath: `Death Note/Season 1/Death Note 0${episode.number}.mkv`,
        sourceFile: `Season 1/Death Note 0${episode.number}.mkv`,
        stillPath: `death-note/stills/e${episode.number}.jpg`,
        subtitles: [
          {
            id: `dn${episode.number}`,
            path: `death-note/e${episode.number}.en.srt`,
            language: 'English',
            position: 0,
          },
        ],
      })),
    })),
  };
})();

/** Held from the Library folder's `Death Note/`. */
const HELD = new Map([['death-note', 'Death Note']]);

const planned = (files: readonly ExportFile[], storedPath: string) =>
  files.find((file) => file.storedPath === storedPath)?.path;

describe('filePlan: a Season 1 show laid out as the household named it', () => {
  it('plans its Season poster under Death Note/Season 1/', () => {
    const { files } = exported([], [DEATH_NOTE], HELD);

    expect(planned(files, 'death-note/season-1/poster.jpg')).toBe(
      'Death Note/Season 1/Images/poster.jpg'
    );
  });

  it('plans its Stills under Death Note/Season 1/', () => {
    const { files } = exported([], [DEATH_NOTE], HELD);

    expect(planned(files, 'death-note/stills/e1.jpg')).toBe(
      'Death Note/Season 1/Images/Stills/S01E01.jpg'
    );
    expect(planned(files, 'death-note/stills/e2.jpg')).toBe(
      'Death Note/Season 1/Images/Stills/S01E02.jpg'
    );
  });

  it('plans its episodes’ tracks under Death Note/Season 1/', () => {
    const { files } = exported([], [DEATH_NOTE], HELD);

    expect(planned(files, 'death-note/e1.en.srt')).toBe(
      'Death Note/Season 1/Subtitles/S01E01/English.srt'
    );
  });

  it('lays the season’s files in the folder its Video cells name', () => {
    const { rows, files } = exported([], [DEATH_NOTE], HELD);

    const videoFolders = rows
      .filter((row) => row.Type === 'Episode')
      .map((row) => row.Video.slice(0, row.Video.lastIndexOf('/')));
    expect(new Set(videoFolders)).toEqual(new Set(['Death Note/Season 1']));
    const seasonScoped = files
      .map((file) => file.path)
      .filter((path) => path !== 'Death Note/Images/poster.jpg');
    expect(seasonScoped.length).toBeGreaterThan(0);
    for (const path of seasonScoped) {
      expect(path.startsWith('Death Note/Season 1/')).toBe(true);
    }
  });

  it('fills the Season, Still and Subtitles cells with those paths', () => {
    const { rows } = exported([], [DEATH_NOTE], HELD);

    expect(rows.find((row) => row.Type === 'Season')?.Poster).toBe(
      'Death Note/Season 1/Images/poster.jpg'
    );
    const first = rows.find(
      (row) => row.Type === 'Episode' && row.Episode === '1'
    );
    expect(first?.Still).toBe('Death Note/Season 1/Images/Stills/S01E01.jpg');
    expect(first?.Subtitles).toBe(
      'Death Note/Season 1/Subtitles/S01E01/English.srt'
    );
  });
});

describe('exportRows: every season-scoped place carries its seasonFolder', () => {
  /** A fake `PathCells` recording every place it is asked. */
  function recorded(): { cells: PathCells; places: LayoutPlace[] } {
    const places: LayoutPlace[] = [];
    const cells: PathCells = {
      image: (place, storedPath) => {
        places.push(place);
        return storedPath;
      },
      tracks: (place) => {
        places.push(place);
        return [];
      },
      video: (place, storedPath) => {
        places.push(place);
        return storedPath;
      },
    };
    return { cells, places };
  }

  it('gives the season poster, Stills, tracks and videos Season 1', () => {
    const { cells, places } = recorded();
    exportRows([], [DEATH_NOTE], cells, HELD);

    const scoped = places.filter(
      (place) =>
        place.kind === 'season-poster' ||
        place.kind === 'still' ||
        ((place.kind === 'tracks' || place.kind === 'video') &&
          'season' in place)
    );
    // One season poster, then two episodes' still, tracks and video each.
    expect(scoped).toHaveLength(7);
    for (const place of scoped) {
      expect(place).toMatchObject({ seasonFolder: 'Season 1' });
    }
  });

  it('spells Season 01 for a season whose episodes name no folder', () => {
    const { cells, places } = recorded();
    const copied: SeriesDetail = {
      ...DEATH_NOTE,
      seasons: DEATH_NOTE.seasons.map((season) => ({
        ...season,
        episodes: season.episodes.map((episode) => ({
          ...episode,
          sourceFile: null,
        })),
      })),
    };
    exportRows([], [copied], cells, HELD);

    const poster = places.find((place) => place.kind === 'season-poster');
    expect(poster).toMatchObject({ seasonFolder: 'Season 01' });
  });
});

describe('exportRows: a Title folder’s name', () => {
  const HEAT: Movie = makeMovie({
    id: 'heat',
    title: 'Heat',
    year: null,
    videoPath: 'Heat/heat.mkv',
    posterPath: 'heat/poster.jpg',
  });

  it('lays out Heat/ for a title held from a folder named Heat', () => {
    const { rows, files } = exported(
      [{ ...HEAT, year: 1995 }],
      [],
      new Map([['heat', 'Heat']])
    );

    expect(rows[0]?.Folder).toBe('Heat');
    expect(planned(files, 'heat/poster.jpg')).toBe('Heat/Images/poster.jpg');
  });

  it('names a yearless title with no Source folder by its title alone', () => {
    const { rows, files } = exported([HEAT], []);

    expect(rows[0]?.Folder).toBe('Heat');
    expect(planned(files, 'heat/poster.jpg')).toBe('Heat/Images/poster.jpg');
    expect(JSON.stringify(rows)).not.toContain('Heat ()');
  });

  it('still numbers two titles with one key, with a Warning line', () => {
    const other: Movie = {
      ...HEAT,
      id: 'heat-tv',
      posterPath: 'heat-tv/poster.jpg',
    };

    const { rows, warnings } = exported([HEAT, other], []);

    expect(rows.map((row) => row.Folder).sort()).toEqual(['Heat', 'Heat (1)']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Heat (1)');
  });
});
