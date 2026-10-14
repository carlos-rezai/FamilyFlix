> **Initiative:** `review-at-scale`
> **Design log:** `docs/design-logs/42-review-at-scale.md`
> **Issue:** #352 (the PRD, step 25)
> **Build order:** step 25, the first after Link or copy. It ships as nine thin slices (log 42, _Implementation Plan_)

## Problem Statement

TMDB keeps saying it has nothing for titles it plainly holds. A Sync reports _no result on TMDB_, and when I type the title into the review's search box I get zero hits too, though the film is right there on TMDB's own site. Worse, once a title is missed it feels as if the app stops trying: the next _Only what's missing_ Sync passes it by. A series I synced last year never gets the episode titles, stills or season poster of a season I added since.

Some seasons have no art at all, and there is nothing I can do about it. TMDB's default poster for that season is empty, the app takes that as final, and I can't give it one from TMDB's other images or from a file of my own.

And when an import goes wrong at scale, the review is unusable. After importing five real series it ran to more than 1,400 rows in one flat list: no way to see it by title, no way to see only one kind of row, and no way to settle a hundred identical rows except with a hundred presses.

## Solution

**Search finds what TMDB holds.** A Sync no longer asks TMDB once, literally. It climbs a **Search ladder** of up to four searches, stopping at the first that answers:

1. the title with its year;
2. the title without its year (a sheet's year one off TMDB's no longer answers nothing);
3. the title cleaned for TMDB (the **Search query**): release tags such as `BluRay`, `x264` and `WEB-DL` dropped, curly quotes and dashes folded, `&` read as _and_, other punctuation a space;
4. the part before a subtitle (`Star Wars: The Force Awakens` → `Star Wars`).

The review's search box climbs the same ladder. A match is still only written on its own when it is **Confident**; anything else becomes an `ambiguous` row with candidates to pick from, which beats _no result_. When nothing answers, the row says _Nothing on TMDB matched this title, with or without its year._ A Folder scan's title guess drops the release tags too, so `Heat.1995.1080p.BluRay.x264-GRP` is added as _Heat_.

**Only what's missing means anything missing.** A title is synced again by _Only what's missing_ whenever it has a **Sync gap**: it lacks a synopsis or a poster (as today), or it is **Unmatched** (no Sync ever matched it), or, for a series, an episode lacks its title, air date or still, or a season on disk lacks its poster. The Settings line _N of M titles have full details_ still means what it says.

**A long review reads as a short one.** In the Import review, rows that share a title collapse into one **Review group**, drawn as a new **Accordion**: the title, a count, the kinds' dots, closed until I open it. A title with one row looks exactly as today. Above the list, a **Kind filter** (pills: _All N_, then each kind with its count) shows one kind at a time, in both the Import review and the Sync's review. And three **Bulk actions** settle many rows in one press: _Skip all_ on a group's header and beside a chosen kind, _Import all as guessed_ when `no-row` is chosen, and _Keep all mine_ when `differs` is chosen. A copy failure no longer files one row per episode: a show whose episodes could not be copied is one `failed` row saying how many and why.

**Every season can have art.** Syncing one series shows a **Seasons** section in its review: each season on disk with its current poster beside up to ten TMDB posters, the season's own first, then the series' posters marked _Series poster_. One press sets that season's poster, replacing the one it had. The run itself also asks TMDB again in any language when the English default comes back empty. Offline, the series form (add and edit) gains a _Season posters_ list: one slot per season, filled from a file.

## User Stories

### Search finds what TMDB holds

