> **Initiative:** `episode-stills`
> **Design log:** `docs/design-logs/44-episode-stills.md`
> **Issue:** #381 (the PRD, step 27; tracking issue #380)
> **Build order:** step 27, the first after TMDB ratings. It ships as four thin slices (log 44, _Implementation Plan_). No prototype revision: `EpisodeRow` and the Up next card already draw a still.

## Problem Statement

I synced our series with TMDB. For some shows every episode now has a picture on the season page. For others TMDB has no pictures at all, so the whole season is a column of gradients, and my parents cannot tell one episode from the next at a glance. Sometimes it is half and half within one season.

Every one of those episodes is a video file sitting on our disk, and each file has a picture inside it. The app already has FFmpeg to play them. It just never takes a picture out of one.

These shows also never leave _Only what's missing_. The Sync counts an episode with no still as a gap, so every Sync asks TMDB again for stills it does not have, and the count in the setup never reaches zero.

## Solution

When a Sync reaches a show and TMDB offers no **Still** for an episode, the Sync takes a **Frame still** from the episode's own video instead. It is one frame at the **Frame point**, a third of the way into the file. It is stored beside the TMDB stills in the show's managed folder, and it is drawn on the season page, in the Up next card and in an Export exactly like a TMDB still, with no mark.

TMDB stays preferred. If TMDB later adds a still for that episode, the next Sync that reaches the show swaps the frame for TMDB's and deletes the frame file. A still the family picked in the series form is never replaced, and neither is a TMDB still.

Nothing new appears on screen. There is no new button, setting or progress screen: a frame is part of the Sync's pass over the show, logs one line in the Activity log, and stops when _Stop_ is pressed. Without FFmpeg, with an unreadable file, or when the video's length cannot be read, the episode keeps its gradient, and nothing is reported as an error.

## User Stories

### Getting a picture

1. As a parent, I want every episode on a season page to show a picture, so that I can recognise an episode before I play it.
2. As the maintainer, I want the Sync to take a picture from the episode's own file when TMDB has none, so that a show TMDB has no stills for still gets art.
3. As the maintainer, I want this to happen as part of the Sync I already run, so that I do not have to learn a new action.
4. As the maintainer, I want a frame taken only when the Poster chip is on, so that a Sync I limited to text fields writes no images.
5. As the maintainer, I want a frame taken only for an episode with no still, so that a Sync never replaces art I already have with a frame.
6. As the maintainer, I want a frame taken for an episode TMDB does not list at all, so that an extra episode on disk is not left as the one gradient in the season.
7. As the maintainer, I want a frame taken for an episode TMDB lists without a still, so that TMDB's gaps are filled.
8. As the maintainer, I want the frame taken a third of the way into the video, so that it shows the episode and not a black opening, a logo or the credits.
9. As the maintainer, I want the third measured off the file's own length rather than the stored runtime, so that an extended or cut file still gets a frame from its middle.
10. As the maintainer, I want the frame kept at the video's own resolution, so that it looks as sharp as a TMDB still on a large screen.
11. As the maintainer, I want the frame stored in the show's managed folder beside the TMDB stills, so that all of a show's art lives in one place.
12. As the maintainer, I want a frame taken from a Linked video never to write anything into the Library folder, so that the family's folders stay exactly as they are.
13. As the maintainer, I want a frame's file named so I can tell it from a TMDB still when I look in the folder, so that the folder makes sense to a person.

### TMDB first

14. As the maintainer, I want TMDB's still used whenever TMDB has one, so that the official picture wins over a frame.
15. As the maintainer, I want a frame replaced with TMDB's still on a later Sync once TMDB adds one, so that a show TMDB fills in later gets better art without me doing anything.
16. As the maintainer, I want the old frame file deleted once TMDB's still replaces it, so that the media folder does not fill with unused frames.
17. As the maintainer, I want a held frame not taken again when TMDB still has nothing, so that a second Sync does no extra work on that episode.
18. As the maintainer, I want a TMDB still that fails to download not to fall back to a frame, so that a network blip does not fix a frame in place where TMDB has a real still.
19. As the maintainer, I want that episode to stay counted as missing, so that the next Sync tries TMDB again.
20. As the maintainer, I want a still I picked in the series form never replaced by a Sync, so that my choice is final.
21. As the maintainer, I want a TMDB still never replaced by a frame, so that a Sync never makes art worse.

