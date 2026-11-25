# Plan: Whole add, adding a title by hand fills every place

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/715

**Add a title** gives the same complete title a **Folder scan** gives, for a
movie or a series, with or without TMDB. The form gains a **Backdrop** slot.
The **Show folder pick** and the new **Film folder read** fill every slot
from the **Folder art** the folder holds, never over a hand pick. The
**Frame fill** gives a show added by hand its Stills without a Sync. The spec
is design log 76 and `docs/handoff/handoff-whole-add/README.md` until phase 6
amends the prototype.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** The agent walks phase 8 itself in the shell. Log 76 settled every
decision, so none is left open.

- The phases follow log 76's _Implementation Plan_, with two splits. Slice 2
  is split by slot: the show's poster and backdrop are phase 2, its Season
  posters and Stills are phase 3. Slice 5 is split as in plans 74 and 75: the
  prototype amendment is phase 6, the scanner block in the app is phase 7,
  and the walk and documents are phase 8. The PRD's "phase 5 amends" is this
  plan's phase 6.
- **Phases 1 to 5 and 7 each start from their own RED test** (`tdd`). Phase
  6 is the prototype and the spec, proved by reading them against the
  handoff. Phase 8's documents are proved by the walk and a green suite.
- **Every existing test stays green after every phase.** The
  `readTitleFolder` suites stay unchanged, which proves phase 2's lift is a
  refactor. The `writeEpisodes` Frame still suites stay unchanged, which
  proves phase 5's lift is too.
- The glossary's terms were written in the grill-me. The checklist's step
  58 row stays 🔜 until the refactor. The README is not touched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - One new route: `GET /api/film-folder?video=<absolute path>` answers
    `FilmFolderRead`. A path that is not absolute or not a video is a `400`.
  - Changed: `POST /movies`, `PATCH /movies/:id`, `POST /series` and
    `PATCH /series/:id` take a backdrop; both adds take found images; the
    movie add takes found tracks; both series routes start the Frame fill.
  - Changed: `GET /show-folder` answers the show's art.
- **Schema**: no migration. `backdrop_path` on `movies` and `series`, the
  episodes' `still_path` and `still_source`, and `media_folder` already
  exist. A found Still is stored with `still_source` `picked`; a Frame still
  with `frame`.
- **Dependencies**: none new.
- **The wire**:
  - A backdrop is the Poster's word for word: a Picked file is a `backdrop`
    part; a held **Stored path** on an edit, or a **Found file** on an add,
    is a `backdropPath` field. On an edit, sending neither removes it. A
    replaced or removed file is deleted after the commit.
  - Found images travel as `posterPath` and `backdropPath`, a `seasonPoster`
    field's `path`, and an `episode` field's `stillPath`. Found movie tracks
    travel as `subtitlePath`.
  - `foundPathRefusal`'s `FoundKind` gains `'image'`. A found path that is
    not absolute or not of its kind is a `400`, with nothing on disk.
