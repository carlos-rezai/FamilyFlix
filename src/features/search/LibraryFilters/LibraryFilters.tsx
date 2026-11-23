import { FilterDropdown } from '@/components';
import { useQualityTags } from '@/App/useQualityTags/useQualityTags';
import { useLibraryTab } from '@/hooks/useLibraryTab/useLibraryTab';
import { useRowView } from '@/hooks/useRowView/useRowView';
import { allTitlesLabel } from '@/utils';

import {
  genreLabel,
  genreOptions,
  type GenreSelection,
} from '../genreOptions/genreOptions';
import { qualityLabel, qualityOptions } from '../qualityOptions/qualityOptions';
import { ratingLabel, ratingOptions } from '../ratingOptions/ratingOptions';
import { sortLabel, sortOptions } from '../sortOptions/sortOptions';
import { useGenreList } from '../useGenreList/useGenreList';
import { useLibraryQuery } from '../useLibraryQuery/useLibraryQuery';

/**
 * The header's filter pills — the `headerEnd` slot of `MainLayout`, carrying
 * the Genre, Rating, Quality and Sort dropdowns in the prototype's order
 * (`page.LibraryPage.dc.html:84`). They are one feature component rather than
 * four because the prototype renders them as siblings of the header's flex
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
 * other pills are untouched by it.
 *
 * The Genre pill also chooses how the tab is browsed (log 73): its value is
 * the URL's genre, else the tab's **Row view**, and it is not drawn while
 * neither is known. A **View row** takes `?genre=` off and saves the tab's
 * view, with no snackbar; a genre writes `?genre=` alone and leaves the view.
 *
 * The rating pill is the one that wears a ★ instead of a caption: `label` still
 * supplies its accessible name, so hiding the words on screen never leaves it
 * announcing a value with no subject.
 *
 * No pill's vocabulary lives here. Each one is a pure builder from the domain
 * data and the current selection to `FilterOption[]`, in its own folder with
 * its own test, and this component is what puts them side by side.
 *
 * The Quality pill sits between Rating and Sort, and is drawn only while
 * _Show video quality_ has landed on: with the toggle off there is nothing on
 * a card for it to filter by, and `useLibraryQuery` reads past a `?quality=`
 * the URL still carries without rewriting it.
 */
export function LibraryFilters() {
  const { query, setSort, setGenre, setRating, setQuality } = useLibraryQuery();
  const qualityTags = useQualityTags();
  const genres = useGenreList();
  const allTitles = allTitlesLabel(useLibraryTab());
  const { rowView, setRowView } = useRowView();

  const selection: GenreSelection | null = query.genre
    ? { genre: query.genre }
    : rowView && { rowView };

  const select = (chosen: GenreSelection) => {
    if ('genre' in chosen) {
      setGenre(chosen.genre);
      return;
    }
    setGenre('');
    void setRowView(chosen.rowView);
  };

  return (
    <>
      {selection && (
        <FilterDropdown
          label="Genre"
          value={genreLabel(selection, allTitles)}
          options={genreOptions(genres, selection, allTitles, select)}
        />
      )}
      <FilterDropdown
        label="Minimum rating"
        showLabel={false}
        leadingStar
        value={ratingLabel(query.minRating)}
        options={ratingOptions(query.minRating, setRating)}
      />
      {qualityTags && (
        <FilterDropdown
          label="Quality"
          value={qualityLabel(query.minQuality)}
          options={qualityOptions(query.minQuality, setQuality)}
        />
      )}
      <FilterDropdown
        label="Sort"
        value={sortLabel(query.sort)}
        options={sortOptions(query.sort, setSort)}
        menuWidth={220}
      />
    </>
  );
}
