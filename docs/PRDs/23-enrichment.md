## Problem Statement

I am the maintainer, and my family are the people who use this app. The
library is in — every film and show the old spreadsheet named, copied into
managed storage by **Bulk import** — but most of it is thin:

- **The sheet never had the words.** A title, a year, a genre or two. Most
  movies have no synopsis, no director, no cast; the detail page's hero is a
  heading over nothing.
- **Most folders never had the pictures.** A film whose **Source folder** held
  no `poster.*` draws the **Gradient fallback** on every shelf, and almost
  nothing has a **Backdrop**, because only a `fanart.*` in the folder could
  give it one.
- **Episodes are numbers.** A show imported from `S01E03.mkv` files has
  episodes with no title, no air date and no picture — a season page of
  `S01E03` rows over gradients.
- **Typing it by hand is the only way.** The **Movie form** can take every one
  of these fields, one film at a time. Nobody is going to type a thousand
  synopses, and the form cannot take an episode at all.

The Movie Database already knows all of it. The prototype revision of
2026-09-22 draws the feature (COMPONENT-SPEC §5a): a **Network group** in
Settings where a TMDB key is pasted and tested, a _Sync with TMDB_ screen in
the importer's three-step shape, and two more ways in — a checkbox on Import
setup and a _Fetch from TMDB_ item in the movie's ⋯ menu. It is step 6 of the
build order, the last that needs nothing of Electron, and it goes after Series
so that it enriches series too.

## Solution

**Enrichment fills what the sheet left blank from TMDB, over the library
already imported** — the first and only feature that goes online. It is a
pass keyed by title and year, never a second scanner, and the household
**Rating** is never touched.

- **A key, tested once.** Settings gains a **Network group** between Playback
  and Storage: the **TMDB key** field (a v3 API key or a v4 Read Access Token,
  both accepted) with _Test connection_. The test is the save — the key is
  stored only when TMDB accepts it, and the pill reads _Connected_.
- **A sync in three steps.** `/enrich` — **setup** (what to sync, which fields
  to fill, where it is saved), **running** (a determinate bar, the Activity
  log, elapsed and ETA, _Stop_), **review** (two tiles over the titles that
  need a human). Three **Enrichment scopes**: _Only what's missing_ (titles
  without **Full details**, gaps filled and nothing questioned), _Everything_,
  and _Just this movie_ from its ⋯ menu.
- **Confident titles are written during the run.** A title whose search
  returns exactly one candidate with an equal **Title key** (and year) gets
  its fields, its `tmdb_id`, and its poster and backdrop copied into its Movie
  folder without a look. Everything else becomes a **Decision**: `ambiguous`
  (pick a poster), `missing` (search by title), or `conflict` (TMDB disagrees
  with something you typed — choose per field, TMDB by default). Every
  Decision has _Skip_.
- **Series too.** A series gets the same fields at show level; each episode on
  disk gets its title, air date, runtime and **Still** — the still drawn in
  the season page's episode row. Episodes never raise a Decision.
- **Offline-first still holds.** Every image is downloaded into the Managed
  media directory, so a poster draws with the cable out. The only images shown
  straight from TMDB are the candidate posters in the review.
- **Optionally, back into the collection.** If the app remembers the **Library
  root** (the importer now records it), a sync can also write the **Metadata
  sheet** — `familyflix-metadata.csv`, the Export file — to the root and a
  `poster.jpg` into each Source folder. Each is a toggle, each is checked for
  write permission with a dry-run log line first, and neither ever replaces a
  file that exists.
- **The Snackbar stack gets its first caller.** The prototype draws six
  notices on these paths — the key test, a Start with no key, a pick, an apply
  and a search — and 1:1 raises them.

## User Stories

### The TMDB key (Settings → Network)

