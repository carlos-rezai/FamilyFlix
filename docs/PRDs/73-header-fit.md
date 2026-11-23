> **Initiative:** `header-fit`
> **Issue:** #693 (the PRD, step 55)
> **Design log:** `docs/design-logs/73-header-fit.md`
> **Handoff:** `docs/handoff/handoff-header-fit/README.md`, until phase 1 amends `page.LibraryPage.dc.html`, `page.SettingsPage.dc.html`, the model in `FamilyFlix.dc.html` and `COMPONENT-SPEC.md` to it.
> **Build order:** step 55, **Header fit**. Retires log 63's **Row view switch** and log 70's **Quality filter**. No migration, no new dependency, no new route.

## Problem Statement

Dad snaps FamilyFlix to half his screen, or opens it on a laptop, and the browse header runs off the right edge. Since the Quality pill (step 52) the header carries five pills, Genre, Rating, Quality, Sort and View, then the Settings gear, all on one line that never wraps. The last pills and the Settings button sit past the window's edge, out of reach: there is no way to scroll to them, and nothing on screen says they are there.

Measured in the shell, the header's contents are 1696px wide at every window size. At 1024px (the window's minimum), at 1280 and even at 1440, the end of the header is cut off. Dropping two pills alone would still leave about 1314px, so a narrow window would still lose Settings.

## Solution

**Every filter pill and the Settings button stay on screen at every window width.**

- **Two fewer pills.** The _View_ pill goes: how a tab is browsed is now chosen in the Genre dropdown. The _Quality_ pill goes: there is no longer a filter by quality.
- **The Genre dropdown chooses the view.** Its first two rows are _All Genres_, the tab's genre rows as today, and _All movies_ (on Movies) or _All series_ (on Series), every title in one grid under that same heading. Then each genre, busiest first, as today. The pill reads the chosen row. The view is still the household's, per tab, kept across relaunches; picking a genre narrows the tab and leaves the view as it was.
- **The end of the header wraps whole.** The three pills and Settings are one unit, the **Header end**. While the first line can hold it, it sits at the right as today; when it can't, it moves together to a second line, right-aligned, and the search box grows into the room it left. Nothing is cut off, nothing shrinks, and Settings is never separated from the pills. With three pills it stays on one line down to about 1347px, so a 1366px laptop sees one line.
- **Show video quality** still tags every poster; its description no longer mentions a filter.

## User Stories

