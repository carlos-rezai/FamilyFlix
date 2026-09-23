import { SeriesDetail } from '@/features/series/SeriesDetail/SeriesDetail';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { ChevronLeftIcon } from '@/primitives';
import { Scroller, BackPill } from './SeriesPage.styles';

/** Where Back goes with nothing behind the page: the Series tab. */
const LANDING = '/?tab=series';

/**
 * `/series/:id` — one series in full. Composition only, `MoviePage`'s
 * precedent: its own scroll container and Back pill over the `SeriesDetail`
 * organism. Back is the one **Back rule** — a step when there is history, the
 * Series tab when there is not.
 */
export default function SeriesPage() {
  const goBack = useGoBack(LANDING);
  const scroller = useRestoredScroll<HTMLDivElement>();

  return (
    <Scroller ref={scroller}>
      <BackPill type="button" onClick={goBack}>
        <ChevronLeftIcon size={18} />
        Back
      </BackPill>
      <SeriesDetail />
    </Scroller>
  );
}