### The Sync gap

22. As the maintainer, I want an episode with a frame to count as having a still, so that _Only what's missing_ stops re-syncing shows TMDB has no stills for.
23. As the maintainer, I want the setup's count to reach zero once every title is complete, so that I can tell the library is done.
24. As the maintainer, I want _Everything_ to still reach every show, so that I can upgrade frames to TMDB stills whenever I choose.

### Progress, cancel and the log

25. As the maintainer, I want each frame to log one line in the Activity log, `▣ name  →  stored`, so that I can see frames being taken next to the `↓` lines for TMDB stills.
26. As the maintainer, I want an episode that gets no frame to log nothing, so that the log is not flooded with non-events at a thousand episodes.
27. As the maintainer, I want _Stop_ to stop a frame in progress, so that cancelling a Sync is immediate even on a large file.
28. As the maintainer, I want a frame that takes too long given up on (the **Frame budget**, 20 seconds), so that one slow file or drive cannot stall the whole Sync.
29. As the maintainer, I want the Sync's bar and estimate to keep counting titles, so that the screen stays as it is.

### When there is no picture to take

30. As the maintainer, I want an episode to keep its gradient when FFmpeg is not available, so that a missing component never breaks a Sync.
31. As the maintainer, I want an episode to keep its gradient when its file is missing, so that a moved file is not an error.
32. As the maintainer, I want an episode whose Library folder cannot be reached to keep its gradient and its gap, so that the next Sync with the drive connected takes the frame.
33. As the maintainer, I want an episode whose length cannot be read to keep its gradient, so that no frame is taken from a guessed point.
34. As the maintainer, I want an episode whose frame cannot be stored to keep its gradient, so that a storage failure does not stop the Sync.
35. As the maintainer, I want no frames for specials (season 0), so that the Sync keeps its rule of never reading season 0.
36. As the maintainer, I want an unmatched show to get its frames on the Sync that matches it, so that nothing is taken before the show is known.
37. As the maintainer, I want an uploaded Playback component to be the one that takes frames, so that the codec pack I installed is used for stills as well as playback.

### Drawing, editing and exporting

38. As a parent, I want a frame drawn exactly like a TMDB still, with no mark, so that the season page looks uniform.
39. As a parent, I want the Up next card to draw the next episode's frame, so that I can see what is coming.
40. As the maintainer, I want a frame shown in the series form's Still slot like any held still, so that I can see it when I edit the show.
41. As the maintainer, I want to replace a frame I dislike by picking a file in the series form, so that I stay in control of the art.
42. As the maintainer, I want the replaced frame file deleted when I pick a new still, so that the folder stays clean.
43. As the maintainer, I want saving the series form without touching a frame to keep it as a frame, so that a later Sync can still upgrade it to TMDB's.
44. As the maintainer, I want a frame carried in an Export with _Images_ on, under `stills/` and named in the Still cell, so that an Export is complete.
45. As the maintainer, I want the Export's columns unchanged, so that a round trip through Bulk import still adds nothing.
46. As the maintainer, I want a Factory reset to erase frames with every other still, so that a reset library is empty.

### Upgrading

47. As the maintainer, I want stills already held when this ships to be recorded as picked or TMDB by their names, so that a Sync after the upgrade treats them correctly.

## Implementation Decisions

### The Still source (schema)

