// @vitest-environment node
//
// Issue #292 — Open folder. The Storage card's button asks main, over a
// no-argument channel, to show the **Managed media directory** in Explorer;
// main hands `openMediaFolder` **Shell paths**' `mediaRoot` and a world of
// `mkdir` (recursive `mkdirSync`), `shell.openPath` and the **Shell log**'s
// `main`. Shaped like `shellDialogs`: the root is made first — a fresh install
// has none until the first import — then opened. Every failure is one Shell
// log line naming the root, and nothing reaches the screen: it never rejects.

import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  FOLDER_CHANNELS,
  type FolderBridge,
} from '../../src/types/libraryFolders';
import { openMediaFolder, type MediaFolderWorld } from './openMediaFolder';

const ROOT = join(
  'C:',
  'Users',
  'someone',
  'AppData',
  'Roaming',
  'FamilyFlix',
  'media'
);

interface WorldOptions {
  /** What `shell.openPath` answers: `''` for success, else its error. */
  opened?: string;
  /** A `mkdir` that throws this. */
  mkdirThrows?: Error;
  /** A `shell.openPath` that rejects with this. */
  openRejects?: Error;
}

/** A recorded world: every call, in order, and every log line. */
function world({ opened = '', mkdirThrows, openRejects }: WorldOptions = {}) {
  const calls: string[] = [];
  const lines: string[] = [];
  const made: string[] = [];
  const openedPaths: string[] = [];

  const value: MediaFolderWorld = {
    mkdir(path: string) {
      calls.push('mkdir');
      if (mkdirThrows) {
        throw mkdirThrows;
      }
      made.push(path);
    },
    openPath(path: string) {
      calls.push('openPath');
      openedPaths.push(path);
      return openRejects
        ? Promise.reject(openRejects)
        : Promise.resolve(opened);
    },
    log(text: string) {
      lines.push(text);
    },
  };

  return { value, calls, lines, made, openedPaths };
}

describe('openMediaFolder — the folder there or made', () => {
  it('makes the root before it opens it', async () => {
    const w = world();

    await openMediaFolder(ROOT, w.value);

    expect(w.calls).toEqual(['mkdir', 'openPath']);
    expect(w.made).toEqual([ROOT]);
    expect(w.openedPaths).toEqual([ROOT]);
  });

  it('logs nothing when openPath answers the empty string', async () => {
    const w = world({ opened: '' });

    await openMediaFolder(ROOT, w.value);

    expect(w.lines).toEqual([]);
  });

  it('resolves to nothing once it is done', async () => {
    await expect(openMediaFolder(ROOT, world().value)).resolves.toBeUndefined();
  });
});

describe('openMediaFolder — openPath refuses', () => {
  const ERROR = 'Failed to open path';

  it('logs one line', async () => {
    const w = world({ opened: ERROR });

    await openMediaFolder(ROOT, w.value);

    expect(w.lines).toHaveLength(1);
  });

  it('opens the line with Couldn’t open the media folder: and the error', async () => {
    const w = world({ opened: ERROR });

    await openMediaFolder(ROOT, w.value);

    expect(w.lines[0]).toMatch(/^Couldn’t open the media folder: /);
    expect(w.lines[0]).toContain(ERROR);
  });

  it('names the root in the line', async () => {
    const w = world({ opened: ERROR });

    await openMediaFolder(ROOT, w.value);

    expect(w.lines[0]).toContain(ROOT);
  });

  it('never rejects', async () => {
    await expect(
      openMediaFolder(ROOT, world({ opened: ERROR }).value)
    ).resolves.toBeUndefined();
  });

  it('logs a rejecting openPath as one line naming the error and the root, and resolves', async () => {
    const w = world({ openRejects: new Error('spawn explorer ENOENT') });

    await expect(openMediaFolder(ROOT, w.value)).resolves.toBeUndefined();

    expect(w.lines).toHaveLength(1);
    expect(w.lines[0]).toMatch(/^Couldn’t open the media folder: /);
    expect(w.lines[0]).toContain('spawn explorer ENOENT');
    expect(w.lines[0]).toContain(ROOT);
  });
});

describe('openMediaFolder — mkdir throws', () => {
  const failure = () =>
    world({
      mkdirThrows: new Error('EACCES: permission denied'),
    });

  it('opens nothing', async () => {
    const w = failure();

    await openMediaFolder(ROOT, w.value);

    expect(w.openedPaths).toEqual([]);
  });

  it('logs the failure as one line, naming the root and the error', async () => {
    const w = failure();

    await openMediaFolder(ROOT, w.value);

    expect(w.lines).toHaveLength(1);
    expect(w.lines[0]).toMatch(/^Couldn’t open the media folder: /);
    expect(w.lines[0]).toContain('EACCES: permission denied');
    expect(w.lines[0]).toContain(ROOT);
  });

  it('never rejects', async () => {
    await expect(
      openMediaFolder(ROOT, failure().value)
    ).resolves.toBeUndefined();
  });
});

// The renderer never names a path for main to open: the **Folder bridge**'s
// third member is named for what it opens, and its channel carries nothing.
describe('the Open folder channel', () => {
  it('is familyflix:folders:open-media', () => {
    expect(FOLDER_CHANNELS.openMedia).toBe('familyflix:folders:open-media');
  });

  it('is a bridge member named openMedia that takes no argument', () => {
    expectTypeOf<FolderBridge['openMedia']>().parameters.toEqualTypeOf<[]>();
    expectTypeOf<FolderBridge['openMedia']>().returns.toEqualTypeOf<
      Promise<void>
    >();
  });
});
