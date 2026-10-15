> **Initiative:** `tmdb-ratings`
> **Design log:** `docs/design-logs/43-tmdb-ratings.md`
> **Issue:** #367 (the PRD, step 26)
> **Build order:** step 26, the first after Review at scale + Season art. It ships as seven thin slices (log 43, _Implementation Plan_), the prototype revision first

## Problem Statement

I synced the whole library with TMDB, and every title we haven't rated ourselves still shows five empty stars. TMDB has said how good each film is — the app even stores it — but nothing draws it, so the shelf looks as if nobody has an opinion about anything. _Highest rated_ puts all of those titles at the bottom, and _3+ stars_ hides them, even the ones TMDB thinks are excellent.

At the same time, the stars on a card have always meant _our_ rating, the family's. If the app started drawing TMDB's opinion there, my parents must be able to tell at a glance whose stars they are looking at, and nothing TMDB says may ever overwrite a rating we set ourselves.

## Solution

A new preference, **TMDB ratings**, on by default: the Display group's second row in Settings, _Fill in ratings from TMDB_, a toggle under _Ultrawide margins_.

While it is on, every title the family hasn't rated draws its **TMDB rating** — TMDB's score halved to the nearest half star, so `7.4` is 3½ ★ — as **TMDB-marked stars**: the filled stars muted rather than in the accent, and the value followed by a small `TMDB` tag, `★★★½☆ 3.5 TMDB`. A title the family _has_ rated draws that rating exactly as today, in the accent, with no tag; the family's rating always wins. With the toggle off, every surface draws as it does today.

What is drawn is the **Shown rating**, and everything that reads a rating reads it: the poster cards on the Movies tab, the Series tab, the Genre page and search; the movie page's meta line; the series page's meta line; the _Highest rated_ sort; and the minimum-rating filter. A card drawing 4 ★ is never hidden by _4+ stars_.

On the movie page the rating picker shows TMDB's rating as its placeholder while the film is unrated — muted stars and `3.5 / 5 TMDB` in place of `Not rated`. Clicking any star sets the family's rating, as today; clicking the star TMDB's rating sits on adopts it as ours. Clearing our rating — clicking the star it sits on, as today — brings TMDB's placeholder back.

Nothing is stored differently. The family's rating and TMDB's score stay two columns; the switch changes only what is drawn and how the shelf is ordered. A title nobody on TMDB voted for has no score at all rather than a score of zero. Export, import and Sync are untouched: an Export still writes the family's rating alone.

## User Stories

### The preference

1. As the maintainer, I want a _Fill in ratings from TMDB_ row in Settings' Display group, so that I can choose whether TMDB's scores fill in for the family's missing ratings.
2. As the maintainer, I want the row to sit under _Ultrawide margins_, on the same row furniture with the same toggle, so that the Display group reads as one card.
3. As the maintainer, I want the row's line to say _When the family hasn't rated a title, show TMDB's score as its stars, marked TMDB. Your own ratings always come first._, so that I know what switching it on does before I do.
4. As the maintainer, I want the preference on by default, so that a freshly synced library reads as rated without visiting Settings.
5. As the maintainer, I want the toggle to flip at once when I press it, so that the switch feels immediate.
6. As the maintainer, I want every loaded screen to redraw the moment the toggle flips, so that I see its effect without reloading.
7. As the maintainer, I want the preference kept in the library's database, so that it survives a restart and applies to the whole household.
8. As the maintainer, I want a refused save to put the toggle back, so that the switch never claims a state the app did not keep.
9. As the maintainer, I want the row drawn whether or not a TMDB key is stored, so that the setting is always where I expect it; with no scores held, switching it changes nothing.
10. As the maintainer, I want a Factory reset to put the preference back to on, so that a reset library starts from the defaults like every other setting.
11. As a parent, I want the app on a cold start to draw only the family's own ratings until the preference has been read, so that TMDB stars never flash onto a library where they were switched off.

### Drawing a TMDB rating

