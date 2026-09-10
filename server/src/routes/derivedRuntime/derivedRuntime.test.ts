// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 2: the body reader gets a folder
// and a test.
//
// The one column the form has no field for, read off the bytes that just
// landed. It is the only helper in this group with a collaborator, and the
// collaborator is a value — the injected `Playback` — so the whole matrix below
// is a fake object and no listener, no disk and no FFmpeg.
//
// **What is really being asserted is that it never throws.** The movie is
// already in the library or about to be and its bytes are already on disk; a
// runtime is the least of what the save was for, so every way of failing to
// derive one has to end in the same `null` a film nothing could measure gets.
// A `Playback` that throws is the case that would otherwise lose an add.

import { describe, expect, it, vi } from 'vitest';

import { derivedRuntime } from './derivedRuntime';
import type { Playback } from '../../playback/createPlayback/createPlayback';

/** The stored path a freshly copied film is written under. */
const STORED = 'The Lantern Keeper (2019)/lantern.mp4';

/** The absolute file that path resolves to, once the containment check passes. */
const FILE = '/media/The Lantern Keeper (2019)/lantern.mp4';

/**
 * A **Playback** that answers only the two questions this helper asks, and
 * throws on the rest.
 *
 * The rest are genuinely unreachable from here — `derivedRuntime` resolves a
 * path and asks how long the film is, and nothing else — so a throw is a
 * sharper double than a stub: a version of this function that reached for
 * `read` or `stream` fails loudly rather than quietly agreeing.
 */
function playbackThat(
  videoFile: (storedPath: string) => string | null,
  duration: (file: string) => number | null
): Playback {
  const unreachable = (): never => {
    throw new Error('derivedRuntime asked Playback something it does not need');
  };
  return {
    videoFile,
    duration,
    read: unreachable,
    stream: unreachable,
    subtitleFile: unreachable,
    cues: unreachable,
  } as unknown as Playback;
}

/** The ordinary case: the path resolves and the film says how long it is. */
const measuring = (seconds: number | null): Playback =>
  playbackThat(
    () => FILE,
    () => seconds
  );

describe('derivedRuntime — when something can measure the film', () => {
  it('answers the minutes the film runs', () => {
    expect(derivedRuntime(measuring(111 * 60), STORED)).toBe(111);
  });

  it('rounds to the nearest minute, up', () => {
    expect(derivedRuntime(measuring(110 * 60 + 40), STORED)).toBe(111);
  });

  it('rounds to the nearest minute, down', () => {
    expect(derivedRuntime(measuring(110 * 60 + 20), STORED)).toBe(110);
  });

  it('resolves the stored path before asking how long the film is', () => {
    const videoFile = vi.fn(() => FILE);
    const duration = vi.fn(() => 111 * 60);

    derivedRuntime(playbackThat(videoFile, duration), STORED);

    expect(videoFile).toHaveBeenCalledWith(STORED);
    // Never the stored path: the containment check lives in `videoFile`, and a
    // caller that resolved its own path would be a second place to forget it.
    expect(duration).toHaveBeenCalledWith(FILE);
  });
});

describe('derivedRuntime — when nothing can', () => {
  it('answers null when nothing on this machine can say how long the film is', () => {
    expect(derivedRuntime(measuring(null), STORED)).toBeNull();
  });

  it('answers null for a stored path that resolves to no file', () => {
    expect(
      derivedRuntime(
        playbackThat(
          () => null,
          () => 111 * 60
        ),
        STORED
      )
    ).toBeNull();
  });

  // A row with no film behind it has nothing to derive from, which is not a
  // failure to derive.
  it('answers null for a row with no film behind it, without asking anything', () => {
    const videoFile = vi.fn(() => FILE);

    expect(
      derivedRuntime(
        playbackThat(videoFile, () => 111 * 60),
        ''
      )
    ).toBeNull();
    expect(videoFile).not.toHaveBeenCalled();
  });

  // Nought is a length, and every reader of `runtimeMinutes` already draws a
  // dash from `null`. One minute would be a fifty-second lie.
  it('answers null rather than nought for a film under half a minute', () => {
    expect(derivedRuntime(measuring(20), STORED)).toBeNull();
  });

  it('answers a minute for a film just over the half-minute', () => {
    expect(derivedRuntime(measuring(40), STORED)).toBe(1);
  });

  it('answers null for a film of no length at all', () => {
    expect(derivedRuntime(measuring(0), STORED)).toBeNull();
  });
});

describe('derivedRuntime — when the component fails', () => {
  // The case that would otherwise cost the maintainer the add.
  it('answers null when measuring the film throws', () => {
    const playback = playbackThat(
      () => FILE,
      () => {
        throw new Error('ffprobe died mid-answer');
      }
    );

    expect(derivedRuntime(playback, STORED)).toBeNull();
  });

  it('answers null when resolving the path throws', () => {
    const playback = playbackThat(
      () => {
        throw new Error('the media root went away');
      },
      () => 111 * 60
    );

    expect(derivedRuntime(playback, STORED)).toBeNull();
  });
});
