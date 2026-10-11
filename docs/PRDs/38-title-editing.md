> **Initiative:** `title-editing` (replaces `episode-links`, `edit-series` and `delete-series`)
> **Design log:** `docs/design-logs/38-title-editing.md`
> **Issue:** #302
> **Build order:** step 21, the last of the third chain. Log 32's steps 22 and 23 are folded in and leave the chain (log 38 Q1). It ships as seven thin vertical slices (Q20)

## Problem Statement

I keep the family library up to date, and I can fix a film in the app but not a series. A film's ⋯ menu offers _Edit details_, _Fetch from TMDB_ and _Delete movie_. A series page has no menu at all: I can't correct a show's title, renumber an episode, re-fetch its poster or remove it.

When I tested Sync, some films didn't come through because TMDB found no match. The review lets me search by another title, but picking a result never fixes the title itself, so a film imported as `Heat 1995 1080p BluRay` keeps that name after its match. If a film is matched wrongly, fixing its title in the form and pressing _Fetch from TMDB_ fetches the same wrong match again, and nothing on screen unlinks it. A series TMDB can't match doesn't reach the review at all. It is only a log line, and the next Sync fails the same way.

Import has the same gap. A show whose files the reader can't number (`eps1.0_hellofriend.mov`) lands as `unplaced` Problems I can only Skip, one per file. A film folder holding two videos opens a Resolve form with an empty video slot, and the browser picker can't reach the folder.

## Solution

One rule, **Title parity**: whatever I can do to a film I can do to a series, and the reverse. It means the same actions, not the same fields.

- **The series page gets a ⋯ menu**, the movie page's three items: _✎ Edit details_, _⟳ Fetch from TMDB_, and the Danger row _🗑 Delete series_.
- **Edit details** opens the Movie form as the **Series edit job**. The shared fields are prefilled, then the poster and one Episode file row per episode. I can renumber, retitle, replace files, add episodes and remove them in one save. An episode I renumber keeps its watch history.
- **Fetch from TMDB** syncs that one series, the way a film's ⋯ menu already does.
- **Delete series** asks first, then removes the show, its episodes and the files FamilyFlix copied. My original folders are never touched.
- **The Sync review treats a series like a film.** A series TMDB can't settle gets an `ambiguous`, `missing` or `conflict` row.
- **A pick fixes the title (the Title fix).** When I pick a match from a `missing` or `ambiguous` row, the title becomes TMDB's, and the year too when ours was blank. The search box says so: _Try another title — the one you pick becomes its title._
- **Changing a title or year in the form unlinks the old match**, so the next _Fetch from TMDB_ searches again.
- **Import numbers a show in the app.** A show with files the reader can't number becomes one Problem whose _Resolve_ opens the series form with one row per file, prefilled by a guess. The numbers I type are an **Episode link**: the file keeps its name, and the next scan remembers it as already in the library.
- **The reader learns the Episode word** (`Episode 12`, `Ep 12`, `E12`) wherever the season is already known.
- **A film folder with two videos** gives its Resolve form a choice of the two.

## User Stories

### The series ⋯ menu

1. As the maintainer, I want a ⋯ menu in the series hero's corner, where the movie page's sits, so that a series can be managed the way a film is.
2. As the maintainer, I want the menu to offer _✎ Edit details_, _⟳ Fetch from TMDB_ and the Danger row _🗑 Delete series_, so that its items read like the film's.
3. As the maintainer, I want the menu only on the series page and not on the season page, so that the actions sit on the title rather than on one of its parts.
4. As a family member, I want the menu to behave like the movie page's (opening, closing, keyboard), so that nothing new has to be learnt.

### Delete a series

