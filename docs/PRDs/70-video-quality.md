> **Initiative:** `video-quality`
> **Issue:** #663 (the PRD, step 52)
> **Design log:** `docs/design-logs/70-video-quality.md`
> **Handoff:** `docs/handoff/handoff-video-quality/`, the spec until phase 1 amends `mol.PosterCard`, `page.LibraryPage`, `page.SettingsPage`, the model in `FamilyFlix.dc.html` and `COMPONENT-SPEC.md` to it
> **Build order:** step 52, **Video quality**. It ships as thin slices (log 70, _Implementation Plan_). One migration (17), one new setting, one new atom (`prim.MetaTag`), the server's first background work after start.

## Problem Statement

Mum picks _Amelie_ off the shelf for a film night on the big screen. It plays as a DVD rip, soft and boxy, while the 1080p copy of _Die Hard_ beside it would have looked sharp. Nothing in FamilyFlix tells the household how good a file is before they press play:

- A **Poster card** shows the art, a heart, a watched badge, a progress bar and the **Star row**, and nothing about the video itself.
- The library already held has never been measured, and a migration cannot open a file to measure it.
- A series has many files, and its episodes may not agree: a first season ripped from DVD, the rest 1080p.
- There is no way to ask the browse for _only the good copies_.
- The **Library sheet** carries a title's runtime but not its quality, so an import of a sheet on a machine with no FFmpeg learns nothing about it.

## Solution

Every movie and episode carries its **Video quality**, one rung of the **Quality ladder** (`4K`, `1080p`, `720p`, `480p`, `SD`), and every Poster card can show it.

- **Measured, not typed.** ffprobe reads the picture stream's frame size, and its **Nominal height** (the larger of its height and its width × 9/16) picks the rung, so a widescreen `1920x800` film is still _1080p_ and a `720x576` DVD is _480p_. The quality is measured from the same single probe that already gives a title its runtime, wherever a runtime is derived: an add, an edit, a series save, a bulk import, a **Found again** video, a **Resolve**.
- **The library already held is measured by itself.** Once the server starts, the **Quality sweep** measures every held movie and episode that has no quality yet and whose video is there, one at a time and in the background. It runs on every start, so a file nothing could probe today is asked again after a component is installed; a title measured once is never asked again.
- **A file nothing could probe carries no tag**, rather than a guess.
- **A series shows its Series quality:** the rung most of its measured episodes are on, a tie going to the better rung. It is derived on every read, never stored.
- **The Quality tag** is a small word in a hairline box (`prim.MetaTag`) at the right end of the Poster card's Star row. It never sits on the art, because the art's corners and bottom edge are already taken.
- **Settings → Display → _Show video quality_**, on by default, shows or hides the tags and the filter.
- **The Quality filter:** while the toggle is on, a _Quality_ pill after _Rating_ keeps titles at or above a rung (_All qualities_, _4K_, _1080p+_, _720p+_, _480p+_), on both tabs and the **Genre page**, written to the URL as `?quality=`.
- **The Library sheet** gets a _Quality_ column after _Runtime_, written by every **Sheet writer** and read back by an import; the probe's answer wins, and the sheet's stands in when the probe has none.

## User Stories

