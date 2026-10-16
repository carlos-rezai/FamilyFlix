// @vitest-environment node
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { framelessPlayback } from './framelessPlayback';

const EPISODE = { videoPath: 'show/season-01/S01E01.mkv', videoFolderId: null };

describe('framelessPlayback', () => {
  it('answers no frame unscripted', async () => {
    expect(
      await framelessPlayback().frame(EPISODE, new AbortController().signal)
    ).toBeNull();
  });

  it('answers the scripted frame when handed one', async () => {
    const picture = Readable.from(['frame bytes']);

    expect(
      await framelessPlayback(async () => picture).frame(
        EPISODE,
        new AbortController().signal
      )
    ).toBe(picture);
  });
});
