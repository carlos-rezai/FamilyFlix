import { describe, it, expect } from 'vitest';

import { deleteView, titleRowView } from './titleRowView';
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

/**
 * 47 — Manage library, Phase 4: "delete a copied title" (issue #410).
 *
 * `deleteView`, pure: a copied **Library title** → the **Delete dialog**'s
 * words (log 47 Q12), spelled once beside the row's:
 *
 * - `heading` — _Delete “Coco”?_;
 * - `subtitle` — _This takes the movie out of FamilyFlix. It can’t be undone
 *   from here._, _the series_ for a show;
 * - `goes` — _Its details, poster and artwork_; _Its watch history, rating
 *   and heart_; _FamilyFlix’s copy of its video and subtitles_;
 * - `stays` — with an original in a Library folder, _Your original in its
 *   library folder — Scan folders would bring it back_; without, _Nothing_;
 * - `confirm` — _Delete movie_ / _Delete series_.
 */
const COPIED_GOES = [
  'Its details, poster and artwork',
  'Its watch history, rating and heart',
  'FamilyFlix’s copy of its video and subtitles',
];
const ORIGINAL_STAYS = [
  'Your original in its library folder — Scan folders would bring it back',
];

describe('deleteView — the heading and subtitle', () => {
  it('names the title in the heading', () => {
    expect(deleteView(makeLibraryMovie({ title: 'Coco' })).heading).toBe(
      'Delete “Coco”?'
    );
  });

  it('says the movie leaves FamilyFlix and can’t be undone from here', () => {
    expect(deleteView(makeLibraryMovie()).subtitle).toBe(
      'This takes the movie out of FamilyFlix. It can’t be undone from here.'
    );
  });

  it('says the series, for a show', () => {
    expect(deleteView(makeLibrarySeries({ title: 'Bluey' }))).toMatchObject({
      heading: 'Delete “Bluey”?',
      subtitle:
        'This takes the series out of FamilyFlix. It can’t be undone from here.',
    });
  });
});

describe('deleteView — What goes', () => {
  it('lists a copied film’s details, history and FamilyFlix’s copy', () => {
    expect(deleteView(makeLibraryMovie()).goes).toEqual(COPIED_GOES);
  });

  it('lists the same for a copied show', () => {
    expect(deleteView(makeLibrarySeries()).goes).toEqual(COPIED_GOES);
  });

  it('lists the same whether or not there is an original', () => {
    expect(
      deleteView(makeLibraryMovie({ originalPath: 'E:\\Movies\\Coco (2017)' }))
        .goes
    ).toEqual(COPIED_GOES);
  });
});

describe('deleteView — What stays', () => {
  it('keeps the original in its Library folder, which a scan would bring back', () => {
    expect(
      deleteView(makeLibraryMovie({ originalPath: 'E:\\Movies\\Coco (2017)' }))
        .stays
    ).toEqual(ORIGINAL_STAYS);
  });

  it('keeps a show’s original the same way', () => {
    expect(
      deleteView(makeLibrarySeries({ originalPath: 'E:\\Series\\Bluey' })).stays
    ).toEqual(ORIGINAL_STAYS);
  });

  it('keeps Nothing for a title added by hand, with no original', () => {
    expect(deleteView(makeLibraryMovie({ originalPath: null })).stays).toEqual([
      'Nothing',
    ]);
  });
});

describe('deleteView — the confirm', () => {
  it('reads Delete movie for a film', () => {
    expect(deleteView(makeLibraryMovie()).confirm).toBe('Delete movie');
  });

  it('reads Delete series for a show', () => {
    expect(deleteView(makeLibrarySeries()).confirm).toBe('Delete series');
  });
});
