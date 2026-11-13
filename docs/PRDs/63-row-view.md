> **Initiative:** `row-view`
> **Issue:** #607 (the PRD, step 46)
> **Design log:** `docs/design-logs/63-row-view.md`
> **Handoff:** `docs/handoff/handoff-row-view/` (its README is the spec until phase 1 amends the prototype)
> **Build order:** step 46, **Row view**. It ships as thin slices (log 63, _Implementation Plan_). No migration (two more rows in the `settings` table), four new reads, one new header control, and a prototype amendment first.

## Problem Statement

The two **Library tab**s browse differently, and neither can be browsed the other way. Movies draws a **Genre row** per genre, capped at 15 cards each, so a parent who wants to see every film at once has to open a **Genre page** per genre, and a film is found by remembering its genre. Series draws one **Library grid** of every show under _All series_, so a household with a growing series library has no way to browse its shows by genre at all: no series row exists, and no series has a Genre page for a row's **View all** to open.

Whatever the family would prefer, they get the face each tab was built with. And any choice they could make would have to outlast a relaunch and be the same for both parents, since they share one library.

## Solution

Either Library tab can be browsed either way, **All** (every title in one grid) or **By genre** (a row per genre), chosen by the **Row view switch**: a _View_ pill in the browse header after Sort, its value _All_ or _By genre_.

- The choice is the household's and per tab: two settings, `movie-row-view` and `series-row-view`, kept in the `settings` table beside the Start tab, so it holds across relaunches, travels with the backup and both parents see it.
- Today's faces are the defaults (Movies _By genre_, Series _All_), so nothing on screen moves until someone switches.
- **Movies under All** is the Series tab's face in films: the Continue row, the **Favorites row** derived from the grid, _All movies_, the count line `N movies`, and the uncapped Library grid of every movie the **Library query** keeps.
- **Series by genre** is the Movies tab's face in shows: the episode Continue row, the Favorites row, a Genre row per populated series genre (busiest first, 15 cards, the true count on View all), and the **Other series row** last.
- A series row's View all opens the Genre page for series, `/genre/:name?tab=series`, and the Other series row's `/genre-less?tab=series`.
- The switch writes no URL: search, genre, rating and sort survive it. Each tab's loading, failure, empty and miss faces are the same in either view. Nothing is drawn until the settings read lands.

## User Stories

### The switch

1. As a parent, I want a _View_ pill in the browse header after Sort, so that I can change how the tab I'm on is laid out.
2. As a parent, I want the pill to read _All_ or _By genre_, so that I can see at a glance how the tab is laid out now.
3. As a parent, I want its two options listed _All_, then _By genre_, the current one checked as the other pills' options are, so that it behaves like the pills beside it.
4. As a parent, I want the pill to show no counts, so that it reads as a choice of layout, not a filter.
5. As a parent using a screen reader, I want the pill named _View_, so that I know what it changes.
6. As a parent, I want picking an option to change the body at once, so that the switch feels immediate.
7. As a parent, I want no snackbar after a switch, since the prototype draws none, so that the screen stays calm.
8. As a parent, I want the switch to set only the tab I'm on, so that changing Movies doesn't rearrange Series.
9. As a parent, I want switching tabs to show that tab's own view in the pill and the body, so that each tab is as I left it.
10. As a parent, I want the pill not drawn until the household's choice has loaded, so that it never shows one value and then jumps to another.
11. As a parent, I want a refused save put back to the value it had, so that the pill never lies about what is kept.

### Remembering it

12. As a parent, I want the view I picked still there after a relaunch, so that I set it once.
13. As a parent, I want the other parent to find the same view, so that we share one library and one way of browsing it.
14. As the maintainer, I want the choice stored in the `settings` table beside the Start tab, so that it travels with a backup like every other household preference.
15. As the maintainer, I want Movies to default to _By genre_ and Series to _All_, so that an upgrade changes nothing on screen until someone switches.
16. As the maintainer, I want a stored value off the list read as that tab's default, so that a hand-edited or stale row can't break the home.
17. As the maintainer, I want the view kept out of the URL, so that a bookmarked or shared link never overrides the household's choice.
18. As the maintainer, I want the view kept out of `localStorage`, so that it isn't tied to one browser profile and is in the backup.
19. As a parent, I want the home drawn in the household's view on first paint, not the default and then the real one, so that the screen doesn't load twice and jump.
20. As a parent, I want the home still drawn in the defaults when the settings read fails, so that a refused read never leaves the home blank.
21. As the maintainer, I want the other preferences to keep today's behaviour on a refused read, so that only the Row views gain this fallback.
22. As the maintainer, I want no Settings row for the view, so that there is one place to change it and one answer to "where did my view go".

