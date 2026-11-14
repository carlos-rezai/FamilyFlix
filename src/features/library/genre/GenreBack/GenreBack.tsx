import { BackButton } from '@/components';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { seriesTabPath } from '@/utils';
import { useGenreTitles } from '../GenreTitles/GenreTitles';

/**
 * The Genre page's **Back button**, for `GenreLayout`'s `back` slot: a step
 * back through history onto the screen the family came from, already filtered
 * and scrolled, and with nothing behind it, the **Library tab** the page
 * serves: `seriesTabPath()` under Series, `/` under Movies. The tab is the
 * provider's, so the layout learns nothing about the library from it.
 */
export function GenreBack() {
  const { tab } = useGenreTitles();
  const goBack = useGoBack(tab === 'series' ? seriesTabPath() : '/');

  return <BackButton onClick={goBack} />;
}
