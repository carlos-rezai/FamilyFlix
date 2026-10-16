# Plan: Episode stills — a frame from the file when TMDB has none

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/381

A synced show TMDB has no stills for draws its season page as a column of
gradients, and never leaves _Only what's missing_. This initiative gives such
an episode a **Frame still**: one frame at the **Frame point**, a third of the
way into its own video, taken by the **Playback component** as part of the
Sync's pass over the show. TMDB's **Still** is preferred and replaces a frame
on a later Sync; a picked still is never replaced. Every still records its
**Still source**, server-side only.

## Running the phases

**There is no Phase 0.** `EpisodeRow`, the Up next card and the series form's
Still slot already draw a held still, so no prototype revision is needed and
`src/` does not change.

**Phases 1–4 run AFK under `issue-loop`**, in order. They are log 44's
_Implementation Plan_ slices 1–4. Phase 2 has no caller of its own: it is the
playback domain's slice, proven by its suites, and Phase 3 is its first
caller.

The docs (README, CLAUDE.md) are ticked ✅ only after the refactor. The
glossary already carries the five terms since log 44.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none new, none changed in shape.
  - `POST /api/series` and `PATCH /api/series/:id` write a picked still as
    `'picked'`; a held still sent back keeps its source; a removed one clears
    both columns.
  - `POST /api/enrichment` starts the same Sync; frames are part of its pass.
  - `GET /api/enrichment`'s **Sync gap** is unchanged: `still_path IS NULL`
    only, so a frame closes it.

- **Schema**:
  - **Migration 14**: `episodes.still_source TEXT` — `'tmdb'`, `'frame'` or
    `'picked'`, `NULL` exactly when `still_path` is `NULL`.
  - Backfill: a form-shaped held still (`%-still.%`) → `'picked'`, any other
    held still → `'tmdb'`. No frames exist before it.
  - Factory reset's erased-tables guard is unchanged: the column goes with
    `episodes`.

- **Key models**:
  - `StillSource = 'tmdb' | 'frame' | 'picked'`, with the series enrichment
    storage. Server-side only, the `mediaFolderOf` precedent: the assembled
    `Episode` does not carry it and `src/types/` does not change.
  - `EpisodeEnrichment.stillSource`, written with `stillPath` and never alone.
  - `stillSourcesOf(seriesId) → ReadonlyMap<episodeId, StillSource>`, read
    once per show.
  - `StillPlan = { kind: 'tmdb'; path } | { kind: 'frame' } | null`, answered
    by `planEpisode(episode, theirs | undefined, fields, held)`.
  - `FRAME_POINT = 1 / 3`; the **Frame budget**, 20 s.