1. As the maintainer, I want a Network group in Settings between Playback and Storage, so that the one online feature has one obvious home.
2. As the maintainer, I want the group to say "Nothing is sent about your household — just movie titles, to look up posters and synopses", so that I know what leaves the machine before I turn it on.
3. As the maintainer, I want to paste my TMDB key into a masked field in mono, so that it is legible to me but not to someone over my shoulder.
4. As the maintainer, I want either the v3 API key or the v4 Read Access Token that TMDB's settings page shows me to work, so that I cannot pick the wrong one.
5. As the maintainer, I want _Test connection_ to check the key with TMDB and save it only if TMDB accepts it, so that a mistyped key is never stored.
6. As the maintainer, I want the button to read _Testing…_ while it asks and _Test again_ once a key is connected, so that I know what pressing it will do.
7. As the maintainer, I want the status pill to read _Connected_ when a stored key is in the field, so that I can see at a glance the sync can run.
8. As the maintainer, I want typing in the field to flip the pill to _Not set up_, so that an edited key is not mistaken for the tested one.
9. As the maintainer, I want _Connected to TMDB._ as a success notice when the key is accepted, so that I know the test worked.
10. As the maintainer, I want _Paste a key first._ as a warning when I press Test on an empty field, so that I know why nothing happened.
11. As the maintainer, I want _TMDB didn't accept that key._ as an error when TMDB refuses it, so that I know to copy it again.
12. As the maintainer, I want _Couldn't reach TMDB._ as an error when TMDB does not answer, so that I do not blame the key for a dead connection.
13. As the maintainer, I want the stored key shown masked when I come back to Settings, so that I can see one is set.
14. As the maintainer, I want the key never sent anywhere but TMDB and my own Settings screen, so that the player and every other read never carry it.

### Getting to a sync

15. As the maintainer, I want a _Sync metadata & posters_ row under the key, so that the sync is one press from where I set it up.
16. As the maintainer, I want that row's line to read `Last synced 2 minutes ago · 412 of 480 titles have full details.`, so that I know whether a sync is worth running.
17. As the maintainer, I want the line to drop the _Last synced_ half when no sync has ever finished, so that it never shows an invented date.
18. As the maintainer, I want _Last synced_ to read _just now_, _N minutes ago_, _yesterday_ or the date, so that it reads like a person wrote it.
19. As the maintainer, I want _⟳ Fetch from TMDB_ in a movie's ⋯ menu between _Edit details_ and the Danger row, so that I can fix one film without syncing the library.
20. As the maintainer, I want an _Also fetch metadata and posters from TMDB_ checkbox over _Start import_, so that a fresh import can be enriched straight after.
21. As the maintainer, I want the checkbox's hint to say _Runs straight after the import, over everything it brings in. Needs the internet._ when a key is set, so that I know what ticking it does.
22. As the maintainer, I want the hint to say _Needs a TMDB key — add one under Settings → Network first._ when none is, so that I know why it will not work yet.
23. As the maintainer, I want _Finish_ on an import with the box ticked to take me to the sync's setup with _Everything_ selected, so that I see what will happen before anything goes online.
24. As the maintainer, I want the ticked box to survive leaving and re-attaching to a running import, so that Finish still knows what I asked for.
25. As the maintainer, I want Back from the sync to go to Settings — or to the movie when I came from its menu — so that Back always lands somewhere that makes sense.

### Setup