1. As the maintainer, I want a Sync to try a title without its year when the search with it finds nothing, so that a sheet year one off TMDB's still finds the film.
2. As the maintainer, I want a Sync to try a title cleaned of punctuation TMDB doesn't fold, so that `F'ck That's Delicious` finds TMDB's `F*ck, That's Delicious`.
3. As the maintainer, I want a Sync to drop release tags (`BluRay`, `x264`, `WEB-DL`, `REMUX`, a release group after them) from the query, so that a title named off a folder still finds its film.
4. As the maintainer, I want curly quotes and dashes folded to plain ones and `&` read as _and_, so that a title typed on a Mac or copied from a web page searches the same.
5. As the maintainer, I want a Sync to try the part before a subtitle when everything else fails, so that a long title TMDB spells differently still offers candidates.
6. As the maintainer, I want the search to stop at the first attempt that answers, so that a title found first time costs one request as before.
7. As the maintainer, I want at most four searches per title, so that a Sync over titles TMDB truly lacks stays bounded.
8. As the maintainer, I want an attempt that repeats an earlier one skipped, so that a title with no year or no punctuation isn't searched twice for nothing.
9. As the maintainer, I want a match still written on its own only when it is Confident (one result, the same title key, the same year when I have one), so that a looser search never writes a wrong film silently.
10. As the maintainer, I want a looser attempt's several results shown as an `ambiguous` row with candidates, so that I can pick the right film rather than being told there is none.
11. As the maintainer, I want the Activity log to say `↳ found as “Star Wars”` when a later attempt answered, so that I can see why a title matched.
12. As the maintainer, I want a title nothing matched to read _Nothing on TMDB matched this title, with or without its year._, so that I know the app tried more than once.
13. As the maintainer, I want the review's search box to climb the same ladder over what I typed, trimmed, so that typing a title with stray spaces or punctuation still finds it.
14. As the maintainer, I want a failed connection on any attempt to stop the search and say TMDB wasn't reached, so that a network problem is never reported as _no result_.
15. As the maintainer, I want a series' look-up to climb the ladder too, so that shows are found as reliably as films.
16. As the maintainer, I want a Folder scan to name `Heat.1995.1080p.BluRay.x264-GRP` as _Heat_, so that titles named off folders are clean in the library and in the search.

### Trying again

17. As the maintainer, I want a title no Sync ever matched to be searched again by every _Only what's missing_ Sync, so that a title missed once is not missed for good.
18. As the maintainer, I want that to hold even when the title already has a synopsis and a poster (from the sheet or the folder), so that a well-described but unmatched title still gets its TMDB match.
19. As the maintainer, I want a series with an episode lacking its title, air date or still to be synced again, so that a season added after the last Sync gets its details.
20. As the maintainer, I want a series with a season on disk lacking its poster to be synced again, so that a new season gets its art.
21. As the maintainer, I want a matched series re-read by its TMDB id rather than searched again, so that a gap is filled without new Decisions.
22. As the maintainer, I want the Settings line _N of M titles have full details_ to keep counting what it counts, so that the number I know doesn't change meaning.
23. As the maintainer, I want the scope cards' counts to reflect the titles that will actually be synced, so that _Only what's missing_ tells me how much work the run is.

### Season art from TMDB

24. As the maintainer, I want a Sync to ask TMDB again in any language when a season's English poster is empty, so that a season with art only in another language gets it.
25. As the maintainer, I want a single-series Sync's review to show a Seasons section, so that I can choose each season's poster.
26. As the maintainer, I want each season shown as `S02` with its current poster (or the gradient) beside TMDB's choices in a horizontal row, so that I can compare before choosing.
27. As the maintainer, I want the season's own posters first and the series' posters after them marked _Series poster_, so that I can fall back to the show's art knowingly.
28. As the maintainer, I want at most ten choices per season, so that the row stays scannable.
29. As the maintainer, I want one press to set that season's poster, replacing the one held, so that I can correct a poor default.
30. As the maintainer, I want the chosen poster on the series page's Season card at once, so that I see the result.
31. As the maintainer, I want the Seasons section drawn on _All done_ too, so that I can choose art even when the Sync needed nothing else from me.
32. As the maintainer, I want a library-wide Sync's review to stay a list of titles only, so that a whole-library review isn't buried under seasons.
33. As the maintainer, I want a choice I press to be one TMDB actually offered for that season, so that the app never stores an arbitrary image.
34. As the maintainer, I want a press made while TMDB can't be reached to tell me so and leave the poster as it was, so that a failed press never blanks a season.
35. As the maintainer, I want an automatic Sync still never to replace a season poster I hold, so that only my press replaces art.

### Season art from a file

36. As the maintainer, I want the series edit to show a _Season posters_ list under the series poster, one slot per season the episode rows hold, so that I can give a season art offline.
37. As the maintainer, I want a held season poster to show in its slot and travel back as its path, so that saving without touching it changes nothing.
38. As the maintainer, I want to pick an image file for a season's slot, so that a season TMDB has nothing for can still have art.
39. As the maintainer, I want ✕ on a slot to take a season's poster away, so that I can remove a wrong one.
40. As the maintainer, I want the same list when adding a series, so that a new show can arrive with its season art.
41. As the maintainer, I want a season slot to appear and disappear as episode rows for that season are added or removed, so that I'm never offered a slot for a season the show doesn't have.
42. As the maintainer, I want a non-image file refused as the poster slot refuses one today, so that the store's boundary holds.
43. As the maintainer, I want the series save to stay one atomic request, rolled back whole on any refusal, so that a refused season poster never leaves a half-saved series.
44. As the maintainer, I want the Season page to stay without art, so that this change doesn't redesign it.