- **Migration 14** adds `episodes.still_source TEXT`: one of `'tmdb'`, `'frame'` or `'picked'`, and `NULL` exactly when `still_path` is `NULL`. This is the **Still source**.
- Backfill: a held `still_path` whose name is form-shaped (`%-still.%`) becomes `'picked'`, and any other held still becomes `'tmdb'`. No frames exist before this migration.
- Every writer of `still_path` writes the source beside it. The Sync's TMDB still writes `'tmdb'` and its fallback `'frame'`. The series form's picked still writes `'picked'`. A held still the edit sends back unchanged keeps its source. A removed still writes `NULL` for both.
- The source is server-side only, on the `mediaFolderOf` precedent. The assembled `Episode` the client reads does not carry it, and `src/types/` does not change.
- `StillSource = 'tmdb' | 'frame' | 'picked'` lives with the series enrichment storage. `EpisodeEnrichment` gains `stillSource`, written with `stillPath` and never alone, and the episode column map gains it.
- The series enrichment storage gains one read, `stillSourcesOf(seriesId) → ReadonlyMap<episodeId, StillSource>`. The show pass reads it once per show, as it reads the Media folder once.
- The series write module's add and edit carry the source with every still write.
- Factory reset's erased-tables guard does not change, because the column goes with `episodes`.

### The grab (playback domain)