26. As the maintainer, I want the heading _Sync with TMDB_ with a key badge and a lede, so that the screen reads as the importer's sibling.
27. As the maintainer, I want an offline banner in a danger tint with _Retry_ when TMDB cannot be reached, so that I know why Start is quiet.
28. As the maintainer, I want "offline" to mean TMDB did not answer, asked by the app, so that a Wi-Fi with no internet is not reported as online.
29. As the maintainer, I want a key banner with _Open Network settings_ when no key is set, so that the fix is one press away.
30. As the maintainer, I want two scope cards — _Only what's missing_ and _Everything_ — each with its count, so that I can see how big each sync is.
31. As the maintainer, I want _Only what's missing_ to cover titles with no synopsis or no poster, so that the default sync is about the gaps I can see.
32. As the maintainer, I want _Only what's missing_ to fill empty fields and never question a filled one, so that I am not asked about my own typing when I only asked for gaps.
33. As the maintainer, I want _Everything_ to cover every movie and series, filling gaps and asking about differences, so that I can bring a hand-typed library into line.
34. As the maintainer, I want _Just this movie_ to replace the other two cards when I came from a movie's menu, so that I cannot sync the library by accident.
35. As the maintainer, I want ten field chips — Synopsis, Poster, Backdrop, Runtime, Year, Genres, Director, Cast, Original title, TMDB score — so that I choose what is filled.
36. As the maintainer, I want a chip switched off to mean that column is never written this sync, so that a field I trust is safe.
37. As the maintainer, I want the setup to say a series gets the same fields at show level plus episode titles, air dates and stills, so that I know shows are included.
38. As the maintainer, I want a line saying ★ ratings are never touched, so that I trust the sync with the family's scores.
39. As the maintainer, I want _Where it is saved_ to list _Your library_ as required, so that I know the database is always the target.
40. As the maintainer, I want a toggle for the Metadata sheet with the library root's path in mono, so that I choose whether a sheet lands in my collection.
41. As the maintainer, I want a toggle for `poster.jpg` in each movie folder, so that I choose whether my collection gets its covers.
42. As the maintainer, I want the two toggles not drawn when the app does not know my library root, so that I am never offered a write it cannot do.
43. As the maintainer, I want an estimate beside Start — `About 12s for 30 titles` — so that I know whether to wait or walk away.
44. As the maintainer, I want the estimate to read _Waiting for a connection_ offline and _A key is needed before this can run_ with no key, so that the line explains a quiet Start.
45. As the maintainer, I want Start to turn primary only when a key is set and TMDB answers, so that its look tells me it is ready.
46. As the maintainer, I want Start with no key to take me to Settings with _Add your TMDB key here first._, so that it is never a dead button.
47. As the maintainer, I want Start offline to do nothing, so that I am not taken anywhere by a connection problem.
48. As the maintainer, I want nothing drawn on the setup until its read lands, so that I never see a count of zero that is not true.

### Running

49. As the maintainer, I want a determinate bar counting titles done of titles total, so that I can see how far it has got.
50. As the maintainer, I want the current title, elapsed time and an ETA, so that I know what it is doing and how long is left.
51. As the maintainer, I want a stat line of how many were enriched and how many need a decision, so that I know what review will hold.
52. As the maintainer, I want the Activity log's lines — _Contacting api.themoviedb.org …_, _Looking up N titles by name and year._, _✓ Matched Title (Year)_, _⚠ … several possible matches_, _⚠ … no result on TMDB_, _⚠ … differs from what you filled in_, _↓ poster.jpg → path_ — so that I can watch it work.
53. As the maintainer, I want each confident title written during the run, so that what was fetched survives a stop or a crash.
54. As the maintainer, I want the poster and backdrop downloaded into the title's own folder in managed storage, so that they draw offline.
55. As the maintainer, I want a title once matched to be fetched by its TMDB id next time and never searched for again, so that a second sync is exact and quick.
56. As the maintainer, I want to leave the screen and come back to a running sync, so that I am not trapped on it.
57. As the maintainer, I want _Stop_ to end the sync and return to setup, keeping everything already written — and the line beside it to say so, so that stopping is safe.
58. As the maintainer, I want a dropped connection mid-sync to end the run into review with _Lost the connection — stopped. Anything already fetched is kept._, so that a Wi-Fi blip is not a crash.
59. As the maintainer, I want TMDB refusing the key mid-sync to end it the same way with _TMDB refused the key._, so that I know to test the key again.
60. As the maintainer, I want a second sync refused while one runs, so that two runs never write over each other.

### Review

