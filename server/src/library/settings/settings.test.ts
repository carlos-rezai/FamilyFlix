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

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteStorage } from '..';
import { DEFAULT_SUBTITLE_LANGUAGE, type Settings } from '@/types';
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

    expect(storage.settings()).toEqual({ subtitleLanguage: 'English' });
  });

  it('answers the shared default, and nothing the caller has to know', () => {
    const storage = freshStorage();
    const settings: Settings = storage.settings();

    expect(settings.subtitleLanguage).toBe(DEFAULT_SUBTITLE_LANGUAGE);
    expect(Object.keys(settings)).toEqual(['subtitleLanguage']);
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

    expect(storage.settings()).toEqual({ subtitleLanguage: 'Spanish' });
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

    expect(second.settings()).toEqual({ subtitleLanguage: 'Portuguese' });
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

    expect(storage.settings()).toEqual({ subtitleLanguage: 'French' });
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

    expect(storage.settings()).toEqual({ subtitleLanguage: 'French' });
    expect(storage.tmdbKey()).toBe('kept-key');
  });
});
