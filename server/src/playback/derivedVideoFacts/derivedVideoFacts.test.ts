// @vitest-environment node
//
// 70 — Video quality, Phase 1: "one film, through the Movie form" (issue #664).
//
// `derivedVideoFacts` replaces `derivedRuntime`: the runtime and the rung of
// the **Quality ladder**, both read off one `Playback.measure`. Like the unit
// it replaces, **it never throws**: the save it serves is already happening,
// so every way of failing to measure ends in `null`s.

import { describe, expect, it, vi } from 'vitest';

import { derivedVideoFacts } from './derivedVideoFacts';
import type { StoredVideo } from '@/types';
import type { Playback } from '../createPlayback/createPlayback';

/** The **StoredVideo** a freshly added film is written under. */
const STORED: StoredVideo = {
  videoPath: 'The Lantern Keeper (2019)/lantern.mkv',
  videoFolderId: null,
};

/** The absolute file that path resolves to. */
const FILE = '/media/The Lantern Keeper (2019)/lantern.mkv';

const NOTHING = { runtimeMinutes: null, videoQuality: null };

type Measure = (file: string) => {
  durationSeconds: number | null;
  quality: string | null;
};

/** A **Playback** that answers only `videoFile` and `measure`. */
function playbackThat(
  resolve: (video: StoredVideo) => string | null,
  measure: Measure
): Playback {
  const unreachable = (): never => {
    throw new Error(
      'derivedVideoFacts asked Playback something it does not need'
    );
  };
  return {
    videoFile: (video: StoredVideo) => {
      const file = resolve(video);
      return file === null ? { kind: 'missing' } : { kind: 'file', file };
    },
    measure,
    read: unreachable,
    stream: unreachable,
    subtitleFile: unreachable,
    cues: unreachable,
  } as unknown as Playback;
}

describe('derivedVideoFacts — a measured file', () => {
  it('answers the runtime and the quality', () => {
    const measure = vi.fn(() => ({
      durationSeconds: 110 * 60 + 40,
      quality: '1080p',
    }));

    expect(
      derivedVideoFacts(
        playbackThat(() => FILE, measure),
        STORED
      )
    ).toEqual({ runtimeMinutes: 111, videoQuality: '1080p' });
    expect(measure).toHaveBeenCalledTimes(1);
    expect(measure).toHaveBeenCalledWith(FILE);
  });

  it('answers the runtime alone when only the header could measure it', () => {
    expect(
      derivedVideoFacts(
        playbackThat(
          () => FILE,
          () => ({ durationSeconds: 6832.5, quality: null })
        ),
        STORED
      )
    ).toEqual({ runtimeMinutes: 114, videoQuality: null });
  });
});

describe('derivedVideoFacts — nothing to measure, and no throw', () => {
  it('answers nulls for a stored path that resolves to no file', () => {
    expect(
      derivedVideoFacts(
        playbackThat(
          () => null,
          () => ({ durationSeconds: 6832.5, quality: '1080p' })
        ),
        STORED
      )
    ).toEqual(NOTHING);
  });

  it('answers nulls for a row with no film behind it', () => {
    const measure = vi.fn(() => ({
      durationSeconds: 6832.5,
      quality: '1080p',
    }));

    expect(
      derivedVideoFacts(
        playbackThat(() => FILE, measure),
        {
          videoPath: '',
          videoFolderId: null,
        }
      )
    ).toEqual(NOTHING);
    expect(measure).not.toHaveBeenCalled();
  });

  it('answers nulls when no component and no header can say', () => {
    expect(
      derivedVideoFacts(
        playbackThat(
          () => FILE,
          () => ({ durationSeconds: null, quality: null })
        ),
        STORED
      )
    ).toEqual(NOTHING);
  });

  it('answers nulls when the probe fails mid-answer', () => {
    expect(
      derivedVideoFacts(
        playbackThat(
          () => FILE,
          () => {
            throw new Error('ffprobe died mid-answer');
          }
        ),
        STORED
      )
    ).toEqual(NOTHING);
  });

  it('answers nulls when resolving the path throws', () => {
    expect(
      derivedVideoFacts(
        playbackThat(
          () => {
            throw new Error('the media root went away');
          },
          () => ({ durationSeconds: 6832.5, quality: '1080p' })
        ),
        STORED
      )
    ).toEqual(NOTHING);
  });
});
