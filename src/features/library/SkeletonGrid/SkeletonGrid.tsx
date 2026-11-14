import { range } from '@/utils';
import { Grid } from '../LibraryGrid/LibraryGrid.styles';
import { SkeletonCard } from '../SkeletonCard/SkeletonCard';

/** Enough placeholder tiles to fill the fold while a grid loads. */
const SKELETON_CARDS = 12;

export interface SkeletonGridProps {
  /** What the status says is loading: _Loading your library_. */
  label: string;
}

/**
 * A grid's first load, laid out on the grid it is about to become. It reuses
 * `LibraryGrid`'s own `Grid` rather than restating the track sizing, so the
 * placeholders sit exactly where the posters will land and nothing shifts
 * under the eye when they do. `MovieGrid` and the Genre page's `GenreGrid`
 * draw it.
 */
export function SkeletonGrid({ label }: SkeletonGridProps) {
  return (
    <Grid role="status" aria-label={label}>
      {range(SKELETON_CARDS).map((card) => (
        <SkeletonCard key={card} />
      ))}
    </Grid>
  );
}
