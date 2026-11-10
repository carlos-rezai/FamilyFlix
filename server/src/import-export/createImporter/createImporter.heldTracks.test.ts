// @vitest-environment node
//
// 60, Rebuild edges, Phase 10 (issue #573): a held title takes the tracks it
// lacks.
//
// A film or a series scanned once is scanned again with new subtitle tracks
// in its **Title folder**: each track in a held film's `Subtitles/`, and in
// each held episode's place, whose language the title holds none of is added
// and copied in, as a first scan copies a track. A track of a language it
// already holds is never added, so a track the **Layout fill** wrote out is
// never read back as a second copy.
//
// Composed as the held art suites are: the film fixture, or the series
// fixture, copied into a sandboxed Library folder, a real `freshStorage`, a
// real `Media` over a sandbox **Managed media directory** and the absent
// **Playback component**. Each track laid later holds its own name, so a copy
// is known by its bytes. Every rescan also lays a track of a language the
// title lacks, so "not added" is told apart from "nothing read".

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createLayoutFill } from '../createLayoutFill/createLayoutFill';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { Episode, ImportMode, ImportRun, Movie, Subtitle } from '@/types';

const DIE_HARD = 'Die Hard (1988)';
const SHOW = 'Tidewater (2018)';

/** Die Hard's English track in the fixture. */
const DIE_HARD_ENGLISH = join('Subtitles', 'Die.Hard.1988.1080p.en.srt');

/** Tidewater's first episode's place for tracks. */
const E01_TRACKS = join('Season 01', 'Subtitles', 'S01E01');

/** Tidewater's first episode's English track in the fixture. */
const E01_ENGLISH = join(E01_TRACKS, 'Tidewater.en.srt');

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  media: Media;
  folder: StoredLibraryFolder;
  /** The Managed media directory. */
  mediaDir: string;
  /** The Title folder under test. */
  title: string;
}

/** An importer over a fresh library, `root` listed as its Library folder. */
function compose(dir: string, root: string, title: string): Sandbox {
  const mediaDir = join(dir, 'media');
  mkdirSync(mediaDir);
  const storage = freshStorage();
  const media = createMedia(mediaDir);
  const importer = createImporter({
    storage,
    media,
    playback: createPlayback(mediaDir, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, media, folder, mediaDir, title };
}

/** The film fixture as a Library folder, Die Hard's Title folder under test. */
function filmSandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-held-film-tracks-');
  const root = join(dir, 'Movies');
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });
  return compose(dir, root, join(root, DIE_HARD));
}

/** The series fixture as a Library folder, Tidewater's Title folder under test. */
function seriesSandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-held-episode-tracks-');
  const { root } = seriesFixture(dir, 'library.csv');
  return compose(dir, root, join(root, SHOW));
}

/** A track laid at `path` under the Title folder, its bytes its own name. */
function layTrack(box: Sandbox, path: string): Buffer {
  const bytes = Buffer.from(
    `1\n00:00:01,000 --> 00:00:02,000\n${path.replace(/\\/g, '/')}\n`
  );
  const absolute = join(box.title, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, bytes);
  return bytes;
}

/** The snapshot once the run has reached review, or a failure if it never does. */
async function untilReview(importer: Importer): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = importer.current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** One whole Folder scan in a mode, then the run let go. */
async function scanOnce(box: Sandbox, mode: ImportMode): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, mode);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** Die Hard as the library holds it, read whole. */
function dieHard(storage: LibraryStorage): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === 'Die Hard');
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error('the library holds no Die Hard');
  }
  return movie;
}

/** Tidewater's id, or a failure when the library holds none. */
function tidewaterId(storage: LibraryStorage): string {
  const series = storage
    .getSeriesHome()
    .series.find((held) => held.title === 'Tidewater');
  if (series === undefined) {
    throw new Error('the library holds no Tidewater');
  }
  return series.id;
}

/** Tidewater's episode `number` of Season 01 as held now. */
function episode(storage: LibraryStorage, number: number): Episode {
  const detail = storage.getSeriesDetail(tidewaterId(storage));
  const found = detail?.seasons
    .find((season) => season.number === 1)
    ?.episodes.find((held) => held.number === number);
  if (found === undefined) {
    throw new Error(`the library holds no Tidewater S01E0${number}`);
  }
  return found;
}

/** A title's tracks' languages, sorted. */
function languages(tracks: readonly Subtitle[]): string[] {
  return tracks.map((track) => track.language).sort();
}

/** The one track of a language, or a failure when there is not exactly one. */
function trackOf(tracks: readonly Subtitle[], language: string): Subtitle {
  const found = tracks.filter((track) => track.language === language);
  expect(found).toHaveLength(1);
  return found[0];
}

/** The bytes of a Stored path in the Managed media directory. */
function stored(box: Sandbox, path: string): Buffer {
  const absolute = join(box.mediaDir, path);
  expect(existsSync(absolute)).toBe(true);
  return readFileSync(absolute);
}