12. As a parent, I want an unrated title with a TMDB score to draw TMDB's stars on its poster card, so that I can see at a glance whether it's worth watching.
13. As a parent, I want TMDB's stars drawn muted rather than in the accent, so that a shelf of mixed ratings is scannable.
14. As a parent, I want TMDB's stars followed by the value and a small `TMDB` tag, so that I never mistake TMDB's opinion for the family's.
15. As a parent using a screen reader, I want the `TMDB` tag read as text, so that whose rating it is does not depend on colour.
16. As a parent, I want a title the family rated drawn exactly as today — accent stars, the value, no tag — so that our own ratings look like ours.
17. As a parent, I want the family's rating drawn even when it is lower than TMDB's, so that our opinion always comes first.
18. As a parent, I want a title rated 0 by the old spreadsheet still drawn as the family's 0, so that a rating we gave is never replaced by TMDB's.
19. As a parent, I want an unrated title with no TMDB score drawn as Unrated, as today, so that nothing is invented.
20. As a parent, I want a title nobody on TMDB voted for drawn as Unrated rather than as a TMDB zero, so that an unknown film doesn't look terrible.
21. As a parent, I want TMDB's score rounded to the nearest half star the same way everywhere, so that the card, the page and the order agree on a `6.5`.
22. As a parent, I want TMDB-marked stars on the Movies tab, the Series tab, the Genre page and search results alike, so that the rule is the same wherever I browse.
23. As a parent, I want the series page's meta line to draw TMDB's stars, marked, when the family hasn't rated the series, so that series and films behave the same.
24. As a parent, I want the series card on the Series tab to draw TMDB's stars the same way a movie card does, so that the two tabs read alike.
25. As a parent, I want the Continue card to keep drawing no stars, so that the resume row is unchanged.
26. As a parent with the preference off, I want every surface drawn exactly as before this feature, so that switching it off is a true undo.

### The movie page's picker

27. As a parent, I want the movie page's picker to show TMDB's rating as muted stars while the film is unrated, so that I see TMDB's opinion where I'd set ours.
28. As a parent, I want the picker's label to read `3.5 / 5 TMDB` in place of `Not rated` while TMDB's is shown, so that I know whose stars those are.
29. As a parent, I want hovering the picker to preview my rating in the accent as today, so that I can tell what a click will set.
30. As a parent, I want a click on any star to set the family's rating, so that rating a film works exactly as before.
31. As a parent, I want a click on the star TMDB's rating sits on to adopt that rating as ours rather than clear anything, so that agreeing with TMDB is one click.
32. As a parent, I want clicking the star my rating sits on to clear it as today, so that clearing works exactly as before.
33. As a parent, I want TMDB's placeholder to come back once I clear my rating, so that clearing returns the film to TMDB's opinion rather than to five empty stars.
34. As a parent with the preference off, I want the picker to read `Not rated` over empty stars as today, so that the switch governs the picker too.
35. As a parent with no TMDB score held, I want the picker to read `Not rated` as today, so that nothing is invented.
36. As the maintainer, I want the Movie form's _Your rating_ picker to show no placeholder, so that the form edits only what is stored.
37. As the maintainer, I want a series' rating still set and cleared in the series edit, with no picker on the series page, so that the series page stays read-only.

### Sort and filter

38. As a parent, I want _Highest rated_ to order titles by the rating they draw, so that a TMDB-rated 4 ★ film sorts among the 4 ★ films rather than under the unrated.
39. As a parent, I want _3+ stars_ to keep a title drawing 3½ TMDB stars, so that the filter never hides a card it should show.
40. As a parent, I want unrated titles with no TMDB score still sorted last under _Highest rated_ and still excluded by a minimum rating, so that the old behaviour holds where TMDB has nothing to say.
41. As a parent, I want every home section, the Series tab, the Genre page and search to agree on the order and the filter, so that the rule is one rule.
42. As a parent with the preference off, I want _Highest rated_ and the filter to read the family's ratings alone, as today, so that the switch governs the order too.
43. As a parent, I want the URL's sort and filter to mean the same thing they always did, so that a bookmarked or Back-restored shelf still opens.

### What does not change

44. As the maintainer, I want an Export to write the family's rating alone, so that the spreadsheet stays the family's and still round-trips.
45. As the maintainer, I want Bulk import's Rating cell to keep writing the family's rating, so that the sheet means what it always meant.
46. As the maintainer, I want no Sync ever to write the family's rating, so that TMDB can never overwrite a rating we set.
47. As the maintainer, I want a Sync that refreshes a score to redraw that title's TMDB stars, so that the shelf follows TMDB's latest.
48. As the maintainer, I want scores of zero already stored by past Syncs treated as no score, so that films nobody voted for stop reading as zero the moment the app updates.

## Implementation Decisions

### Vocabulary

- **TMDB rating** — the stored TMDB score read as a Rating: the score rounded to an integer of half-star units (`7.4` → `7` → 3½ ★). Never stored.
- **Shown rating** — the household Rating when one is stored (any value, `0` included), else the TMDB rating while TMDB ratings is on and a score is held, else Unrated. It carries a **Rating source**, `household` or `tmdb`.
- **TMDB ratings** — the household preference: settings key `tmdb-ratings`, `Settings.tmdbRatings`, default `DEFAULT_TMDB_RATINGS = true`.
- **TMDB-marked stars** — how a `tmdb`-sourced rating is drawn: muted filled stars and a `TMDB` tag after the value.
- "Rating" keeps meaning the household's column alone; "effective/display/fallback rating" are not used.

