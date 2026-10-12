import { SeasonEpisodes } from '@/features/series/SeasonEpisodes/SeasonEpisodes';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/series/:id/season/:n` — one season's episodes. Composition only: the
 * `SeasonEpisodes` organism, which owns _Back to series_ and its **Landing**,
 * on the same sheet and column as every other column screen.
 */
export default function SeasonPage() {
  return (
    <MaintainerLayout>
      <SeasonEpisodes />
    </MaintainerLayout>
  );
}
