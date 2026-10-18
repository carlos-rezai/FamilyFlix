import type { AudioTrack, PlaybackPath } from '@/types';

import type { MediaProbe, ProbedAudio } from '../probe/probe';
import { trackLanguage } from '../trackLanguage/trackLanguage';

/**
 * One track's label before collisions: language · title, a title already
 * naming the language alone, either alone, else `Track N` from 1.
 */
function audioTrackLabel(
  stream: ProbedAudio,
  language: string | null,
  index: number
): string {
  const { title } = stream;
  if (language !== null && title !== null) {
    return title.toLowerCase().includes(language.toLowerCase())
      ? title
      : `${language} · ${title}`;
  }
  return language ?? title ?? `Track ${index + 1}`;
}

/**
 * A probe and each **Audio track index**'s **Playback path** → the offered
 * **Audio tracks**, labelled, in index order. A track whose path would be
 * `cannot-play` is not offered; a file nothing probed, or with no audio,
 * offers none. Two labels that would collide each take ` · Track N`.
 */
export function audioTracks(
  probe: MediaProbe | null,
  pathOf: (index: number) => PlaybackPath
): AudioTrack[] {
  if (probe === null) {
    return [];
  }

  const offered = probe.audioStreams.flatMap((stream, index) => {
    const path = pathOf(index);
    if (path === 'cannot-play') {
      return [];
    }
    const language = trackLanguage(stream.language);
    return [
      {
        index,
        language,
        label: audioTrackLabel(stream, language, index),
        fileDefault: stream.isDefault,
        path,
      },
    ];
  });

  return offered.map((track) =>
    offered.some(
      (other) => other.index !== track.index && other.label === track.label
    )
      ? { ...track, label: `${track.label} · Track ${track.index + 1}` }
      : track
  );
}
