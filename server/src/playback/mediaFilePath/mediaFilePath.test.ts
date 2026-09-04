// @vitest-environment node
//
// 10 — Video player, Phase 2: "direct play" (issue #84).
//
// The one check standing between a string in the database and an open file
// handle. Every route in `playback/` that opens a file goes through it, so it
// is tested directly rather than only through the routes that call it: the
// cases that matter most — an absolute path, a `..` walk, a directory link that
// leaves the tree — are cheap to stage here and awkward to stage over HTTP.
//
// The rule it enforces is stated on the **resolved** path, never on the raw
// string. A check that rejected the substring `..` would pass every test below
// and still be wrong: it would refuse `A Film (2016)/../A Film (2016)/f.mp4`,
// which never leaves, and accept a link that leaves without a `..` anywhere in
// it.

import { describe, expect, it } from 'vitest';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

import { mediaFilePath } from './mediaFilePath';

/**
 * A managed media directory with a sibling directory beside it, both inside a
 * temporary root that is removed afterwards.
 *
 * The root is `sandboxRoot`'s, which resolves it. That is not incidental here:
 * a temporary directory is a symlink on macOS and an 8.3 short name on Windows,
 * so a check that resolves links — which this one has to, or a link inside the
 * tree defeats it — would otherwise disagree with the path the test built by
 * hand.
 */
function sandbox(): { media: string; outside: string } {
  const root = sandboxRoot('familyflix-media-');

  const media = join(root, 'media');
  const outside = join(root, 'elsewhere');
  mkdirSync(media);
  mkdirSync(outside);

  return { media, outside };
}

/** Write a file, creating the directories above it. */
function writeFile(path: string, contents = 'video bytes'): string {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

describe('mediaFilePath — a stored path that stays inside', () => {
  it('resolves a relative path to the file under the managed media directory', () => {
    const { media } = sandbox();
    const file = writeFile(join(media, 'Northwind (2018)', 'northwind.mp4'));

    expect(mediaFilePath(media, 'Northwind (2018)/northwind.mp4')).toBe(file);
  });

  it('resolves a path several directories deep', () => {
    const { media } = sandbox();
    const file = writeFile(
      join(media, '__seed__', 'cold-open', 'cold-open.mp4')
    );

    expect(mediaFilePath(media, '__seed__/cold-open/cold-open.mp4')).toBe(file);
  });

  it('accepts a path whose `..` segments land back inside the tree', () => {
    // The reason the rule is stated on the resolved path: this one contains the
    // sequence a string check would refuse, and never leaves the directory.
    const { media } = sandbox();
    const file = writeFile(join(media, 'Glasshouse (2017)', 'glasshouse.mp4'));

    expect(
      mediaFilePath(
        media,
        'Havoc Line (2022)/../Glasshouse (2017)/glasshouse.mp4'
      )
    ).toBe(file);
  });
});

describe('mediaFilePath — a stored path that leaves', () => {
  it('refuses a `..` walk out of the managed media directory', () => {
    const { media, outside } = sandbox();
    // The file genuinely exists, so a refusal here cannot be the accident of
    // there being nothing to open.
    writeFile(join(outside, 'private.mp4'));

    expect(mediaFilePath(media, '../elsewhere/private.mp4')).toBeNull();
  });

  it('refuses an absolute path, however real the file behind it', () => {
    const { media, outside } = sandbox();
    const file = writeFile(join(outside, 'private.mp4'));

    expect(mediaFilePath(media, file)).toBeNull();
  });

  it('refuses a file reached through a directory link that points outside', () => {
    // Nothing in this stored path says `..` and every segment of it sits under
    // the media directory. Only the resolved path shows that it leaves.
    const { media, outside } = sandbox();
    writeFile(join(outside, 'private.mp4'));
    symlinkSync(outside, join(media, 'shortcut'), 'junction');

    expect(mediaFilePath(media, 'shortcut/private.mp4')).toBeNull();
  });

  it('refuses the managed media directory itself', () => {
    const { media } = sandbox();

    expect(mediaFilePath(media, '')).toBeNull();
    expect(mediaFilePath(media, '.')).toBeNull();
  });
});

describe('mediaFilePath — a stored path with nothing behind it', () => {
  it('answers null for a file that is not on disk', () => {
    const { media } = sandbox();

    expect(
      mediaFilePath(media, 'Signal Lost (2023)/signal-lost.mp4')
    ).toBeNull();
  });

  it('answers null for a directory, which is not a file to send', () => {
    const { media } = sandbox();
    mkdirSync(join(media, 'Northwind (2018)'));

    expect(mediaFilePath(media, 'Northwind (2018)')).toBeNull();
  });

  it('answers rather than throwing when the media directory does not exist', () => {
    // The dev default is `./media`, which is absent until something imports a
    // film. Every route that opens a file asks this question first, so it has
    // to have an answer before the directory does.
    const { media } = sandbox();

    expect(mediaFilePath(join(media, 'not-created-yet'), 'a/b.mp4')).toBeNull();
  });
});
