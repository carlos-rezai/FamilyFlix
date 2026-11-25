// @vitest-environment node
//
// 76, Whole add follow-up (issue #724): the Frame fill after a Folder scan.
//
// `createImporter` takes the **Frame fill** as a dependency beside the
// **Layout fill**, and a **Folder scan** starts it for each show it imports
// or joins, right after that show's Layout fill, without waiting: the scan
// goes on to review while the Stills are still being taken. A film starts
// none, and a sheet **Import** starts none (the Layout fill's own rule). The
// queue rules are `createFrameFill`'s; here they are proved to hold through
// the scan: one take at a time, a series asked twice filled once, a series
// gone while waiting taking nothing.
//
// Composed as `createImporter.layoutFill.test.ts` is: the film and series
// fixtures copied side by side into one sandboxed **Library folder**, a real
// `freshStorage`, a real `Media` over a sandbox **Managed media directory**,
// the absent **Playback component**, an idle **Library sheet writer** and
// Layout fill, and the real `createFrameFill` over a scripted `frame` that
// waits behind a door, recorded so a test knows which series it was asked
// for.

import { cpSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createFrameFill } from '../../enrichment/createFrameFill/createFrameFill';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import {
  createPlayback,
  type Playback,
} from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { SERIES_FIXTURE } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun, Series } from '@/types';

type Frame = Playback['frame'];

const HARBOR = 'Harbor & Vine (2021)';

/** A door the scripted frame waits behind until it is opened. */
function door() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The Library folder on disk. */
  root: string;
  /** The series fixture's sheet, beside the Library folder. */
  sheet: string;
  /** The scripted frame, waiting behind `held`. */
  frame: ReturnType<typeof vi.fn<Frame>>;
  held: ReturnType<typeof door>;
  /** Every series id the Frame fill was asked for, in order. */
  asked: string[];
}

/**
 * Both fixtures' trees in one sandboxed Library folder (two films, two
 * shows), and an importer handed the real Frame fill, recorded.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-frame-fill-');
  const mediaDir = join(dir, 'media');
  mkdirSync(mediaDir);
  const root = join(dir, 'Library');
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });
  cpSync(join(SERIES_FIXTURE, 'root'), root, { recursive: true });
  const sheet = join(dir, 'library.csv');
  cpSync(join(SERIES_FIXTURE, 'library.csv'), sheet);

  const storage = freshStorage();
  const media = createMedia(mediaDir, unfittedArt());
  const held = door();
  const frame = vi.fn<Frame>(async () => {
    await held.opened;
    return {
      kind: 'frame',
      picture: Readable.from([Buffer.from('a frame off the video')]),
    };
  });
  const real = createFrameFill({
    storage,
    media,
    playback: framelessPlayback(frame),
  });
  const asked: string[] = [];
  const importer = createImporter({
    storage,
    media,
    playback: createPlayback(mediaDir, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
    frameFill: {
      fill(seriesId: string) {
        asked.push(seriesId);
        return real.fill(seriesId);
      },
    },
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder, root, sheet, frame, held, asked };
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

/** One whole Folder scan of the sandbox's Library folder, linking. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, 'link');
  return untilReview(box.importer);
}

const allSeries = (storage: LibraryStorage): Series[] =>
  storage.getSeriesHome().series;

const seriesTitled = (storage: LibraryStorage, title: string): Series => {
  const found = allSeries(storage).find((series) => series.title === title);
  if (found === undefined) throw new Error(`no series titled ${title}`);
  return found;
};

/** Each episode of a series as `[S/E, still source or null]`. */
function stillSources(
  storage: LibraryStorage,
  id: string
): [string, string | null][] {
  const sources = storage.stillSourcesOf(id);
  return storage
    .listEpisodes(id)
    .map((episode) => [
      `S${episode.season}E${episode.number}`,
      episode.stillPath === null ? null : (sources.get(episode.id) ?? 'held'),
    ]);
}

