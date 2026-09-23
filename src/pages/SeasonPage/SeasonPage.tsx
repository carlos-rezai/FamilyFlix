import { SeasonEpisodes } from '@/features/series/SeasonEpisodes/SeasonEpisodes';
import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { Scroller } from './SeasonPage.styles';

/**
 * `/series/:id/season/:n` — one season's episodes. Composition only,
 * `SeriesPage`'s precedent: its own scroll container around the
 * `SeasonEpisodes` organism, which owns _Back to series_ and its **Landing**.
 */
export default function SeasonPage() {
  const scroller = useRestoredScroll<HTMLDivElement>();

  return (
    <Scroller ref={scroller}>
      <SeasonEpisodes />
    </Scroller>
  );
}
