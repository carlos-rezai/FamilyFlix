// The frame is the real page's own, imported rather than copied: a skeleton
// that traced its own columns would be free to drift out of alignment with the
// screen it is standing in for, which is the one thing it must never do.
import { Content, PosterColumn, Main } from '../MovieDetail/MovieDetail.styles';
import {
  SkeletonPoster,
  SkeletonTitle,
  SkeletonMeta,
  SkeletonChips,
  SkeletonChip,
  SkeletonLine,
} from './LoadingDetail.styles';

/** Enough placeholder chips and lines to fill the fold while the movie loads. */
const SKELETON_CHIPS = 2;
const SKELETON_LINES = 3;

const range = (length: number) => Array.from({ length }, (_, index) => index);

/**
 * The movie detail page's own shape, held while the movie loads, rather than a
 * blank screen that jumps when the content lands.
 *
 * It announces itself once, as a status named "Loading movie", and everything
 * inside it is hidden from assistive technology — a screen reader listing nine
 * empty boxes would be describing the placeholder rather than the wait.
 */
export function LoadingDetail() {
  return (
    <Content role="status" aria-label="Loading movie">
      <PosterColumn aria-hidden="true">
        <SkeletonPoster />
      </PosterColumn>
      <Main aria-hidden="true">
        <SkeletonTitle />
        <SkeletonMeta />
        <SkeletonChips>
          {range(SKELETON_CHIPS).map((chip) => (
            <SkeletonChip key={chip} />
          ))}
        </SkeletonChips>
        {range(SKELETON_LINES).map((line) => (
          <SkeletonLine key={line} />
        ))}
      </Main>
    </Content>
  );
}
