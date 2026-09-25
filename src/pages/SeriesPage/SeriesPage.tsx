import { SeriesDetail } from '@/features/series/SeriesDetail/SeriesDetail';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { ChevronLeftIcon } from '@/primitives';
import { Scroller, BackCircle } from './SeriesPage.styles';

/** Where Back goes with nothing behind the page: the Series tab. */
const LANDING = '/?tab=series';

/** The circle's edge and its chevron, from `page.SeriesPage.dc.html`. */
const BACK_SIZE = 44;
const CHEVRON_SIZE = 20;

/**
 * `/series/:id` — one series in full. Composition only, `MoviePage`'s
 * precedent: its own scroll container and Back over the `SeriesDetail`
 * organism — the prototype's glass circle, not the movie page's pill. Back is
 * the one **Back rule** — a step when there is history, the Series tab when
 * there is not.
 */
export default function SeriesPage() {
  const goBack = useGoBack(LANDING);
  const scroller = useRestoredScroll<HTMLDivElement>();

  return (
    <Scroller ref={scroller}>
      <BackCircle label="Back" title="Back" size={BACK_SIZE} onClick={goBack}>
        <ChevronLeftIcon size={CHEVRON_SIZE} />
      </BackCircle>
      <SeriesDetail />
    </Scroller>
  );
}