- A new pure unit in `playback/`, `frameArgs`: `FRAME_POINT = 1 / 3`, and `frameArgs(file, atSeconds) → string[]`, which is `-hide_banner -loglevel error -ss <t> -i <file> -frames:v 1 -an -sn -f image2pipe -c:v mjpeg -q:v 3 pipe:1`. `-ss` before `-i` (input seeking) keeps it fast on a 12 GB file. The video's native resolution is kept.
- A new `Playback` member, `frame(video: StoredVideo, signal: AbortSignal) → Promise<Readable | null>`. It resolves the file through `videoFile`, reads `duration(file)` (the probe, then the MP4's `mvhd`), and runs `slot.current()?.spawn(frameArgs(file, duration × FRAME_POINT))`. It collects stdout into a buffer and answers it as a stream.
- `frame` answers `null` in every case where there is no picture: no component, a `missing` or `unreachable` video, an unknown duration, a process that wrote nothing, the **Frame budget** (20 s) spent, or the signal aborted. In each case the process is killed. It never rejects (`derivedRuntime`'s rule).
- It goes through the existing `spawn` seam, so the `PlaybackComponent` interface does not change and the tests' scripted component can produce a frame. The component is read per call off the **Component slot**, so an uploaded component is the one used.
- There is no temp file: the picture comes back on stdout, and the only write is `media/`'s.

### The plan (enrichment domain)

- `planEpisode(episode, theirs: TmdbSeasonEpisode | undefined, fields, held: StillSource | null) → { enrichment, still: StillPlan }`, where `StillPlan` is `{ kind: 'tmdb'; path } | { kind: 'frame' } | null`.
- The still rule applies only under the Poster chip, and only when the episode holds no still or holds a frame:
  - TMDB offers a still → `tmdb`.
  - Nothing is held and TMDB offers none, or does not list the episode → `frame`.
  - A frame is held and TMDB offers none → `null`, so the frame is not taken again.
  - A `tmdb` or `picked` still is held → `null`.
- Title, air date and runtime are filled as today, and only when `theirs` is present.

### The pass (enrichment domain)

- `createEnrichment({ storage, client, media, playback })` takes `Playback` as a dependency, wired in `main.ts` as `createImporter`'s is. The suites that compose the router or the enrichment domain pass one.
- `writeEpisodes` no longer skips an episode TMDB does not list. It reads the held source off the show's `stillSourcesOf` map and lets the plan decide.
- **`tmdb`**: fetched with `client.image` and stored as `<stem>.still.jpg` with `storeNamed` in the Series folder's `season-NN/`. It is written with source `'tmdb'` and logged `↓`. If a frame was held, its file is then removed through `media.removeFile`. If the image fails or cannot be stored, nothing is written and the episode keeps whatever it held. A failed TMDB image never falls back to a frame.
- **`frame`**: `playback.frame(episode's StoredVideo, signal)`, then stored as `<stem>.frame.jpg` with `storeNamed` in the same `season-NN/`. It is written with source `'frame'` and logged `▣ <name>  →  <stored>` with kind `scan`. A `null` answer or a store failure is silent and leaves the gradient.
- An aborted signal ends the pass after the step in flight, as it does today.
- Season 0 is still never read, and an Unmatched show still has no episode pass.

### Unchanged

- `syncGap` still counts `still_path IS NULL` only, so a frame closes the gap.
- `exportRows` and `writeExport`: a frame is a still, carried under `stills/<Episode tag>` with _Images_ on and named in the `Still` cell. The sheets stay at sixteen and nine columns.
- No Write target, because stills are never written back into a Library folder.
- `src/` does not change: no new screen, no mark, no prototype revision. `EpisodeRow`, the Up next card and the series form's Still slot already draw a held still.

## Testing Decisions

- Tests check external behaviour only: what a pure function answers, what a domain member answers and writes, what a route echoes, what a migrated database holds. They never check how a function gets there.
- **Migration 14** (`db.test.ts`, the earlier migrations' precedent): a fresh database migrates to version 14. On a version-13 library, a form-shaped still is backfilled `'picked'`, any other held still `'tmdb'`, and an episode with no still `NULL`.
- **The series write module and the series routes** (the `editSeries` suite and the series write suite, #379's precedent): a picked still on add or edit is `'picked'`, a held still sent back unchanged keeps its source (a held frame stays `'frame'`), and a removed still clears both columns.
- **`stillSourcesOf`** (the series enrich suite): each episode's source by id, and none for an episode with no still.
- **`frameArgs`** (pure, its own suite): the argv in order, input seeking before `-i`, and the time at the given seconds.
- **`Playback.frame`** (the `createPlayback` suites, over a scripted component through the `fixedSlot` and component doubles): a frame's bytes come back as a stream. It answers `null` with no component, for a missing video, for an unreachable Library folder, with no duration, for an empty stdout, at the Frame budget and on abort, and the last three kill the process. It never rejects. One suite runs real ffmpeg over `test-support/fixtureVideo/` when ffmpeg is on PATH and skips otherwise, checking that the answer is a JPEG.
- **`planEpisode`** (pure, its suite extended): each row of the still rule above, for both a listed and an unlisted episode, with and without the Poster chip, and title, air date and runtime unchanged when `theirs` is present and untouched when it is absent.
- **The Sync's pass** (`createEnrichment.series.test.ts`, over `fakeTmdb` and a scripted Playback):
  - A frame for an episode TMDB offers no still for, and for one TMDB does not list, stored as `.frame.jpg` with source `'frame'` and logged `▣`.
  - No frame without the Poster chip, and none after a failed TMDB image.
  - A held frame plus TMDB's still gives `.still.jpg` with source `'tmdb'`, and the frame file is removed.
  - A held frame with TMDB offering none is not taken again.
  - A TMDB or picked still is never touched.
  - A `null` frame leaves the gradient and logs nothing.
  - _Stop_ aborts a frame in flight.
  - The Sync gap closes once every episode holds a still.
- Prior art: `derivedRuntime`'s suite for a best-effort reading that never throws, the existing `planEpisode` and Season poster suites for the pure plan, and the Season poster slices of `createEnrichment.series.test.ts` for the pass.

## Out of Scope

- A frame at import, or taken on demand from a menu or a Settings row.
- A chip or switch of its own: frames follow the Poster chip.
- Frames for season 0 or for films (a film has a poster and a backdrop, not a Still).
- Choosing the frame point, a frame picker, or detecting black frames or credits. A frame the family dislikes is replaced by picking a still in the series form.
- Showing the Still source to the client, a mark on a frame, or a source column in an Export.
- A new `PlaybackComponent` member, or a temp file for the grab.
- Writing stills back into a Library folder.

## Further Notes

- **The cost**: a Sync over a show TMDB has no stills for now runs one ffmpeg per episode, up to the 20 s Frame budget each on a slow Library folder. It is bounded by the budget and cancelled by _Stop_. Input seeking keeps a local file to well under a second.
- **The companion column**: `still_source` must stay in step with `still_path` in every writer. The pair is written together everywhere, and the migration and write suites hold that.
- **The glossary**: **Frame still**, **Frame point**, **Frame budget**, **Still source** and **Still plan** are in `docs/ubiquitous-language.md` since log 44. Never call a Frame still a thumbnail, a screenshot or a bare "frame".
- Feature is ✅ only after its refactor, not when the build issues close.
