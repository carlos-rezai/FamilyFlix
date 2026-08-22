import { MovieDetail } from '@/features/movie-detail/MovieDetail/MovieDetail';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { ChevronLeftIcon } from '@/primitives';
import { Scroller, BackPill } from './MoviePage.styles';

/**
 * `/movie/:id` — one movie in full. Composition only: this screen's own chrome
 * (the scroll container and the Back pill) and the `MovieDetail` organism, which
 * loads the movie from the URL.
 *
 * `MainLayout` is deliberately not used here. Its solid header would sit exactly
 * where this screen's translucent controls belong, and the detail page's chrome
 * is designed to float over artwork.
 *
 * Back is `useGoBack`, the app's one Back rule — a step through history, so a
 * parent who was halfway along the Action row returns to that row at that scroll
 * position, not to the top of the home screen.
 *
 * Owning its scroll container also means owning what `MainLayout` gives every
 * other screen for free: coming back to this page from the player returns it to
 * where it was left.
 */
export default function MoviePage() {
  const goBack = useGoBack();
  const scroller = useRestoredScroll<HTMLDivElement>();

  return (
    <Scroller ref={scroller}>
      <BackPill type="button" onClick={goBack}>
        <ChevronLeftIcon size={18} />
        Back
      </BackPill>
      <MovieDetail />
    </Scroller>
  );
}
