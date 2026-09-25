import { range } from '@/utils';

// The frame is the real page's own, imported rather than copied — the reason
// `LoadingDetail` gives: a skeleton that traced its own columns would be free
// to drift out of alignment with the screen it is standing in for.
import {
  Content,
  Hero,
  PosterColumn,
  Main,
} from '../SeriesDetail/SeriesDetail.styles';
import {
  SkeletonPoster,
  SkeletonTitle,
  SkeletonLine,
} from './LoadingSeries.styles';

/** Placeholder lines held while the series loads. */
const SKELETON_LINES = 3;

/**
 * The series page's hero shape, held while the series loads, rather than a
 * blank screen that jumps when the content lands — `LoadingDetail`'s
 * precedent. It announces itself once, as a status named "Loading series",
 * and the blocks inside it are hidden from assistive technology.
 */
export function LoadingSeries() {
  return (
    <Content role="status" aria-label="Loading series">
      <Hero aria-hidden="true">
        <PosterColumn>
          <SkeletonPoster />
        </PosterColumn>
        <Main>
          <SkeletonTitle />
          {range(SKELETON_LINES).map((line) => (
            <SkeletonLine key={line} />
          ))}
        </Main>
      </Hero>
    </Content>
  );
}