### The arithmetic

- Rounding is `Math.round` on the client and `ROUND` cast to an integer in SQLite; both round a positive half up, so the stars and the order agree.
- A TMDB `vote_average` of `0` means no votes. `fetchedFields`' score reading answers `null` for it, so no Sync stores a `0` again.
- **Migration 13** sets `tmdb_score` to `NULL` where it is `0`, on both `movies` and `series`. No `vote_count` is fetched or thresholded.

### Modules

- **`shownRating`** (new, pure, `src/utils/`) — `(rating, tmdbScore, tmdbRatings) → { units, source } | null`. The one client reading of the Shown rating; four mappers in three features call it, which is why it is a util rather than a feature module. `RatingSource` (`'household' | 'tmdb'`) is exported from the shared view-model types.
- **`shownRatingSql`** (new, pure, `library/browse/`) — `(alias, tmdbRatings) → SQL` for the Shown rating's units: the household column coalesced with the rounded TMDB score while on, the household column alone while off. `fullDetails`' precedent: one spelling, read by both the movie browse and the series browse (which imports it).
- **Movie and series browse** — `highest-rated`'s order and the minimum-rating term are built from `shownRatingSql`. Each browse is composed in the library's composition root with a reader, `() => settings.settings().tmdbRatings`, asked per query, so `listMovies`, every Home section, the Series tab and the Genre page agree. The **Library query** is unchanged: the preference is not a query and is not on the URL or the wire.
- **Library settings** — a third preference key, `tmdb-ratings`, read through the one `valueOf`; `settings()` answers `tmdbRatings` with the default applied when the row is absent; `setTmdbRatings(on)` an upsert, `setUltrawideMargins`' twin. Factory reset's erase already takes the `settings` table, so the default returns.
- **Settings routes** — `GET /api/settings` answers `{ subtitleLanguage, ultrawideMargins, tmdbRatings }`. New `POST /api/settings/tmdb-ratings { value }` → `200 { value }`, a **Single-signal write**; `400` for anything but a boolean.
- **`DisplayPreferenceProvider` / `useDisplayPreference`** — the provider's one `fetchSettings` on mount now lands both display preferences; the hook answers `{ ultrawideMargins, setUltrawideMargins, tmdbRatings, setTmdbRatings }`. `setTmdbRatings` keeps `setUltrawideMargins`' bargain: shown at once, posted, the echo kept, put back on refusal, never rejecting. `null` (Blank until it lands, or no provider) reads as **off**, so a refused read never draws TMDB stars the maintainer switched off.
- **`saveTmdbRatings`** (new, `App/`) — the one write, over `postValue`, `saveUltrawideMargins`' twin; one caller, so it sits beside the provider rather than in `src/api/`.
- **`DisplaySection`** — the second row, _Fill in ratings from TMDB_, its line as in story 3, the same `Row` furniture and `Toggle`, reading and writing through `useDisplayPreference()`.
- **`StarRating` primitive** — gains `muted?: boolean` (filled stars in a neutral ink, not the accent) and `tag?: string` (a small uppercase word after the value, in the faint ink). Domain-free: it does not know what TMDB is.
- **`RatingPicker` component** — gains `placeholder?: number | null` (a percent) and `placeholderTag?: string`. While `value` is `null` and a placeholder is given: muted stars at the placeholder and the label `x / 5 <tag>` in place of `Not rated`. Hover preview stays in the accent. Any click sets the value — the segment equal to the placeholder sets it, never clears; _Clear rating_ is named only on the segment holding `value`.
- **The four mappers** — each gains a `tmdbRatings: boolean` parameter and calls `shownRating`:
  - the library card mapper and the series card mapper give `PosterCardMovie` its `rating` percent and a `ratingSource`;
  - the movie page's mapper gives `ratingPercent` (the household's, for the picker) and `tmdbPercent` (the TMDB rating while on, else `null`, for the placeholder);
  - the series page's mapper gives `ratingPercent` and `ratingSource`.
    Their callers read `useDisplayPreference().tmdbRatings` and pass `=== true`. The Movie form's value mapping is untouched.
- **`PosterCard` and `SeriesMetaLine`** — map `ratingSource === 'tmdb'` onto `StarRating`'s `muted` and `tag="TMDB"`. The movie page's meta line passes `tmdbPercent` as the picker's placeholder with `placeholderTag="TMDB"`.
- **`fetchedFields`** — the score reading answers `null` for `0`.
- **Migrations** — migration 13 as above.

### Decided against

- Storing TMDB's score into the household Rating — the way a family's rating gets overwritten.
- A merged rating on the record from the server — a flip would not redraw loaded screens, and the movie page needs the two apart.
- Colour alone, or a tooltip, to tell the sources apart.
- A _Use TMDB's_ control — clearing already falls through to TMDB's.
- The preference as a field on the Library query.