### The review's shape

45. As the maintainer, I want a show whose episodes couldn't be copied to file one `failed` row naming the show, so that a full disk doesn't fill the review with one row per episode.
46. As the maintainer, I want that row to say how many episodes failed and the first error (`3 episodes couldn't be copied: no space left on device.`), so that I know the cause.
47. As the maintainer, I want that row's detail to list the episodes that failed, so that I can see which.
48. As the maintainer, I want _Resolve_ on that row to open the Series Resolve when the series is held, else the form as today, so that I can retry from the review.
49. As the maintainer, I want a film's `failed` row unchanged, so that nothing I knew moves.
50. As the maintainer, I want every kind filed at most once per Source folder, Sheet row or Show folder, so that the review grows with titles, not with files.
51. As the maintainer, I want rows sharing a title collapsed into one group with a count, so that a thousand rows read as a few dozen groups.
52. As the maintainer, I want a group closed until I open it, so that the list is short on arrival.
53. As the maintainer, I want each kind's dot shown on a group's header, so that I can tell what's inside without opening it.
54. As the maintainer, I want a title with one row drawn as its bare row exactly as today, so that a short review looks unchanged.
55. As the maintainer, I want groups holding a hard kind first and groups of only soft kinds (`missing-meta`, `differs`) after them, so that what must be fixed comes first.
56. As the maintainer, I want a group's header to be a button I can open by keyboard, announced as expanded or collapsed, so that the review is accessible.
57. As the maintainer, I want a group's header to signal hover, press and focus as every control does, so that it feels like the rest of the app.
58. As the maintainer, I want a group whose last row is settled to disappear, so that the list shrinks as I work.
59. As the maintainer, I want the Sync's review left ungrouped, so that its one row per title stays a plain list.

### The Kind filter

60. As the maintainer, I want pills above the review reading _All N_ then each kind present with its count, so that I can see the review's make-up at a glance.
61. As the maintainer, I want to press a kind's pill to see only that kind, so that I can work through one sort of problem at a time.
62. As the maintainer, I want the pills in the glossary's order (import: `no-folder`, `ambiguous`, `no-video`, `no-row`, `failed`, `unplaced`, `missing-meta`, `differs`; Sync: `ambiguous`, `missing`, `conflict`), so that their order never shifts under me.
63. As the maintainer, I want the filter drawn only when the list holds two kinds or more, so that a simple review isn't cluttered.
64. As the maintainer, I want a kind's pill to go when its last row is settled, and the filter to fall back to _All_, so that I never stare at an empty filter.
65. As the maintainer, I want the filter in the Sync's review too, so that a large Sync can be worked by kind.
66. As the maintainer, I want the filter kept out of the URL, so that the review stays a step of a run, not a page to link to.

### Bulk actions

67. As the maintainer, I want _Skip all_ on a group's header, so that I can dismiss every row of a title in one press.
68. As the maintainer, I want _Skip all_ beside the filter when a kind is chosen, so that I can dismiss every row of that kind in one press.
69. As the maintainer, I want _Import all as guessed_ beside the filter when `no-row` is chosen, so that every folder the sheet didn't name is imported under its guessed title in one press.
70. As the maintainer, I want _Import all as guessed_ to follow the run's Import mode, so that bulk-imported titles are linked or copied like their neighbours.
71. As the maintainer, I want a row that _Import all as guessed_ can't settle to stay in the list, redrawn as its new problem, so that nothing is lost silently.
72. As the maintainer, I want _Keep all mine_ beside the filter when `differs` is chosen, so that I can keep every value of mine in one press.
73. As the maintainer, I want _Skip all_ beside the Sync review's filter, so that I can let a kind of Decision go at once.
74. As the maintainer, I want bulk actions to need no confirmation, as Skip needs none today, so that settling a list is quick; running the import again undoes them.
75. As the maintainer, I want the review redrawn from the answer to a bulk press, so that what I see is exactly what the server holds.
76. As the maintainer, I want a row settled meanwhile passed over rather than failing the press, so that a bulk press never errors because I was quick.

### Edge cases

