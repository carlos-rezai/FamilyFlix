import { FilterDropdown } from '@/components';

import { ALL_GENRES, genreOptions } from '../genreOptions/genreOptions';
import { ratingLabel, ratingOptions } from '../ratingOptions/ratingOptions';
import { sortLabel, sortOptions } from '../sortOptions/sortOptions';
import { useGenreList } from '../useGenreList/useGenreList';
import { useLibraryQuery } from '../useLibraryQuery/useLibraryQuery';

/**
 * The header's filter pills — the `headerEnd` slot of `MainLayout`, carrying
 * the Genre, Rating and Sort dropdowns in the prototype's order
 * (`page.LibraryPage.dc.html:84`). They are one feature component rather than
 * three because the prototype renders them as siblings of the header's flex
 * row, so this returns a fragment and adds no wrapper that would take them out
 * of it.
 *
 * Like the search box, it only ever *writes* the URL and only ever *reads* it
 * back — each pill shows whatever the URL is carrying, whoever put it there,
 * and no pill reads another. Nothing here knows that the rows exist.
 *
 * The genre list is the one thing this component loads, and it loads it once
 * per mount rather than per query: the counts describe the whole library, so
 * they must not reshuffle under a finger already reaching for them. It renders
 * before that list arrives — and if it never arrives — with "All Genres" alone,
 * so a failed list is a quieter dropdown rather than a broken header, and the
 * other two pills are untouched by it.
 *
 * The rating pill is the one that wears a ★ instead of a caption: `label` still
 * supplies its accessible name, so hiding the words on screen never leaves it
 * announcing a value with no subject.
 *
 * No pill's vocabulary lives here. Each one is a pure builder from the domain
 * data and the current selection to `FilterOption[]`, in its own folder with
 * its own test, and this component is what puts the three side by side.
 */
export function LibraryFilters() {
  const { query, setSort, setGenre, setRating } = useLibraryQuery();
  const genres = useGenreList();

  return (
    <>
      <FilterDropdown
        label="Genre"
        value={query.genre ?? ALL_GENRES}
        options={genreOptions(genres, query.genre, setGenre)}
      />
      <FilterDropdown
        label="Minimum rating"
        showLabel={false}
        leadingStar
        value={ratingLabel(query.minRating)}
        options={ratingOptions(query.minRating, setRating)}
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