61. As the maintainer, I want two tiles — _movies enriched_ and _need your decision_ — so that I see the outcome at once.
62. As the maintainer, I want _All done_ when nothing needs a decision, so that I know I can leave.
63. As the maintainer, I want each Decision as a card with a dot by kind, the title, the reason and its source path, so that I can recognise the film.
64. As the maintainer, I want an `ambiguous` row to show up to three candidates as posters with year, genre, language and _% match_, so that I can pick the right release by eye.
65. As the maintainer, I want the reason to say _{n} releases share this title — pick the right one._, so that I know why I am asked.
66. As the maintainer, I want picking a candidate to write it and raise _Match saved._, so that one press settles the film.
67. As the maintainer, I want a dashed _Search by title_ card in the picker that swaps in a search box prefilled with the title, so that I can look when none of the three is right.
68. As the maintainer, I want a `missing` row to show the search box with _Nothing on TMDB matched this title._, so that I can try a different spelling.
69. As the maintainer, I want a search to raise _Searching TMDB…_ and answer candidates in the same picker, so that searching and picking are one motion.
70. As the maintainer, I want a search with no results to keep the box and say _Nothing on TMDB matched “{query}”._, so that I can try again.
71. As the maintainer, I want a `conflict` row to show each differing field as _Yours | TMDB_ with TMDB chosen by default, so that I can accept TMDB's answer with one press or keep mine per field.
72. As the maintainer, I want only Synopsis, Year, Genres, Director and Cast ever to conflict, so that I am never asked to diff a picture or TMDB's own score.
73. As the maintainer, I want differences in case, spacing or order of genres and cast not to count, so that I am not asked about nothing.
74. As the maintainer, I want a conflicting title's empty fields filled at once, so that only the real disagreements wait for me.
75. As the maintainer, I want _Apply choices_ to write what I chose and raise _Details updated._, so that I know it took.
76. As the maintainer, I want _Keep all mine_ to leave the title as it is, so that TMDB never overrides me unasked.
77. As the maintainer, I want _Skip_ on every row, so that I can leave a title for another day.
78. As the maintainer, I want a settled row to leave the list and count into _movies enriched_, so that the list shrinks as I work.
79. As the maintainer, I want _Done_ (or _Back to the movie_) to leave by the same rule as Back, so that the review ends where I came from.
80. As the maintainer, I want _Sync again_ to drop the finished run and show setup, so that I can go round again with different fields.
81. As the maintainer, I want _Saved to …_ to name the sheet and posters when they were written, so that I know what landed in my collection.

### Series and episodes

82. As the maintainer, I want a series matched by its title and first year and given the same fields as a movie, its Director being its creator, so that shows fill in the same way.
83. As the maintainer, I want a series' year range filled from TMDB's first and last air dates, so that `2019–2023` is right.
84. As the maintainer, I want every episode on disk to get its title and air date when empty, so that the season page reads like a TV guide.
85. As the maintainer, I want every episode to get its still under the Poster chip and its runtime under Runtime, so that the chips mean the same thing for shows.
86. As a parent, I want an episode row to show its still where it used to show a gradient, so that I can recognise the episode by its picture.
87. As the maintainer, I want episodes never to raise a Decision, so that a show with 200 episodes is not a 200-row review.

### Writing back into the collection

88. As the maintainer, I want the importer to remember my library root and where each title came from under it, so that a sync knows where the source folders are.
89. As the maintainer, I want re-running an import over my existing library to record the source folder of every title it recognises, so that a library imported before this feature can still get its posters written back.
90. As the maintainer, I want each source path stored relative to the root, so that no absolute path from this machine ends up on a library row.
91. As the maintainer, I want the sync to check it can write to the root before the first request and log _Will write familyflix-metadata.csv to E:\Movies_, so that I see what will happen before it happens.
92. As the maintainer, I want _Can't write to E:\Movies — the sheet and posters will be skipped_ when it cannot, so that the sync still runs into the library.
93. As the maintainer, I want `familyflix-metadata.csv` to be the Export file — the eight columns, every movie A–Z — so that the importer can read it back.
94. As the maintainer, I want an existing sheet or `poster.jpg` never replaced, with _– … exists, left alone_ in the log, so that nothing of mine is overwritten.
95. As the maintainer, I want a title with no source folder on record to log _– Title — no source folder on record, poster skipped_ and nothing else, so that it is not a Decision.
96. As the maintainer, I want nothing else ever written into my library root, so that the collection stays mine.

### Invariants and edge cases

97. As a parent, I want the family's ★ rating never changed by a sync, so that our scores stay ours.
98. As a parent, I want watched state and resume positions never touched by a sync, so that Continue Watching is not disturbed.
99. As the maintainer, I want TMDB's genres mapped onto our twelve — _Science Fiction_ as Sci-Fi, _Action & Adventure_ as both — and the rest dropped, so that the genre filter never grows a genre with one film in it.
100.  As the maintainer, I want every answer in English, so that synopses read the same across the library.
101.  As the maintainer, I want an empty library to show zero counts rather than an error, so that the screen is still honest.
102.  As the maintainer, I want no test ever to go online, so that the suite runs on a plane.

## Implementation Decisions

### Scope

- One initiative, `enrichment`, carrying both 🔜 parts of step 6 —
  **Enrichment (TMDB)** and the **Network group** — because neither is usable
  alone.
