// @vitest-environment node
//
// 60, Rebuild edges, Phase 11 (issue #574): held files land on one scan, and
// the log says so.
//
// The held-files fill runs after the run's new episodes are in, so a
// **Season** the same run adds takes its **Season poster** on that scan, and
// a held series' Season poster is set in one place only: copied in once, a
// held one never replaced. A held title's `✓ Updated` line names what it
// took from its **Title folder** (`poster`, `backdrop`, `season posters`,
// `stills`, `subtitles`) beside its **Sheet fills**, film and series alike,
// and a held series that took files is no longer logged **Already in
// library**.
//
// The ticket's own repros, laid from nothing: `Heat (1995)/heat.mkv` and
// `Sev (2022)/Season 01/Sev.S01E01.mkv` in a sandboxed **Library folder**, a
// real `freshStorage`, a real `Media` over a sandbox **Managed media
// directory** and the absent **Playback component**. Each file laid later
// holds its own name, so a copy is known by its bytes.

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type {
  ImportMode,
  ImportRun,
  Movie,
  SeriesDetail,
  Subtitle,
} from '@/types';

const HEAT = 'Heat (1995)';
const SEV = 'Sev (2022)';

/** A real JPEG to build each image from. */
const JPEG = readFileSync(
  join(LIBRARY_FIXTURE, 'root', 'Die Hard (1988)', 'Images', 'poster.jpg')
);

/** A real video to lay each episode and film from. */
const VIDEO = readFileSync(
  join(LIBRARY_FIXTURE, 'root', 'Die Hard (1988)', 'Die.Hard.1988.1080p.mp4')
);

/** The Library sheet's header, as the fixture's sheet spells it. */
const HEADER =
  'Type,Folder,Season,Episode,Title,Year,Air date,Runtime,Genres,Director,Cast,Synopsis,Rating,TMDB rating,TMDB id,Status,Favorite,Video,Subtitles,Poster,Backdrop,Still';

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The Library folder's path on disk. */
  root: string;
  /** The Managed media directory. */
  media: string;
}

/** A file laid at `path` under the Library folder, its bytes `bytes`. */
function lay(box: Sandbox, path: string, bytes: Buffer): Buffer {
  const absolute = join(box.root, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, bytes);
  return bytes;
}

/** An image laid at `path`: the JPEG's bytes and then its own path. */
function layImage(box: Sandbox, path: string): Buffer {
  return lay(box, path, Buffer.concat([JPEG, Buffer.from(path)]));
}

/** A subtitle track laid at `path`, its bytes its own path. */
function layTrack(box: Sandbox, path: string): Buffer {
  return lay(
    box,
    path,
    Buffer.from(`1\n00:00:01,000 --> 00:00:02,000\n${path}\n`)
  );
}

/** A video laid at `path`, the fixture's bytes and its own path. */
function layVideo(box: Sandbox, path: string): void {
  lay(box, path, Buffer.concat([VIDEO, Buffer.from(path)]));
}

/** A Meta sheet naming `rows` laid into the Library folder. */
function laySheet(box: Sandbox, rows: string[]): void {
  lay(
    box,
    join('Meta', 'familyflix-library.csv'),
    Buffer.from([HEADER, ...rows].join('\n') + '\n')
  );
}

/** The ticket's Library folder: Heat's one video, Sev's Season 01 episode. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-held-one-scan-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Library');
  mkdirSync(root);
  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    // A Linked video resolves under its Library folder, so a linked Heat is
    // held where it lies, not Found again.
    playback: createPlayback(
      media,
      fixedSlot(null),
      (id) =>
        storage.libraryFolders().find((folder) => folder.id === id)?.path ??
        null
    ),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  const box: Sandbox = {
    storage,
    importer,
    folder: storage.addLibraryFolder(root),
    root,
    media,
  };
  layVideo(box, join(HEAT, 'heat.mkv'));
  layVideo(box, join(SEV, 'Season 01', 'Sev.S01E01.mkv'));
  return box;
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

/** Heat as the library holds it, read whole. */
function heat(storage: LibraryStorage): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === 'Heat');
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error('the library holds no Heat');
  }
  return movie;
}

