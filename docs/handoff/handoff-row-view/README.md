# Row view: handoff

Step 46, design log `docs/design-logs/63-row-view.md`. This README is the
spec for the **Row view** until phase 1 amends `page.LibraryPage.dc.html`, the
model in `FamilyFlix.dc.html` and `COMPONENT-SPEC.md` to it; after that the
prototype rules, as everywhere. Nothing here is newly designed: every piece
is one the prototype already draws, placed under the other tab.

## The switch

A fourth `mol.FilterDropdown` in the browse header's end slot, after Sort:

| Part            | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Label           | `View`                                                    |
| Value shown     | `All` or `By genre`                                       |
| Options         | `All`, `By genre`, in that order, the current one checked |
| Accessible name | `View`                                                    |
| Counts          | none                                                      |
| Not drawn       | until the household's settings read lands                 |

It sets the current **Library tab**'s Row view only. No snackbar. It writes
no URL; the search, genre, rating and sort stay as they are.

## The defaults

| Tab    | Row view   | Which is today's face |
| ------ | ---------- | --------------------- |
| Movies | `By genre` | the genre rows        |
| Series | `All`      | _All series_          |

## What each tab draws

### Movies, `By genre` (unchanged)

Continue Watching row, Favorites row, a Genre row per populated genre, the
Other row _Other movies_ last.

### Movies, `All` (new)

As the Series tab's _All series_, in movies:

1. Continue Watching row (unchanged).
2. Favorites row: the grid's hearted movies, in its order, at most 15.
3. Heading `All movies`, 24px serif, as `All series`.
4. Count line `N movies` (`1 movie`), 15px faint, as the series count line.
5. `feat.LibraryGrid` of every movie the query keeps, uncapped.

### Series, `All` (unchanged)

Episode Continue row, Favorites row, `All series`, `N series · M episodes`,
the Library grid.

### Series, `By genre` (new)

As the Movies tab's rows, in series:

1. Episode Continue row (unchanged).
2. Favorites row: hearted series, at most 15.
3. A `feat.GenreRow` per populated series genre, busiest first, 15 cards,
   `View all {count}` with the genre's true count.
4. Last, the Other row titled `Other series`: every series with no genre, at
   most 15; not drawn under a genre filter, nor when every series has one.

A genre filter leaves that genre's row alone.

## View all on a series row

Opens `page.GenrePage` for series: `/genre/{name}?tab=series`, and the Other
series row's `/genre-less?tab=series`. Drawn as the movie Genre page is
(Back, the name over `N of M titles`, search, Sort, the Library grid), its
cards opening the series page. The `other` mode is headed `Other series`.

## The faces belong to the tab

| Face    | Movies, either view                                                    | Series, either view                       |
| ------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| Loading | skeleton rows (`By genre`), a grid of skeleton cards (`All`)           | nothing until it lands                    |
| Failure | `Couldn’t load your library`, Retry                                    | `Couldn’t load your series`, Retry        |
| Empty   | `Your library is empty` / `Add a movie to start filling your shelves.` | `All series` over `0 series · 0 episodes` |
| Miss    | today's search and filter copy                                         | today's search and filter copy            |
