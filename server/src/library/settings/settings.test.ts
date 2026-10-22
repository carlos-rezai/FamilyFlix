// @vitest-environment node
//
// 15 — Settings hub, Phase 2: "the Subtitles rows" (issue #144).
//
// The household's one preference, read and written through the `library/`
// repository's public `LibraryStorage` interface — `settings()` and
// `setSubtitleLanguage()` — over a REAL SQLite database. `library/` is the one
// SQLite door: a `settings/` server domain was rejected (two methods over one
// table is not a domain), and so was `localStorage` (volume is a device's;
// this is the household's, and it must be in the backup).
//
// `settings()` applies the default when the row is absent, so no caller has to
// know what it is; `setSubtitleLanguage` is an upsert, so the second write
// replaces the first rather than failing on the key. Membership in the
// **Language pool** is not checked — a display vocabulary, not a constraint,
// the rule a **Subtitle**'s own language follows.

import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteStorage } from '..';
import { openDatabase, type SqliteDatabase } from '../../db';
import { createSettings } from './settings';
import {
  shippingSourcesMatching,
  withoutComments,
} from '@/test-support/shippingSources/shippingSources';
import {
  DEFAULT_AUDIO_LANGUAGE,
  DEFAULT_START_TAB,
  DEFAULT_SUBTITLE_LANGUAGE,
  DEFAULT_TMDB_RATINGS,
  DEFAULT_ULTRAWIDE_MARGINS,
  isLibraryTab,
  LANGUAGE_POOL,
  LIBRARY_TABS,
  type PoolLanguage,
  type Settings,
} from '@/types';
import {
  closeTracked,
  freshStorage,
  track,
} from '../../test-support/freshStorage/freshStorage';

const tempDirs: string[] = [];

/** A path to a database file no other test shares, removed automatically. */
function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'familyflix-settings-'));
  tempDirs.push(dir);
  return join(dir, 'familyflix.db');
}

