// @vitest-environment node
//
// The seam the two import suites hold a run mid-copy with, tested for the
// three things they rely on: that the copy waits, that `reached` resolves
// while it is held, and that the signal it is handed reaches the real copy —
// the one thing the route suite's own version got wrong.

import { describe, expect, it, vi } from 'vitest';

import { heldCopy } from './heldCopy';
import type { Media } from '../../media/createMedia/createMedia';

/** A `Media` whose `copyIn` records what it was asked and answers a path. */
function recordingMedia(): { media: Media; copyIn: ReturnType<typeof vi.fn> } {
  const copyIn = vi.fn(
    async (folder: string, source: string, _signal?: AbortSignal) =>
      `${folder}/${source.split('/').pop()}`
  );
  return { media: { copyIn } as unknown as Media, copyIn };
}

/** Whether a promise has settled by the next turn of the loop. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(
    () => (done = true),
    () => (done = true)
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  return done;
}

describe('heldCopy', () => {
  it('holds the first copy until released, and says when it is held', async () => {
    const { media, copyIn } = recordingMedia();
    const { seam, reached, release } = heldCopy();

    const copy = seam(media).copyIn('northwind-2018', '/root/Northwind/n.mp4');

    await reached;
    expect(copyIn).not.toHaveBeenCalled();
    expect(await settled(copy)).toBe(false);

    release();

    await expect(copy).resolves.toBe('northwind-2018/n.mp4');
    expect(copyIn).toHaveBeenCalledTimes(1);
  });

  it('holds only the copy of the file named, and lets the others through', async () => {
    const { media, copyIn } = recordingMedia();
    const { seam, reached, release } = heldCopy('Amelie.mp4');
    const seamed = seam(media);

    await expect(
      seamed.copyIn('die-hard-1988', '/root/Die.Hard/Die.Hard.mp4')
    ).resolves.toBe('die-hard-1988/Die.Hard.mp4');
    expect(await settled(reached)).toBe(false);

    const held = seamed.copyIn('amelie-2001', '/root/Amelie/Amelie.mp4');
    await reached;
    expect(copyIn).toHaveBeenCalledTimes(1);

    release();
    await expect(held).resolves.toBe('amelie-2001/Amelie.mp4');
  });

  it('holds once: a second copy of the same file goes straight through', async () => {
    const { media, copyIn } = recordingMedia();
    const { seam, reached, release } = heldCopy('Amelie.mp4');
    const seamed = seam(media);

    const first = seamed.copyIn('amelie-2001', '/root/Amelie/Amelie.mp4');
    await reached;
    release();
    await first;

    await seamed.copyIn('amelie-2001-2', '/root/Amelie/Amelie.mp4');
    expect(copyIn).toHaveBeenCalledTimes(2);
  });

  // The route suite's copy dropped the third argument, so a cancel while a
  // copy was held could never abort the real one.
  it('forwards the signal it is handed to the real copy', async () => {
    const { media, copyIn } = recordingMedia();
    const { seam, reached, release } = heldCopy();
    const controller = new AbortController();

    const copy = seam(media).copyIn(
      'northwind-2018',
      '/root/Northwind/n.mp4',
      controller.signal
    );
    await reached;
    release();
    await copy;

    expect(copyIn).toHaveBeenCalledWith(
      'northwind-2018',
      '/root/Northwind/n.mp4',
      controller.signal
    );
  });

  it('leaves everything else on the Media as it was', () => {
    const removeMovieFolder = vi.fn();
    const { seam } = heldCopy();

    const seamed = seam({ removeMovieFolder } as unknown as Media);

    expect(seamed.removeMovieFolder).toBe(removeMovieFolder);
  });
});