/** Sev as the library holds it, or a failure when it holds none. */
function sev(storage: LibraryStorage): SeriesDetail {
  const series = storage
    .getSeriesHome()
    .series.find((held) => held.title === 'Sev');
  const detail =
    series === undefined ? null : storage.getSeriesDetail(series.id);
  if (detail === null) {
    throw new Error('the library holds no Sev');
  }
  return detail;
}

/** Sev's Season `number` as held now, or a failure when it holds none. */
function sevSeason(storage: LibraryStorage, number: number) {
  const season = sev(storage).seasons.find((held) => held.number === number);
  if (season === undefined) {
    throw new Error(`the library holds no Sev Season ${number}`);
  }
  return season;
}

/** The bytes of a Stored path in the Managed media directory. */
function stored(box: Sandbox, path: string | null): Buffer {
  expect(path).not.toBeNull();
  return readFileSync(join(box.media, path as string));
}

/** Every file in the Managed media directory, walked whole. */
function mediaFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? mediaFiles(path) : [path];
  });
}

/** How many files in the Managed media directory hold exactly `bytes`. */
function copiesOf(box: Sandbox, bytes: Buffer): number {
  return mediaFiles(box.media).filter((path) =>
    readFileSync(path).equals(bytes)
  ).length;
}

/** The one track of a language, or a failure when there is not exactly one. */
function trackOf(tracks: readonly Subtitle[], language: string): Subtitle {
  const found = tracks.filter((track) => track.language === language);
  expect(found).toHaveLength(1);
  return found[0];
}

/**
 * What the title's one `✓ Updated` line names, sorted, or a failure when the
 * run logged not exactly one for it, or logged it as anything but `success`.
 */
function updatedNames(run: ImportRun, title: string): string[] {
  const prefix = `✓ Updated    ${title} — `;
  const lines = run.log.filter((line) => line.text.startsWith(prefix));
  expect(lines.map((line) => line.text)).toHaveLength(1);
  expect(lines[0].kind).toBe('success');
  return lines[0].text.slice(prefix.length).split(', ').sort();
}

/** Whether the run logged the title Already in library. */
function loggedAlreadyHeld(run: ImportRun, title: string): boolean {
  return run.log.some((line) => line.text === `· Already in library ${title}`);
}

