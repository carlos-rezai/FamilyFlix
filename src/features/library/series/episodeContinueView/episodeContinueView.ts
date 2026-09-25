import type { ContinueCardMovie, EpisodeContinueEntry } from '@/types';
import {
  formatClock,
  formatEpisodeTag,
  gradientFromId,
  toProgressPercent,
  toRuntimeSeconds,
} from '@/utils';

/**
 * Maps a Continue Watching entry to the `ContinueCardMovie` an unchanged
 * `ContinueCard` renders — an **Episode continue card**, `continueView`'s
 * precedent for a movie. The title reads `Series · SnnEnn`; the **Resume
 * label** is elapsed and total together when the runtime is known, elapsed
 * alone when it isn't. The id is the episode's, which is what the card opens.
 */
export function episodeContinueView({
  series,
  episode,
}: EpisodeContinueEntry): ContinueCardMovie {
  const { g1, g2 } = gradientFromId(episode.id);
  const elapsed = formatClock(episode.resumePositionSeconds);
  const totalSeconds = toRuntimeSeconds(episode.runtimeMinutes);

  return {
    id: episode.id,
    title: `${series.title} · ${formatEpisodeTag(episode)}`,
    g1,
    g2,
    resumeLabel:
      totalSeconds === null
        ? `Resume · ${elapsed}`
        : `Resume · ${elapsed} of ${formatClock(totalSeconds)}`,
    progress: toProgressPercent(
      episode.resumePositionSeconds,
      episode.runtimeMinutes
    ),
  };
}