5. As the maintainer, I want _Delete series_ to open a dialog rather than delete at once, so that one click can't remove a show.
6. As the maintainer, I want the dialog to read _Delete “F'ck That's Delicious”?_ over _This can't be undone._, so that I see which show I'm about to lose.
7. As the maintainer, I want the body to say the series and its N episodes leave the library, the copied videos, posters and subtitles are deleted, its watch history goes with it, and the original files are not touched, so that I know exactly what goes and what stays.
8. As the maintainer, I want _Delete series_ first and _Cancel_ second, so that it reads like the movie's Delete dialog.
9. As the maintainer, I want _Delete series_ to read _Deleting…_ and be disabled in flight, so that I can't send it twice.
10. As the maintainer, I want Escape, the scrim, ✕ and _Cancel_ to close the dialog without deleting, so that backing out is always easy.
11. As the maintainer, I want a delete to take the series' episodes, genres and subtitles with it, so that nothing is left pointing at a show that's gone.
12. As the maintainer, I want the Series folder in managed storage removed afterwards, best-effort, so that the space comes back and one locked file doesn't fail the delete.
13. As the maintainer, I want to land back where I came from after a delete, with the Series tab as the fallback, so that I don't end up on a page for a show that no longer exists.
14. As the maintainer, I want a delete of a series that's already gone to answer not-found, so that a stale page fails plainly.
15. As the maintainer, I want my Library folders and the originals in them never touched by a delete, so that removing a show from the app never costs me a file.

### Fetch a series from TMDB

16. As the maintainer, I want _Fetch from TMDB_ on a series to open the Enrichment flow for that series alone, so that I can fix one show without syncing the whole library.
17. As the maintainer, I want its scope card to read _Just this series_, so that I know what the run covers.
18. As the maintainer, I want the flow to re-attach only to a single-title run for that same series, so that another title's run is never shown as this one's.
19. As the maintainer, I want a run waiting in review for another title named by the Let-go line and let go by Start, as it is for a film, so that a stale review doesn't block me.
20. As the maintainer, I want the Busy notice when another title's Sync is running, as for a film, so that I know why Start did nothing.
21. As the maintainer, I want _Back_ and _Done_ to land on the series page, so that I return to the show I started from.
22. As the maintainer, I want a single-series run for a show the library doesn't hold refused, so that a stale link fails plainly.

### Series in the Sync review

23. As the maintainer, I want a series TMDB finds several candidates for to get an `ambiguous` row with its candidates, so that I can choose the right show.
24. As the maintainer, I want a series TMDB finds nothing for to get a `missing` row with the title search, so that I can try another title.
25. As the maintainer, I want an _Everything_ Sync to raise field conflicts for a series, as it does for a film, so that TMDB never silently overwrites what the household wrote.
26. As the maintainer, I want _Apply choices_ and _Keep all mine_ to work on a series' conflict row, so that conflicts settle the same way for both kinds.
27. As the maintainer, I want a series candidate's card to show TMDB's show name and first air year, so that I can tell shows apart the way I tell films apart.
28. As the maintainer, I want _Skip_ to work on every series row, so that I can leave a show for later.
29. As the maintainer, I want a series row to look exactly like a film's, so that the review reads as one list.

### The Title fix and the Match unlink

30. As the maintainer, I want a pick from a `missing` or `ambiguous` row to make the picked candidate's title the title's own, so that `Heat 1995 1080p BluRay` becomes _Heat_ once I've matched it.
31. As the maintainer, I want the picked candidate's year written too when ours is blank, so that the match fills the gap it was found by.
32. As the maintainer, I want a year we already hold kept on a pick, so that the household's year isn't overwritten.
33. As the maintainer, I want a Confident match never to change the title, so that a title the household spelt its own way (a Dutch title, `The` left off) is kept.
34. As the maintainer, I want a conflict row never to raise the title as a conflict, so that an _Everything_ Sync doesn't ask about every title.
35. As the maintainer, I want the Title fix to apply to a series too, so that a show's title comes out clean the same way.
36. As the maintainer, I want the title search's caption to read _Try another title — the one you pick becomes its title._, so that I know what a pick does before I make it.
37. As the maintainer, I want the review to make clear that a title TMDB can't match is still in my library, so that I don't think it failed to import.
38. As the maintainer, I want a form save that changes a film's title or year to unlink its TMDB match, so that the next _Fetch from TMDB_ searches again instead of fetching the same wrong film.
39. As the maintainer, I want the same unlink for a series, so that a wrongly matched show can be fixed the same way.
40. As the maintainer, I want the fields a wrong match filled kept after the unlink, so that nothing I see disappears, and a later _Everything_ Sync shows them as conflicts.
41. As the maintainer, I want an edit that changes neither title nor year to keep the match, so that fixing a synopsis doesn't cost a lookup.

