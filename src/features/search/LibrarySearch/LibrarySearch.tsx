import { useSearchParams } from 'react-router-dom';

import { SearchBar } from '@/components';
import { useLibraryQuery } from '../useLibraryQuery/useLibraryQuery';
import { useSettledText } from '../useSettledText/useSettledText';

/**
 * The header's search control — the `headerStart` slot of `MainLayout`.
 *
 * The field follows every keystroke immediately, because a box that lags behind
 * the typing feels broken; the URL is written once the typing has stopped,
 * because everything downstream — the home request, the rows, the miss
 * message — treats the URL as the **settled query** and would otherwise re-run
 * on every letter. That holding-back is `useSettledText`, which is the app's
 * one debounce and lives nowhere else; this component is what wires it to the
 * home's query.
 *
 * The URL stays in charge of what the box shows: arriving on a shared or
 * bookmarked search fills it, and a navigation that changes the settled query
 * under it — Back out of a movie, the logo home — resets it to match.
 */
export function LibrarySearch() {
  const { query, setSearch } = useLibraryQuery();
  const [text, setText] = useSettledText(query.search ?? '', setSearch);
  // The box names what it searches: the Series tab's caption is its own.
  const [searchParams] = useSearchParams();
  const placeholder =
    searchParams.get('tab') === 'series'
      ? 'Search your series'
      : 'Search your movies';

  return (
    <SearchBar value={text} placeholder={placeholder} onChange={setText} />
  );
}