- **On disk**:
  - Every found image is copied through `Media.copyIn` into the title's
    **Media folder**, even for a linked title: poster and backdrop at its
    root, a Season poster and a Still in `season-NN/`, a movie's tracks at
    the root. An add whose only copies are images still reserves a Media
    folder. A copy that breaks fails the save and takes the folder back.
  - A Frame still is stored as `<stem>.frame.jpg` in the Series folder only,
    named in one place for the Sync and the fill. Nothing new is written
    into a Library folder; the **Layout fill** writes a picked backdrop into
    `Images\` as it already does.
- **Key models**:
  - `MovieFormValues` gains `backdrop: MovieFormFile | null`.
  - `FolderArt` (`src/types/form.ts`): `{ poster, backdrop, seasonPosters:
Record<number, string> }`, absolute paths, `null` for none.
  - `FilmFolderRead` (`src/types/form.ts`): `{ poster, backdrop, subtitles:
{ path, language }[] }`.
  - `ShowFolderRead` gains `poster`, `backdrop` and `seasonPosters: {
season, path }[]` (only seasons holding one, in number order);
    `ShowFolderEpisode` gains `still: string | null`.
  - `readTitleArt(folder)` answers a folder's Poster and Backdrop by role
    from `Images/`, the first of each by name order. Both the Show folder
    read and `readTitleFolder` use it.
  - `createFrameFill({ storage, media, playback })` answers `{ fill(seriesId):
Promise<void> }`; injected into `createApiRouter` as `frameFill`.
- **The rules**:
  - **One fill rule, the Folder key's.** A pick fills a slot only while it is
    empty or still holds the earlier pick's file. The pick's ✕ takes back
    each slot still holding its file. A slot replaced by hand stays.
  - Folder reads happen only in the shell, through the **Path bridge**. A
    browser gains only the Backdrop slot. A Resolve draws no Backdrop slot
    and reads no folder.
  - No loader, snackbar or progress for any read or for the Frame fill.

---

## Phase 1: A Backdrop by hand

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9

### What to build

The Backdrop slot, end to end for both kinds. The form draws a `mol.FileField`
labelled _Backdrop_ (_Choose backdrop image_, the `poster` icon) directly
under Poster in each kind's Files card, on the add and the edit. An edit
loads the held backdrop into it. The wire sends it as the Poster is sent,
the uploads collectors take the `backdrop` part, and the add and edit routes
store it as `backdrop_path`. A Resolve passes no backdrop, so no slot is
drawn. Demo: add a movie with a backdrop picked; its detail page draws it,
and a linked title's `Images\` gains `backdrop.jpg`.

### Acceptance criteria

- [ ] Both kinds' Files card draws the Backdrop slot under Poster, on the add
      and the edit, and none on a Resolve.
- [ ] An edit shows the held backdrop in the slot.
- [ ] A picked backdrop is stored on both kinds' add, kept on an edit that
      sends its Stored path, replaced by a new pick, and removed by ✕.
- [ ] A replaced or removed backdrop's old file is deleted only after the
      save commits; a failed save loses nothing.
- [ ] A browser add uploads the backdrop's bytes.
- [ ] A linked title's backdrop is written into its Title folder's `Images\`
      by the Layout fill.

---

## Phase 2: A show's poster and backdrop, taken whole

**User stories**: 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 32, 33, 35, 36, 37,
57

### What to build

The Show folder pick fills the Poster and Backdrop. The art reader is lifted
out of `readTitleFolder` as `readTitleArt`, and the Show folder read answers
the **Show folder**'s poster and backdrop through it, so a picked Season
folder still brings its show's art. Found images are admitted on the wire
and copied by a shared `copyFoundArt` into a Media folder, reserved even for
a linked show whose only copies are images. The form fills both slots by the
one fill rule, and the Show folder row's ✕ takes back what is still the
pick's. Demo: pick `The Show (2019)\` in the shell; Poster and Backdrop
fill; save with no TMDB key; the series page draws both.

### Acceptance criteria

- [ ] `readTitleArt` answers a folder's poster and backdrop, the first by
      name order, and `null` for none; the `readTitleFolder` suites pass
      unchanged.
- [ ] The Show folder read answers the show's poster and backdrop, for the
      show and for a picked Season folder; a folder with no art answers
      `null`s.
- [ ] A series add with found poster and backdrop copies both into a
      reserved Media folder, also for a linked show.
- [ ] A found image path that is relative or not an image is a `400` with
      nothing on disk; a copy that breaks fails the save and takes the
      folder back.
- [ ] The pick fills empty slots and never one picked by hand; a second pick
      replaces only the first pick's art; the ✕ takes back what still holds
      the pick's art and keeps a slot replaced by hand.
- [ ] A folder with no art fills nothing and draws nothing.

---

## Phase 3: A show's Season posters and Stills, taken whole

**User stories**: 12, 13, 34, and 15 to 20 for these slots

### What to build

The rest of a show's art. The Show folder read answers each season's
`Images\poster.jpg` and each episode's `Images\Stills\S01E01.jpg`. The form
fills each _Season posters_ slot (drawn once the rows hold its season) and
each episode row's Still, by the same fill rule and ✕. `copyFoundEpisodes`
copies a found Still into `season-NN/` beside its tracks, and the add copies
found Season posters there too; a found Still is stored as `picked`, so a
Sync never replaces it. Demo: pick `The Show (2019)\`; four Season posters
and every Still the folder holds fill; save; the series page draws them all.

### Acceptance criteria

- [ ] The Show folder read lists Season posters only for seasons holding
      one, in number order, and each episode's Still or `null`.
- [ ] `showFolderRows` sets each row's Still as a Found file.
- [ ] Season poster and Still slots fill by the fill rule, and the ✕ takes
      them back, keeping hand picks.
- [ ] A series add copies found Season posters and Stills into `season-NN/`
      of the Media folder, and stores each found Still with `still_source`
      `picked`.
- [ ] A found Still or Season poster path that is relative or not an image
      is a `400` with nothing on disk.

---

## Phase 4: A film taken whole

**User stories**: 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 38

### What to build

The Film folder read, end to end. `readFilmFolder` reads the picked video's
folder and, when it reads as a `film` holding that video, answers its
poster, backdrop and tracks with their languages; anything else answers
empty. `GET /api/film-folder` exposes it. The movie add takes found tracks
by path. The form, in the shell on a plain add, reads the folder when a
video is picked: it fills Poster and Backdrop by the fill rule and adds one
Subtitles row per track, with its language chosen, after the hand-added
rows. A later pick replaces only the earlier fills, the video's ✕ takes them
back, and an answer that lands late is dropped. No loader is drawn. Demo:
pick `Heat (1995)\Heat.mkv`; Poster, Backdrop and its tracks fill; ✕ on the
video takes them back.

### Acceptance criteria

- [ ] `readFilmFolder` answers a film's art and tracks; a folder of two
      videos still answers them; a series folder, a left-out folder and an
      unreadable one answer empty.
- [ ] `GET /api/film-folder` answers `FilmFolderRead`, and a relative or
      non-video path is a `400`.
- [ ] `POST /movies` copies found art and found tracks into the Media
      folder, also for a linked film.
- [ ] The pick fills by the fill rule, adds track rows after hand-added
      ones, and the ✕ or a later pick takes back only its own fills.
- [ ] An answer landing after a later pick or the ✕ changes nothing.
- [ ] An edit's replacement video, a Resolve and a browser read no folder.

---

## Phase 5: Stills without a Sync

**User stories**: 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 56, 58

### What to build

The Frame fill. Taking one Frame still is lifted out of the Sync's episode
writer as `takeFrameStill`, so both name `<stem>.frame.jpg` in one place.
`createFrameFill` queues fills one take at a time, fills a waiting series
once, re-reads the series at its turn (a gone series does nothing and
reserves no folder), takes each Still-less episode in season then episode
order (specials included) through one Late reserve, and drops a picture
when a Still landed meanwhile. It is injected into the router as
`frameFill`; the series add and edit start it after the Layout fill and
answer without waiting. Movies take none. Demo: add a show with no Stills
and no TMDB key; the save answers at once, and the series page, reopened a
little later, draws a Frame still on every row.

### Acceptance criteria

- [ ] The Sync's Frame still suites pass unchanged, and a Sync still
      replaces a `frame` Still with TMDB's.
- [ ] Every Still-less episode gets a Frame still with `still_source`
      `frame`; an episode holding a Still is untouched.
- [ ] A second `fill` while queued fills once; a series deleted or reset
      while queued reserves nothing.
- [ ] A Still landing mid-take wins.
- [ ] `POST /series` and `PATCH /series/:id` answer before the fill ends,
      and the Stills land after; a movie add starts no fill.
- [ ] A linked show's Frame stills live only in its Series folder; nothing is
      written into its Library folder. No route imports playback.

---

## Phase 6: The spec amended

**User stories**: none directly; it is the spec phase 7 builds to

### What to build

The prototype and its spec brought up to the handoff README.
`feat.MovieForm.dc.html` draws the Backdrop slot on both kinds.
`feat.ImportFlow.dc.html` and `page.LibraryFoldersPage.dc.html` draw the new
scanner block. `COMPONENT-SPEC.md` describes MovieForm's Files and both
`FolderShapes`. After this phase the prototype rules, and the handoff README
is history. Demo: the prototypes, opened in a browser, draw the Backdrop
slot and the new block.

### Acceptance criteria

- [ ] Both kinds' Files card in the prototype draws _Backdrop_ under Poster,
      as phase 1 built it.
- [ ] Both scanner blocks draw the movie and series examples side by side,
      the three rules and the Sheet note unchanged, as the handoff gives
      them.
- [ ] The retired shape lines and the folder-first sentence are gone from
      both.
- [ ] `COMPONENT-SPEC.md` matches.

---

## Phase 7: The scanner block

**User stories**: 52, 53, 54, 55

### What to build

`FolderShapes`, rewritten as a 1:1 translation of the amended prototype,
name kept. The panel, glyph and heading stay. The movie example
(`Heat (1995)\`) and the series example (`The Show (2019)\`) sit side by
side in 12px mono, faint, line-height 1.8, wrapping with `gap: 32px`. Three
rules follow in 13px sans, faint, their names in mono. The Sheet note
follows, unchanged. Demo: Import setup and Library folders → Scan both draw
the new block.

### Acceptance criteria

- [ ] The block draws both examples, the three rules and the Sheet note.
- [ ] `subs.en.srt`, `Show Name\`, loose episodes and "the folder first" are
      gone.
- [ ] Both pages that draw it show the same block.

---

## Phase 8: Walk it live, then the documents

**User stories**: all, checked live

### What to build

The acceptance walk in the shell (`npm run electron:dev`), done by the
agent, followed by the documents. The walk:

1. Add a movie with a backdrop picked by hand: the detail page draws it.
2. Pick `The Show (2019)\` with no TMDB key: Poster, Backdrop, each Season
   poster and every Still fill; save; the series page draws them all. ✕ on
   the Show folder row takes them back.
3. Pick `Heat (1995)\Heat.mkv`: Poster, Backdrop and its tracks fill; ✕ on
   the video takes them back.
4. Add a show with no Stills: the save answers at once; reopened a little
   later, every row draws a Frame still.
5. Import setup and Library folders → Scan draw the new block.

Then the documents: CLAUDE.md's Movie form rule (a show taken whole "with
its art"; a film's art and tracks read from its folder), the docblocks of
`MovieFormValues`, `ShowFolderRead`, `readShowFolder`, `useShowFolderPick`,
`copyFoundEpisodes`, `foundPathRefusal`, `writeEpisodes` and the two add
routes, and the checklist's step 58 entry.

### Acceptance criteria

- [ ] Each of the walk's five checks passes in the shell.
- [ ] Every changed unit's docblock describes its new face; CLAUDE.md's
      Movie form rule is amended. The README and older handoff READMEs are
      untouched.
- [ ] The checklist's step 58 entry describes the initiative and stays 🔜.
- [ ] The full suite and the typecheck (`--force`) are green.