- Everything the prototype does not draw is not built (see Out of Scope).
- Every recommendation in design log 23 was accepted by the maintainer in
  advance; the log is the source of truth where this PRD is terse.

### Schema — migration 5

- `movies`: `original_title TEXT`, `tmdb_score REAL`, `source_folder TEXT`.
- `series`: `original_title TEXT`, `tmdb_score REAL`, `source_folder TEXT`.
- `episodes`: `still_path TEXT`.
- Nothing seeded, nothing backfilled by the migration. `tmdb_id` (movies,
  migration 1; series, migration 4) is already there and finally gets a value.
- Three new keys in the existing `settings` table: `tmdb-api-key`,
  `library-root`, `enrichment-last-synced-at` (ISO). Read and written through
  the library's settings unit beside the subtitle language.

### Shared types (both build targets)

- A new enrichment type module: `EnrichField` (the ten chips), `EnrichScope`
  (`missing` | `all` | `single`), `EnrichmentSummary { total, complete,
lastSyncedAt, keySet, online, libraryRoot }`, `Candidate { tmdbId, title,
year, genre, language, posterUrl, score }`, `FieldConflict { field, label,
mine, tmdb }` (field one of the five conflictable), `Decision` (id, title,
  reason, path, and one of `ambiguous { query, candidates }`, `missing
{ query }`, `conflict { fields }`), and `EnrichmentRun { id, phase
('running' | 'review'), scope, startedAt, total, done, enriched,
currentItem, log, decisions, written: { sheet, posters } }`.
- `ImportRun` gains `enrich: boolean`; `StartImport` takes it.
- The Movie and Series types gain `originalTitle`, `tmdbScore`; Episode gains
  `stillPath`. `sourceFolder` stays server-side.

### Server — a fifth domain, `enrichment/`

Nothing in `library/`, `media/`, `import-export/` or `playback/` is a network
client — the rule `playback/` was born by. Injected into the router as a sixth
argument so no route learns there is a TMDB. Units, one folder each:

- **`tmdbClient`** — the injected seam: built over an injected `fetch`;
  `authenticate(key)`, `searchMovie`, `movie` (with credits), `searchTv`,
  `tv` (with credits), `season(id, n)`, `image(path)` → a stream, and a
  short-timeout reachability probe. `en-US` fixed. Distinguishes "refused"
  (`401`) from "unreachable" (network error / timeout) as values.
- **`tmdbAuth`** — pure: a key → how to send it. A JWT-shaped string is a v4
  Read Access Token (`Authorization: Bearer`); anything else a v3 API key
  (`api_key` query).
- **`tmdbGenres`** — pure: TMDB genre names → the **Genre pool**. Same name
  kept, `Science Fiction` → Sci-Fi, TV compounds split (`Action & Adventure` →
  Action + Adventure; `Sci-Fi & Fantasy` → Sci-Fi), everything else dropped.
  The pool never grows.
- **`matchScore`** — pure: a title and year × a TMDB result → 0–100. 70 for
  the title (**Title key** equal → 70, else word overlap × 70), 30 for the year
  (equal 30, one off 15, unknown 0). **Confident**: exactly one candidate with
  an equal Title key and, when the title has a year, an equal year. `titleKey`
  is imported from `import-export/`.
- **`fetchedFields`** — pure: a TMDB movie or TV detail → our columns, keyed
  by chip. Director = the first credit with job `Director`; a series'
  creator = `created_by` names joined with `, `; cast = top 10; series years
  from first/last air date; `tmdb_score` = `vote_average`, one decimal.
- **`planFields`** — pure: a title's current values × fetched fields × the
  chips on × the scope → `{ fill, conflicts }`. Empty fields are always
  filled; in `missing` scope a filled field is never a conflict; otherwise
  Synopsis, Year, Genres, Director/creator and Cast conflict when they differ
  after trimming and case-folding (genres and cast as sets). Poster, Backdrop
  and Runtime fill when empty and are otherwise left. Original title and TMDB
  score are always written when their chip is on.
- **`writeBack`** — the two **Write targets**: `check(root, targets)` →
  per-target writable or not (`fs.access W_OK`) plus its dry-run line;
  `poster(root, sourceFolder, stream)` — adds `poster.jpg` only when absent;
  `sheet(root, movies)` — adds `familyflix-metadata.csv` via `writeSheet`'s
  CSV only when absent. Each answers what it did as a value and a log line;
  never throws, never overwrites.
