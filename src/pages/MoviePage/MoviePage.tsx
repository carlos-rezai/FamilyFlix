import { useLocation, useNavigate } from 'react-router-dom';

import { MovieDetail } from '@/features/movie-detail/MovieDetail/MovieDetail';
import { ChevronLeftIcon } from '@/primitives';
import { Scroller, BackPill } from './MoviePage.styles';

/**
 * The key React Router gives the first entry of a session — the page was opened
 * by deep link or reload, so there is nothing behind it to go back to.
 */
const NO_HISTORY = 'default';

/**
 * `/movie/:id` — one movie in full. Composition only: this screen's own chrome
 * (the scroll container and the Back pill) and the `MovieDetail` organism, which
 * loads the movie from the URL.
 *
 * `MainLayout` is deliberately not used here. Its solid header would sit exactly
 * where this screen's translucent controls belong, and the detail page's chrome
 * is designed to float over artwork.
 *
 * Back is a step through history rather than a link to `/`, so a parent who was
 * halfway along the Action row returns to that row at that scroll position — not
 * to the top of the home screen.
 */
export default function MoviePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    if (location.key === NO_HISTORY) {
      navigate('/');
      return;
    }
    navigate(-1);
  };

  return (
    <Scroller>
      <BackPill type="button" onClick={goBack}>
        <ChevronLeftIcon size={18} />
        Back
      </BackPill>
      <MovieDetail />
    </Scroller>
  );
}
