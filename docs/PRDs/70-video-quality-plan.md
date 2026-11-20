# Plan: Video quality, every poster shows how sharp its video is

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/663

Every movie and episode carries its **Video quality**, one rung of the
**Quality ladder** (`4K`, `1080p`, `720p`, `480p`, `SD`), measured from the
same single probe that gives a title its runtime. A series shows its
**Series quality**, derived on every read. The **Quality sweep** measures the
library already held, the **Quality tag** sits at the end of the Poster
card's Star row, Settings → Display can hide it, the **Quality filter** keeps
titles at or above a rung, and the **Library sheet** carries a _Quality_
column. The spec is design log 70 and its handoff.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** Phase 10's walk is done by the agent itself in the dev app. No
decision is left open: log 70 settled them all.

- The phases are log 70's _Implementation Plan_ slices, thinned: slice 1
  into the Movie form (phase 1) and the other ways a movie gets in
  (phase 2); slice 3 into episodes measured (phase 3) and the Series quality
  (phase 4); slice 6 into the sheet written (phase 8) and read back
  (phase 9).
- **Two departures from log 70's order**, both so a unit is built once:
  the sweep comes after the series phases, so it covers movies and episodes
  from its first commit; and the sheet's quality as the probe's fallback
  (story 68) lands with the sheet's reader in phase 9, not in phase 2.
- **Each phase starts from its own RED test** (`tdd`), except phase 10's
  documents (proved by the walk and a green suite).
- **Every existing test stays green after every phase**; a test asserting
  `runtimeMinutes` keeps asserting it after `derivedRuntime` gives way.
- The glossary's **Video quality** section, the handoff README and the
  checklist's step 52 row were written in the grill-me; the row stays 🔜
  until the refactor. CLAUDE.md is untouched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: migration 17 adds a nullable `video_quality TEXT` to `movies`
  and `episodes`, backfilling nothing. No `series.video_quality` column, no
  width or height, no "swept" flag.
- **Routes**:
  - `POST /api/settings/quality-tags { value: boolean }`, a **Single-signal
    write** (400 for a non-boolean); `Settings.qualityTags` reads `true`
    until set.
  - Every route that reads `?rating=` also reads `?quality=`: `4k`, `1080p`,
    `720p`, `480p`, lowercased. A value off the ladder answers
    `400 Invalid quality: …`.
- **Prototype**: phase 1 amends `mol.PosterCard`, `page.LibraryPage`,
  `page.SettingsPage`, the model in `FamilyFlix.dc.html` and
  `COMPONENT-SPEC.md` to the handoff; after that the prototype rules. One
  new atom, `prim.MetaTag`.
- **Key models**:
  - `VIDEO_QUALITIES` (best first) and its union `VideoQuality`, shared by
    server and wire: the one statement of the ladder's order. The SQL
    ranking, the filter's options and the sheet's reader derive from it.
  - `qualityOf(frame): VideoQuality | null`, pure, in the playback domain:
    **Nominal height** `max(height, width × 9/16)`, floors `4K` ≥ 1620,
    `1080p` ≥ 900, `720p` ≥ 600, `480p` ≥ 420, else `SD`; a missing or zero
    dimension gives `null`. The sample aspect ratio is not read.
  - The probe answers `frameSize: { width; height } | null` from the picture
    stream it picks for `videoCodec`.
  - `Playback.measure(file): VideoMeasure` (`{ durationSeconds, quality }`,
    one ffprobe call) replaces `Playback.duration`; the duration keeps its
    `mvhd` fallback, the quality has none.
  - `derivedVideoFacts(playback, video): VideoFacts`
    (`{ runtimeMinutes, videoQuality }`) replaces `derivedRuntime` at every
    site; it never throws and answers `null` for what it can't read.
  - `Movie.videoQuality`, `Episode.videoQuality`, `Series.videoQuality`:
    `VideoQuality | null`. `MoviePatch` and the episode inputs take it as
    they take `runtimeMinutes`.
  - `qualityRank(column)`, a SQL `CASE` over `VIDEO_QUALITIES` in the
    library domain, shared by the series reads and the filter.
  - `createQualitySweep({ storage, playback })` with `start()` and
    `stop(): Promise<void>`, over `storage.unmeasuredVideos()` and
    `storage.recordVideoQuality(kind, id, quality)`.
  - `CardPreferences { tmdbRatings; qualityTags }`, answered by
    `useCardPreferences()`, taken by `view` and `seriesCardView` as one
    options object. `PosterCardMovie.quality: VideoQuality | null`.
  - `LibraryQuery.minQuality?: VideoQuality`; `qualityOptions` and
    `qualityLabel` in `ratingOptions`' shape.
- **The rules**:
  - A quality is measured, never typed, except in the Library sheet.
  - A file nothing could probe carries no quality and no tag.
  - The **Series quality** is the most common measured rung among its
    episodes, a tie going to the better rung, `NULL` with none measured.
  - A `NULL` quality is dropped by any minimum; _All qualities_ hides
    nothing.
  - The tag never sits on the art, never takes focus, and never changes a
    card's accessible name.

---

