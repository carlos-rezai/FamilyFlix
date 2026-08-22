import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * The key React Router gives the first entry of a session — the screen was
 * opened by deep link or reload, so there is nothing behind it to go back to.
 */
const NO_HISTORY = 'default';

/**
 * The one Back rule in the app: step back through history, and fall back to the
 * library only when there is no history to step through.
 *
 * A step is what a parent means by Back — the browse home they had already
 * filtered and scrolled, or the genre shelf they were halfway down, returned to
 * exactly as they left it. Navigating to `/` instead would be a fresh entry:
 * filters cleared, shelf back at the top. That is why this is not the
 * prototype's `goBrowse()`.
 *
 * The fallback is for the screen with nothing behind it — deep-linked or
 * reloaded — where a history step would leave the parent stranded on the very
 * screen they asked to leave, looking at a dead button.
 *
 * A global hook rather than a feature module: `GenreLayout`'s Back pill and
 * `MoviePage`'s both call it, and the rule must not exist twice.
 */
export function useGoBack() {
  const navigate = useNavigate();
  const { key } = useLocation();

  return useCallback(() => {
    if (key === NO_HISTORY) {
      navigate('/');
      return;
    }
    navigate(-1);
  }, [key, navigate]);
}
