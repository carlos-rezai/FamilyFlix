import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { fetchSettings } from '@/api/fetchSettings/fetchSettings';
import { seriesTabPath } from '@/utils';

/**
 * Whether the browse home may draw, honouring the household's **Start tab**.
 *
 * Off the **Launch entry** (a deep link, a named tab, a search query, any
 * location the history put there) it answers `true` at once and reads nothing.
 * On it (bare `/`, no query, the router's `default` key) it reads the settings
 * route itself, once per mount, and answers `false` until that read settles:
 * Series replaces the entry with the Series tab, so no Movies frame is drawn
 * and Back has nothing behind it; Movies, or a refused read, leaves `/` alone.
 *
 * It reads the route rather than the provider's value because it must tell a
 * refusal from a value still on its way (log 49 Q13), as `useOpeningReads`
 * does.
 */
export function useStartTab(): boolean {
  const location = useLocation();
  const navigate = useNavigate();

  // Decided once, from where the mount began: the replace onto the Series tab
  // moves the location, and that must not reopen the question.
  const [onLaunchEntry] = useState(
    () =>
      location.pathname === '/' &&
      location.search === '' &&
      location.key === 'default'
  );
  const [settled, setSettled] = useState(!onLaunchEntry);

  useEffect(() => {
    if (!onLaunchEntry) {
      return;
    }
    let cancelled = false;

    void fetchSettings()
      .then((settings) => {
        if (!cancelled && settings.startTab === 'series') {
          navigate(seriesTabPath(), { replace: true });
        }
      })
      // A refusal is no preference: the browse home opens where it is.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setSettled(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // The read belongs to the mount, not to each navigate identity.
  }, [onLaunchEntry]);

  return settled;
}