### Edit a series

42. As the maintainer, I want _Edit details_ to open the Movie form on `/add?series=<id>`, so that a series is edited on the same form it was added on.
43. As the maintainer, I want the shared fields prefilled from the series (title, year range, created by, cast, description, genres, rating), so that I only change what's wrong.
44. As the maintainer, I want no Kind tabs on an edit, so that a series can't be turned into a film by accident.
45. As the maintainer, I want the series' poster in its slot as the file it already has, so that a title-only edit sends no files.
46. As the maintainer, I want one Episode file row per held episode in season then episode order, so that I see the whole show at once.
47. As the maintainer, I want each row to show the episode's numbers, its title, its subtitles and its ✕, so that every part of an episode can be edited where it sits.
48. As the maintainer, I want a row's mono line to show the original filename (its Source file) when the library knows it, else the stored video's name, so that I can tell which file is which.
49. As the maintainer, I want to renumber an episode, so that a show the reader numbered wrongly can be fixed.
50. As the maintainer, I want to swap two episodes' numbers in one save, so that a mix-up between E03 and E04 doesn't need a detour through a spare number.
51. As the maintainer, I want to retitle an episode, so that a wrong or missing episode title can be corrected.
52. As the maintainer, I want to replace an episode's video or subtitles, so that a bad file can be swapped without removing the episode.
53. As the maintainer, I want _＋ Add episode files_ to append new rows, so that an episode found later can join the show.
54. As the maintainer, I want ✕ on a held row to remove that episode on save, so that a duplicate or wrong file can leave.
55. As the maintainer, I want only freshly picked files to travel as bytes, so that an edit of a fifty-episode show isn't a fifty-video upload.
56. As the maintainer, I want the Save gate to refuse a pair of numbers twice before anything is sent, so that I see the clash on the form.
57. As the maintainer, I want the save to be all or nothing, files stored on the way included, so that a refusal never leaves the show half-edited.
58. As a family member, I want a renumbered or retitled episode to keep its watch state, resume position and still, so that what we watched stays watched.
59. As a family member, I want an episode whose video was replaced to keep its watch state, so that a better copy of a watched episode doesn't show as unwatched.
60. As the maintainer, I want a removed episode's copied files cleaned up best-effort after the save, so that the space comes back.
61. As the maintainer, I want to land on the series page after a save, so that I see the result.
62. As the maintainer, I want an edit of a series that's gone to answer not-found, so that a stale form fails plainly.
63. As the maintainer, I want an episode id the series doesn't hold, or one sent twice, refused, so that a stale or tampered body can't touch another show.

### Source file and the Episode word

64. As the maintainer, I want each imported episode to remember its original file's path inside the show's folder, so that the library knows which file it came from.
65. As the maintainer, I want a later Folder scan to treat a remembered file as already in the library, so that an episode I numbered by hand isn't offered again.
66. As the maintainer, I want that check made before the Episode tag is read, so that a file whose name gives other numbers still counts as held.
67. As the maintainer, I want a file I keep in place during an edit to keep its Source file, so that renumbering doesn't make the next scan forget it.
68. As the maintainer, I want the reader to number `Episode 12`, `Ep 12`, `Ep.12` and `E12` inside a Season folder, so that shows named that way need no hand numbering.
69. As the maintainer, I want the same words at a Show folder's root read as season 1, so that a one-season show with loose files is numbered.
70. As the maintainer, I want the Episode word never to make a folder a show, so that a film called `E12` isn't mistaken for an episode.
71. As the maintainer, I want the form's filename reading to agree with the importer's, so that a picked `Ep 12.mkv` is numbered the same on both.

### Series Resolve