1. As the household, I want every filter pill visible in a narrow window, so that I can always filter the library.
2. As the household, I want the Settings button visible at every window size, so that I can always reach Settings.
3. As the household, I want a narrow window to put the pills and Settings on a second line rather than cut them off, so that nothing is hidden past the edge.
4. As the household, I want the pills and Settings to move together, so that the gear never ends up alone on a line.
5. As the household, I want the second line right-aligned, so that the controls stay where my eye expects them, at the right.
6. As the household, I want a wide window to keep the header on one line, so that a big screen looks as it does today.
7. As the household on a 1366px laptop, I want the header on one line, so that the common laptop size isn't made taller.
8. As the household, I want the search box to grow into the room the pills left when they wrap, so that the first line doesn't look empty.
9. As the household, I want no pill to truncate or squeeze its words, so that every value stays readable.
10. As the household, I want a long genre name chosen in the Genre pill to never push Settings off screen, so that a choice can't hide a control.
11. As the household, I want the header to re-flow as I resize the window, so that every size works without a relaunch.
12. As the household, I want _All movies_ in the Genre dropdown to show every film in one grid, so that I can browse the whole library at once.
13. As the household, I want _All Genres_ to show the genre rows, so that the familiar shelves are one press away.
14. As the household, I want the grid row to read the same words as the heading above the grid, so that the dropdown and the page agree.
15. As the household on the Series tab, I want _All series_ in the same dropdown, so that both tabs work the same way.
16. As the household on the Series tab, I want _All Genres_ to give series genre rows, so that shows can be browsed by genre too.
17. As the household, I want the Genre pill to read _All movies_ or _All series_ while the grid is showing, so that the pill says what I'm looking at.
18. As the household, I want the Genre pill to read _All Genres_ while the rows are showing, so that the default home reads as it always has.
19. As the household, I want the Genre pill to read the genre while one is chosen, so that I know what's narrowing the page.
20. As the household, I want exactly one row checked in the Genre dropdown, so that I can see my current choice at a glance.
21. As the household, I want _All Genres_ and _All movies_ to show the whole library's count, so that both read as "everything", arranged two ways.
22. As the household, I want choosing _All Genres_ or _All movies_ to clear a chosen genre, so that those rows really show everything.
23. As the household, I want picking a genre to keep the grid if I was on the grid, so that the genre narrows the grid rather than switching views.
24. As the household, I want picking a genre to keep the rows if I was on the rows, so that the genre leaves one row with its View all, as today.
25. As the household, I want my search, rating and sort kept when I change the view, so that switching views doesn't undo my other filters.
26. As the household, I want the view I chose kept after a relaunch, so that the home opens the way we like it.
27. As the household, I want each tab to keep its own view, so that Movies as rows and Series as a grid can both be remembered.
28. As a fresh household, I want Movies to start on _All Genres_ and Series on _All series_, so that an upgrade changes nothing on screen until someone chooses.
29. As the household, I want no snackbar when I change the view, so that browsing stays quiet, as the prototype draws it.
30. As the household, I want the Genre pill not to flash a wrong value while the app starts, so that the header never jumps.
31. As the household, I want a failed genre list to still offer _All Genres_ and _All movies_, so that I can always switch views.
32. As the household, I want the View all on a genre row and the Genre page to work as before, so that nothing past the header changes.
33. As the household, I want no Quality pill in the header, so that the header has room for the controls we use.
34. As the household, I want _Show video quality_ to keep tagging each poster, so that I can still tell a DVD rip from a 4K file.
35. As the household, I want the _Show video quality_ description to talk only about the tags, so that it doesn't mention a filter that's gone.
36. As the household, I want an old link carrying a quality filter to show the whole library, so that a stale link never hides films or shows an error.
37. As the maintainer, I want the quality filter removed from the client, the wire and the server, so that no code keeps a contract nobody calls.
38. As the maintainer, I want a request carrying `?quality=` answered 200 with the whole library, so that the removal is pinned by a test.
39. As the maintainer, I want the Series quality and the Quality tag untouched, so that removing the filter removes nothing else.
40. As the maintainer, I want the _All movies_ and _All series_ words stated once, so that the dropdown and the grid headings can't drift apart.
41. As the maintainer, I want the fit rule in the layout, so that no page has to know the header wraps.
42. As the maintainer, I want the walk to check the header at 1024, 1280, 1366 and 1920px on both tabs, with a long genre chosen, so that "in reach" is measured, not assumed.

## Implementation Decisions

