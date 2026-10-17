// @vitest-environment node
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { framelessPlayback } from './framelessPlayback';

const EPISODE = { videoPath: 'show/season-01/S01E01.mkv', videoFolderId: null };

describe('framelessPlayback', () => {
  it('answers no frame unscripted, for want of a component', async () => {
    expect(
      await framelessPlayback().frame(EPISODE, new AbortController().signal)
    ).toEqual({ kind: 'none', reason: 'no-component' });
  });

  it('answers the scripted outcome when handed one', async () => {
    const outcome = {
      kind: 'frame' as const,
      picture: Readable.from(['frame bytes']),
    };

    expect(
      await framelessPlayback(async () => outcome).frame(
        EPISODE,
        new AbortController().signal
      )
    ).toBe(outcome);
  });
});