## Phase 1: One film, through the Movie form

**User stories**: 1 to 14, 21, 22, 26, 72

### What to build

The ladder end to end for one movie. The prototype is amended to the
handoff. The probe reads `frameSize`, `qualityOf` picks the rung,
`Playback.measure` answers duration and quality from one probe, and
`derivedVideoFacts` replaces `derivedRuntime` at every site (`duration` and
`derivedRuntime` are removed). Migration 17 adds the columns; an add through
the Movie form, and an edit with a new video, store the movie's quality,
answered on the wire as `Movie.videoQuality`. `prim.MetaTag` is born, and
the Poster card's Star row becomes a flex row with the tag at its right end,
drawn whenever `quality` is set (no toggle yet). Demo: add _Die Hard_ from
the dev fixture and its card reads its rung.

### Acceptance criteria

- [ ] `qualityOf`: one case per example frame of log 70 Q4, each floor's
      edges, and `null` for a missing or zero dimension.
- [ ] `probe`: `frameSize` from the picture stream, skipping an
      `attached_pic`; `null` with no video stream or no size.
- [ ] `measure`: duration and quality from one probe; the `mvhd` fallback
      still gives a duration, with quality `null`.
- [ ] `derivedVideoFacts`: both facts from a measured file; `null`s and no
      throw for a missing file, no component, or a probe failure.
- [ ] Migration 17: both columns exist and are `NULL` on rows from before
      it.
- [ ] An add and an edit with a new video store `video_quality`; an edit
      that keeps its video leaves it; a failed probe still saves.
- [ ] `MetaTag` draws its label, is not a control and is not focusable.
- [ ] `PosterCard` draws the tag at the Star row's end when `quality` is
      set, nothing when `null`; the art and the accessible name are
      unchanged.
- [ ] The Movie form offers no quality field.

---

## Phase 2: Every other way a movie gets in

**User stories**: 23, 24, 26, 71

### What to build

A **Bulk import**'s movie adds, a **Found again** video and a **Resolve**
store the quality from the same probe that reads their runtime. A failed
measurement never blocks an add or an import. Demo: import the dev fixture
and _Amelie_'s and _Die Hard_'s cards read their rungs.

### Acceptance criteria

- [ ] A bulk import's movie, a Found again video and a Resolve each store
      `video_quality`.
- [ ] One probe per file still: a large linked import is not slowed by a
      second spawn.
- [ ] A file nothing could probe imports with a `NULL` quality and no tag.

---

## Phase 3: Episodes measured

**User stories**: 25, 26

### What to build

`Episode.videoQuality` on the wire and in the episode inputs. A series save
measures each episode's video, and a bulk import's episodes store theirs,
from the one probe that reads their runtime. Demo: import _Tidewater_ and
each episode row on the wire carries its quality.

### Acceptance criteria

- [ ] A series save stores `video_quality` on each episode with a video; a
      replaced episode video is measured again.
- [ ] A bulk import's episodes store `video_quality`.
- [ ] An episode nothing could probe saves with a `NULL` quality.

---

## Phase 4: The Series quality

**User stories**: 15 to 20, 70

### What to build

`qualityRank` in the library domain and the **Series quality** as one SQL
subquery on every series read, exposed as `Series.videoQuality`, never
stored. `seriesCardView` passes it to the card, so a series poster draws
its tag. `db:seed-series` gives its mock episodes qualities, mixed in one
show and tied in another. Demo: after the seed, the mixed show reads its
majority rung and the tied one its better rung.

### Acceptance criteria

- [ ] Majority wins; a tie goes to the better rung; an unmeasured episode
      doesn't count; no measured episode gives `null`.
- [ ] One stray SD extra doesn't mark a 1080p show SD; a 4K last season
      doesn't make a mostly DVD show 4K.
- [ ] Adding or replacing an episode changes the next read.
- [ ] A series card draws the tag when the Series quality is set.
- [ ] The seed writes mixed and tied qualities.

---

## Phase 5: The Quality sweep

**User stories**: 27 to 36

### What to build

`storage.unmeasuredVideos()` answers every movie and episode with
`video_quality IS NULL`, movies first, A to Z. `createQualitySweep` measures
them one at a time, passing over a `missing` or `unreachable` video,
writing through `recordVideoQuality` (that one column only) and yielding to
the event loop between files. The server starts it after it listens, on
every start, and the **Ordered shutdown** awaits `stop()` before the
database closes. Demo: a library held before step 52 gains its tags on the
shelves one by one after a start.

### Acceptance criteria

- [ ] Only unmeasured rows are measured, movies first, A to Z, then
      episodes.
- [ ] Only the quality is written; the runtime is left as it was.
- [ ] Missing and unreachable videos, and the seed's fileless episodes, are
      passed over without a failure.
- [ ] A row still `NULL` is asked again on a second start; a measured row
      never is.
- [ ] `stop()` resolves mid-run and nothing is written after it; the
      Ordered shutdown awaits it before the database closes.
- [ ] A request is served between two files.

---

## Phase 6: The toggle

**User stories**: 37 to 43

### What to build