### Delivery

Seven thin slices, in this order (log 43, _Implementation Plan_):

1. **Prototype revision** (HITL) — `prim.StarRating` (`muted`, `tag`), `mol.RatingPicker` (`placeholder`, `placeholderTag`), `mol.PosterCard` (a TMDB-rated face), `page.SettingsPage` (the second Display row), `page.MoviePage` and `page.SeriesPage` (a TMDB-rated meta line) and `FamilyFlix.dc.html`. The inks are settled here, before anything is built.
2. **The preference** — key, `Settings.tmdbRatings`, the route, the provider, `saveTmdbRatings`, the Display row; the toggle flips and survives a reload.
3. **Shown on the cards** — `shownRating`, `StarRating`'s face, the two card mappers.
4. **Shown on the pages** — `RatingPicker`'s placeholder, the movie and series page mappers, `SeriesMetaLine`.
5. **Sort and filter** — `shownRatingSql`, both browses, the reader composed in the library.
6. **No votes** — the score reading and migration 13.
7. **Docs** — README, CLAUDE.md (step 26, the feature entries, the folder tree) and the glossary, ticked ✅ only after the refactor.

## Testing Decisions

A good test drives a unit through its public interface and asserts what a caller sees — a returned value, a rendered name or label, a response body, the rows a query answers — never which internal helper ran.

- **`shownRating`** — the full table: a household rating wins over any score (including a stored `0`); `null` rating with a score and the preference on gives `round(score)` and `tmdb`; preference off gives `null`; no score gives `null`; `x.5` rounds up. Prior art: the pure `utils/` suites (`gradientFromId`, `spellYearSpan`).
- **`shownRatingSql` and both browses** — against a real in-memory SQLite: _Highest rated_ orders a TMDB-only title among household ratings with the preference on and last with it off; the minimum rating keeps and drops accordingly; a title with neither stays last and is filtered out; `6.5` sorts with 3½ ★. Each test says which preference it runs under. Prior art: the existing `library/browse/` and `library/series/browse/` suites.
- **Library settings** — the default when absent, the upsert, reading back after a write; Factory reset returns the default. Prior art: the settings suite's Ultrawide margins cases and `resetDatabase`'s.
- **Settings routes** — `GET` carries `tmdbRatings`; `POST` echoes a boolean, `400` for a string, a number, `null` and a missing value. Prior art: the `ultrawide-margins` route tests.
- **`DisplayPreferenceProvider` / `useDisplayPreference`** — both values land from one read; `null` before it lands; the optimistic flip, the echo kept, the put-back on refusal, never rejecting. Prior art: the provider's Ultrawide margins suite.
- **`saveTmdbRatings`** — the posted body and the echo. Prior art: `saveUltrawideMargins`.
- **`DisplaySection`** — the second row's title, line and switch state; a press calls the setter. Prior art: its current suite.
- **`StarRating`** — `muted` changes the filled stars' ink off the accent (`resolvedStyle`), `tag` renders as readable text after the value; absent, nothing changes.
- **`RatingPicker`** — the placeholder face and label while `value` is `null`; no placeholder face once a value is set; a click on the placeholder's segment emits that value rather than `null`; _Clear rating_ named only on the value's segment; hover preview in the accent.
- **The four mappers** — the percent and source under both preferences, the movie page's `ratingPercent`/`tmdbPercent` pair kept apart. Prior art: the existing `view`, `seriesCardView`, `detailView` and `seriesView` suites.
- **`PosterCard`, `SeriesMetaLine`, the movie page's meta line** — a `tmdb` source draws the `TMDB` tag; a `household` one does not.
- **`fetchedFields`** — `vote_average: 0` yields a `null` score; `7.44` still yields `7.4`.
- **Migration 13** — a stored `0` becomes `NULL` on both tables, any other score is untouched. Prior art: the migration suites in `db/`.

## Out of Scope

- The TMDB score drawn as a number of its own beside the stars.
- A `vote_count` threshold.
- A `TMDB score` column in the Export, or reading one on import.
- A rating picker on the series page.
- Drawing the original title.
- Stars on the Continue card.
- Any change to what a Sync, an import or the Movie form writes.

## Further Notes

- The prototype revision comes first, per _The prototype is the spec_; the muted ink and the tag's ink are its decision, not this PRD's.
- A cold start draws household ratings only until the one settings read lands — accepted, so that a refused read never contradicts a preference switched off.
- Tests of `highest-rated` and the minimum rating now depend on a preference; every such test must state the one it runs under.
- The feature is ✅ in README and CLAUDE.md only after its refactor, not when the build issues close.
