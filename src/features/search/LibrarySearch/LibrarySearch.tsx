import { useEffect, useState } from 'react';

import { SearchBar } from '@/components';
import { useLibraryQuery } from '../useLibraryQuery/useLibraryQuery';

/** How long the typing has to stop for before the query is written. */
const DEBOUNCE_MS = 250;

/**
 * The header's search control — the `headerStart` slot of `MainLayout`.
 *
 * It is the only holder of un-settled input in the app. The field follows every
 * keystroke immediately, because a box that lags behind the typing feels
 * broken; the URL is written once the typing has stopped for 250ms, because
 * everything downstream — the home request, the rows, the miss message — treats
 * the URL as the **settled query** and would otherwise re-run on every letter.
 * That debounce lives here and nowhere else.
 *
 * The URL stays in charge of what the box shows: arriving on a shared or
 * bookmarked search fills it, and a navigation that changes the settled query
 * under it — Back out of a movie, the logo home — resets it to match.
 */
export function LibrarySearch() {
  const { query, setSearch } = useLibraryQuery();
  const settled = query.search ?? '';
  const [text, setText] = useState(settled);

  // The URL is the authority: whenever the settled query changes, the box says
  // what it says — including a change this component didn't cause.
  useEffect(() => {
    setText(settled);
  }, [settled]);

  useEffect(() => {
    if (text === settled) {
      return;
    }

    const timer = setTimeout(() => setSearch(text), DEBOUNCE_MS);

    // Another keystroke means the typing hasn't stopped after all — the pending
    // write is abandoned rather than added to.
    return () => clearTimeout(timer);
  }, [text, settled, setSearch]);

  return <SearchBar value={text} onChange={setText} />;
}