### Movies under All

23. As a parent, I want Movies under _All_ to draw every film the library holds in one grid, so that I can scroll everything without opening each genre.
24. As a parent, I want the grid uncapped, so that no film is missing from it.
25. As a parent, I want genre-less films in the grid with the rest, so that _All_ really is all.
26. As a parent, I want the Continue Watching row first, as today, so that I can pick up a film where I left it.
27. As a parent, I want a Favorites row of the grid's hearted films, in the grid's order, at most 15, so that my favourites stay one glance away.
28. As a parent, I want the heading _All movies_, as the Series tab's _All series_, so that both tabs read alike.
29. As a parent, I want a count line `N movies` (`1 movie` for one), so that I know how much the grid holds.
30. As a parent, I want the grid sorted by the Sort pill, so that the header still decides the order.
31. As a parent, I want a search under _All_ to narrow the grid, so that I can find a film in it.
32. As a parent, I want a genre filter under _All_ to narrow the grid to that genre, so that the filter still works without rows.
33. As a parent, I want a rating filter under _All_ to narrow the grid, so that every pill means the same in either view.
34. As a parent, I want hearting a film in the grid to update the Favorites row above, so that the shelf follows my hearts.
35. As a parent, I want a card in the grid to open the film's page, so that the grid behaves as the Genre page's grid does.

### Series by genre

36. As a parent, I want Series under _By genre_ to draw a row per series genre, so that I can browse shows by kind.
37. As a parent, I want the episode Continue row first, as today, so that I can carry on with the next episode.
38. As a parent, I want a Favorites row of my hearted series, at most 15, in the Sort pill's order, so that my favourite shows stay one glance away.
39. As a parent, I want the genre rows busiest first, as the Series tab's Genre pill orders them, so that the biggest genres come first.
40. As a parent, I want each row to carry at most 15 shows, so that the home stays quick to scroll.
41. As a parent, I want each row's View all to show the genre's true count, so that I know how many shows are behind it.
42. As a parent, I want only genres that hold a show drawn as rows, so that there are no empty rows.
43. As a parent, I want an _Other series_ row last, holding every show with no genre, so that no show is unreachable.
44. As a parent, I want no _Other series_ row when every show has a genre, so that an empty row is never drawn.
45. As a parent, I want a genre filter under _By genre_ to leave that genre's row alone and no Other row, as on Movies, so that the filter reads the same on both tabs.
46. As a parent, I want a search under _By genre_ to narrow every row, so that I can find a show in the rows.
47. As a parent, I want a row card to open the series page, so that it behaves as the grid card does.
48. As a parent, I want hearting a show on a row to show the heart on every row and shelf it appears on, so that one heart is one heart everywhere.

### The Genre page for series