- **Boundaries**:
  - The grab is `Playback.frame(video: StoredVideo, signal) → Promise<Readable
| null>`, over the existing `spawn` seam: the `PlaybackComponent`
    interface does not change, the component is read per call off the
    **Component slot**, the picture comes back on stdout, no temp file. It
    never rejects (`derivedRuntime`'s rule).
  - The argv: `-hide_banner -loglevel error -ss <t> -i <file> -frames:v 1 -an
-sn -f image2pipe -c:v mjpeg -q:v 3 pipe:1` — input seeking, native
    resolution.
  - `createEnrichment({ storage, client, media, playback })`, wired in
    `main.ts` as `createImporter`'s is.
  - Only `media/` writes: `storeNamed` into the Series folder's `season-NN/`,
    `<stem>.still.jpg` for TMDB's, `<stem>.frame.jpg` for a frame. A **Linked
    video** is read, never written into.

- **Unchanged throughout**:
  - Season 0 is never read; an Unmatched show has no episode pass.
  - The Export: a frame is a still under `stills/`, named in the `Still` cell;
    sixteen and nine columns.
  - No Write target, no chip of its own (frames follow the Poster chip), no new
    screen, no mark, no progress screen; the bar keeps counting titles.

---

## Phase 1: The Still source

**User stories**: 20, 40–43, 46, 47

### What to build

The companion column, end to end through every writer that exists today.
Migration 14 adds `episodes.still_source` and backfills it by name. The
Sync's TMDB still writes `'tmdb'` beside its path. The series form's add and
edit write `'picked'` for a freshly picked still, keep the held source for a
still sent back unchanged — a held frame stays `'frame'` — and clear both
columns for a removed one; a superseded still's file is removed as today.
`EpisodeEnrichment` and the episode column map gain `stillSource`. Nothing on
screen changes.

### Acceptance criteria

- [ ] A fresh database migrates to version 14.
- [ ] On a version-13 library, a `-still.` still backfills `'picked'`, any
      other held still `'tmdb'`, and an episode with no still `NULL`.
- [ ] A still picked on `POST /api/series` or `PATCH /api/series/:id` is
      stored with source `'picked'`.
- [ ] A held still sent back unchanged keeps its source, a held `'frame'`
      included.
- [ ] A removed still clears `still_path` and `still_source` together.
- [ ] A Sync's TMDB still is stored with source `'tmdb'`.
- [ ] A Factory reset still erases every episode, the guard unchanged.

---

## Phase 2: The grab

**User stories**: 8–10, 27, 28, 30–33, 37

### What to build

The playback domain learns to take one picture out of a video. A pure unit
builds the argv at a given second. `Playback.frame` resolves the file through
`videoFile`, reads its duration off the file (the probe, then the MP4's own
`mvhd`), spawns the slot's current component at a third of it, collects
stdout, and answers the bytes as a stream — or `null` in every case where
there is no picture, killing the process where one runs. No caller yet.

### Acceptance criteria

- [ ] The argv is in order, `-ss` before `-i`, the time at the given seconds.
- [ ] A scripted component's stdout comes back as a stream.
- [ ] `null` with no component, for a `missing` video, for an `unreachable`
      Library folder, and with no duration.
- [ ] `null` for an empty stdout, at the Frame budget, and on abort, each
      killing the process.
- [ ] It never rejects.
- [ ] The component used is the one the slot holds at the call, an uploaded
      one included.
- [ ] Over `test-support/fixtureVideo/`, real ffmpeg on PATH answers a JPEG;
      the suite skips without it.

---

## Phase 3: The Sync falls back

**User stories**: 1–7, 11–13, 18, 19, 25, 26, 29, 34–36, 38, 39

### What to build

A Sync's show pass takes a frame where TMDB has no still. `planEpisode`
answers a `StillPlan` under the Poster chip: `tmdb` when TMDB offers a still,
`frame` when nothing is held and TMDB offers none or does not list the
episode, `null` otherwise. `createEnrichment` takes `playback`, wired in
`main.ts` and passed by every suite composing it. The pass reads the show's
`stillSourcesOf` once and no longer skips an episode TMDB does not list. A
`frame` plan stores `<stem>.frame.jpg` in `season-NN/` with source `'frame'`
and logs `▣ <name>  →  <stored>`; a `null` answer or a store failure is
silent. A failed TMDB image never falls back to a frame, and the episode
stays in the gap. The season page and the Up next card draw the frame as they
draw any still.

### Acceptance criteria

- [ ] `planEpisode`'s still rule holds for a listed and an unlisted episode,
      with and without the Poster chip; title, air date and runtime unchanged
      when `theirs` is present and untouched when absent.
- [ ] `stillSourcesOf` answers each episode's source by id, none for an
      episode with no still.
- [ ] A frame is taken for an episode TMDB offers no still for, and for one
      TMDB does not list: `.frame.jpg`, source `'frame'`, one `▣` line.
- [ ] No frame without the Poster chip, and none after a failed TMDB image —
      that episode keeps its gap.
- [ ] A `null` frame or a failed store leaves the gradient and logs nothing.
- [ ] _Stop_ aborts a frame in flight.
- [ ] No frame for season 0, and none for an Unmatched show.
- [ ] A Linked video's Library folder gains no file.

---

## Phase 4: TMDB replaces a frame

**User stories**: 14–17, 21–24, 44, 45

### What to build

The upgrade path and the closed gap. When an episode holds a frame and TMDB
now offers a still, the pass stores `<stem>.still.jpg` with source `'tmdb'`,
logs `↓`, and then removes the frame file through `media.removeFile`; a
failed image leaves the frame as it was. A held frame with TMDB offering none
is not taken again. A `'tmdb'` or `'picked'` still is never touched. Once
every episode holds a still the **Sync gap** closes, and _Everything_ still
reaches every show. An Export carries a frame as it carries any still.

### Acceptance criteria

- [ ] A held frame plus TMDB's still gives `.still.jpg` with source `'tmdb'`,
      and the frame file is removed.
- [ ] A held frame whose TMDB image fails is kept, file and source.
- [ ] A held frame with TMDB offering none spawns nothing.
- [ ] A `'tmdb'` or `'picked'` still is never replaced or removed.
- [ ] A show whose every episode holds a still — frames included — is not in
      _Only what's missing_; _Everything_ still reaches it.
- [ ] An Export with _Images_ on carries a frame under `stills/`, named in
      the `Still` cell, with the column counts unchanged.