77. As the maintainer, I want a bulk press after the run has been let go answered as _no run_, so that a stale screen can't act on nothing.
78. As the maintainer, I want a review with zero rows to show _All done_ as today, with no filter drawn, so that the empty state is unchanged.
79. As the maintainer, I want the open groups and the chosen filter lost on reload, as the review's scroll is, so that nothing new is persisted.

## Implementation Decisions

### Prototype first

The first slice amends the prototype, per _The prototype is the spec_: a new `mol.Accordion.dc.html`; `feat.ImportFlow.dc.html` (the Kind filter, the Review groups, the bulk buttons, the folded `failed` row); `feat.EnrichmentFlow.dc.html` (the Kind filter, _Skip all_, the Seasons section); `feat.MovieForm.dc.html` (_Season posters_); `FamilyFlix.dc.html` with them, and `COMPONENT-SPEC.md` (`Accordion`, `SeasonChoices`). Nothing else is built until it lands.

### The Search ladder (log 42 Q3–Q8)

- **`searchQuery(title)`** and **`RELEASE_NOISE`** live beside `titleKey` in `import-export/`, the one heuristic tuned against real folder names. `searchQuery` applies `titleGuess`'s tail strip, then drops Release noise (whole words, and everything after the first of them), folds curly quotes and dashes to ASCII, reads `&` as `and`, and makes every other non-letter-or-digit a space. `titleGuess` drops Release noise too.
- **`searchLadder(title, year) → SearchRung[]`**, `SearchRung = { query, year }`, is a new pure unit in `enrichment/`. Its rungs in order: title with year; title without year; `searchQuery(title)` without year; the part before a `:` or `-` subtitle when it has two words or more, without year. A rung equal to one already listed is dropped. At most four.
- **`searchTitled(apiKey, kind, rungs, signal) → TmdbOutcome<{ rung, results }>`** inside `createEnrichment` climbs the rungs, stopping at the first with results; `unreachable` or `refused` on any rung stops the climb and is the outcome. The TMDB client stays one request per call; its seam is not widened.
- The film look-up, the series' look-up and the review's search box all climb it: the look-ups over `searchLadder(title, year)`, the box over `searchLadder(query.trim(), null)`.
- **Confident is unchanged**: read over whichever rung answered.
- `NO_MATCH_REASON` becomes _Nothing on TMDB matched this title, with or without its year._; `noMatchFor(query)` is unchanged. When a rung after the first answers, the run logs an `info` Log line `↳ found as “<query>”`.

### The Sync gap (Q9–Q10)

- `missing` scope = titles with a **Sync gap**, spelled once as SQL, `syncGap(alias)`, in `library/enrich/` beside `fullDetails`. A gap is: not Full details; or Unmatched (`tmdb_id IS NULL`); or, for a series, an episode with no title, no air date or no Still, or a Season on disk with no Season poster.
- `moviesInScope` and `seriesInScope` read it. **Full details** and its Settings count are unchanged.
- A matched series with a gap is re-read by its `tmdb_id` (detail plus one season request per season), never searched, never a Decision. No "tried and failed" memory is added.

### `failed` per show (Q11)

- A show's episode copies that throw file **one** `failed` Problem titled with the show; its reason is the count and the first error, its detail lists the episodes. A film's `failed` is unchanged.
- Its _Resolve_ is the Series Resolve when the series is held, else the existing form; _Skip_ is Dismiss.
- The rule **at most one Problem per kind per Source folder, Sheet row or Show folder** is held by a guard in the importer's suite.

### The Accordion (Q12)

- `components/Accordion/`, a molecule translating `mol.Accordion`: a header button (chevron, label, count pill, optional trailing `actions`) over `children`, `aria-expanded` and `aria-controls`, the body unmounted while closed.
- Controlled, `PillTabs`' and `Toggle`'s rule: `{ label, count, expanded, onToggle, actions?, children }`.
- A **Control** under the Interaction contract (`controlStates`), not a Card. Domain-free; re-exported from the components barrel. Not `<details>`, because the filter and the bulk press must drive the open state.
- `CodecManager`'s suite assertion that there is no accordion is about the Codecs row; it is re-read and kept true of that screen.

### Review groups and the Kind filter (Q13–Q15)

- **`reviewGroups(problems, filter)`**, pure, in `importView/`: Problems grouped by `title`, hard-kind groups first in the run's order, soft-only groups after. A group of one is drawn as the bare Problem row; two or more as one Accordion, closed by default, its label line carrying each kind's dot. The snapshot is unchanged: grouping is the client's.
- The Sync's review is filtered, not grouped.
- The **Kind filter** is `PillTabs` above the list in both reviews: _All N_ then one pill per kind present with its count, in the glossary's order; drawn only with two kinds or more; screen state, not in the URL; a pill whose kind empties goes, and the filter falls back to _All_.