1. As the household, I want each Poster card to show how sharp its video is, so that I can pick the best-looking copy before pressing play.
2. As the household, I want the tag to read one of _4K_, _1080p_, _720p_, _480p_ or _SD_, so that it uses words we already see on TVs and boxes.
3. As the household, I want a widescreen `1920x800` film to read _1080p_, not _720p_, so that a letterboxed film isn't marked down for its black bars.
4. As the household, I want a `3840x1600` film to read _4K_, so that a cropped 4K film is still called 4K.
5. As the household, I want a 4:3 `1440x1080` film to read _1080p_, so that an old film in its original shape is rated by its sharpness.
6. As the household, I want a DVD rip (`720x576` or `720x480`) to read _480p_, so that I can tell it apart from an HD copy.
7. As the household, I want a small web video (`640x360`) to read _SD_, so that I know it will look soft on the TV.
8. As the household, I want an odd encode (`1600x900`, `2560x1440`, `960x540`) to land on its nearest rung, so that the tag never shows a size the ladder doesn't name.
9. As the household, I want a file nothing could probe to show no tag at all, so that the app never guesses wrongly.
10. As the household, I want the tag to sit at the end of the Star row below the art, so that it never covers a poster's lettering, the heart, the watched badge or the progress bar.
11. As the household, I want a card with no tag to look exactly as it does today, so that turning the feature off or a missing quality leaves no gap.
12. As the household, I want the tag to look like a quiet label, not a button, so that I don't try to press it.
13. As the household, I want the tag never to take keyboard focus, so that moving through the shelves isn't slowed by an extra stop per card.
14. As a screen-reader user in the family, I want a card's name to stay its title, so that the tags don't double the length of every shelf read out.
15. As the household, I want a series poster to show the quality most of its episodes are on, so that the tag matches what _Play_ will usually show.
16. As the household, I want a series whose episodes split evenly between two rungs to show the better one, so that a tie has one clear answer.
17. As the household, I want one stray SD extra not to mark a 1080p show as SD, so that the series tag is fair.
18. As the household, I want a show whose last season is 4K but most are DVD not to read _4K_, so that the poster doesn't promise more than most episodes give.
19. As the household, I want a series with no measured episode to show no tag, so that an empty show doesn't claim a quality.
20. As the household, I want a series' tag to change as soon as an episode is added or replaced, so that it is never out of date.
21. As the maintainer, I want a title I add through the **Movie form** to be measured on save, so that it carries its tag straight away.
22. As the maintainer, I want a title whose video I replace on an edit to be measured again, so that a better copy shows its better tag.
23. As the maintainer, I want every title a **Bulk import** adds to be measured from the same probe that reads its runtime, so that a large linked import isn't twice as slow.
24. As the maintainer, I want a **Found again** video and a **Resolve** to be measured like any add, so that no path into the library skips the tag.
25. As the maintainer, I want a series save to measure each episode's video, so that the Series quality is right from the first save.
26. As the maintainer, I want a failed measurement never to block a save or an import, so that a broken file still gets into the library.
27. As the maintainer, I want the library I already hold to be measured without my pressing anything, so that every poster gets its tag after one start.
28. As the household, I want the app to stay usable while the library is being measured, so that a first start after the update doesn't freeze the browse.
29. As the household, I want tags to appear on the shelves as the sweep works through them, so that I see progress without a progress screen.
30. As the maintainer, I want the sweep to measure only titles with no quality, so that a title measured once is never probed again.
31. As the maintainer, I want the sweep to try again on the next start for a file nothing could probe, so that installing a component later fills in the gap.
32. As the maintainer, I want the sweep to pass over a video that is missing or on an unplugged drive, so that it never fails or waits on a drive that isn't there.
33. As the maintainer, I want the sweep to write only the quality, so that a runtime the household or a sheet gave is never overwritten.
34. As the maintainer, I want quitting the app mid-sweep to stop the sweep before the database closes, so that a quit never corrupts or hangs.
35. As the maintainer, I want the sweep to work through movies first, A to Z, then episodes, so that the most-browsed shelves fill first.
36. As the maintainer, I want mock series episodes, which have no files, to be passed over by the sweep, so that the seed doesn't fill the log with failures.
37. As the household, I want a _Show video quality_ toggle in Settings → Display, so that I can hide the tags if they're clutter to me.
38. As the household, I want the toggle on until I change it, so that the feature shows itself on first use.
39. As the household, I want the toggle to sit after _Fill in ratings from TMDB_ and before _Start on_, with a sentence saying what it does and that it also hides the filter, so that I know what I'm turning off.
40. As the household, I want the toggle not drawn until Settings has read its value, so that it never flips under my finger.
41. As the household, I want turning the toggle off to hide every Quality tag at once, on every shelf and page, so that the change is obvious.
42. As the household, I want my choice remembered across restarts, so that I set it once.
43. As the household, I want no snackbar on toggling, so that it behaves like its neighbours.
44. As the household, I want a _Quality_ pill between _Rating_ and _Sort_, so that I can ask for only the good copies.
45. As the household, I want its rows to read _All qualities_, _4K_, _1080p+_, _720p+_, _480p+_, so that picking one keeps everything at least that good.
46. As the household, I want _1080p+_ to keep 4K films too, so that asking for good copies never hides the best ones.
47. As the household, I want a title with no quality dropped by any minimum, so that a filtered shelf only shows titles known to be good enough.
48. As the household, I want _All qualities_ to show everything, unmeasured titles included, so that the default hides nothing.
49. As the household, I want the pill to show no counts, so that it reads as a scale, not as shelves.
50. As the household, I want no _SD+_ row, so that no choice looks like it filters while doing nothing.
51. As the household, I want the filter on both the Movies and Series tabs and on the Genre page, wherever the Rating pill is, so that it works everywhere I browse.
52. As the household, I want a series filtered by its Series quality, so that the filter agrees with its tag.
53. As the household, I want the filter to work together with genre, rating and sort, so that I can ask for 1080p+ comedies rated four stars and up.
54. As the household, I want the chosen quality kept in the URL, so that _Back_ and a reload keep my filter.
55. As the household, I want the pill hidden while _Show video quality_ is off, so that I'm never filtering by a quality I can't see.
56. As the household, I want a link carrying `?quality=` to show the whole library while the toggle is off, so that a hidden filter never quietly empties a shelf.
57. As the household, I want turning the toggle off never to rewrite my URL, so that turning it back on restores my filter.
58. As the household, I want the pill not drawn until Settings has landed, so that it doesn't flash in and out on load.
59. As the maintainer, I want a bad `?quality=` value refused with `400 Invalid quality: …`, so that a typo in a link is clear rather than silent.
60. As the maintainer, I want the URL to read `?quality=4k` and `?quality=1080p`, lowercased, so that links are easy to type.
61. As the maintainer, I want a _Quality_ column after _Runtime_ in the Library sheet, so that I can see and edit what every title was measured as.
62. As the maintainer, I want the column filled on Movie and Episode rows and blank on Series and Season rows, so that the sheet holds only stored facts, not derived ones.
63. As the maintainer, I want a title with no quality to leave the cell blank, so that blank always means unmeasured.
64. As the maintainer, I want an **Export** to write the column too, so that a copied library keeps its qualities.
65. As the maintainer, I want an import to read the column back under _Quality_ or _Resolution_, any case (`4k`, `1080P`), so that a hand-edited sheet still reads.
66. As the maintainer, I want a value off the ladder reported as an **Unread cell**, like every other unreadable cell, so that I can fix it.
67. As the maintainer, I want the probe's measurement to win over the sheet's on an import, so that the file's own frame is the truth.
68. As the maintainer, I want the sheet's quality kept when the probe answers none, so that a linked video on a machine with no FFmpeg still keeps its tag.
69. As the maintainer, I want a sheet written before this step, with no _Quality_ column, to read exactly as today, so that old libraries still import.
70. As the maintainer, I want `npm run db:seed-series` to give its mock episodes mixed and tied qualities, so that I can see the Series quality rule in the dev app.
71. As the maintainer, I want the dev fixture's videos measured on import like any others, so that the dev library shows real tags.
72. As the maintainer, I want the Movie form not to offer a quality field, so that a quality is always measured, never typed.

