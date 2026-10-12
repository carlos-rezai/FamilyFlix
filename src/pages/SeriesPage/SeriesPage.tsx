import { SeriesDetail } from '@/features/series/SeriesDetail/SeriesDetail';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { seriesTabPath } from '@/utils';
import { BackButton } from '@/components';
import { Scroller } from './SeriesPage.styles';

/** Where Back goes with nothing behind the page: the Series tab. */
const LANDING = seriesTabPath();

/**
 * `/series/:id` — one series in full. Composition only, `MoviePage`'s
 * precedent: its own scroll container and Back over the `SeriesDetail`
 * organism — the same **Back button** every screen draws. Back is
 * the one **Back rule** — a step when there is history, the Series tab when
 * there is not.
 */
export default function SeriesPage() {
  const goBack = useGoBack(LANDING);
  const scroller = useRestoredScroll<HTMLDivElement>();

  return (
    <Scroller ref={scroller}>
      <BackButton onClick={goBack} />
      <SeriesDetail />
    </Scroller>
  );
}