The `quality-tags` setting, on until set, and its route.
`DisplayPreferenceProvider` holds `qualityTags` (`null` until landed) and
`setQualityTags` through a new `saveQualityTags` call. `useCardPreferences`
replaces `useTmdbRatings` at the 8 card call sites, and `view` and
`seriesCardView` take `CardPreferences`; `quality` is `null` while the
toggle is off. `DisplaySection` draws _Show video quality_ after _Fill in
ratings from TMDB_ and before _Start on_, with the handoff's copy, once the
read lands; no snackbar. Demo: turn it off and every tag on every shelf
goes at once; restart and it stays off.

### Acceptance criteria

- [ ] `quality-tags` reads `true` until set and round-trips; a non-boolean
      answers 400.
- [ ] `view` / `seriesCardView`: `quality` follows `videoQuality` while
      `qualityTags` is on and is `null` while off; `tmdbRatings` behaves as
      before.
- [ ] All 8 card call sites read `useCardPreferences`.
- [ ] The Display row is not drawn until the read lands, reflects and
      writes the setting, and shows no snackbar.

---

## Phase 7: The filter

**User stories**: 44 to 60

### What to build

`?quality=` on both browses and the Genre page: movies filter on
`video_quality`, series on their Series quality, both through
`qualityRank`, combined with genre, rating and sort. `qualityOptions` and
`qualityLabel` give _All qualities_, _4K_, _1080p+_, _720p+_, _480p+_.
`LibraryFilters` draws a _Quality_ `mol.FilterDropdown` between _Rating_
and _Sort_, no counts, only while `qualityTags` is `true` and landed.
`useLibraryQuery` ignores `?quality=` while the toggle is off and never
rewrites the URL for it. Demo: _1080p+_ on the Movies tab keeps 1080p and
4K films and drops the unmeasured ones; Back keeps it.

### Acceptance criteria

- [ ] `?quality=` keeps titles at or above the rung on movies and series,
      drops `NULL`s, and combines with genre and rating.
- [ ] A value off the ladder answers `400 Invalid quality: …`.
- [ ] `qualityOptions` / `qualityLabel`: the five rows in order, the URL
      values, labels both ways; no _SD+_ row.
- [ ] The pill is drawn only while the toggle is on and landed, on both
      tabs and the Genre page; choosing a row writes `?quality=`, _All
      qualities_ removes it.
- [ ] With the toggle off, `?quality=` is ignored and the URL left alone;
      turning it back on restores the filter.

---

## Phase 8: The sheet written

**User stories**: 61 to 64

### What to build

`Quality` joins `SHEET_COLUMNS` after `Runtime`. `exportRows` fills it on
Movie and Episode rows and leaves it blank on Series and Season rows and
for a `NULL` quality, so every **Sheet writer** and an **Export** write it.
Demo: after an import, `Meta/familyflix-library.csv` has the column, filled
on the movie rows.

### Acceptance criteria

- [ ] `exportRows` writes `Quality` after `Runtime` on Movie and Episode
      rows; blank on Series and Season rows and for an unmeasured title.
- [ ] An Export's sheet carries the column.

---

## Phase 9: The sheet read back

**User stories**: 65 to 69

### What to build

`readSheet` reads the column under `quality` or `resolution`, case-folded;
a value off the ladder is an **Unread cell**, and a sheet without the
column reads as today. On an import the probe's quality wins and the
sheet's stands in when the probe answers none, at every site that already
falls back to the sheet's runtime. Demo: import a sheet-bearing library
with no FFmpeg installed and its titles keep their tags.

### Acceptance criteria

- [ ] `readSheet` reads `Quality` and `Resolution` in any case (`4k`,
      `1080P`).
- [ ] An off-ladder value is reported as an Unread cell.
- [ ] A sheet written before step 52 reads unchanged.
- [ ] The probe's quality wins over the sheet's; the sheet's is kept when
      the probe answers none.

---

## Phase 10: The walk and the documents

**User stories**: all, proved end to end

### What to build

The agent walks the dev app over the dev library and a folder of mixed
qualities (a DVD rip, a letterboxed 1080p, a cropped 4K, an unprobeable
file): an add, an edit, a bulk import, a series save, the sweep on a
restart, the toggle, the filter on both tabs and the Genre page, the sheet
written and imported back. Any gap the walk finds is fixed in its phase's
unit and its test first. Then the docblocks of log 70 Q19 say what their
units now do, the checklist's step 52 row is written to the build and stays
🔜, and the dev journal gains this step's entry.

### Acceptance criteria

- [ ] Every card in the walk reads the rung log 70 Q4 gives its frame, or
      no tag when nothing could probe it.
- [ ] The sweep fills a held library's tags after one start without
      freezing the browse, and a quit mid-sweep closes cleanly.
- [ ] The docblocks named in log 70 Q19 describe their current behaviour.
- [ ] Step 52's row in `docs/feature-checklist.md` describes the build and
      stays 🔜; `docs/dev-journal.md` has a step 52 entry;
      `docs/ubiquitous-language.md` matches the build.
- [ ] CLAUDE.md is unchanged; no em dash in any prose.
- [ ] The full suite is green.