72. As the maintainer, I want a show's unnumbered files filed as one Problem per show rather than one per file, so that the review list stays readable.
73. As the maintainer, I want that row titled with the show and its reason giving the count (_24 episodes need numbers_), so that I see the size of the job.
74. As the maintainer, I want that row to have _Resolve_ as well as _Skip_, so that I can number the show instead of losing it.
75. As the maintainer, I want _Resolve_ to open the Movie form's series kind in import context, with one Episode file row per unnumbered video, so that I number them where I'd add any series.
76. As the maintainer, I want each row prefilled by the Numbering guess (the season from the folder, the episode from the Episode word, else the next free number in name order), so that I usually just confirm.
77. As the maintainer, I want every guessed number editable, so that a wrong guess is one keystroke away.
78. As the maintainer, I want the files offered as paths from the run's folder rather than picked, so that I never have to find them in a browser picker that can't reach them.
79. As the maintainer, I want Resolve on a show already in the library to join that series, with its fields from the held series and rows for only the new files, so that a scan that found new episodes adds them to the show.
80. As the maintainer, I want that join to refuse a number the series already holds, so that a new file can't overwrite an episode.
81. As the maintainer, I want a Resolve's save to record each file's Source file, so that the next scan recognises them.
82. As the maintainer, I want a saved Resolve to take the Problem off the list, so that the review shrinks as I work.
83. As the maintainer, I want only files under the run's root accepted, so that a Resolve can't copy in something from elsewhere on the disk.

### The film's Found-file choice

84. As the maintainer, I want a film folder holding two videos to say _Two videos — pick the film._, so that I know why it wasn't imported.
85. As the maintainer, I want its Resolve form's video slot to offer the folder's videos by name, the first preselected, so that I can pick the right one without a file picker.
86. As the maintainer, I want the picker kept beside the choice, so that I can still pick a file from somewhere else.
87. As the maintainer, I want a folder with exactly one video, or none, to resolve as it does today, so that nothing else about Resolve changes.

### Prototype and system

88. As the maintainer, I want the prototype to show the series ⋯ menu, the Delete dialog, the series edit job, the Series Resolve, the Found-file choice, the `unplaced` row's Resolve, _Just this series_ and the search caption before the code does, so that the prototype stays the spec.
89. As a family member, I want browsing and watching to look as they did, so that nothing I use changes.
90. As a developer, I want the server's Decisions held against a kind-and-id reference, so that `search`, `pick` and `apply` work for both kinds without the wire Decision changing.

## Implementation Decisions

- **Seven slices, each end to end (log 38 Q20):**
  1. **Delete a series:** the series ⋯ menu with its Danger row only, the dialog, `DELETE /api/series/:id`, the cleanup.
  2. **Fetch a series:** `seriesId` on start and run, the re-attach rule, the menu's second item.
  3. **Series in the review:** the Title reference, series Decisions and conflicts, the Title fix for both kinds.
  4. **Edit a series:** `PATCH /api/series/:id`, the form's Series edit job, the menu's first item, the Match unlink for both kinds.
  5. **Source file:** migration 8, written by every import path, read by the scan.
  6. **Episode word:** the server reader and its client mirror.
  7. **Series Resolve:** one Problem per show, `files.videos`, the series body on the resolve route, the film's Found-file choice.
- **Prototype first (Q19).** Before the slice that draws it:
  - `page.SeriesPage`: the ⋯ menu and the Delete dialog.
  - `feat.MovieForm`: the Series edit job, the Series Resolve and the Found-file choice.
  - `feat.ImportFlow`: the `unplaced` row with _Resolve_.
  - `feat.EnrichmentFlow`: _Just this series_ and the Title search's caption.
  - `COMPONENT-SPEC.md` gains the new units.

### Slice 1: Delete a series

