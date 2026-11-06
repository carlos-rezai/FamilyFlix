// @vitest-environment node
//
// 57 — Tidy into folders, Phase 4: "Tidy all, failures and Resolve" (issue
// #527).
//
// - A failed `importer.tidy(problemId)` redraws the same row with _Couldn't
//   move it: <why>. Nothing was moved._ and keeps its **Tidy**; when the
//   rollback failed too, files did move, so the row says where they are
//   instead: _Couldn't move it: <why>. Some of its files are in “<folder>”._
// - `importer.tidyMany(ids)`, behind _Tidy all_: each id tidied in order, a
//   failed move redrawn as `tidy` redraws it, and the first _The folder can't
//   be reached right now._ stops the rest, left listed as they were.
// - _Resolve_ on a loose film: the **Problem detail** answers the root as the
//   folder and the video and its **Companion files** as the **Found files**,
//   so the add links the film where it lies, untidied.
//
// Real runs over a root laid out per test, a real `Media` over a sandbox
// managed directory, the `createImporter.tidy` precedent. A held-open file is
// a `rename` from its path that throws, `tidyIntoFolder.test.ts`' double.

import {
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import type { ImportProblem, ImportRun } from '@/types';

/** A rename from one of these paths throws its code. */
const refused = vi.hoisted(() => new Map<string, string>());

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const { resolve: resolvePath } = await import('node:path');
  const rename = async (
    from: Parameters<typeof actual.rename>[0],
    to: Parameters<typeof actual.rename>[1]
  ) => {
    const code = refused.get(resolvePath(String(from)));
    if (code !== undefined) {
      throw Object.assign(
        new Error(`${code}: refused, rename '${String(from)}'`),
        { code }
      );
    }
    return actual.rename(from, to);
  };
  return { ...actual, rename, default: { ...actual, rename } };
});

afterEach(() => {
  refused.clear();
});

/** A rename from `path` throws `code`. */
const refuse = (path: string, code: string): void => {
  refused.set(resolve(path), code);
};

/** The fixture's film header, every video's bytes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

const APEX = 'Apex.2026.1080p.mp4';
const APEX_SUBTITLE = 'Apex.2026.1080p.en.srt';
const APEX_FOLDER = 'Apex (2026)';
const QUARRY = 'Quarry.Lane.2004.720p.mp4';
const QUARRY_FOLDER = 'Quarry Lane (2004)';

const OPEN = "It's open in another app.";
const GONE = "The folder can't be reached right now.";
const CLASH = `A folder called “${APEX_FOLDER}” is already here.`;

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  root: string;
  folder: StoredLibraryFolder;
}

/** Two loose films at the top of one root, Apex with its subtitle. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-tidy-all-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  mkdirSync(root);
  cpSync(HEADER, join(root, APEX));
  writeFileSync(
    join(root, APEX_SUBTITLE),
    '1\n00:00:01,000 --> 00:00:02,000\nHi\n'
  );
  cpSync(HEADER, join(root, QUARRY));

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, root, folder };
}

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
    await new Promise((wait) => setTimeout(wait, 10));
  }
}

/** A Link Folder scan left in review, and its loose rows by folder. */
async function inReview(): Promise<
  Sandbox & { apex: ImportProblem; quarry: ImportProblem }
> {
  const box = sandbox();
  await box.importer.scan([box.folder], false, 'link');
  const run = await untilReview(box.importer);
  const looseTitled = (title: string): ImportProblem => {
    const found = run.problems.find(
      (each) => each.kind === 'loose' && each.title === title
    );
    if (found === undefined) {
      throw new Error(`no loose ${title}: ${JSON.stringify(run.problems)}`);
    }
    return found;
  };
  return {
    ...box,
    apex: looseTitled(APEX_FOLDER),
    quarry: looseTitled(QUARRY_FOLDER),
  };
}

const listed = (importer: Importer, id: string): ImportProblem | undefined =>
  importer.current()?.problems.find((each) => each.id === id);

const titles = (storage: LibraryStorage): string[] =>
  storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title);

describe('createImporter.tidy — a rollback that fails too', () => {
  it('redraws the row saying where the files are, not that nothing moved, its Tidy kept', async () => {
    const box = await inReview();
    refuse(join(box.root, APEX_SUBTITLE), 'EBUSY');
    refuse(join(box.root, APEX_FOLDER, APEX), 'EBUSY');

    const outcome = await box.importer.tidy(box.apex.id);

    const reason = `Couldn't move it: ${OPEN} Some of its files are in “${APEX_FOLDER}”.`;
    expect(outcome).toEqual({
      kind: 'redrawn',
      problem: expect.objectContaining({
        id: box.apex.id,
        reason,
        tidy: box.apex.tidy,
      }),
    });
    expect(listed(box.importer, box.apex.id)?.reason).toBe(reason);
  });
});

describe('createImporter.tidyMany — Tidy all', () => {
  it('tidies and imports every id, taking each row off', async () => {
    const box = await inReview();

    await box.importer.tidyMany([box.apex.id, box.quarry.id]);

    expect(existsSync(join(box.root, APEX_FOLDER, APEX))).toBe(true);
    expect(existsSync(join(box.root, QUARRY_FOLDER, QUARRY))).toBe(true);
    expect(titles(box.storage)).toEqual(
      expect.arrayContaining(['Apex', 'Quarry Lane'])
    );
    expect(listed(box.importer, box.apex.id)).toBeUndefined();
    expect(listed(box.importer, box.quarry.id)).toBeUndefined();
  });

  it('redraws a failed move as tidy does and goes on to the next', async () => {
    const box = await inReview();
    mkdirSync(join(box.root, APEX_FOLDER));

    await box.importer.tidyMany([box.apex.id, box.quarry.id]);

    expect(listed(box.importer, box.apex.id)).toMatchObject({
      reason: `Couldn't move it: ${CLASH} Nothing was moved.`,
      tidy: box.apex.tidy,
    });
    expect(listed(box.importer, box.quarry.id)).toBeUndefined();
    expect(existsSync(join(box.root, QUARRY_FOLDER, QUARRY))).toBe(true);
  });

  it('stops at the first unreachable failure and leaves the rest listed as they were', async () => {
    const box = await inReview();
    renameSync(box.root, `${box.root}-away`);

    await box.importer.tidyMany([box.apex.id, box.quarry.id]);

    expect(listed(box.importer, box.apex.id)).toMatchObject({
      reason: `Couldn't move it: ${GONE} Nothing was moved.`,
    });
    expect(listed(box.importer, box.quarry.id)).toEqual(box.quarry);
  });
});

describe('createImporter.problem — Resolve on a loose film', () => {
  it('answers the root as the folder', async () => {
    const box = await inReview();

    expect(box.importer.problem(box.apex.id)).toMatchObject({
      id: box.apex.id,
      folder: box.root,
    });
  });

  it('answers the video and its companions as the Found files, and nothing of the other loose film', async () => {
    const box = await inReview();

    const files = box.importer.problem(box.apex.id)?.files;

    expect(files?.video).toBe(join(box.root, APEX));
    expect(files?.videos).toEqual([join(box.root, APEX)]);
    expect(files?.subtitles.map((track) => track.path)).toEqual([
      join(box.root, APEX_SUBTITLE),
    ]);
  });
});
