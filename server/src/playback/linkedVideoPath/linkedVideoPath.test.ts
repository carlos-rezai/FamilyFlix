// @vitest-environment node
//
// 41 — Link or copy, Phase 2: "a linked video plays" (issue #342).
//
// The linked boundary: the one check between a **Linked video**'s row — a
// `video_path` relative to its **Library folder** — and an open file. A Library
// folder is not the app's, so the row may name only a video: an absolute path
// is refused first, then any kind that is not a video, and what is left goes to
// `mediaFilePath`'s containment, the rule reused rather than spelled again.
// `mediaFilePath`'s own sandbox suite is the prior art.

import { describe, expect, it } from 'vitest';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

import { linkedVideoPath } from './linkedVideoPath';

/** A Library folder with a sibling directory beside it, in a resolved sandbox. */
function sandbox(): { folder: string; outside: string } {
  const root = sandboxRoot('familyflix-linked-');

  const folder = join(root, 'Movies');
  const outside = join(root, 'elsewhere');
  mkdirSync(folder);
  mkdirSync(outside);

  return { folder, outside };
}

/** Write a file, creating the directories above it. */
function writeFile(path: string, contents = 'video bytes'): string {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

describe('linkedVideoPath — a video inside the Library folder', () => {
  it('resolves a relative, forward-slashed path to the file in the folder', () => {
    const { folder } = sandbox();
    const file = writeFile(join(folder, 'Heat (1995)', 'Heat.1995.mkv'));

    expect(linkedVideoPath(folder, 'Heat (1995)/Heat.1995.mkv')).toBe(file);
  });
});

describe('linkedVideoPath — a path that leaves the folder', () => {
  it('refuses an absolute path, however real the video behind it', () => {
    const { folder } = sandbox();
    const file = writeFile(join(folder, 'Heat (1995)', 'Heat.1995.mkv'));

    expect(linkedVideoPath(folder, file)).toBeNull();
  });

  it('refuses a `..` escape to a video beside the folder', () => {
    const { folder, outside } = sandbox();
    writeFile(join(outside, 'private.mp4'));

    expect(linkedVideoPath(folder, '../elsewhere/private.mp4')).toBeNull();
  });

  it('refuses a video reached through a directory link that points out', () => {
    const { folder, outside } = sandbox();
    writeFile(join(outside, 'private.mp4'));
    symlinkSync(outside, join(folder, 'shortcut'), 'junction');

    expect(linkedVideoPath(folder, 'shortcut/private.mp4')).toBeNull();
  });
});

describe('linkedVideoPath — a file that is not a video', () => {
  it.each(['poster.jpg', 'Heat.1995.en.srt', 'setup.exe'])(
    'refuses %s, though it sits in the folder',
    (name) => {
      const { folder } = sandbox();
      writeFile(join(folder, 'Heat (1995)', name));

      expect(linkedVideoPath(folder, `Heat (1995)/${name}`)).toBeNull();
    }
  );
});

describe('linkedVideoPath — nothing behind the path', () => {
  it('answers null for a video that is not on disk', () => {
    const { folder } = sandbox();

    expect(linkedVideoPath(folder, 'Heat (1995)/Heat.1995.mkv')).toBeNull();
  });
});