- **`deleteSeries(id)`** in the series storage's `write` unit, through `LibraryStorage`. The existing cascade takes episodes, `series_genres` and `episode_subtitles`. It answers whether a row went, and the stored path to clean up.
- **`Media.removeSeriesFolder(storedPath)`**, a new `createMedia` removal. It removes the Series folder best-effort, one directory above an episode's season folder (`storeInSeriesFolder`'s reading). It never throws.
- **`DELETE /api/series/:id`** → `204`, or `404` for a series not held. The database goes first and the files after (the movie delete's order). There is no `409` guard, the movie delete's precedent.
- **Frontend, in `features/series/`:**
  - `SeriesEditMenu/` mirrors `EditMenu` on `CornerMenu`'s furniture. It stays a feature unit and is not promoted to `components/`, because it navigates and opens a feature's dialog.
  - `DeleteSeriesDialog/` on `Modal`, worded as in Q18, with the episode count in the body.
  - `useDeleteSeries/` → `{ deleting, deleteSeries }`, back through `useGoBack` with the Series tab as its Landing.
  - `api/deleteSeries` (one caller).

### Slice 2: Fetch a series

- **`StartEnrichment` and `EnrichmentRun` gain `seriesId?: string`** beside `movieId`. A `single` run carries exactly one of the two. `enrichmentBody` refuses a body carrying both, or a `single` body carrying neither.
- **`titlesFor`** reads the series when `seriesId` is set. A series the library doesn't hold is `400`, the film's `no-movie` reading generalised to `no-title`.
- **`enrichPath({ series })`** → `/enrich?series=<id>`, beside `{ movie }`.
- **`useEnrichmentRun`** re-attaches only to a `single` run whose `seriesId` matches. The Waiting run, the Let-go line (worded for another title's sync) and the Busy notice behave as they do for a film.
- The scope card reads _Just this series_. _Back_ and _Done_ land on the series page.

### Slice 3: Series in the review

- **The Title reference.** `createEnrichment`'s `decided` map holds `{ kind: 'movie' | 'series'; id }` per Decision id instead of a movie id. `held`, `search`, `pick` and `apply` branch on the kind: `searchTv` and `writeSeries` for a series. The wire `Decision` is unchanged, with no `kind`.
- **`lookUpSeries`** returns a Decision the way `lookUp` does. `decisionFace` gets a TV variant that reads `name` and `first_air_date`, the way `fetchedTvFields` already reads TV results. The log line _"left for a later Sync"_ goes.
- **`writeSeries`** plans under the run's own scope instead of a fixed `missing`, so _Everything_ raises series Field conflicts and _Apply choices_ writes them.
- **The Title fix.** `pick` from a `missing` or `ambiguous` Decision writes the Candidate's title as the title, and its year when ours is null, for both kinds. A Confident match and `apply` (a conflict) never write the title. The title stays out of the ten Enrich fields.
- **`TitleSearch`**'s caption: _Try another title — the one you pick becomes its title._ The `missing` reason stays _No result on TMDB_.

### Slice 4: Edit a series

- **`PATCH /api/series/:id`**, multipart and atomic like `POST /api/series`, read by `seriesFormBody`. Each `episode` field gains an optional `id`:
  - **With an id:** a held episode, renumbered or retitled. Its video and subtitles travel as stored paths, or as a picked replacement.
  - **Without an id:** a new episode.
  - **A held id the body leaves out:** the episode is removed.
- **Refusals.** `404` for a series not held. `400` for an id the series doesn't hold, an id sent twice, a pair of numbers twice, or anything the add refuses. Every refusal rolls back the whole edit, including files stored from bytes on the way.
- **`updateSeries`** in the series `write` unit, in one transaction:
  - The fields first.
  - Then the **Two-pass renumber**: every held episode being renumbered moves to a negative placeholder (`-1`, `-2`, …), then each takes its new number. `UNIQUE (series_id, season_number, episode_number)` never sees a duplicate, and the index stays.
  - Then the inserts and the removals.
  - A held episode keeps its id, so its watch state, resume position and still survive a renumber, a retitle or a replaced video.
  - Removed episodes' files are removed best-effort after the commit.
- **The Match unlink.** A save that changes the title or the year clears `tmdb_id`, on `PATCH /api/movies/:id` and `PATCH /api/series/:id` alike. The fields the match filled stay.
- **Frontend:**
  - `movieFormPath({ series })` → `/add?series=<id>`. It is the **Series edit job**, the form's fifth job, whose Landing is the series page and which draws no Kind tabs. `?problem=` wins over `?series=`, as it already does over `?movie=`.
  - `useMovieForm` loads the series. Its Save gate is the series gate.
  - `useEpisodeList` holds held rows: each carries its episode id and `stored` File slots, a ✕ removes it, and picked rows append.
  - `api/updateSeries` (one caller).
  - The mono line shows `sourceFile` when set, else the stored video's name.

### Slice 5: Source file

- **Migration 8:** `episodes.source_file TEXT`, nullable. It holds the video's path relative to its series' Source folder, with forward slashes.
- It is written by a sheet import, a Folder scan and a Series Resolve. It is `null` for the form's add and for a freshly picked file in an edit. An edit keeps it for every held file left in place.
- `Episode` gains `sourceFile: string | null`.
- `createImporter`'s scan of a held series treats a video as Already in library when its Source file is held, checked before the Episode tag. Films need no column, because `movies.source_folder` already does this job.

### Slice 6: Episode word

- `media/episodeTag` reads a third shape, the **Episode word**: `Episode 12`, `Ep 12`, `Ep.12` and `E12`. It gives an episode number only, and is read only where the season is known: in a Season folder, or at a Show folder's root as season 1. `groupShows` never makes a folder a show on its strength.
- The client's `readEpisodeTag` mirrors it, and the drift guard's shared table gains its cases.

### Slice 7: Series Resolve and the Found-file choice

- **One `unplaced` Problem per show.**
  - The `ImportProblem` row gains no field. Its title is the show's, and its reason the count (_24 episodes need numbers_).
  - The **Problem detail** gains `files.videos: string[]`: every video as an absolute path, in name order. The same field serves a film.
- **`ProblemRow`** gives `unplaced` a _Resolve_ → `/add?kind=series&problem=<id>`, plus `&series=<id>` when the show is held. The `resolvable` exclusion goes.
- **The Series Resolve** (`useMovieForm`, series kind in import context):
  - One Episode file row per Unplaced video, as `found` paths, prefilled by the **Numbering guess**: the season from the folder, the episode from the Episode word, else the next free number in name order.
  - Joining a held series, the fields come from it, and the gate also refuses a number the series already holds.
- **The resolve route** `POST /api/import/current/problems/:id/resolve` reads the body with `seriesFormBody` when the Problem is `unplaced`, and with `movieFormBody` otherwise. `found` paths copy only from under the run's root. A save creates the series or joins the held one, records each Source file, and takes the Problem off the list.
- **The film's parity case.**
  - `filesOf` lists every video in `files.videos`, and still sets `video` only when there is exactly one.
  - `matchRows`' two-video `no-video` reason reads _Two videos — pick the film._
  - `MovieFormFiles`' video slot draws the **Found-file choice** when `videos` has more than one: the names as options, the first preselected, the picker kept beside them.

### Types (log 38 § Types)

- `StartEnrichment.seriesId?` and `EnrichmentRun.seriesId?`.
- `ImportProblemDetail.files.videos: string[]`.
- `Episode.sourceFile: string | null`.
- Server-only: `TitleRef = { kind: 'movie' | 'series'; id }`.
- The series edit body's episode field: `{ id?, season, number, title }`.

## Testing Decisions

- A good test checks what a unit answers, what the wire carries, or what a person sees, and never how a unit is wired inside. Server units run over sandboxes and real SQLite, routes over the composed router, and hooks and organisms through the DOM with `fakeResponse`.
- **Series `write`, `deleteSeries`:** the row, its episodes, genres and subtitles go; an unknown id answers not-found. Prior art: the movie delete's storage cases.
- **`createMedia`, `removeSeriesFolder`:** the Series folder goes, a missing one is nothing, a locked file doesn't throw. Prior art: `removeMovieFolder`'s cases.
- **Routes, `DELETE /api/series/:id`:** `204` then the series page `404`s and its folder is gone; `404` for an unknown id. Prior art: the movie Delete route's suite.
- **`SeriesEditMenu`, `DeleteSeriesDialog`, `useDeleteSeries`:** the three items and where each goes; the dialog's copy and episode count; confirm before Cancel (`comesBefore`); _Deleting…_ in flight; back through `useGoBack` onto the Series tab. Prior art: `EditMenu`, `DeleteMovieDialog` and `useDeleteMovie`'s suites.
- **`createEnrichment`, over `fakeTmdb`:**
  - A `single` series run.
  - Series `ambiguous`, `missing` and `conflict` Decisions, with `search`, `pick`, `apply` and _Skip_ on each.
  - The Title fix for both kinds: the title written, the year only when blank; never on a Confident match or `apply`.
  - Series conflicts under _Everything_ only.
  - Prior art: the film Decision suites and log 33's single-run suites.
- **`decisionFace`, TV variant:** name, first air year, the genre off the pool.
- **`enrichmentBody`:** `seriesId` read; both ids, or neither on `single`, refused.
- **`enrichPath`, `movieFormPath`:** the `{ series }` spellings, the id encoded.
- **`useEnrichmentRun`, `EnrichmentFlow`:** re-attach only to the same series' `single` run; the Waiting run, Let-go line and Busy notice for a series; _Back_ and _Done_ onto the series page.
- **Series `write`, `updateSeries`:**
  - A swap of two episodes' numbers in one save succeeds.
  - A kept episode keeps its id, watch state, resume position and still.
  - A removed episode's rows go.
  - A refusal partway changes nothing.
- **Routes, `PATCH /api/series/:id`:** each refusal (`404`; an unknown, repeated or clashing id) with nothing written and no stored file left behind; a title-only edit carries no file part. The Match unlink on both PATCH routes: a title or year change clears `tmdb_id`, any other change keeps it. Prior art: `PATCH /api/movies/:id`'s suite.
- **`useMovieForm`, `useEpisodeList`, `MovieForm`:** the Series edit job prefilled, held rows in order, no Kind tabs, the gate, the landing; the Series Resolve's rows under the Numbering guess and the held-number refusal on a join.
- **Migrations:** migration 8 adds `source_file`, and the `resetDatabase` table guard still passes.
- **`createImporter`:**
  - Source file written by a sheet import and a Folder scan.
  - A scan skips a held Source file before the tag.
  - One `unplaced` Problem per show, with `files.videos` in name order.
  - A two-video film folder lists both videos and sets no `video`.
  - Prior art: the series fixture suites.
- **`episodeTag` and `readEpisodeTag`:** the Episode word's shapes, season-known only, never making a show. The drift guard holds both to one table.
- **Routes, the resolve route with a series body:** create, join, the held-number refusal, `found` outside the root refused, Source file recorded, the Problem gone.
- **`ProblemRow`:** `unplaced` draws _Resolve_ and its URL, with `series` when held.
- **`MovieFormFiles`:** the Found-file choice for two or more videos, the first preselected, the picker beside it; none for one.

## Out of Scope

- Renaming source files on disk.
- Editing episode numbers from the Season page.
- Moving an episode to another series.
- A series-level Source file chooser for a show split over two folders.
- TMDB's title overwriting the household's on a Confident match.
- The title as an eleventh Enrich field.
- An _Unlink TMDB_ menu item.
- `kind` on the wire `Decision`.
- A `409` guard on a series delete while a run runs.
- Dropping the episodes' UNIQUE index.

## Further Notes

- The glossary was updated in log 38's commit: Title, Title editing, Title parity, Title fix, Title reference, Match unlink, Series edit menu, Series edit job, Two-pass renumber, Series Resolve, Found-file choice, and the updated Episode link, Source file, Single-title Sync, Edit a series and Delete a series.
- The build order in README and CLAUDE.md should name step 21 as **Title editing** and drop 22 and 23. ✅ is ticked only after the step's refactor, not when the build issues close.
- `useMovieForm` grows to five jobs (add, edit, resolve, series edit, series resolve). It was already flagged in log 32, and this step's refactor is when it is split.
- `createEnrichment` branches on kind in four more places. If the refactor finds `SeriesEditMenu` and `EditMenu` identical, it extracts them then.