### Bulk actions (Q16–Q17)

| Route                                                      | Answer                              |
| ---------------------------------------------------------- | ----------------------------------- |
| `POST /api/import/current/problems/dismiss { ids }`        | `200 ImportRun` · `400` · `404`     |
| `POST /api/import/current/problems/import-guessed { ids }` | `200 ImportRun` · `400` · `404`     |
| `POST /api/enrichment/current/decisions/dismiss { ids }`   | `200 EnrichmentRun` · `400` · `404` |

- Each answers the whole snapshot, so the screen redraws from the echo (the Codec report's precedent).
- `400` for an `ids` that is not a non-empty string array, read in `importBody` / `enrichmentBody`, each refusal a sentence. An id not held is passed over, not refused. `404` with no run.
- `import-guessed` runs each row through `importFromReview` in order under the run's Import mode; a row that redraws stays, redrawn.
- _Skip all_ (group header, and beside a chosen kind) and _Keep all mine_ (beside `differs`) both post `dismiss`; _Import all as guessed_ (beside `no-row`) posts `import-guessed`. No confirm.
- `useImportRun` gains `skipMany(ids)` and `importManyAsGuessed(ids)`; `useEnrichmentRun` gains `skipMany(ids)`. Each api call lives in its feature's `api/`, one caller each.

### Season choices (Q18–Q20)

- The TMDB client gains `seasonImages(key, id, n, signal)` and `seriesImages(key, id, signal)` → `TmdbOutcome<{ file_path, vote_average }[]>`, ordered by vote, values never throws. Each asks `include_image_language=en,null` and, when that answers none, again with no language filter.
- `planSeason`'s run gains the same retry: when `season()` answers `poster_path: null`, the season's images are asked with no language filter. The run still never replaces a held Season poster and never raises a Decision for one.
- `EnrichmentRun` gains `seasons?: SeasonChoice[]` (shared enrichment types, both build targets), set only on a `single` run over a series:

  ```ts
  interface SeasonChoice {
    season: number;
    posterUrl: string | null; // the held Season poster, through imageUrl
    choices: { path: string; url: string; source: 'season' | 'series' }[];
  }
  ```

  At most ten choices: the season's own, then the series' posters.

- `POST /api/enrichment/current/seasons/:season/poster { path }` → `200 SeasonChoice`: the image streamed through `Media.storeNamed` as `S02-poster.jpg`, overwriting, then `setSeasonPoster`'s upsert. `400` for a path not among that season's choices; `404` without a single-series run or that season; `503` when TMDB is not reached.
- `useEnrichmentRun` gains `chooseSeasonPoster(season, path)`. A new organism-level unit, `features/enrichment/SeasonChoices/`, draws the section above the Decision rows and on _All done_, `CandidatePicker`'s face with no score.

### Season posters from a file (Q21)

- `SeriesFormFiles` gains a _Season posters_ list under the series poster: one poster slot per Season the episode rows hold; a held one travels as its path, a picked one as bytes, ✕ takes one away.
- On the wire, `PATCH /api/series/:id` and `POST /api/series` gain a `seasonPoster` field (`{ season, path? }`) followed, for a picked file, by a `seasonPosterFile` part, paired by order in `seriesFormBody` (the `episode` precedent). A `seasonPoster` with no path and no file removes that season's poster. `fileKinds`' image rule is the boundary; the request stays atomic.
- The Season page still draws no art.

### Slices (log 42, _Implementation Plan_)

1. **Prototype.**
2. **The Search ladder.** `searchQuery`, `RELEASE_NOISE`, `searchLadder`, `searchTitled`; the look-ups and the review box climb it; the new reason and log line. Thinnest end-to-end: a title one year off TMDB's is now Confident.
3. **The Sync gap.** `syncGap`, both in-scope reads.
4. **`failed` per show** and the per-source guard.
5. **The Accordion and the review.** `components/Accordion/`, `reviewGroups`, the Kind filter in both reviews.
6. **Bulk actions.** The three routes, the hooks' calls, the buttons.
7. **Season choices.** `seasonImages`, `seriesImages`, the `planSeason` retry, `SeasonChoice` on the run, the route, the Seasons section.
8. **Season posters from a file.** `seriesFormBody`'s pairing, the `SeriesFormFiles` list.
9. **Docs.** README, CLAUDE.md (step 25, feature entries, the folder tree's `searchLadder/` and `components/Accordion/`, the new routes) and the glossary, ticked ✅ only after the refactor.

## Testing Decisions

A good test drives a unit through its public surface and asserts what a caller sees: the queries TMDB was asked and in what order, a run's snapshot and the library's records afterwards, a route's status and body, what a screen draws and what a press posts. It never asserts how `createEnrichment`'s or `createImporter`'s closures are arranged.

- **`searchQuery` / `RELEASE_NOISE`** get table rows in `titleKey`'s suite: each noise spelling, the release group after it, curly quotes, dashes, `&`, and `F'ck That's Delicious`. **`titleGuess`** gains `Heat.1995.1080p.BluRay.x264-GRP` → _Heat_.
- **`searchLadder`** gets a pure table suite: four rungs for a full title, duplicates dropped (no year, no punctuation, no subtitle), the subtitle rung refused under two words, `:` and `-` both cut.
- **`createEnrichment`**, over `fakeTmdb` (every call recorded): a title one year off answers Confident on rung 2; a punctuation title on rung 3; rung 4 lands as `ambiguous`; the climb stops at the first answer; `unreachable` on rung 2 stops it and is the outcome; the new `missing` reason; the `↳ found as` log line; the review box trims and climbs with no year; series look-ups climb too.
- **`syncGap`** gets storage suites (`enrich.test.ts` prior art): an Unmatched film with Full details is in scope; a matched complete series is not; one with an episode lacking a still, or a season lacking a poster, is; Full details' count is unchanged.
- **`createImporter`**: one `failed` Problem per show with the count, first error and episode list; and the guard, a generated tree of five shows × eight seasons × twenty episodes with every copy failing, holding at most one Problem per kind per source.
- **`tmdbClient`**: `seasonImages` and `seriesImages` ask `include_image_language=en,null` then retry without; ordered by vote; outcomes, never throws. **`planSeason`**: the retry on a `null` poster, still never replacing.
- **Routes** (`routes.import`, `routes.enrichment` prior art): each bulk route's `200` echo, `400` sentences, `404` with no run, an unknown id passed over; `import-guessed` under the run's mode with a redrawn row kept; the Season poster route's `200`, `400` for a path not offered, `404`, `503`; `PATCH` / `POST /api/series` with `seasonPoster` held, picked, removed and refused (non-image), rolled back whole.
- **Client**, Testing Library with `fakeResponse`:
  - `Accordion`: button semantics, `aria-expanded` / `aria-controls`, body unmounted while closed, `onToggle`, the actions slot, count; `resolvedStyle` for the Control's states (the `PillTabs` / `Toggle` prior art).
  - `reviewGroups`: pure suite, grouping, order, filter.
  - `ImportReview` and `EnrichmentReview`: the filter appears at two kinds, falls back to _All_ when a kind empties; a group of one is the bare row; each bulk button posts its route with the right ids and redraws from the echo.
  - `useImportRun` / `useEnrichmentRun`: `skipMany`, `importManyAsGuessed`, `chooseSeasonPoster`.
  - `SeasonChoices`: one card per season, held poster or gradient, at most ten choices, _Series poster_ marking, a press posts and redraws.
  - `SeriesFormFiles` / `useMovieForm`: one slot per season present, held travels as path, picked as a part, ✕ removes.

## Out of Scope

- Converting a title's kind (a film that is really a series, or the reverse).
- A **Rematch** of a title holding a wrong `tmdb_id`.
- Persisting Decisions or Problems across restarts; remembering "tried and failed".
- An automatic series-poster fallback on the Season card: the series' posters are only ever a choice.
- Art on the Season page.
- Grouping the Enrichment review.
- Fuzzy matching of our own, or `search/multi`.
- A Seasons section in a library-wide Sync.

## Further Notes

- The new and amended terms (**Search ladder**, **Search rung**, **Search query**, **Release noise**, **Unmatched**, **Sync gap**, **Accordion**, **Review group**, **Kind filter**, **Bulk action**, **Season choice**; **Enrichment scope**, **Season poster**) are in `docs/ubiquitous-language.md` already, from log 42.
- The accepted cost: a Sync makes up to four searches for a title TMDB truly lacks, and re-reads matched series whose gap TMDB can't fill, on every _Only what's missing_; the noise list is a heuristic that will gain rows; the open groups and the chosen filter are lost on reload.