- **`createEnrichment`** — the domain: `summary()`, `start(options)`,
  `current()`, `cancel()`, `search(id, query)`, `pick(id, tmdbId)`,
  `apply(id, choices)`, `dismiss(id)`. One **Current enrichment run** in
  memory, its state machine as closures over the run and an abort
  controller — `createImporter`'s shape and log 13's argument for it. Takes
  the storage, the settings, `Media`, the TMDB client and `writeBack`.

### The run

- `start` refuses with values the route maps: busy, no key, offline, bad
  body. It snapshots the titles in scope, so `total` is known before the first
  request, and writes the dry-run lines before any TMDB call.
- One title at a time. A title with a `tmdb_id` is fetched by id; otherwise
  searched by title + year and scored. Confident → fetched, planned, written:
  columns, `tmdb_id`, poster/backdrop streamed into the title's Movie folder
  (or Series folder) as `poster.jpg` / `backdrop.jpg` through a new `Media`
  member that stores a stream under a name, then the poster write target.
  Several candidates → `ambiguous` with the top three; none → `missing`;
  fields that differ → `conflict`, with empty fields filled at once.
- A series additionally reads `/tv/{id}/season/{n}` for every season number it
  has on disk, matched by episode number: title and air date when empty,
  always; still (as `<episode file stem>.still.jpg` in its season folder)
  under Poster; runtime under Runtime. No Decisions for episodes; season 0 is
  never asked for.
- A network failure ends the run into review with _Lost the connection —
  stopped. Anything already fetched is kept._; a `401` the same with _TMDB
  refused the key._
- At review: the sheet write target (films A–Z), `enrichment-last-synced-at`
  stamped, `✓ Sync complete — X enriched, Y need a decision.`
- `cancel` aborts in-flight requests and drops the run; written rows stay.
  Undecided rows go with it.
- `pick` and `apply` write through the same path as a confident title and
  count into `enriched`; `dismiss` (Skip, _Keep all mine_) removes the row.
- Log lines are the prototype's verbatim where true, plus the stop, conflict
  and write-back lines of log 23 Q32/Q35; the last 80, as the importer's.

### Server — library, media and import

- Library storage grows: a summary count (movies + series, and those with
  both a synopsis and a poster), the titles in a scope with their current
  values and `source_folder`, and enrich writes for a movie, a series and an
  episode that touch only the columns named — never `rating`, `watched`,
  `resume_position_seconds` or `last_watched_at`.
- `Media` gains one member storing a stream under a given name in a title's
  folder (optionally its season subfolder), answering the relative stored
  path — `storeUpload`'s precedent.
- The importer writes `library-root` on Start, and `source_folder` (relative
  to the root) on every movie and series it adds **or** finds **Already in
  library** — a re-run backfills an existing library. It carries
  `enrich` on the run.

### Server — routes (the HTTP layer only)

