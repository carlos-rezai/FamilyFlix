import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { usePlayback } from './usePlayback';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 10 — Video player, Phase 3 (issue #85).
 *
 * The deep module of the frontend: every media-element edge case behind one
 * hook, so that nothing above it ever touches the element. What it hands back
 * is the **Absolute position** — seconds into the film itself — which on
 * **Direct play** is the element's own time and on a stream path will be the
 * **Stream offset** plus it. Every later consumer (the scrubber, the cue
 * lookup, the watch reporter) reads that one number and none of them learns
 * which path is playing.
 *
 * Only `direct` exists in this slice, so what is pinned here is the invariant
 * rather than the arithmetic: on direct play the offset is nought, and the
 * position the hook reports is the position the film is at.
 */
function renderPlayback() {
  const video = document.createElement('video');
  const ref = { current: video };
  const view = renderHook(() => usePlayback(ref, { path: 'direct' }));
  return { video, ...view };
}

/** Fire one of the element's own events, the way a browser would. */
function emit(video: HTMLMediaElement, type: string): void {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
}

describe('usePlayback', () => {
  stubMediaElement();

  it('starts the film when the screen opens, without a second press', async () => {
    const { video, result } = renderPlayback();

    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.paused).toBe(false);
  });

  it('pauses a playing film and resumes a paused one', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.playing).toBe(false));
    expect(video.paused).toBe(true);

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.paused).toBe(false);
  });

  it('reports the absolute position, which on direct play is the element’s own', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    video.currentTime = 1840;
    emit(video, 'timeupdate');

    // Nought offset, so the two agree — and the number every consumer reads is
    // this one, not `video.currentTime`.
    expect(result.current.position).toBe(1840);
  });

  it('starts at the beginning of the film rather than at nothing', () => {
    const { result } = renderPlayback();

    expect(result.current.position).toBe(0);
  });

  it('reports the element waiting, and stops when it plays again', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    emit(video, 'waiting');
    expect(result.current.buffering).toBe(true);

    emit(video, 'playing');
    expect(result.current.buffering).toBe(false);
  });

  it('is not buffering merely because it has just opened', async () => {
    const { result } = renderPlayback();

    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(result.current.buffering).toBe(false);
  });

  it('knows when the film has finished', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    emit(video, 'ended');

    expect(result.current.ended).toBe(true);
    expect(result.current.playing).toBe(false);
  });

  it('follows the element when something else pauses it', async () => {
    // The element is the truth, not our idea of it: a pause that did not come
    // through `toggle` — a keyboard media key, the OS — still has to leave the
    // big-play circle showing.
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => video.pause());

    expect(result.current.playing).toBe(false);
  });
});

describe('usePlayback — when the browser refuses to autoplay', () => {
  stubMediaElement({ autoplay: 'refused' });

  it('leaves the film stopped rather than failing silently', async () => {
    const { video, result } = renderPlayback();

    await waitFor(() => expect(video.paused).toBe(true));
    // Paused is what draws the big-play circle, which is the answer to a
    // refused autoplay — a black picture with no explanation is not.
    expect(result.current.playing).toBe(false);
  });

  it('starts on one press', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(false));

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.paused).toBe(false);
  });

  it('does not leave the refusal as an unhandled rejection', async () => {
    // An uncaught `play()` rejection is an error in the console on every open
    // where a browser blocks autoplay, which is most of them.
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => {
      rejections.push(event.reason);
    };
    window.addEventListener('unhandledrejection', onRejection);

    const { result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 0));

    window.removeEventListener('unhandledrejection', onRejection);
    expect(rejections).toEqual([]);
  });
});

/**
 * The one rule the whole seeking design rests on, checked in the only place it
 * can be: the source. `video.duration` is `NaN` on a live transcode and a
 * rounded lie on a remux, so the **Playback read** is where a duration comes
 * from — and a single `.duration` read that crept back in would work perfectly
 * on direct play and fail only on the films the family actually owns.
 */
describe('the player feature’s duration rule', () => {
  it('reads no duration off the media element, anywhere in the feature', () => {
    const offenders = sourceFiles('src/features/player').filter((file) =>
      /\.duration\b/.test(withoutComments(readFileSync(file, 'utf8')))
    );

    expect(offenders).toEqual([]);
  });
});

/** The file with its comments removed — prose about `video.duration` is not a read of it. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Every `.ts`/`.tsx` file under `root` that ships — tests excluded. */
function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map((entry) => join(root, entry))
    .filter(
      (file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file)
    );
}
