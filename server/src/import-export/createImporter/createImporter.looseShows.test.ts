// @vitest-environment node
//
// 57 — Tidy into folders, Phase 5: "loose shows" (issue #528).
//
// A **Folder scan** groups tagged **Loose videos** by the **Title key** of the
// text before the tag into one `show` **Tidy**, filed as one hard `loose`
// **Problem** with the show reason, _N episodes lie loose at the top of
// <root>, with no folder of their own._ Episodes with nothing before the tag
// are kept where they are, and the walk logs _⚠ N loose episodes at the top
// of <root> don't name their show, left where they are_ once per folder.
// `importer.tidy` moves every episode and companion flat into the folder and
// imports one series through `importShow`; `importer.problem` answers a loose
// show's Resolve as the **Series Resolve** over its episodes, as `unplaced`
// does.
//
// Real runs over a root laid out per test (every video a copy of the
// fixture's header), the `createImporter.looseVideos` precedent.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import type { Episode, ImportProblem, ImportRun, Series } from '@/types';

/** The fixture's film header, every video's bytes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

const E01 = 'Breaking.Bad.S01E01.mp4';
const E02 = 'Breaking.Bad.S01E02.mp4';
const E01_SUBTITLE = 'Breaking.Bad.S01E01.en.srt';
const SHOW = 'Breaking Bad';

/** The demo: two loose episodes of one show, the first with its subtitle. */
const DEMO = [E01, E01_SUBTITLE, E02];

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  media: string;
  root: string;
  folder: StoredLibraryFolder;
  /** A second root, laid out from the second list, when one was given. */
  other: StoredLibraryFolder | null;
}

/** Lay `files` out under `root` (videos as the header, others as a subtitle). */
function layOut(root: string, files: string[]): void {
  mkdirSync(root, { recursive: true });
  for (const file of files) {
    const path = join(root, file);
    if (file.endsWith('.mp4')) {
      cpSync(HEADER, path);
    } else {
      writeFileSync(path, '1\n00:00:01,000 --> 00:00:02,000\nHi\n');
    }
  }
}

function sandbox(files: string[], otherFiles?: string[]): Sandbox {
  const dir = sandboxRoot('familyflix-loose-shows-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  layOut(root, files);

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  let other: StoredLibraryFolder | null = null;
  if (otherFiles !== undefined) {
    const second = join(dir, 'other');
    layOut(second, otherFiles);
    other = storage.addLibraryFolder(second);
  }
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, media, root, folder, other };
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

const looseOf = (run: ImportRun): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === 'loose');

/** A Link Folder scan over every listed folder, left in review. */
async function inReview(box: Sandbox): Promise<ImportRun> {
  const folders = box.other === null ? [box.folder] : [box.folder, box.other];
  await box.importer.scan(folders, false, 'link');
  return untilReview(box.importer);
}

/** The demo in review, and its one loose show Problem. */
async function showInReview(): Promise<
  Sandbox & { run: ImportRun; problem: ImportProblem }
> {
  const box = sandbox(DEMO);
  const run = await inReview(box);
  const [problem] = looseOf(run);
  if (problem === undefined) {
    throw new Error(`no loose Problem: ${JSON.stringify(run.problems)}`);
  }
  return { ...box, run, problem };
}

function seriesTitled(storage: LibraryStorage, title: string): Series[] {
  return storage
    .getSeriesHome()
    .series.filter((series) => series.title === title);
}

