import { describe, it, expect } from 'vitest';

import { titleRowView } from './titleRowView';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
 *
 * `titleRowView`, pure: a **Library title** → the **Title row**'s words,
 * every sentence spelled once — `importView`'s and `enrichmentView`'s
 * precedent:
 *
 * - `year` — the film's year, a show's **Year range** as the series page
 *   spells it (`spellYearSpan`), `null` with none;
 * - `badge` — _Linked_ for a title with **Linked files** of any kind, else
 *   _Copied_, the **Import mode**'s words;
 * - `files` — _N files_ for a film (_1 file_), _N seasons · N episodes_ for
 *   a show, `SeriesMetaLine`'s counts;
 * - `dot` — the **Details state**'s tone and words: _Synced with TMDB_
 *   `success`, _Your own details_ `info`, _No details_ `warning`;
 * - `unreachable` — `folderLine`'s _Can’t be reached right now_ when the
 *   Linked files are `unreachable`, else `null`.
 */

describe('titleRowView — the year', () => {
  it('spells a film’s year', () => {
    expect(titleRowView(makeLibraryMovie({ year: 2017 })).year).toBe('2017');
  });

  it('draws no year for a film with none', () => {
    expect(titleRowView(makeLibraryMovie({ year: null })).year).toBeNull();
  });

  it('spells a show’s Year range, closed', () => {
    expect(
      titleRowView(makeLibrarySeries({ year: 2019, endYear: 2023 })).year
    ).toBe('2019–2023');
  });

  it('spells a show still running as an open range', () => {
    expect(
      titleRowView(makeLibrarySeries({ year: 2021, endYear: null })).year
    ).toBe('2021–');
  });

  it('draws no year for a show with none', () => {
    expect(
      titleRowView(makeLibrarySeries({ year: null, endYear: null })).year
    ).toBeNull();
  });
});

describe('titleRowView — the badge', () => {
  it('badges a copied title Copied', () => {
    expect(titleRowView(makeLibraryMovie({ linkedFiles: null })).badge).toBe(
      'Copied'
    );
  });

  it.each(['folder', 'videos', 'unreachable'] as const)(
    'badges a title whose Linked files are %s Linked',
    (linkedFiles) => {
      expect(titleRowView(makeLibraryMovie({ linkedFiles })).badge).toBe(
        'Linked'
      );
      expect(titleRowView(makeLibrarySeries({ linkedFiles })).badge).toBe(
        'Linked'
      );
    }
  );
});

describe('titleRowView — the files', () => {
  it('counts a film’s files', () => {
    expect(titleRowView(makeLibraryMovie({ files: 3 })).files).toBe('3 files');
  });

  it('counts one file in the singular', () => {
    expect(titleRowView(makeLibraryMovie({ files: 1 })).files).toBe('1 file');
  });

  it('counts a show’s seasons and episodes', () => {
    expect(
      titleRowView(makeLibrarySeries({ seasons: 3, episodes: 151 })).files
    ).toBe('3 seasons · 151 episodes');
  });

  it('counts one season and one episode in the singular', () => {
    expect(
      titleRowView(makeLibrarySeries({ seasons: 1, episodes: 1 })).files
    ).toBe('1 season · 1 episode');
  });
});

describe('titleRowView — the dot', () => {
  it('reads synced as Synced with TMDB, in success', () => {
    expect(titleRowView(makeLibraryMovie({ details: 'synced' })).dot).toEqual({
      tone: 'success',
      label: 'Synced with TMDB',
    });
  });

  it('reads own as Your own details, in info', () => {
    expect(titleRowView(makeLibraryMovie({ details: 'own' })).dot).toEqual({
      tone: 'info',
      label: 'Your own details',
    });
  });

  it('reads none as No details, in warning', () => {
    expect(titleRowView(makeLibrarySeries({ details: 'none' })).dot).toEqual({
      tone: 'warning',
      label: 'No details',
    });
  });
});

describe('titleRowView — the unreachable line', () => {
  it('says an unreachable title can’t be reached right now', () => {
    expect(
      titleRowView(makeLibraryMovie({ linkedFiles: 'unreachable' })).unreachable
    ).toBe('Can’t be reached right now');
  });

  it.each([null, 'folder', 'videos'] as const)(
    'draws no line when the Linked files are %s',
    (linkedFiles) => {
      expect(
        titleRowView(makeLibraryMovie({ linkedFiles })).unreachable
      ).toBeNull();
    }
  );
});