afterEach(() => {
  // Close the tracked databases before removing the directories they sit in —
  // Windows will not delete an open file, and this hook runs before the
  // harness's own teardown.
  closeTracked();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('library: settings() — the default applied', () => {
  it('answers English on a fresh database', () => {
    const storage = freshStorage();

    expect(storage.settings()).toEqual({
      subtitleLanguage: 'English',
      audioLanguage: 'English',
      ultrawideMargins: false,
      tmdbRatings: true,
      startTab: 'movies',
    });
  });

  it('answers the shared default, and nothing the caller has to know', () => {
    const storage = freshStorage();
    const settings: Settings = storage.settings();

    expect(settings.subtitleLanguage).toBe(DEFAULT_SUBTITLE_LANGUAGE);
    expect(Object.keys(settings)).toEqual([
      'subtitleLanguage',
      'audioLanguage',
      'ultrawideMargins',
      'tmdbRatings',
      'startTab',
    ]);
  });

  it('answers the same default however many times it is asked', () => {
    // Reading applies the default; it does not write it down as if chosen.
    const storage = freshStorage();

    expect(storage.settings()).toEqual(storage.settings());
    expect(storage.settings().subtitleLanguage).toBe('English');
  });
});

describe('library: setSubtitleLanguage — the upsert', () => {
  it('stores the language and reads it back', () => {
    const storage = freshStorage();

    storage.setSubtitleLanguage('Spanish');

    expect(storage.settings()).toEqual({
      subtitleLanguage: 'Spanish',
      audioLanguage: 'English',
      ultrawideMargins: false,
      tmdbRatings: true,
      startTab: 'movies',
    });
  });

  it('replaces the language already held rather than refusing the key', () => {
    const storage = freshStorage();
    storage.setSubtitleLanguage('Spanish');

    storage.setSubtitleLanguage('French');

    expect(storage.settings().subtitleLanguage).toBe('French');
  });

  it('takes the value already held as a harmless write', () => {
    const storage = freshStorage();
    storage.setSubtitleLanguage('Spanish');

    expect(() => storage.setSubtitleLanguage('Spanish')).not.toThrow();
    expect(storage.settings().subtitleLanguage).toBe('Spanish');
  });

  it('can be put back to the default by name', () => {
    const storage = freshStorage();
    storage.setSubtitleLanguage('Dutch');

    storage.setSubtitleLanguage('English');

    expect(storage.settings().subtitleLanguage).toBe('English');
  });

  it('keeps a language outside the pool as it was given', () => {
    // A display vocabulary, not a constraint: the pool is the pill's to draw,
    // and the repository stores what it is handed.
    const storage = freshStorage();

    storage.setSubtitleLanguage('Japanese');

    expect(storage.settings().subtitleLanguage).toBe('Japanese');
  });

  it('survives closing and reopening the database — it is in the backup', () => {
    const path = tempDbPath();
    const first = track(createSqliteStorage(path));
    first.setSubtitleLanguage('Portuguese');
    first.close();

    const second = track(createSqliteStorage(path));

    expect(second.settings()).toEqual({
      subtitleLanguage: 'Portuguese',
      audioLanguage: 'English',
      ultrawideMargins: false,
      tmdbRatings: true,
      startTab: 'movies',
    });
  });
});

// 23 — Enrichment, Phase 1: "the TMDB key" (issue #203).
//
// The maintainer's TMDB key lives in the same `settings` table under
// `tmdb-api-key`, read and written through the same repository. It is not a
// household preference: `settings()` — which the player reads through
// `GET /api/settings` — never carries it, and it reads `null` when absent
// rather than any default.
describe('library: tmdbKey / setTmdbKey — the TMDB key', () => {
  it('answers null on a fresh database', () => {
    const storage = freshStorage();

    expect(storage.tmdbKey()).toBeNull();
  });

  it('stores the key and reads it back', () => {
    const storage = freshStorage();

    storage.setTmdbKey('0123456789abcdef0123456789abcdef');

    expect(storage.tmdbKey()).toBe('0123456789abcdef0123456789abcdef');
  });

  it('replaces the key already held rather than refusing the key', () => {
    const storage = freshStorage();
    storage.setTmdbKey('first-key');

    storage.setTmdbKey('second-key');

    expect(storage.tmdbKey()).toBe('second-key');
  });

  it('leaves the household settings exactly as they were', () => {
    const storage = freshStorage();
    storage.setSubtitleLanguage('French');

    storage.setTmdbKey('0123456789abcdef0123456789abcdef');

    expect(storage.settings()).toEqual({
      subtitleLanguage: 'French',
      audioLanguage: 'English',
      ultrawideMargins: false,
      tmdbRatings: true,
      startTab: 'movies',
    });
  });

  it('is untouched by a subtitle language write', () => {
    const storage = freshStorage();
    storage.setTmdbKey('kept-key');

    storage.setSubtitleLanguage('German');

    expect(storage.tmdbKey()).toBe('kept-key');
  });

  it('survives closing and reopening the database', () => {
    const path = tempDbPath();
    const first = track(createSqliteStorage(path));
    first.setTmdbKey('kept-across-restarts');
    first.close();

    const second = track(createSqliteStorage(path));

    expect(second.tmdbKey()).toBe('kept-across-restarts');
  });
});

// 23 — Enrichment, Phase 3 (issue #205): reaching review stamps
// `enrichment-last-synced-at`, an ISO string in the same `settings` table —
// the library's, not a household preference, so `settings()` never carries it.
describe('library: enrichmentLastSyncedAt — when the library last synced', () => {
  it('answers null on a library never synced', () => {
    const storage = freshStorage();

    expect(storage.enrichmentLastSyncedAt()).toBeNull();
  });

  it('stores the ISO stamp and reads it back', () => {
    const storage = freshStorage();

    storage.setEnrichmentLastSyncedAt('2026-09-26T12:00:00.000Z');

    expect(storage.enrichmentLastSyncedAt()).toBe('2026-09-26T12:00:00.000Z');
  });

  it('replaces the stamp already held', () => {
    const storage = freshStorage();
    storage.setEnrichmentLastSyncedAt('2026-09-26T12:00:00.000Z');

    storage.setEnrichmentLastSyncedAt('2026-09-27T08:30:00.000Z');

    expect(storage.enrichmentLastSyncedAt()).toBe('2026-09-27T08:30:00.000Z');
  });

  it('leaves the household settings and the key exactly as they were', () => {
    const storage = freshStorage();
    storage.setSubtitleLanguage('French');
    storage.setTmdbKey('kept-key');

    storage.setEnrichmentLastSyncedAt('2026-09-26T12:00:00.000Z');

    expect(storage.settings()).toEqual({
      subtitleLanguage: 'French',
      audioLanguage: 'English',
      ultrawideMargins: false,
      tmdbRatings: true,
      startTab: 'movies',
    });
    expect(storage.tmdbKey()).toBe('kept-key');
  });
});

// 30 — Library folders, Phase 4 (issue #271): the single remembered root is
// gone. Migration #7 carries `library-root` over onto the **Library folders**
// list and deletes the key, so one place remembers folders: the storage no
// longer answers `libraryRoot` or takes `setLibraryRoot`, and no shipping code
// reads either — the migration that carries the key over is the one place
// left that names it.
describe('library: no remembered root — the folder list replaced it', () => {
  it('offers neither libraryRoot nor setLibraryRoot', () => {
    const storage = freshStorage();

    expect('libraryRoot' in storage).toBe(false);
    expect('setLibraryRoot' in storage).toBe(false);
  });

  it('leaves no shipping code reading libraryRoot or the library-root key', () => {
    const pattern = /\b(?:set)?[lL]ibraryRoot\b|['"`]library-root['"`]/;
    const readers = ['server/src', 'src', 'electron']
      .flatMap((root) => shippingSourcesMatching(root, pattern))
      .filter((path) => path !== 'server/src/db/migrations.ts');

    expect(readers).toEqual([]);
  });
});

// 27 — Ultrawide margins, Phase 1 (issue #249): the household's second
// preference, `ultrawide-margins` in the same `settings` table, stored as
// `'1'` / `'0'`. `settings()` answers it with the default — off — applied when
// the row is absent, and does not write that default down; `setUltrawideMargins`
// is an upsert through the same pair the subtitle language uses. Driven through
// `createSettings` over a raw migrated handle, so the table itself can be asked
// whether a read wrote anything.
describe('library: ultrawideMargins / setUltrawideMargins — the frame preference', () => {
  /** A migrated in-memory handle and the repository over it. */
  function repositoryOverRawDb() {
    const db = track(openDatabase(':memory:'));
    return { db, repository: createSettings(db) };
  }

  /** How many rows the settings table holds under `key`. */
  function rowsUnder(db: SqliteDatabase, key: string): number {
    return (
      db
        .prepare('SELECT COUNT(*) AS count FROM settings WHERE key = ?')
        .get(key) as { count: number }
    ).count;
  }

  it('answers false on a fresh database — the shared default', () => {
    const storage = freshStorage();

    expect(storage.settings().ultrawideMargins).toBe(false);
    expect(DEFAULT_ULTRAWIDE_MARGINS).toBe(false);
  });

  it('does not write the default down when it is read', () => {
    const { db, repository } = repositoryOverRawDb();

    expect(repository.settings().ultrawideMargins).toBe(false);
    expect(repository.settings().ultrawideMargins).toBe(false);

    expect(rowsUnder(db, 'ultrawide-margins')).toBe(0);
  });

  it('stores true and reads it back', () => {
    const storage = freshStorage();

    storage.setUltrawideMargins(true);

    expect(storage.settings().ultrawideMargins).toBe(true);
  });

  it('round-trips true then false', () => {
    const storage = freshStorage();
    storage.setUltrawideMargins(true);

    storage.setUltrawideMargins(false);

    expect(storage.settings().ultrawideMargins).toBe(false);
  });

  it('upserts a repeated write rather than failing on the key', () => {
    const { db, repository } = repositoryOverRawDb();
    repository.setUltrawideMargins(true);

    expect(() => repository.setUltrawideMargins(true)).not.toThrow();
    expect(repository.settings().ultrawideMargins).toBe(true);
    expect(rowsUnder(db, 'ultrawide-margins')).toBe(1);
  });

  it('leaves the subtitle language untouched by either write', () => {
    const storage = freshStorage();
    storage.setSubtitleLanguage('French');

    storage.setUltrawideMargins(true);
    expect(storage.settings().subtitleLanguage).toBe('French');

    storage.setUltrawideMargins(false);
    expect(storage.settings().subtitleLanguage).toBe('French');
  });

  it('is untouched by a subtitle language write', () => {
    const storage = freshStorage();
    storage.setUltrawideMargins(true);

    storage.setSubtitleLanguage('German');

    expect(storage.settings()).toEqual({
      subtitleLanguage: 'German',
      audioLanguage: 'English',
      ultrawideMargins: true,
      tmdbRatings: true,
      startTab: 'movies',
    });
  });

  it('survives closing and reopening the database — it is in the backup', () => {
    const path = tempDbPath();
    const first = track(createSqliteStorage(path));
    first.setUltrawideMargins(true);
    first.close();

    const second = track(createSqliteStorage(path));

    expect(second.settings().ultrawideMargins).toBe(true);
  });
});

// 43 — TMDB ratings, Phase 1 (issue #369): the household's third preference,
// `tmdb-ratings` in the same `settings` table, stored as `'1'` / `'0'` and read
// through the one `valueOf`. `settings()` answers it as `tmdbRatings` with the
// default — on — applied when the row is absent, and does not write that
// default down; `setTmdbRatings` is an upsert, `setUltrawideMargins`' twin.
// Factory reset's erase takes the `settings` table, so the default returns.
describe('library: tmdbRatings / setTmdbRatings — the TMDB ratings preference', () => {
  /** A migrated in-memory handle and the repository over it. */
  function repositoryOverRawDb() {
    const db = track(openDatabase(':memory:'));
    return { db, repository: createSettings(db) };
  }

  /** How many rows the settings table holds under `key`. */
  function rowsUnder(db: SqliteDatabase, key: string): number {
    return (
      db
        .prepare('SELECT COUNT(*) AS count FROM settings WHERE key = ?')
        .get(key) as { count: number }
    ).count;
  }

  it('answers true on a fresh database — the shared default', () => {
    const storage = freshStorage();

    expect(storage.settings().tmdbRatings).toBe(true);
    expect(DEFAULT_TMDB_RATINGS).toBe(true);
  });

  it('does not write the default down when it is read', () => {
    const { db, repository } = repositoryOverRawDb();

    expect(repository.settings().tmdbRatings).toBe(true);
    expect(repository.settings().tmdbRatings).toBe(true);

    expect(rowsUnder(db, 'tmdb-ratings')).toBe(0);
  });

  it('stores false and reads it back', () => {
    const storage = freshStorage();

    storage.setTmdbRatings(false);

    expect(storage.settings().tmdbRatings).toBe(false);
  });

  it('round-trips false then true', () => {
    const storage = freshStorage();
    storage.setTmdbRatings(false);

    storage.setTmdbRatings(true);

    expect(storage.settings().tmdbRatings).toBe(true);
  });

  it("stores the value under 'tmdb-ratings' as '1' / '0'", () => {
    const { db, repository } = repositoryOverRawDb();
    const stored = () =>
      (
        db
          .prepare('SELECT value FROM settings WHERE key = ?')
          .get('tmdb-ratings') as { value: string } | undefined
      )?.value;

    repository.setTmdbRatings(false);
    expect(stored()).toBe('0');

    repository.setTmdbRatings(true);
    expect(stored()).toBe('1');
  });

  it('upserts a repeated write rather than failing on the key', () => {
    const { db, repository } = repositoryOverRawDb();
    repository.setTmdbRatings(false);

    expect(() => repository.setTmdbRatings(false)).not.toThrow();
    expect(repository.settings().tmdbRatings).toBe(false);
    expect(rowsUnder(db, 'tmdb-ratings')).toBe(1);
  });

  it('leaves the other two preferences untouched', () => {
    const storage = freshStorage();
    storage.setSubtitleLanguage('French');
    storage.setUltrawideMargins(true);

    storage.setTmdbRatings(false);

    expect(storage.settings()).toEqual({
      subtitleLanguage: 'French',
      audioLanguage: 'English',
      ultrawideMargins: true,
      tmdbRatings: false,
      startTab: 'movies',
    });
  });

  it('is untouched by an Ultrawide margins write', () => {
    const storage = freshStorage();
    storage.setTmdbRatings(false);

    storage.setUltrawideMargins(true);

    expect(storage.settings().tmdbRatings).toBe(false);
  });

  it('survives closing and reopening the database — it is in the backup', () => {
    const path = tempDbPath();
    const first = track(createSqliteStorage(path));
    first.setTmdbRatings(false);
    first.close();

    const second = track(createSqliteStorage(path));

    expect(second.settings().tmdbRatings).toBe(false);
  });

  it('returns to the default after a Factory reset', () => {
    const storage = freshStorage();
    storage.setTmdbRatings(false);

    storage.reset();

    expect(storage.settings().tmdbRatings).toBe(true);
  });
});

// 46 — Audio tracks, Phase 1 (issue #399): the pool renamed. The **Language
// pool** is no longer the subtitles' alone — the **Preferred audio language**
// is chosen off it too — so its list is `LANGUAGE_POOL` and its union
// `PoolLanguage`, for every reader. `DEFAULT_SUBTITLE_LANGUAGE` stays, and
// `DEFAULT_AUDIO_LANGUAGE`, English, is born beside it with nothing reading it.
describe('library: the Language pool — renamed for audio beside subtitles', () => {
  it('lists the seven languages as LANGUAGE_POOL, in the dropdown order', () => {
    expect(LANGUAGE_POOL).toEqual([
      'English',
      'Spanish',
      'French',
      'German',
      'Portuguese',
      'Italian',
      'Dutch',
    ]);
  });

  it('exports DEFAULT_AUDIO_LANGUAGE as English, a member of the pool', () => {
    const audio: PoolLanguage = DEFAULT_AUDIO_LANGUAGE;

    expect(audio).toBe('English');
    expect(LANGUAGE_POOL).toContain(DEFAULT_AUDIO_LANGUAGE);
  });

  it('leaves no code, shipping or test, naming the old list or its union', () => {
    // Joined from halves so this suite does not name them itself.
    const names = [
      ['SUBTITLE_', 'LANGUAGES'],
      ['Subtitle', 'Language'],
    ].map((halves) => halves.join(''));
    const pattern = new RegExp(`\\b(?:${names.join('|')})\\b`);
    const sources = (root: string): string[] =>
      readdirSync(root, { recursive: true, encoding: 'utf8' })
        .map((entry) => `${root}/${entry}`.replace(/\\/g, '/'))
        .filter((path) => /\.tsx?$/.test(path))
        .filter((path) => !/\/(?:dist|node_modules)\//.test(path));
    const readers = ['server/src', 'src', 'electron']
      .flatMap(sources)
      .filter((path) =>
        pattern.test(withoutComments(readFileSync(path, 'utf8')))
      );

    expect(readers).toEqual([]);
  });
});

// 46 — Audio tracks, Phase 3 (issue #401): the **Preferred audio language**.
// A fourth preference under the key `audio-language`, read through `valueOf`
// with `DEFAULT_AUDIO_LANGUAGE` applied when the row is absent, and written by
// `setAudioLanguage()`, an upsert. The pool is a vocabulary, not a constraint.
describe('library: audioLanguage / setAudioLanguage — the audio preference', () => {
  /** A migrated in-memory handle and the repository over it. */
  function repositoryOverRawDb() {
    const db = track(openDatabase(':memory:'));
    return { db, repository: createSettings(db) };
  }

  it('answers English on a fresh database — the shared default', () => {
    const storage = freshStorage();

    expect(storage.settings().audioLanguage).toBe('English');
    expect(storage.settings().audioLanguage).toBe(DEFAULT_AUDIO_LANGUAGE);
  });

  it('does not write the default down when it is read', () => {
    const { db, repository } = repositoryOverRawDb();

    expect(repository.settings().audioLanguage).toBe('English');

    const rows = db
      .prepare('SELECT COUNT(*) AS count FROM settings WHERE key = ?')
      .get('audio-language') as { count: number };
    expect(rows.count).toBe(0);
  });

  it("stores the language under 'audio-language' and reads it back", () => {
    const { db, repository } = repositoryOverRawDb();

    repository.setAudioLanguage('French');

    expect(repository.settings().audioLanguage).toBe('French');
    expect(
      (
        db
          .prepare('SELECT value FROM settings WHERE key = ?')
          .get('audio-language') as { value: string } | undefined
      )?.value
    ).toBe('French');
  });

  it('replaces the language already held rather than refusing the key', () => {
    const storage = freshStorage();
    storage.setAudioLanguage('Spanish');

    storage.setAudioLanguage('Dutch');

    expect(storage.settings().audioLanguage).toBe('Dutch');
  });

  it('keeps a language outside the pool as it was given', () => {
    const storage = freshStorage();

    storage.setAudioLanguage('Japanese');

    expect(storage.settings().audioLanguage).toBe('Japanese');
  });

  it('leaves the other three preferences untouched, and is untouched by them', () => {
    const storage = freshStorage();
    storage.setAudioLanguage('German');

    storage.setSubtitleLanguage('Italian');
    storage.setUltrawideMargins(true);
    storage.setTmdbRatings(false);

    expect(storage.settings()).toEqual({
      subtitleLanguage: 'Italian',
      audioLanguage: 'German',
      ultrawideMargins: true,
      tmdbRatings: false,
      startTab: 'movies',
    });
  });

  it('survives closing and reopening the database — it is in the backup', () => {
    const path = tempDbPath();
    const first = track(createSqliteStorage(path));
    first.setAudioLanguage('Portuguese');
    first.close();

    const second = track(createSqliteStorage(path));

    expect(second.settings().audioLanguage).toBe('Portuguese');
  });

  it('returns to English after a Factory reset', () => {
    const storage = freshStorage();
    storage.setAudioLanguage('Spanish');

    storage.reset();

    expect(storage.settings().audioLanguage).toBe('English');
  });
});

// 49 — Start on Series, Phase 3 (issue #428): the **Start tab**. A fifth
// preference under the key `start-tab`, a choice of two rather than a flag:
// the **Library tabs** are spelled once as `LIBRARY_TABS`, `LibraryTab` is
// derived from it, and `isLibraryTab` is the guard the read and the route
// share. `settings()` answers `startTab`, reading nothing, or a stored value
// outside the list, as `DEFAULT_START_TAB` (Movies); `setStartTab` is an
// upsert. A Factory reset empties the table, so Movies returns.
describe('the Library tabs — LIBRARY_TABS, LibraryTab and isLibraryTab', () => {
  it.each(['movies', 'series'])('recognises %s as a Library tab', (tab) => {
    expect(isLibraryTab(tab)).toBe(true);
  });

  it.each([
    ['an unknown name', 'documentaries'],
    ['a different case', 'Series'],
    ['an empty string', ''],
    ['a number', 1],
    ['a null', null],
    ['an absent value', undefined],
  ])('refuses %s', (_, value) => {
    expect(isLibraryTab(value)).toBe(false);
  });

  it('defaults the Start tab to Movies, a member of the list', () => {
    expect(DEFAULT_START_TAB).toBe('movies');
    expect(LIBRARY_TABS).toContain(DEFAULT_START_TAB);
  });
});

describe('library: startTab / setStartTab — the Start tab preference', () => {
  /** A migrated in-memory handle and the repository over it. */
  function repositoryOverRawDb() {
    const db = track(openDatabase(':memory:'));
    return { db, repository: createSettings(db) };
  }

  /** How many rows the settings table holds under `key`. */
  function rowsUnder(db: SqliteDatabase, key: string): number {
    return (
      db
        .prepare('SELECT COUNT(*) AS count FROM settings WHERE key = ?')
        .get(key) as { count: number }
    ).count;
  }

  it('answers movies on a fresh database — the shared default', () => {
    const storage = freshStorage();

    expect(storage.settings().startTab).toBe('movies');
    expect(storage.settings().startTab).toBe(DEFAULT_START_TAB);
  });

  it('does not write the default down when it is read', () => {
    const { db, repository } = repositoryOverRawDb();

    expect(repository.settings().startTab).toBe('movies');

    expect(rowsUnder(db, 'start-tab')).toBe(0);
  });

  it('stores series and reads it back', () => {
    const storage = freshStorage();

    storage.setStartTab('series');

    expect(storage.settings().startTab).toBe('series');
  });

  it('round-trips series then movies', () => {
    const storage = freshStorage();
    storage.setStartTab('series');

    storage.setStartTab('movies');

    expect(storage.settings().startTab).toBe('movies');
  });

  it("stores the value under 'start-tab' as the tab's own name", () => {
    const { db, repository } = repositoryOverRawDb();

    repository.setStartTab('series');

    const row = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('start-tab') as { value: string } | undefined;
    expect(row?.value).toBe('series');
  });

  it('upserts a repeated write rather than failing on the key', () => {
    const { db, repository } = repositoryOverRawDb();
    repository.setStartTab('series');

    expect(() => repository.setStartTab('series')).not.toThrow();
    expect(repository.settings().startTab).toBe('series');
    expect(rowsUnder(db, 'start-tab')).toBe(1);
  });

  it.each(['documentaries', 'Series', ''])(
    'reads a hand-stored %j as movies',
    (nonsense) => {
      const { db, repository } = repositoryOverRawDb();
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
        'start-tab',
        nonsense
      );

      expect(repository.settings().startTab).toBe('movies');
    }
  );

  it('leaves the other preferences untouched', () => {
    const storage = freshStorage();
    storage.setSubtitleLanguage('French');
    storage.setAudioLanguage('German');
    storage.setUltrawideMargins(true);
    storage.setTmdbRatings(false);

    storage.setStartTab('series');

    expect(storage.settings()).toEqual({
      subtitleLanguage: 'French',
      audioLanguage: 'German',
      ultrawideMargins: true,
      tmdbRatings: false,
      startTab: 'series',
    });
  });

  it('survives closing and reopening the database — it is in the backup', () => {
    const path = tempDbPath();
    const first = track(createSqliteStorage(path));
    first.setStartTab('series');
    first.close();

    const second = track(createSqliteStorage(path));

    expect(second.settings().startTab).toBe('series');
  });

  it('returns to movies after a Factory reset', () => {
    const storage = freshStorage();
    storage.setStartTab('series');

    storage.reset();

    expect(storage.settings().startTab).toBe('movies');
  });
});