| Route                                                                        | Answer                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/tmdb/key`                                                          | `{ key: string \| null }`                                               |
| `POST /api/tmdb/key { key }`                                                 | `200 { key }` · `400` empty · `422` refused · `503` unreachable         |
| `GET /api/enrichment`                                                        | `EnrichmentSummary`                                                     |
| `POST /api/enrichment { scope, movieId?, fields, writeSheet, writePosters }` | `201 EnrichmentRun` · `400` · `409` busy · `412` no key · `503` offline |
| `GET /api/enrichment/current`                                                | `EnrichmentRun` · `404`                                                 |
| `POST /api/enrichment/current/cancel`                                        | `204`                                                                   |
| `POST /api/enrichment/current/decisions/:id/search { query }`                | `200 Decision`                                                          |
| `POST /api/enrichment/current/decisions/:id/pick { tmdbId }`                 | `204`                                                                   |
| `POST /api/enrichment/current/decisions/:id/apply { choices }`               | `204`                                                                   |
| `DELETE /api/enrichment/current/decisions/:id`                               | `204` · `404`                                                           |

- The key is read only by `GET /api/tmdb/key`; `GET /api/settings` is not
  widened, so the player never carries it.
- `POST /api/import` accepts `enrich`.

### Frontend — `features/enrichment/`

The import-export feature's shape, one folder per unit:

- **`EnrichmentFlow`** — the organism: header row (Back, _Sync with TMDB_,
  key badge, lede), owns `useEnrichmentRun` and `useEnrichmentSummary`,
  renders one of three steps.
- **`EnrichmentSetup`**, **`EnrichmentProgress`**, **`EnrichmentReview`** —
  the three steps.
- Molecules: **`SetupBanner`** (two tones: offline with _Retry_, key with
  _Open Network settings_), **`ScopeCard`** (radio card, dot left, 15px
  label), **`WriteTargetRow`** (glyph tile, title, mono line, Toggle or the
  _Required_ pill), **`DecisionRow`** (dot by kind, title, reason, path,
  _Skip_, and one face), **`CandidatePicker`** (horizontal candidates, the
  dashed _Search by title_ card), **`TitleSearch`**, **`FieldDiff`** (_Yours |
  TMDB_ rows, TMDB default, _Apply choices_ / _Keep all mine_). ❌ Reusing
  `FormatCard` / `StatTile` — different pixels.
- **`useEnrichmentRun`** — start, poll at 500 ms while running, re-attach on
  mount, cancel, search, pick, apply, dismiss; `useImportRun`'s shape.
- **`useEnrichmentSummary`** — the setup's read and _Retry_.
- **`enrichmentView`** — pure: a run → headline, stat line, percent, elapsed,
  ETA; the estimate (`About {⌈n × 0.4⌉}s for N titles`, or its two other
  faces); `importView`'s precedent.
- **`api/`** — the enrichment calls with one caller each.
- The candidate posters load straight from `image.tmdb.org` (`w185`) over the
  Gradient fallback; nothing in the library does.

### Frontend — elsewhere

- **Route** `/enrich`, `pages/EnrichmentPage` — `MaintainerLayout` around
  `EnrichmentFlow`, `ImportPage`'s shape. `?movie=<id>` → _Just this movie_;
  `?scope=all` preselects _Everything_. **Landing**: the movie's path with a
  movie, else `/settings`; Back, _Done_ and _Back to the movie_ all follow the
  **Back rule**. _Sync again_ dismisses the run and shows setup.
- **Settings** gains **`NetworkSection`** between Playback and Storage, on
  the shared section furniture, and **`useTmdbKey`** (`{ key, connected,
testing, onKey, test }`), raising the key's four snackbars.
- **`fetchEnrichmentSummary`** moves to the shared `api/` — two features call
  it (the Settings sync row and the setup).
- **`EditMenu`** gains _⟳ Fetch from TMDB_ between _Edit details_ and the
  Danger row, pushing `/enrich?movie=<id>`.
- **`ImportSetup`** gains the checkbox card (a `role="checkbox"` over a
  `visuallyHidden` input, the prototype's 22px box) with its two hints off
  `GET /api/tmdb/key`; `startImport` carries `enrich`; the Review step's
  _Finish_ **replaces** `/import` with `/enrich?scope=all` when `run.enrich`.
- **`EpisodeRow`** gains `stillUrl?`, drawn over the Gradient fallback,
  `PosterCard`'s precedent; the season view passes it.
- Snackbars through the existing `useSnackbar()` — plain notices, 5 s, no
  per-notice duration: _Paste a key first._ (warning), _Connected to TMDB._
  (success), _TMDB didn't accept that key._ (error), _Couldn't reach TMDB._
  (error), _Add your TMDB key here first._ (info), _Match saved._ (success),
  _Details updated._ (success), _Searching TMDB…_ (info).

### Documents

- The glossary's Enrichment section already exists (log 23). CLAUDE.md and
  the README record the fifth server domain, the new routes and the Snackbar
  stack's first caller when the refactor closes — not before (Feature is Done
  only after its refactor).
- **Prototype amendments flagged:** the `missing` row's reason (_…this title_,
  not _…this folder name_), and the `ambiguous` reason's spelled-out count.

## Testing Decisions

- **A good test exercises external behaviour only** — what a unit answers,
  what a route returns, what a screen shows and sends — never a closure's
  internals or a component's state. **No test goes online**: every test of the
  domain drives an injected `fetch` or a fake TMDB client; the image stream is
  a fake.
- **Pure units, table-driven**: `tmdbAuth` (v3 vs v4 shapes), `tmdbGenres`
  (kept, renamed, split, dropped), `matchScore` (the 70/30 arithmetic,
  Confident's two conditions, yearless titles), `fetchedFields` (movie vs TV,
  Director and creator, cast cap, score rounding), `planFields` (each scope ×
  filled/empty × each field class, set comparison, chips off),
  `enrichmentView` (headline, percent, ETA, the estimate's three faces, the
  relative _Last synced_). Prior art: `matchRows`, `importView`, `titleKey`.
- **`tmdbClient`** over a fake `fetch`: the auth header or query per key shape,
  `en-US`, `append_to_response=credits`, refused vs unreachable as values.
- **`writeBack`** in a sandbox directory: writes when absent, leaves an
  existing file byte-identical, reports an unwritable root, never throws.
  Prior art: `componentSlot`'s and `createMedia`'s sandbox suites.
- **`createEnrichment`** over a real in-memory SQLite library, a fake client
  and a sandbox media root: a confident movie is written with `tmdb_id` and
  its images; `rating` and watch columns are untouched; `missing` scope never
  conflicts; ambiguous/missing/conflict Decisions; pick/apply/dismiss; a known
  `tmdb_id` skips the search; series and episode writes, no episode Decisions;
  cancel keeps written rows; network loss and `401` end into review; busy /
  no-key / offline refusals. Prior art: `createImporter`'s suite and its
  `heldCopy` double for holding a run mid-flight.
- **Library storage**: migration 5 applies over a v4 database; the summary
  counts; the enrich writes touch only their columns. Prior art: the series
  storage suites.
- **Importer**: `library-root` written on start; `source_folder` relative on
  add and on Already in library; `run.enrich` carried. Over the existing
  fixtures.
- **Routes** through supertest with the domain injected: each status in the
  table. Prior art: the import and component-upload route suites.
- **Frontend** with @testing-library/react: `NetworkSection` + `useTmdbKey`
  (pill, labels, the four snackbars), `EnrichmentFlow` over its three steps
  with a stubbed fetch (Start's three behaviours, polling, re-attach, Stop),
  each molecule's contract, `DecisionRow`'s three faces, `EditMenu`'s new
  item, `ImportSetup`'s box and hints, Finish's replace (via `LocationProbe`),
  `EpisodeRow`'s still. Snackbars asserted through the real
  `SnackbarProvider` and `snackbarStack`. Prior art: `ImportFlow`,
  `CodecManager`, `useImportRun`.

## Out of Scope

- Anywhere the **TMDB score** or **original title** is drawn — both are
  stored, neither is shown.
- _Fetch from TMDB_ for a series — the series page has no ⋯ menu (log 22's
  amendment flag stands).
- A language picker for TMDB's answers; `en-US` is fixed.
- Specials (season 0).
- Scheduled, automatic or background syncs; a sync surviving a server
  restart.
- Growing the **Genre pool** from TMDB.
- Seeding or changing the household **Rating** — never.
- Hot-linking library art from TMDB; a proxy for candidate posters.
- Refreshing or overwriting an existing `familyflix-metadata.csv` or
  `poster.jpg`; writing anything else into the **Library root**.
- Series in the Metadata sheet (log 22's ruling on Export).
- Remembering the Library root by any route other than an import (_Change…_
  is the Electron shell's).
- Consulting TMDB during **Bulk import** itself — the checkbox only hands
  Finish to a sync's setup.

## Further Notes

- Design log: `docs/design-logs/23-enrichment.md` (the grill session, 45
  questions, all recommendations accepted in advance). Glossary: the
  _Enrichment_ section of `docs/ubiquitous-language.md`.
- Suggested slicing (log 23's plan): (1) tracer — a key and one confident
  movie through _Just this movie_; (2) the whole library — summary, scopes,
  progress, the Settings row; (3) Decisions; (4) series and episodes;
  (5) write targets and `source_folder`; (6) from the import.
- Trade-off accepted: `source_folder` is only as good as the last import. A
  library added through the form, or imported before this ships, gets no
  `poster.jpg` in its source folder until an import is re-run over it.
- The app now has an outbound request on a Settings/setup visit (the
  reachability probe) and a stored secret; both are behind the injected seam
  and tested offline.