## Implementation Decisions

- **One initiative**, `video-quality`, step 52, design log 70. The handoff README is the spec until phase 1 amends the prototype to it (log 63's way); after that the prototype rules.
- **The Quality ladder** is a shared server-and-wire constant, `VIDEO_QUALITIES` (best first), with `VideoQuality` its union type. It is the one statement of the ladder's order: the SQL ranking, the filter's options and the sheet's reader all derive from it.
- **What is stored is the rung, never the pixels.** Nothing stores a width or a height.
- **`qualityOf(frame): VideoQuality | null`**, a new pure unit in the playback domain. It applies the **Nominal height** (`max(height, width × 9/16)`) with floors halfway between rungs: `4K` ≥ 1620, `1080p` ≥ 900, `720p` ≥ 600, `480p` ≥ 420, `SD` below. The coded frame is used as ffprobe gives it; the sample aspect ratio is not read. A missing or zero dimension gives `null`.
- **The probe learns `frameSize: { width; height } | null`**, read from the same picture stream it already picks for `videoCodec` (the first video stream that isn't `attached_pic`).
- **`Playback.measure(file): VideoMeasure` replaces `Playback.duration`**: `{ durationSeconds, quality }` from one ffprobe call. The duration keeps its MP4 `mvhd` fallback; the quality has no header fallback. `duration` is removed, since it would have no caller.
- **`derivedVideoFacts(playback, video): VideoFacts`** replaces `derivedRuntime`: `{ runtimeMinutes, videoQuality }`. It is called at every site `derivedRuntime` was (the importer's adds, Found again, Resolve, and the routes' add, edit and series saves). It never throws and answers `null` for what it can't read. A site that falls back to the sheet's runtime falls back to the sheet's quality the same way.
- **Migration 17**: a nullable `video_quality TEXT` on `movies` and `episodes`, backfilling nothing. On the wire, `Movie.videoQuality` and `Episode.videoQuality` are `VideoQuality | null`; `MoviePatch` and the episode inputs take it as they take `runtimeMinutes`.
- **The Series quality is derived on every read** as one SQL subquery, built by a `qualityRank(column)` helper (a `CASE` over `VIDEO_QUALITIES`) in the library domain. The series reads and the Quality filter share it. The most common measured rung wins, a tie goes to the better rung, and no measured episode gives `NULL`. It is exposed as `Series.videoQuality`, and no `series.video_quality` column is stored.
- **The Quality sweep**, `createQualitySweep({ storage, playback })`, a new unit in the playback domain with `start()` and `stop(): Promise<void>`:
  - `main.ts` starts it after the server listens, on every start.
  - It reads `storage.unmeasuredVideos()`: rows with `video_quality IS NULL`, movies first, A to Z.
  - It skips any video whose `videoFile` answers `missing` or `unreachable`.
  - It measures one file at a time and writes through `storage.recordVideoQuality(kind, id, quality)`, which touches that one column and nothing else.
  - It yields to the event loop (`setImmediate`) between files, so a request waits behind at most one `spawnSync` probe.
  - The **Ordered shutdown** awaits `stop()` before the database closes.
  - No "swept" flag, no manual button, no re-probe of measured titles, no runtime writes.
- **Card preferences**: `view(movie, …)` and `seriesCardView(series, …)` take one options object, `CardPreferences { tmdbRatings; qualityTags }`, instead of a positional boolean. It is answered by a new `useCardPreferences()` that replaces `useTmdbRatings()` at the 8 card call sites. `PosterCardMovie.quality: VideoQuality | null` is the title's quality while `qualityTags` is on, else `null`. The molecule never reads the preference.
- **`prim.MetaTag`**, a new atom: `{ label: string }`, 11px sans, weight 600, `.04em` letter-spacing, `2px 6px` padding, a 1px `border`-token hairline, a 4px radius, `textDim`, no fill, line-height 1. It is never a control and never focusable.
- **`PosterCard`**: the Star row becomes a flex row (`space-between`, centred): stars left, the tag right, drawn only when `quality` isn't `null`. The art is unchanged, and the accessible name stays the title.
- **The setting**: `settings.quality-tags`, exposed as `Settings.qualityTags`, on until set. It is written by `POST /api/settings/quality-tags { value: boolean }`, a **Single-signal write** (400 for a non-boolean).
  - `DisplayPreferenceProvider` holds `qualityTags: boolean | null` (`null` until landed) and `setQualityTags`, which writes through a new `saveQualityTags` call.
  - `DisplaySection` draws the _Show video quality_ row (copy per the handoff) with a `prim.Toggle`, once the read lands. No snackbar.
- **The Quality filter**:
  - The browse takes `LibraryQuery.minQuality?: VideoQuality`. Every route that reads `?rating=` also reads `?quality=` (the rung lowercased: `4k`, `1080p`, `720p`, `480p`); a value off the ladder answers `400 Invalid quality: …`.
  - Movies filter on `video_quality` and series on their Series quality, both through `qualityRank`. A `NULL` quality is dropped by any minimum.
  - `qualityOptions` / `qualityLabel` follow `ratingOptions`' shape.
  - `LibraryFilters` draws a `mol.FilterDropdown` _Quality_ between _Rating_ and _Sort_, valued _All qualities_ until chosen, with no counts. It is drawn only while `qualityTags` is `true`, on both tabs and the Genre page.
  - `useLibraryQuery` ignores `?quality=` while the toggle is off and never rewrites the URL for it.
- **The Library sheet**: `Quality` is added to `SHEET_COLUMNS` after `Runtime`. `exportRows` fills it on Movie and Episode rows and leaves it blank on Series and Season rows and for a `NULL` quality. `readSheet` reads it under the aliases `quality` and `resolution`, case-folded; a value off the ladder is an **Unread cell**, and a sheet without the column reads as today.
- **The seed**: `db:seed-series` writes qualities on its mock episodes, mixed in one show and tied in another.
- **Slices** (log 70, _Implementation Plan_):
  1. One film, end to end: the prototype amended; `VideoQuality`, `frameSize`, `qualityOf`, `measure`, `derivedVideoFacts` at every site; migration 17; `Movie.videoQuality`; `MetaTag`; the tag on a movie's card, always drawn.
  2. The Quality sweep, its storage read and write, its wiring and its shutdown stop.
  3. Series: `Episode.videoQuality`, `qualityRank`, the Series quality on reads and cards, the seed.
  4. The toggle: the setting and route, the provider, `useCardPreferences` at the 8 sites, the Display row.
  5. The filter: `?quality=` on both browses, `qualityOptions`, the pill.
  6. The sheet: the column written and read back.
  7. Walk it live over the dev library and a mixed folder, then the documents (log 70 Q19).

## Testing Decisions

- A good test drives a unit through its public face and checks what the household would see or what the server would store: the rung a given frame gets, the tag a card draws, the titles a filtered browse answers, the cell a sheet carries. It never checks which helper ran or how many spawns happened inside a unit, except where the single probe is the contract (`measure`).
- **`qualityOf`**: one case per example row of log 70 Q4 (`3840x2160`, `3840x1600`, `4096x1716`, `1920x1080`, `1920x800`, `2560x1440`, `1600x900`, `1280x720`, `1280x544`, `720x480`, `720x576`, `960x540`, `640x360`, `480x270`), the floors' edges, and a missing or zero dimension giving `null`. Prior art: the pure playback units' tests (`choosePlaybackPath`, `trackLanguage`).
- **`probe`**: `frameSize` is read from the picture stream and skips an `attached_pic`; no video stream or no size gives `null`. Prior art: the existing `probe` tests over canned ffprobe JSON.
- **`createPlayback.measure`**: duration and quality from one probe; the `mvhd` fallback still gives a duration when the probe answers none, with quality `null`. Prior art: the existing `duration` tests.
- **`derivedVideoFacts`**: both facts from a measured file; `null`s and no throw for a missing file, no component, or a probe failure. Prior art: `derivedRuntime.test.ts`.
- **The write sites**: an add, an edit with a new video, a series save, a bulk import, a Found again and a Resolve each store `video_quality`, and an import with a sheet falls back to the sheet's quality only when the probe answers none. Prior art: the route and importer tests that assert `runtimeMinutes`.
- **Migration 17**: the columns exist and are `NULL` on rows from before it. Prior art: `db.scannedAt.test.ts`.
- **`createQualitySweep`**: measures only unmeasured rows, movies first, A to Z; writes the quality alone, leaving the runtime; passes over missing and unreachable videos; asks again on a second start for a row still `NULL`; never asks again for a measured one; `stop()` resolves mid-run and nothing is written after it; and a request can be served between two files. Prior art: the importer's cancellable-run tests and `orderedShutdown`'s tests.
- **The Series quality**: majority wins; a tie goes to the better rung; an unmeasured episode doesn't count; no measured episode gives `null`; the filter agrees with the read. Prior art: the series browse tests.
- **The browse filter**: `?quality=` keeps titles at or above the rung on movies and series, drops `NULL`s, combines with genre and rating, and a value off the ladder answers 400. Prior art: the `?rating=` route tests.
- **The setting**: `quality-tags` reads `true` until set and round-trips; a non-boolean answers 400. Prior art: the `tmdb-ratings` setting tests.
- **`MetaTag`**: draws its label and is not focusable or a control. Prior art: the other primitives' tests.
- **`PosterCard`**: draws the tag at the Star row's end when `quality` is set, nothing when `null`; the accessible name is unchanged. Prior art: `PosterCard.test.tsx`.
- **`view` / `seriesCardView`**: `quality` follows `videoQuality` while `qualityTags` is on and is `null` while it is off; `tmdbRatings` behaves as before. Prior art: their existing tests.
- **`qualityOptions` / `qualityLabel`**: the five rows in order, the URL values, and labels both ways. Prior art: `ratingOptions.test.ts`.
- **`LibraryFilters` / `useLibraryQuery`**: the pill is drawn only while the toggle is on and landed; choosing a row writes `?quality=`, and _All qualities_ removes it; with the toggle off, `?quality=` on the URL is ignored and the URL is left alone. Prior art: the Rating pill's tests.
- **`DisplaySection`**: the row is drawn after the read lands, its toggle reflects and writes the setting, and there is no snackbar. Prior art: the _Fill in ratings from TMDB_ row's tests.
- **The sheet**: `exportRows` writes `Quality` on Movie and Episode rows and leaves it blank elsewhere; `readSheet` reads `quality`/`resolution` in any case, reports an off-ladder value as an Unread cell, and reads an old sheet unchanged. Prior art: the `Runtime` column's tests.
- Every slice starts RED (`tdd`); the acceptance is the walk in the dev app over the dev library and a folder of mixed qualities.

## Out of Scope

- A tag on the **Continue card**, the **Season card**, an **Episode row** or the **Movie detail page**.
- A sort by quality.
- HDR, codec, bitrate or audio channels on the tag; any rung beyond the five (`1440p`, `2K`, `8K` fold into their neighbours).
- A quality field on the Movie form; a hand-typed quality anywhere but the Library sheet.
- The MP4 header's `tkhd` size as a fallback when no component can probe.
- A _Measure library_ button, a progress screen for the sweep, or a one-time "swept" flag.
- Re-measuring a title that already has a quality, except when its video is replaced by a save.
- Announcing the tag to assistive technology.

## Further Notes

- This is the server's first background work after start. The Ordered shutdown gains one more thing to stop, and every start probes the files nothing could read before.
- The probe is `spawnSync` with a 15s timeout, so one bad file can hold every request for up to 15s, once per start. The sweep's yield between files limits that to one file at a time; log 70 accepts the cost.
- `derivedVideoFacts` and the single probe are the seam for any future fact read from a video's bytes.
- The checklist's step 52 entry, the glossary's **Video quality** section and the handoff README were written in the grill-me (log 70). Phase 1 amends the prototype and `COMPONENT-SPEC.md`; the docblocks of Q19 follow in the final slice.