function episodesOf(storage: LibraryStorage, title: string): Episode[] {
  const [show] = seriesTitled(storage, title);
  if (show === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return storage.listEpisodes(show.id);
}

const untitledWarning = (count: number, root: string): string =>
  `⚠ ${count} loose episodes at the top of ${root} don't name their show, left where they are`;

describe('createImporter.scan — a loose show', () => {
  it('files one loose Problem for the episodes sharing a Title key, never a film', async () => {
    const box = sandbox(DEMO);

    const run = await inReview(box);

    expect(looseOf(run)).toHaveLength(1);
    expect(looseOf(run)[0].tidy?.kind).toBe('show');
  });

  it('gives it the show reason, named from the text before the tag, its tidy holding every episode', async () => {
    const box = sandbox(DEMO);

    const [problem] = looseOf(await inReview(box));

    expect(problem).toMatchObject({
      kind: 'loose',
      title: SHOW,
      reason: `2 episodes lie loose at the top of ${box.root}, with no folder of their own.`,
      tidy: {
        kind: 'show',
        folder: SHOW,
        videos: [E01, E02],
        companions: [E01_SUBTITLE],
      },
    });
  });
});

describe('createImporter.scan — untitled episodes', () => {
  it('keeps them, filing no tidy for them', async () => {
    const box = sandbox([...DEMO, 'S01E03.mp4', '1x04.mp4']);

    const run = await inReview(box);

    const tidied = looseOf(run).flatMap(
      (problem) => problem.tidy?.videos ?? []
    );
    expect(tidied).toEqual([E01, E02]);
    expect(existsSync(join(box.root, 'S01E03.mp4'))).toBe(true);
  });

  it('logs the Warning line once for the folder, counting them', async () => {
    const box = sandbox([...DEMO, 'S01E03.mp4', '1x04.mp4']);

    const run = await inReview(box);

    const warnings = run.log.filter((line) =>
      line.text.includes("don't name their show")
    );
    expect(warnings).toEqual([
      { text: untitledWarning(2, box.root), kind: 'warning' },
    ]);
  });

  it('logs one Warning line per folder holding them, and none for a folder without', async () => {
    const box = sandbox(
      ['S01E03.mp4', 'S01E04.mp4'],
      ['S02E01.mp4', 'S02E02.mp4', 'S02E03.mp4']
    );
    const plainRoot = join(box.root, '..', 'plain');
    layOut(plainRoot, [E01]);
    const plain = box.storage.addLibraryFolder(plainRoot);
    if (box.other === null) {
      throw new Error('the sandbox laid out no second root');
    }

    await box.importer.scan([box.folder, box.other, plain], false, 'link');
    const run = await untilReview(box.importer);

    const warnings = run.log.filter((line) =>
      line.text.includes("don't name their show")
    );
    expect(warnings).toEqual([
      { text: untitledWarning(2, box.root), kind: 'warning' },
      { text: untitledWarning(3, box.other.path), kind: 'warning' },
    ]);
  });
});

describe('createImporter.tidy — a loose show', () => {
  it('answers imported', async () => {
    const box = await showInReview();

    await expect(box.importer.tidy(box.problem.id)).resolves.toEqual({
      kind: 'imported',
    });
  });

  it('moves every episode and companion flat into the folder, with no Season folder', async () => {
    const box = await showInReview();

    await box.importer.tidy(box.problem.id);

    expect(readdirSync(join(box.root, SHOW)).sort()).toEqual(
      [E01, E01_SUBTITLE, E02].sort()
    );
    for (const file of DEMO) {
      expect(existsSync(join(box.root, file))).toBe(false);
    }
  });

  it('imports one series of two episodes, linked where they now lie', async () => {
    const box = await showInReview();

    await box.importer.tidy(box.problem.id);

    expect(seriesTitled(box.storage, SHOW)).toHaveLength(1);
    expect(
      episodesOf(box.storage, SHOW).map((episode) => ({
        season: episode.season,
        number: episode.number,
        videoFolderId: episode.videoFolderId,
        videoPath: episode.videoPath,
      }))
    ).toEqual([
      {
        season: 1,
        number: 1,
        videoFolderId: box.folder.id,
        videoPath: `${SHOW}/${E01}`,
      },
      {
        season: 1,
        number: 2,
        videoFolderId: box.folder.id,
        videoPath: `${SHOW}/${E02}`,
      },
    ]);
    expect(box.storage.listMovies({ sort: 'a-z' })).toEqual([]);
  });

  it('takes the Problem off the snapshot', async () => {
    const box = await showInReview();

    await box.importer.tidy(box.problem.id);

    expect(
      box.importer.current()?.problems.map((problem) => problem.id)
    ).not.toContain(box.problem.id);
  });
});

describe('createImporter.problem — Resolve on a loose show', () => {
  it('answers the show as the row, the root as the folder and its episodes as the videos', async () => {
    const box = await showInReview();

    const detail = box.importer.problem(box.problem.id);

    expect(detail?.row.title).toBe(SHOW);
    expect(detail?.folder).toBe(box.root);
    expect(detail?.files.videos).toEqual([
      join(box.root, E01),
      join(box.root, E02),
    ]);
  });
});
