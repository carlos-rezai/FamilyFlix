// @vitest-environment node
//
// 41 — Link or copy, Phase 2: "a linked video plays" (issue #342).
//
// `videoFile` takes a **StoredVideo** — `{ videoPath, videoFolderId }` — and
// answers a **VideoFile**, a value and never a throw. A managed video
// (`videoFolderId` null) resolves under the Managed media directory as it
// always did; a **Linked video** resolves under the **Library folder** the
// injected reader names for its id, through `linkedVideoPath`. An id the
// reader does not know, and a file missing under either root, are `missing` —
// everything `null` meant before. `fixedSlot` stands in for the slot, as in
// every other suite that composes a Playback and never writes to it.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

import { createPlayback } from './createPlayback';

const FOLDER_ID = 'folder-1';

/** A media root and one Library folder, each holding the files named. */
function sandbox(): {
  media: string;
  folder: string;
  write: (root: string, relative: string) => string;
} {
  const root = sandboxRoot('familyflix-video-file-');
  const media = join(root, 'media');
  const folder = join(root, 'Movies');
  mkdirSync(media);
  mkdirSync(folder);
  const write = (base: string, relative: string): string => {
    const file = join(base, relative);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, 'film bytes');
    return file;
  };
  return { media, folder, write };
}

/** A Playback whose reader knows one Library folder by {@link FOLDER_ID}. */
function playbackOver(media: string, folder: string) {
  return createPlayback(media, fixedSlot(null), (id) =>
    id === FOLDER_ID ? folder : null
  );
}

describe('createPlayback.videoFile — a file to send', () => {
  it('answers file for a managed video, under the media directory', () => {
    const { media, folder, write } = sandbox();
    const file = write(media, 'heat-1995/heat.mp4');

    expect(
      playbackOver(media, folder).videoFile({
        videoPath: 'heat-1995/heat.mp4',
        videoFolderId: null,
      })
    ).toEqual({ kind: 'file', file });
  });

  it('answers file for a linked video, under its Library folder', () => {
    const { media, folder, write } = sandbox();
    const file = write(folder, 'Heat (1995)/Heat.1995.mkv');

    expect(
      playbackOver(media, folder).videoFile({
        videoPath: 'Heat (1995)/Heat.1995.mkv',
        videoFolderId: FOLDER_ID,
      })
    ).toEqual({ kind: 'file', file });
  });

  it('never reads a linked path under the media directory, nor a managed one under the folder', () => {
    // The two roots are kept apart: the same relative path in the other root
    // is not this video.
    const { media, folder, write } = sandbox();
    write(media, 'Heat (1995)/Heat.1995.mkv');
    write(folder, 'heat-1995/heat.mp4');
    const playback = playbackOver(media, folder);

    expect(
      playback.videoFile({
        videoPath: 'Heat (1995)/Heat.1995.mkv',
        videoFolderId: FOLDER_ID,
      })
    ).toEqual({ kind: 'missing' });
    expect(
      playback.videoFile({
        videoPath: 'heat-1995/heat.mp4',
        videoFolderId: null,
      })
    ).toEqual({ kind: 'missing' });
  });
});

describe('createPlayback.videoFile — nothing to send', () => {
  it('answers missing for a folder id the reader does not know', () => {
    const { media, folder, write } = sandbox();
    write(folder, 'Heat (1995)/Heat.1995.mkv');

    expect(
      playbackOver(media, folder).videoFile({
        videoPath: 'Heat (1995)/Heat.1995.mkv',
        videoFolderId: 'folder-gone',
      })
    ).toEqual({ kind: 'missing' });
  });

  it('answers missing for a managed video that is not on disk', () => {
    const { media, folder } = sandbox();

    expect(
      playbackOver(media, folder).videoFile({
        videoPath: 'heat-1995/heat.mp4',
        videoFolderId: null,
      })
    ).toEqual({ kind: 'missing' });
  });

  it('answers missing for a linked video that is not on disk', () => {
    const { media, folder } = sandbox();

    expect(
      playbackOver(media, folder).videoFile({
        videoPath: 'Heat (1995)/Heat.1995.mkv',
        videoFolderId: FOLDER_ID,
      })
    ).toEqual({ kind: 'missing' });
  });
});
