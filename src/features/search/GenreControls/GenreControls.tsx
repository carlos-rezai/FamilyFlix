import { useParams } from 'react-router-dom';

import { FilterDropdown, SearchBar } from '@/components';
import { sortLabel, sortOptions } from '../sortOptions/sortOptions';
import { useGenreQuery } from '../useGenreQuery/useGenreQuery';
import { useSettledText } from '../useSettledText/useSettledText';

/**
 * The genre header's two controls — the trailing slot of `GenreLayout`, holding
 * the search box and the Sort pill in the prototype's order and at its widths
 * (`page.GenrePage.dc.html:101`).
 *
 * One feature component rather than two because the prototype renders them as
 * siblings of the header's flex row, so this returns a fragment and adds no
 * wrapper that would take them out of it — the same shape as `LibraryFilters`.
 *
 * It takes no props and reads the URL itself, exactly as the home's controls
 * do. The genre is the path, so the box can name the shelf it narrows —
 * "Search in Action", not "Search your movies", because the caption is the only
 * thing on screen that says this search is the narrower one. Arriving is a
 * fresh search: the home's term is not in this URL, so the box opens empty and
 * the shelf the parent asked to see whole opens whole.
 *
 * The Sort pill offers the same five orders as the home. A genre is a different
 * shelf, not a different vocabulary, so nothing is renamed on the way in and
 * `sortOptions` is shared rather than copied. There is no Genre pill, because
 * the genre is the screen, and no rating pill, because this screen has no
 * rating filter to write a cut-off from.
 *
 * Each control writes its own parameter through `useGenreQuery` and reads back
 * only what the URL is carrying, so choosing an order can't drop a search and a
 * settling search can't drop the order.
 */
export function GenreControls() {
  const { name } = useParams<{ name: string }>();
  const { query, setSearch, setSort } = useGenreQuery();

  // Decoded by the router, which is what lets a genre with a space in it
  // ("Science Fiction") be named in the caption the way it is written.
  const genre = name ?? '';

  const [text, setText] = useSettledText(query.search ?? '', setSearch);

  return (
    <>
      <SearchBar
        value={text}
        placeholder={`Search in ${genre}`}
        maxWidth={250}
        onChange={setText}
      />
      <FilterDropdown
        label="Sort"
        value={sortLabel(query.sort)}
        options={sortOptions(query.sort, setSort)}
        menuWidth={220}
      />
    </>
  );
}