- **One initiative**, `header-fit`, step 55, design log 73: the Row view in the Genre dropdown, the Quality filter gone end to end, and the **Header end** that wraps whole.
- **The prototype first.** Phase 1 amends the browse page, the Settings page, the prototype's model and the component spec to the handoff README, as log 63 did.
- **The Header end, in `MainLayout`.** A new styled box wraps the `headerEnd` slot and the Settings button: flex, the header's 24px gap, never shrinking, never wrapping inside, pushed right with an auto left margin. The header itself gains `flex-wrap` and a 12px row gap (`space.s3`). No breakpoint and no media or container query: the line wraps when the content doesn't fit, whatever the pills read. The search bar keeps its current floor. `GenreLayout` is untouched. This is structure only, a template's job.
- **`allTitlesLabel(tab)`, a new pure util**: _All movies_ for Movies, _All series_ for Series. `MovieGrid`, `SeriesGrid` and `SeriesRows` draw their heading through it, and the Genre dropdown names its grid row with it.
- **`useRowView` moves to the shared hooks** (`src/hooks/`), unchanged, with its test: the search feature's `LibraryFilters` now reads it beside the library feature's `LibraryBody`, and a hook two features use is shared (CLAUDE.md's rule).
- **`genreOptions` learns the View rows** and stays a pure builder in the search feature. It takes the genre list, a `GenreSelection` (`{ genre }` or `{ rowView }`), the tab's _All_ label and an `onSelect(selection)`. It answers _All Genres_ (checked for `{ rowView: 'genre' }`), the _All_ row (checked for `{ rowView: 'all' }`), then each genre busiest first (checked for its `{ genre }`). Both View rows carry the list total. A sibling `genreLabel(selection, allTitles)` answers the pill's value. `GenreSelection` lives in the unit; one feature reads it.
- **`LibraryFilters` draws three pills**, Genre, Rating, Sort. It builds the selection from the URL's genre, else the tab's Row view. A View row clears `?genre=` and then sets the Row view through the provider (shown at once, no snackbar); a genre writes `?genre=` alone. The Genre pill draws nothing while the Row view is `null`. In practice that is never seen, because `StartTabGate` waits on the same settings read.
- **Deleted:** `RowViewSwitch`, `rowViewOptions` (with `rowViewLabel`) and their tests. `LibraryPage`'s end slot is `LibraryFilters` alone.
- **The Quality filter goes, end to end:** the pill; `qualityOptions`; `setQuality`; `honouredLibraryQuery`; the client's `parseMinQuality`; `quality` in `parseLibraryQuery` and `toLibraryQueryParams`; `minQuality` on `LibraryQuery` and `MovieQuery`; the route's `parseMinQuality` and its `400 Invalid quality`; the movie and series browse `WHERE`s; and their tests. `useLibraryQuery` and `useSettledLibraryQuery` stop reading `useQualityTags`. Kept: the Video quality, the Quality tag, the Quality sweep, the sheet column, `qualityRankSql` (read by the Series quality) and the toggle.
- **A held `?quality=`** is read past as any unknown parameter, client and server; nothing strips it.
- **The toggle's description** becomes _Tag each poster with how sharp its video is: 4K, 1080p, 720p, 480p or SD._
- **Documents:** the glossary's Header fit section is already written (log 73); the checklist's step 55; the docblocks of `MainLayout`, `LibraryPage`, `LibraryFilters`, `genreOptions`, `useLibraryQuery`, `useQualityTags`, `DisplaySection`, `LibraryBody` and the routes' Library query reader. CLAUDE.md and the README are untouched.

## Testing Decisions

- A good test drives a unit through its public face and checks what a household member or a caller sees: the rows offered, the row checked, the URL written, the setting saved, the status answered. It never checks which helper ran or a styled-component's class.
- **`genreOptions`**: the order; both View rows' labels and totals on each tab; exactly one row checked for a genre, for `rowView: 'genre'` and for `rowView: 'all'`; what each row reports to `onSelect`; `genreLabel` for each selection; an empty list still offers both View rows. Prior art: today's `genreOptions.test.ts`, `rowViewOptions.test.ts`.
- **`allTitlesLabel`**: both tabs. Prior art: the `src/utils/` tests.
- **`LibraryFilters`**: three pills and no Quality pill with _Show video quality_ on; the Genre pill blank while the view is `null`; a View row clearing `?genre=` and saving the tab's view; a genre writing `?genre=` and leaving the view alone; the Series tab reading _All series_. Prior art: `LibraryFilters.test.tsx`, `RowViewSwitch.test.tsx`.
- **`useRowView`**: its test moves with it, unchanged.
- **`MainLayout`**: the Settings button sits in the Header end beside the `headerEnd` slot. jsdom does no layout, so the wrap itself is proved in the walk. Prior art: `MainLayout.test.tsx`.
- **`LibraryPage`**: no View pill; the body still follows the tab's view. Prior art: `LibraryPage.test.tsx`.
- **Grid headings**: `MovieGrid`, `SeriesGrid` and `SeriesRows` keep their heading text. Prior art: their own tests.
- **Server**: `GET /api/home?quality=4k` and `GET /api/series?quality=nope` answer 200 with the whole library, replacing `routes.qualityFilter.test.ts`. Prior art: that file's fixtures.
- **`DisplaySection`**: the new one-sentence description. Prior art: `DisplaySection.test.tsx`.
- **Removed with their units**: the `*.quality.test.*` files of `parseLibraryQuery`, `toLibraryQueryParams`, `useLibraryQuery` and `useSettledLibraryQuery`; `qualityOptions.test.ts`; `honouredLibraryQuery.test.ts`; `parseMinQuality`'s test.
- Every slice starts RED (`tdd`). The acceptance is the walk in the shell: both tabs at 1024, 1280, 1366 and 1920px, with _Documentary_ (or the longest genre held) chosen; every pill and Settings on screen, nothing truncated; each View row on each tab, and a relaunch keeping both.

## Out of Scope

- The Genre page's header (Back, heading, search, Sort): it fits.
- A collapsed search, a _More_ menu, a header that scrolls sideways, or smaller type and gaps.
- A filter by quality of any other kind, such as a sort or a search word.
- Any change to what a body draws: the Genre rows, View all, the Genre page and the four bodies are unchanged.
- A genre that forces the grid, or a genre remembered per view.
- Stripping a held `?quality=` from the URL.

## Further Notes

- Trade-offs accepted: below about 1347px the header is a line taller (about 58px), so the body starts lower in a narrow window; one pill now writes both the URL and a household setting; a held `?quality=` can linger on a URL, unread.
- Implementation plan (log 73): 1. the Row view in the Genre dropdown (prototype amended, `allTitlesLabel`, `useRowView` moved, `genreOptions`, `LibraryFilters`, the switch deleted); 2. the Quality filter goes (client, route, browses, the toggle's sentence); 3. the Header end and the walk, then the documents.
