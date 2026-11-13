import { SeasonEpisodes } from '@/features/series/SeasonEpisodes/SeasonEpisodes';
import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { Scroller } from './SeasonPage.styles';

/**
 * `/series/:id/season/:n` — one season's episodes. Composition only,
 * `SeriesPage`'s precedent: its own scroll container over the `SeasonEpisodes`
 * organism, which owns _Back to series_, its **Landing**, and the series'
 * **Detail backdrop** behind the column.
 */
export default function SeasonPage() {
  const scroller = useRestoredScroll<HTMLDivElement>();

  return (
    <Scroller ref={scroller}>
      <SeasonEpisodes />
    </Scroller>
  );
}