/** Wait a beat for anything the scan might still have started. */
const aBeat = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('createImporter.scan: starts the Frame fill for each show', () => {
  it('asks it for every series the scan imports, and for no film', async () => {
    const box = sandbox();

    await scanOnce(box);

    await vi.waitFor(() => expect(box.asked).toHaveLength(2));
    expect([...box.asked].sort()).toEqual(
      allSeries(box.storage)
        .map((series) => series.id)
        .sort()
    );
    const films = box.storage.listMovies({ sort: 'a-z' }).map((m) => m.id);
    expect(films).toHaveLength(2);
    for (const film of films) {
      expect(box.asked).not.toContain(film);
    }
  });

  it('reaches review without waiting for the fill, and the Frame stills land after', async () => {
    const box = sandbox();

    const run = await scanOnce(box);

    // In review while the first take is still held behind the door.
    expect(run.phase).toBe('review');
    await vi.waitFor(() => expect(box.frame).toHaveBeenCalledTimes(1));
    const harbor = seriesTitled(box.storage, 'Harbor & Vine');
    expect(stillSources(box.storage, harbor.id)).toEqual([
      ['S1E1', null],
      ['S1E2', null],
    ]);

    box.held.open();
    await vi.waitFor(() =>
      expect(stillSources(box.storage, harbor.id)).toEqual([
        ['S1E1', 'frame'],
        ['S1E2', 'frame'],
      ])
    );
  });

  it('gives a frame only to the Still-less episodes, leaving a held Still', async () => {
    const box = sandbox();

    await scanOnce(box);
    box.held.open();

    const tidewater = seriesTitled(box.storage, 'Tidewater');
    await vi.waitFor(() =>
      expect(stillSources(box.storage, tidewater.id)[1]).toEqual([
        'S1E2',
        'frame',
      ])
    );
    const [first] = stillSources(box.storage, tidewater.id);
    expect(first[0]).toBe('S1E1');
    expect(first[1]).not.toBeNull();
    expect(first[1]).not.toBe('frame');
  });

  it('asks it for a held series a rescan joins, and its new episode gets a Frame still', async () => {
    const box = sandbox();
    const episode = join(
      box.root,
      HARBOR,
      'Season 01',
      'Harbor.and.Vine.S01E02.The.Night.Market.mp4'
    );
    const aside = join(box.root, 'aside.mp4');
    renameSync(episode, aside);
    await scanOnce(box);
    box.held.open();
    const harbor = seriesTitled(box.storage, 'Harbor & Vine');
    await vi.waitFor(() =>
      expect(stillSources(box.storage, harbor.id)).toEqual([['S1E1', 'frame']])
    );
    renameSync(aside, episode);
    box.asked.length = 0;

    await scanOnce(box);

    await vi.waitFor(() => expect(box.asked).toContain(harbor.id));
    await vi.waitFor(() =>
      expect(stillSources(box.storage, harbor.id)).toEqual([
        ['S1E1', 'frame'],
        ['S1E2', 'frame'],
      ])
    );
  });
});

describe('createImporter.start: a sheet Import starts no Frame fill', () => {
  it('asks it for nothing over the sheet, though a Folder scan of the same shows does', async () => {
    const sheeted = sandbox();
    await sheeted.importer.start(sheeted.sheet, false, 'link');
    await untilReview(sheeted.importer);
    expect(allSeries(sheeted.storage)).toHaveLength(2);

    const scanned = sandbox();
    await scanOnce(scanned);

    await aBeat();
    expect(sheeted.asked).toEqual([]);
    expect(sheeted.frame).not.toHaveBeenCalled();
    expect(scanned.asked).toHaveLength(2);
  });
});

describe('createImporter.scan: the Frame fill’s queue rules hold', () => {
  it('takes one frame at a time across the scanned shows', async () => {
    const box = sandbox();

    await scanOnce(box);
    await vi.waitFor(() => expect(box.frame).toHaveBeenCalledTimes(1));
    await aBeat();

    expect(box.frame).toHaveBeenCalledTimes(1);
  });

  it('fills a scanned series asked twice once: one frame per Still-less episode', async () => {
    const box = sandbox();
    await scanOnce(box);
    await vi.waitFor(() => expect(box.frame).toHaveBeenCalledTimes(1));

    // A second scan while the first take is held asks for both shows again.
    await scanOnce(box);
    await vi.waitFor(() => expect(box.asked).toHaveLength(4));
    box.held.open();

    const harbor = seriesTitled(box.storage, 'Harbor & Vine');
    const tidewater = seriesTitled(box.storage, 'Tidewater');
    await vi.waitFor(() => {
      expect(stillSources(box.storage, harbor.id)).toEqual([
        ['S1E1', 'frame'],
        ['S1E2', 'frame'],
      ]);
      expect(stillSources(box.storage, tidewater.id)[1]).toEqual([
        'S1E2',
        'frame',
      ]);
    });
    await aBeat();
    // Harbor & Vine's two and Tidewater's one, each taken once.
    expect(box.frame).toHaveBeenCalledTimes(3);
  });

  it('takes nothing for a scanned series deleted while it waits', async () => {
    const box = sandbox();
    await scanOnce(box);
    await vi.waitFor(() => expect(box.frame).toHaveBeenCalledTimes(1));
    const [first, second] = box.asked;
    const firstStillLess = stillSources(box.storage, first).filter(
      ([, source]) => source === null
    ).length;

    box.storage.deleteSeries(second);
    box.held.open();

    await vi.waitFor(() =>
      expect(
        stillSources(box.storage, first).filter(([, source]) => source === null)
      ).toEqual([])
    );
    await aBeat();
    expect(box.frame).toHaveBeenCalledTimes(firstStillLess);
    expect(box.storage.getSeriesDetail(second)).toBeNull();
  });
});
