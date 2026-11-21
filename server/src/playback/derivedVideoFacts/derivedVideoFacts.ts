import type { StoredVideo, VideoQuality } from '@/types';
import type { Playback } from '../createPlayback/createPlayback';

/** The units the `runtime_minutes` column stores, and the film's own. */
const SECONDS_PER_MINUTE = 60;

/** What a save learns about a film from its bytes. */
export interface VideoFacts {
  runtimeMinutes: number | null;
  videoQuality: VideoQuality | null;
}

const NOTHING: VideoFacts = { runtimeMinutes: null, videoQuality: null };

/**
 * The **Runtime label**'s minutes and the **Video quality** of a film that has
 * just landed, each `null` when this machine cannot say, both read off one
 * `Playback.measure`. Every save calls it, and the **Quality sweep** measures
 * by it too, so what counts as a measurable video is stated here alone.
 *
 * The form has no runtime or quality field and the prototype designs none, so
 * both are derived from the bytes: `measure` asks the **Playback component**'s
 * probe first and, for the duration only, the container's own header second.
 *
 * **It never throws.** The movie is already in the library or about to be;
 * these facts are the least of what the save was for, so every way of failing
 * to derive them ends in the `null`s a film nothing could measure gets.
 *
 * The runtime is rounded to the nearest minute; a film that rounds to nought
 * is `null` rather than nought, which every reader already treats as unknown.
 */
export function derivedVideoFacts(
  playback: Pick<Playback, 'videoFile' | 'measure'>,
  video: StoredVideo
): VideoFacts {
  // A row with no film behind it has nothing to derive from.
  if (video.videoPath === '') {
    return NOTHING;
  }

  try {
    const found = playback.videoFile(video);
    if (found.kind !== 'file') {
      return NOTHING;
    }

    const { durationSeconds, quality } = playback.measure(found.file);
    const minutes =
      durationSeconds === null
        ? null
        : Math.round(durationSeconds / SECONDS_PER_MINUTE);
    return {
      runtimeMinutes: minutes !== null && minutes > 0 ? minutes : null,
      videoQuality: quality,
    };
  } catch {
    return NOTHING;
  }
}
