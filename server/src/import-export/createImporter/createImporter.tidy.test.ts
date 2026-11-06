// @vitest-environment node
//
// 57 — Tidy into folders, Phase 3: "Tidy into, one film" (issue #526).
//
// `importer.tidy(problemId)` on a `loose` **Problem**: the film's **Tidy**
// moves the video and its **Companion files** into the **Tidy folder name**,
// then the new folder is imported named off its folder under the run's
// **Import mode** (a Link run's film stays a **Linked video**, where it now
// lies). It logs the move line, `✓ Tidied <video> into <folder> (+N with
// it)`, then the import's own lines, takes the Problem off and answers
// `imported`; the **Sync** _Just what was added_ after the run counts the
// film.
//
// Real runs over a root laid out per test (every video a copy of the
// fixture's header), a real `Media` over a sandbox managed directory and the
// absent **Playback component**, the `createImporter.looseVideos` precedent.

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
import type { ImportMode, ImportProblem, ImportRun, Movie } from '@/types';

/** The fixture's film header, every video's bytes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

const VIDEO = 'Apex.2026.1080p.mp4';
const SUBTITLE = 'Apex.2026.1080p.en.srt';
const FOLDER = 'Apex (2026)';

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  media: string;
  root: string;
  folder: StoredLibraryFolder;
}

/** The demo root: one loose film with its subtitle, listed and scanned over. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-tidy-run-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  mkdirSync(root);
  cpSync(HEADER, join(root, VIDEO));
  writeFileSync(join(root, SUBTITLE), '1\n00:00:01,000 --> 00:00:02,000\nHi\n');

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, media, root, folder };
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

/** A Folder scan in `mode`, left in review, and its one loose Problem. */
async function looseInReview(
  mode: ImportMode
): Promise<Sandbox & { run: ImportRun; problem: ImportProblem }> {
  const box = sandbox();
  await box.importer.scan([box.folder], false, mode);
  const run = await untilReview(box.importer);
  const problem = run.problems.find((each) => each.kind === 'loose');
  if (problem === undefined) {
    throw new Error(`no loose Problem: ${JSON.stringify(run.problems)}`);
  }
  return { ...box, run, problem };
}

function movieTitled(storage: LibraryStorage, title: string): Movie {
  const movie = storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === title);
  if (movie === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return movie;
}

const TIDIED =
  /^✓ Tidied\s+Apex\.2026\.1080p\.mp4 into Apex \(2026\) \(\+1 with it\)$/;

describe('createImporter.tidy — the film moved and imported', () => {
  it('answers imported', async () => {
    const box = await looseInReview('link');

    await expect(box.importer.tidy(box.problem.id)).resolves.toEqual({
      kind: 'imported',
    });
  });

  it('moves the video and its subtitle into the new folder', async () => {
    const box = await looseInReview('link');

    await box.importer.tidy(box.problem.id);

    expect(readdirSync(join(box.root, FOLDER)).sort()).toEqual(
      [SUBTITLE, VIDEO].sort()
    );
    expect(existsSync(join(box.root, VIDEO))).toBe(false);
  });

  it('takes the Problem off the snapshot', async () => {
    const box = await looseInReview('link');

    await box.importer.tidy(box.problem.id);

    expect(
      box.importer.current()?.problems.map((problem) => problem.id)
    ).not.toContain(box.problem.id);
  });

  it('logs the move line, then the import’s own lines', async () => {
    const box = await looseInReview('link');
    const before = box.importer.current()?.log.length ?? 0;

    await box.importer.tidy(box.problem.id);

    const added = (box.importer.current()?.log ?? []).slice(before);
    expect(added[0]).toMatchObject({ kind: 'success' });
    expect(added[0]?.text).toMatch(TIDIED);
    expect(added.length).toBeGreaterThan(1);
  });

  it('lets the Sync that follows count the film as added', async () => {
    const box = await looseInReview('link');
    const before = box.storage.enrichmentCounts(box.run.startedAt).added ?? 0;

    await box.importer.tidy(box.problem.id);

    expect(box.storage.enrichmentCounts(box.run.startedAt).added).toBe(
      before + 1
    );
  });
});

describe('createImporter.tidy — the run’s Import mode', () => {
  it('a Link run links the film where it now lies, named off its folder', async () => {
    const box = await looseInReview('link');

    await box.importer.tidy(box.problem.id);

    expect(movieTitled(box.storage, 'Apex')).toMatchObject({
      year: 2026,
      videoFolderId: box.folder.id,
      videoPath: `${FOLDER}/${VIDEO}`,
    });
    expect(readdirSync(box.media)).not.toContain(FOLDER);
  });

  it('a Link run logs the import as linked, after the move line', async () => {
    const box = await looseInReview('link');
    const before = box.importer.current()?.log.length ?? 0;

    await box.importer.tidy(box.problem.id);

    const added = (box.importer.current()?.log ?? []).slice(before);
    expect(added[1]?.text).toMatch(/^✓ Linked\s/);
  });

  it('a Copy run copies the moved film in', async () => {
    const box = await looseInReview('copy');

    await box.importer.tidy(box.problem.id);

    const movie = movieTitled(box.storage, 'Apex');
    expect(movie.videoFolderId).toBeNull();
    expect(existsSync(join(box.media, movie.videoPath))).toBe(true);
    expect(existsSync(join(box.root, FOLDER, VIDEO))).toBe(true);
  });
});