/** The tracks as the library holds them, without their ids' order mattering. */
function trackFacts(tracks: readonly Subtitle[]) {
  return tracks
    .map(({ id, path, language }) => ({ id, path, language }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe.each(['copy', 'link'] as const)(
  'createImporter.scan: a held title takes the tracks it lacks (%s)',
  (mode) => {
    it('takes Subtitles/English.srt into a held film with no English track', async () => {
      const box = filmSandbox();
      rmSync(join(box.title, DIE_HARD_ENGLISH));
      await scanOnce(box, mode);
      expect(languages(dieHard(box.storage).subtitles)).toEqual(['Portuguese']);
      const bytes = layTrack(box, join('Subtitles', 'English.srt'));

      const run = await scanOnce(box, mode);

      const tracks = dieHard(box.storage).subtitles;
      expect(languages(tracks)).toEqual(['English', 'Portuguese']);
      expect(stored(box, trackOf(tracks, 'English').path)).toEqual(bytes);
      expect(run.problems).toEqual([]);
    });

    it('gives a held episode a track of a language it lacks', async () => {
      const box = seriesSandbox();
      await scanOnce(box, mode);
      expect(languages(episode(box.storage, 1).subtitles)).toEqual(['English']);
      const bytes = layTrack(box, join(E01_TRACKS, 'Tidewater.fr.srt'));

      const run = await scanOnce(box, mode);

      const tracks = episode(box.storage, 1).subtitles;
      expect(languages(tracks)).toEqual(['English', 'French']);
      expect(stored(box, trackOf(tracks, 'French').path)).toEqual(bytes);
      expect(run.problems).toEqual([]);
    });

    it('does not add a held film a track of a language it holds', async () => {
      const box = filmSandbox();
      await scanOnce(box, mode);
      const before = dieHard(box.storage).subtitles;
      expect(languages(before)).toEqual(['English', 'Portuguese']);
      layTrack(box, join('Subtitles', 'English.srt'));
      layTrack(box, join('Subtitles', 'Portuguese.srt'));
      layTrack(box, join('Subtitles', 'French.srt'));

      await scanOnce(box, mode);

      const tracks = dieHard(box.storage).subtitles;
      expect(languages(tracks)).toEqual(['English', 'French', 'Portuguese']);
      expect(trackOf(tracks, 'English')).toEqual(trackOf(before, 'English'));
      expect(trackOf(tracks, 'Portuguese')).toEqual(
        trackOf(before, 'Portuguese')
      );
    });

    it('does not add a held episode a track of a language it holds', async () => {
      const box = seriesSandbox();
      await scanOnce(box, mode);
      const before = episode(box.storage, 1).subtitles;
      expect(languages(before)).toEqual(['English']);
      layTrack(box, join(E01_TRACKS, 'English.srt'));
      layTrack(box, join(E01_TRACKS, 'German.srt'));

      await scanOnce(box, mode);

      const tracks = episode(box.storage, 1).subtitles;
      expect(languages(tracks)).toEqual(['English', 'German']);
      expect(trackOf(tracks, 'English')).toEqual(trackOf(before, 'English'));
    });

    it('adds a held film no second track after the Layout fill', async () => {
      const box = filmSandbox();
      await scanOnce(box, mode);
      const film = dieHard(box.storage);
      rmSync(join(box.title, DIE_HARD_ENGLISH));
      const fill = createLayoutFill({ storage: box.storage, media: box.media });
      const outcome = await fill.fill(film.id);
      expect(outcome.written).toContain(
        join(box.title, 'Subtitles', 'English.srt')
      );
      layTrack(box, join('Subtitles', 'French.srt'));

      await scanOnce(box, mode);

      const tracks = dieHard(box.storage).subtitles;
      expect(languages(tracks)).toEqual(['English', 'French', 'Portuguese']);
      expect(
        trackFacts(tracks.filter((track) => track.language !== 'French'))
      ).toEqual(trackFacts(film.subtitles));
    });

    it('adds a held episode no second track after the Layout fill', async () => {
      const box = seriesSandbox();
      await scanOnce(box, mode);
      const before = episode(box.storage, 1).subtitles;
      rmSync(join(box.title, E01_ENGLISH));
      const fill = createLayoutFill({ storage: box.storage, media: box.media });
      const outcome = await fill.fill(tidewaterId(box.storage));
      expect(outcome.written).toContain(
        join(box.title, E01_TRACKS, 'English.srt')
      );
      layTrack(box, join(E01_TRACKS, 'Tidewater.fr.srt'));

      await scanOnce(box, mode);

      const tracks = episode(box.storage, 1).subtitles;
      expect(languages(tracks)).toEqual(['English', 'French']);
      expect(
        trackFacts(tracks.filter((track) => track.language !== 'French'))
      ).toEqual(trackFacts(before));
    });
  }
);