describe.each(['copy', 'link'] as const)(
  'createImporter.scan: held files land on one scan (%s)',
  (mode) => {
    it('sets the Sev repro’s Season 2 poster on the scan that adds Season 2', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      layVideo(box, join(SEV, 'Season 02', 'Sev.S02E01.mkv'));
      const poster = layImage(
        box,
        join(SEV, 'Season 02', 'Images', 'poster.jpg')
      );

      const run = await scanOnce(box, mode);

      const season = sevSeason(box.storage, 2);
      expect(season.episodes.map((episode) => episode.number)).toEqual([1]);
      expect(stored(box, season.posterPath)).toEqual(poster);
      expect(run.problems).toEqual([]);
    });

    it('copies the new season’s poster into the library once', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      layVideo(box, join(SEV, 'Season 02', 'Sev.S02E01.mkv'));
      layVideo(box, join(SEV, 'Season 02', 'Sev.S02E02.mkv'));
      const poster = layImage(
        box,
        join(SEV, 'Season 02', 'Images', 'poster.jpg')
      );

      await scanOnce(box, mode);

      expect(copiesOf(box, poster)).toBe(1);
    });

    it('keeps a held season’s own poster while a new season takes its own', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      const ownPath = join('held-art', 'sev-s01.jpg');
      const own = Buffer.concat([JPEG, Buffer.from('held Season 1')]);
      mkdirSync(join(box.media, 'held-art'));
      writeFileSync(join(box.media, ownPath), own);
      box.storage.setSeasonPoster(sev(box.storage).series.id, 1, ownPath);
      layVideo(box, join(SEV, 'Season 01', 'Sev.S01E02.mkv'));
      layImage(box, join(SEV, 'Season 01', 'Images', 'poster.jpg'));
      layVideo(box, join(SEV, 'Season 02', 'Sev.S02E01.mkv'));
      const second = layImage(
        box,
        join(SEV, 'Season 02', 'Images', 'poster.jpg')
      );

      await scanOnce(box, mode);

      const first = sevSeason(box.storage, 1);
      expect(first.episodes.map((episode) => episode.number)).toEqual([1, 2]);
      expect(first.posterPath).toBe(ownPath);
      expect(stored(box, first.posterPath)).toEqual(own);
      expect(stored(box, sevSeason(box.storage, 2).posterPath)).toEqual(second);
    });

    it('fills the Heat repro’s poster, backdrop and track on one scan, and says so', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      const poster = layImage(box, join(HEAT, 'Images', 'poster.jpg'));
      const backdrop = layImage(box, join(HEAT, 'Images', 'backdrop.jpg'));
      const track = layTrack(box, join(HEAT, 'Subtitles', 'English.srt'));

      const run = await scanOnce(box, mode);

      const movie = heat(box.storage);
      expect(stored(box, movie.posterPath)).toEqual(poster);
      expect(stored(box, movie.backdropPath)).toEqual(backdrop);
      expect(stored(box, trackOf(movie.subtitles, 'English').path)).toEqual(
        track
      );
      expect(updatedNames(run, HEAT)).toEqual([
        'backdrop',
        'poster',
        'subtitles',
      ]);
      expect(loggedAlreadyHeld(run, HEAT)).toBe(false);
      expect(run.problems).toEqual([]);
    });

    it('names only the poster when a held film took only its poster', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      layImage(box, join(HEAT, 'Images', 'poster.jpg'));

      const run = await scanOnce(box, mode);

      expect(updatedNames(run, HEAT)).toEqual(['poster']);
    });

    it('names a held film’s Sheet fills beside the files it took, on one line', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      expect(heat(box.storage).synopsis).toBeNull();
      laySheet(box, [
        `Movie,${HEAT},,,Heat,1995,,,,,,A crew of thieves and the detective on their trail.,,,,,,,,,,`,
      ]);
      layImage(box, join(HEAT, 'Images', 'poster.jpg'));

      const run = await scanOnce(box, mode);

      expect(updatedNames(run, HEAT)).toEqual(['poster', 'synopsis']);
    });

    it('names each kind of file a held series took', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      layImage(box, join(SEV, 'Images', 'poster.jpg'));
      layImage(box, join(SEV, 'Season 01', 'Images', 'poster.jpg'));
      layImage(box, join(SEV, 'Season 01', 'Images', 'Stills', 'S01E01.jpg'));
      layTrack(
        box,
        join(SEV, 'Season 01', 'Subtitles', 'S01E01', 'English.srt')
      );

      const run = await scanOnce(box, mode);

      expect(updatedNames(run, SEV)).toEqual([
        'poster',
        'season posters',
        'stills',
        'subtitles',
      ]);
    });

    it('names a held series’ Sheet fills beside the files it took, on one line', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      expect(sev(box.storage).series.synopsis).toBeNull();
      laySheet(box, [
        `Series,${SEV},,,Sev,2022,,,,,,A courier crosses one city in seven nights.,,,,,,,,,,`,
      ]);
      layImage(box, join(SEV, 'Images', 'backdrop.jpg'));

      const run = await scanOnce(box, mode);

      expect(updatedNames(run, SEV)).toEqual(['backdrop', 'synopsis']);
    });

    it('does not log a held series that took files Already in library', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      layImage(box, join(SEV, 'Images', 'poster.jpg'));

      const run = await scanOnce(box, mode);

      expect(sev(box.storage).series.posterPath).not.toBeNull();
      expect(loggedAlreadyHeld(run, SEV)).toBe(false);
    });
  }
);