49. As a parent, I want View all on a series row to open that genre's series, so that I can see every show behind the 15.
50. As a parent, I want View all on _Other series_ to open every show with no genre, so that the Other row has its own page too.
51. As a parent, I want the series Genre page drawn as the movie one (Back, the genre's name over `N of M titles`, search, Sort, the grid), so that both kinds read alike.
52. As a parent, I want the series Other page headed _Other series_, so that it names what it holds.
53. As a parent, I want the series Genre page's cards to open the series page, so that a show opens as a show.
54. As a parent, I want the Sort I had on the home carried to the Genre page, as on Movies, so that the order I picked follows me.
55. As a parent, I want Back from a series Genre page to return to the Series tab in the view I left, so that I land where I was.
56. As the maintainer, I want the tab to ride the Genre page's link as `?tab=series`, omitted at Movies, as it rides the home's, so that one Genre page serves both kinds.
57. As the maintainer, I want View all to open the Genre page rather than the Series grid narrowed by `?genre=`, so that following a link never rewrites the household's Row view.

### Switching keeps the rest

58. As a parent, I want a switch to keep my search text, so that I don't retype it.
59. As a parent, I want a switch to keep the genre, rating and sort pills, so that only the layout changes.
60. As a parent, I want Back from a title to return to the view the household holds, so that the home is as I left it.

### Faces

61. As a parent, I want Movies to draw skeleton rows while loading under _By genre_ and a grid of skeleton cards under _All_, so that loading looks like what is coming.
62. As a parent, I want Series to draw nothing until it has loaded, in either view, as today, so that the tab behaves as it always has.
63. As a parent, I want Movies with no films to say _Your library is empty_ / _Add a movie to start filling your shelves._ in either view, so that an empty library reads the same whichever way I browse.
64. As a parent, I want Series with no shows to draw _All series_ over `0 series · 0 episodes` in either view, since an empty library has no genre to row, so that the empty face is the tab's.
65. As a parent, I want today's search and filter miss copy in either view, so that a miss reads the same.
66. As a parent, I want a failed load to show _Couldn't load your library_ (Movies) or _Couldn't load your series_ (Series) with Retry, in either view, so that I can try again.
67. As a parent, I want Retry to reload the body I'm looking at, so that it recovers the view I chose.

### The record

68. As the maintainer, I want `page.LibraryPage.dc.html`, the model in `FamilyFlix.dc.html` and `COMPONENT-SPEC.md` amended to the handoff before any code, so that the prototype stays the spec.
69. As the maintainer, I want the glossary to hold **Row view**, **All**, **By genre**, **Row view switch** and **Other series row**, and the updated **Browse home**, **Series tab**, **Genre page**, **Other row**, **View all**, **Library grid** and **Favorites row** (done in the grill-me commit; kept true by the build).
70. As the maintainer, I want the checklist's step 46 and a dev-journal entry for this step, so that the record is complete.
71. As the maintainer, I want the docblocks of `LibraryBody`, `SeriesHome`, `GenreMovies`, `GenrePage`, `DisplayPreferenceProvider` and the `/home` and `/series` routes to say what they now do.
72. As the maintainer, I want CLAUDE.md untouched, since there is no new domain, wire rule or product rule.

## Implementation Decisions

- **One initiative** (log 63 Q1), step 46, `row-view`: the switch, the two new bodies, and the series Genre page a series row's View all needs. No Settings row, no further layouts.
- **The spec** (Q2): the handoff README rules until phase 1 amends `page.LibraryPage.dc.html`, the model in `FamilyFlix.dc.html` and `COMPONENT-SPEC.md` to it, as issue 445 did for log 51's Other row. Nothing new is designed; each body is composed of drawn pieces.
- **Names** (Q3, Q19): the choice is the **Row view**, its values **All** (`'all'`) and **By genre** (`'genre'`), the control the **Row view switch**. Never _layout_, _mode_, _display_ or _grid view_.
- **Types** (Q8):
  - `ROW_VIEWS = ['all', 'genre'] as const` and `RowView`, beside `LIBRARY_TABS` in the browse types.
  - `MovieGridPayload { movies: Movie[]; continueWatching: Movie[] }`, beside them.
  - `SeriesRow { genre; count; series: Series[] }` (`HomeRow` in series) and `SeriesRowsPayload { rows: SeriesRow[]; other: SeriesRow | null; favorites: Series[]; continueWatching: EpisodeContinueEntry[] }` in the series types.
  - `DEFAULT_MOVIE_ROW_VIEW = 'genre'`, `DEFAULT_SERIES_ROW_VIEW = 'all'`; `Settings` gains flat `movieRowView` and `seriesRowView`, so the settings write keeps its one-field body.
- **Settings** (library domain, Q7): two keys, `movie-row-view` and `series-row-view`, read with `choiceOf(key, ROW_VIEWS, default)` (an off-list value reads as the default), written one key per request as `start-tab` is. No migration.
- **`getMovieGrid(query)`** (home slice, Q12): beside `getHome`; the browse query uncapped in the caller's sort, and the continue section built by the same `listSection` call `getHome` uses.
- **`getSeriesRows(query)`** (series browse slice, Q14): `getHome`'s rules over series: `HOME_ROW_LIMIT` per row, the true count per genre, genres busiest first as `/api/series/genres` orders them, the genre filter deciding which rows exist (and dropping Other), favorites capped at 15 in the caller's sort, the episode continue section; each section built independently.
- **Series genre reads** (series browse slice, Q15): one genre's series and the genre-less series, uncapped, answering `GenrePayload`'s shape in series.
- **Routes** (Q12, Q14, Q15), all narrowed by the one Library query:
  - `GET /api/movies` via `libraryQueryOr400`, answering `MovieGridPayload`. The path is free for GET.
  - `GET /api/series/rows` via `libraryQueryOr400`, answering `SeriesRowsPayload`.
  - `GET /api/series/genre/:name` and `GET /api/series/genre-less` via `genreQueryOr400`, as the movie genre routes.
  - The three `/series/...` reads are registered ahead of `/series/:id`, so none is read as a series id.
  - Domains stay injected into `createApiRouter`; the routes only parse, call and respond.
- **Saves** (Q9): `saveMovieRowView` and `saveSeriesRowView` in the app shell, one save per preference as `saveStartTab` is.
- **`DisplayPreferenceProvider`** (Q9, Q10): two more held values; `DisplayPreferenceApi` gains `movieRowView`, `setMovieRowView`, `seriesRowView`, `setSeriesRowView`. A switch is shown at once, posted, the echo kept, put back on refusal, no snackbar. Each is `null` until the read lands; a refused read lands the two Row view defaults alone, the other preferences keeping `null` as today. No settled flag.
- **`useRowView()`** (library feature, Q9): reads the current Library tab off `useLibraryTab()` and returns `{ rowView: RowView | null; setRowView(view): Promise<void> }` for that tab, so neither the switch nor the body knows there are two settings.
- **`rowViewOptions(current, onChoose) => FilterOption[]`** (library feature, Q5): pure, the `sortOptions` / `ratingOptions` shape; _All_ then _By genre_, the current one checked, no counts.
- **`RowViewSwitch`** (library feature, Q4, Q5): a `FilterDropdown` labelled _View_ over `rowViewOptions` and `useRowView`; draws nothing while the view is `null`. Rendered by `LibraryPage` in `headerEnd` after `LibraryFilters`, not inside it (that is the search feature's and writes the URL).
- **`MovieGrid`** (home feature, Q11, Q18): Movies under All, `SeriesHome`'s shape with its load inline: Continue row, Favorites row via `shelvedFavorites`, _All movies_, `N movies` / `1 movie`, the Library grid; Q16's faces.
- **`SeriesRows` + `useSeriesRows`** (series feature, Q13, Q18): Series by genre, `HomeRows` / `useHomeRows`' shape over `seriesCardView`, reusing `GenreRow`, `ContinueRow`, `FavoritesRow` and `RetryableFailure`; the Other row titled _Other series_; hearts across rows and shelf by `withHeart`'s rule.
- **`LibraryBody`** (Q18): picks among four bodies off `useLibraryTab()` and `useRowView()`; draws nothing while the view is `null`. `HomeRows` and `SeriesHome` are unchanged.
- **Genre page** (Q15): `GenreMovies` reads the Library tab off the URL with `useLibraryTab()`; under Series it loads the two series genre reads, opens the series page from its cards, and heads its `other` mode _Other series_. Heading, `N of M titles`, search, sort and the **Carried sort** are unchanged. `GenreMovies` keeps its name for now.
- **Series row links** (Q15): View all builds `/genre/:name?tab=series` and `/genre-less?tab=series`, the Carried sort riding beside the tab.
- **Independence** (Q17): a switch writes no URL and keeps search, genre, rating and sort; it reloads only because the body changes.
- **No new domain, no migration, no CLAUDE.md change** (Q20).
- **Slices** (log 63, _Implementation Plan_):
  1. Movies as one grid: the prototype amendment; the types, settings, saves, provider and `useRowView`; `rowViewOptions` and `RowViewSwitch`; `GET /api/movies` and `MovieGrid`; `LibraryBody` picking on Movies.
  2. Series by genre: `GET /api/series/rows`, `SeriesRows` and `useSeriesRows` with the Other series row; the series Genre page through `?tab=series` and its two reads.
  3. Every face: Q16's faces in both new bodies, the hearts across rows and shelf, the refused read landing the defaults, the switch blank until it lands.
  4. Walk it live in the shell on the dev library with `npm run db:seed-series`, then the documents of Q20.

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or a family member sees: the payload a read answers, the setting a read returns after a write, the options built, the pill and body on screen, the request made, the link a View all opens. It never asserts which helper ran or a component's internal state.
- **`settings`**: both keys default (Movies `genre`, Series `all`); each written and read back; an off-list stored value reads as the default; a write touches its one key. Prior art: the `start-tab` tests in `settings.test.ts`.
- **`getMovieGrid`**: uncapped (more than 15 movies all returned); narrowed by search, genre and rating; in the query's sort; genre-less movies included; its continue section equal to `getHome`'s. Prior art: `home.test.ts`.
- **`getSeriesRows`**: 15 per row with the true count; busiest genre first; only populated genres; Other holds the genre-less and is `null` when none; a genre filter leaves one row and no Other; favorites capped at 15 in the caller's sort; the episode continue section. Prior art: `home.test.ts` for `getHome`, the series browse tests.
- **Series genre reads**: one genre's series uncapped; genre-less series; search and sort applied. Prior art: the movie genre read's tests.
- **Routes**: a new movie grid route test and a new series rows route test (shapes, 400s on a bad query); `/series/rows`, `/series/genre/:name` and `/series/genre-less` not read as a series id; the settings route accepting both new fields and refusing an off-list value. Prior art: `routes.settings.test.ts` and the existing browse route tests.
- **`rowViewOptions`**: two options in order, the current one checked, choosing calls back with its value. Prior art: `sortOptions` and `ratingOptions` tests.
- **`useRowView`**: returns Movies' view under the Movies tab and Series' under Series; `null` until the read lands; the setter sets only the current tab's. Prior art: the provider's hook tests.
- **`DisplayPreferenceProvider`**: both values land from the read; a set shows at once and posts; a refused save is put back; a refused read lands the two defaults and leaves the other preferences `null`. Prior art: its existing tests.
- **`RowViewSwitch`**: labelled _View_, shows the current value, nothing drawn while `null`, a choice sets the view and writes no URL. Prior art: `LibraryFilters` tests.
- **`MovieGrid`**: every face of Q16 (skeleton grid, empty, miss, failure with Retry), _All movies_ and the count line singular and plural, the Favorites row from the grid capped at 15, a heart reaching the shelf. Prior art: `SeriesHome.test.tsx`.
- **`SeriesRows`**: rows with View all counts, Other series last and absent when `null`, a genre filter leaving one row, every face of Q16, a heart across rows and shelf, View all links carrying `?tab=series`. Prior art: `HomeRows` tests.
- **`GenreMovies`** under `?tab=series`: the series reads called, series cards opening the series page, the `other` mode headed _Other series_, the count line and Carried sort as on Movies. Prior art: `GenreMovies.test.tsx`.
- **`LibraryPage`**: the switch in the header after the filters; the body following it per tab; switching tabs showing each tab's own view; search and filters kept across a switch. Prior art: `LibraryPage.test.tsx`.
- Slice 4's live walk in the shell is the acceptance: each tab both ways, a filter and a search under each, a heart on a row and on the grid, View all on a series row and on Other series, and both choices kept across a relaunch.

## Out of Scope

- A Settings row for the Row view (Q1).
- Further layouts: a list, a denser grid, card sizes (Q1).
- The view in the URL, or in `localStorage` (Q7).
- Generic kind-neutral bodies (`TitleRows` / `TitleGrid`) over both kinds (Q18); renaming `GenreMovies` and `SeriesHome` is the refactor's to propose.
- A second Genre page or a `/series/genre/:name` client route (Q15).
- New copy per view (Q16).
- A series equivalent of the Genre dropdown's movie counts beyond what `/api/series/genres` already gives.

## Further Notes

- The trade-off is accepted: four new server reads widen the surface; the Genre page's provider serves two kinds under a movie's name until the refactor renames it; a view is not shareable as a link, by design.
- The maintainer approved every recommendation of log 63 in advance; this PRD adds no decision the log doesn't hold.
