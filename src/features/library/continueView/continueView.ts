import type { ContinueCardMovie, Movie } from '@/types';
import { formatClock, gradientFromId, toProgressPercent } from '@/utils';

/**
 * Maps a canonical `Movie` record to the `ContinueCardMovie` a `ContinueCard`
 * renders — the resume-tile sibling of `view()`. It builds the **Resume label**
 * here rather than in the molecule: elapsed and total together
 * ("Resume · 1:13 of 1:55") when the runtime is known, elapsed alone when it
 * isn't — no "of --" placeholder. Gradient stops always come from the id (the
 * tile has no artwork slot) and progress reuses `toProgressPercent`, including
 * its nominal sliver for an in-progress movie of unknown length.
 */
export function continueView(movie: Movie): ContinueCardMovie {
  const { g1, g2 } = gradientFromId(movie.id);
  const elapsed = formatClock(movie.resumePositionSeconds);
  const totalSeconds =
    movie.runtimeMinutes !== null && movie.runtimeMinutes > 0
      ? movie.runtimeMinutes * 60
      : null;

  return {
    id: movie.id,
    title: movie.title,
    g1,
    g2,
    resumeLabel:
      totalSeconds === null
        ? `Resume · ${elapsed}`
        : `Resume · ${elapsed} of ${formatClock(totalSeconds)}`,
    progress: toProgressPercent(
      movie.resumePositionSeconds,
      movie.runtimeMinutes
    ),
  };
}
