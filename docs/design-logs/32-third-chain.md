# 32 — The third chain

> **Initiatives:** `single-title-sync`, `backdrop-veil`, `open-media-folder`,
> `export-name`, `factory-reset`, `episode-links`, `edit-series`,
> `delete-series`
> **PRDs:** one per initiative, to be written
> **Plans:** to be written

This log is the `grill-me` session that turned six problems found while
using v0.3.0 (tagged 2026-10-09, `370b3fb`) into the third build chain,
steps 16–23. It ran against the code as it stood that day and is an
immutable snapshot of that moment. The session ran alone, and the
maintainer approved every recommendation in advance. Partway through they
added one requirement for Q1, recorded there as Q1c. Their brief:

1. _When adding a folder, there is no way to edit the files within FF, and
   the movies are forced to be skipped. We need a way to edit the files
   through FF._ (Screenshot: the **Folder scan**'s Review step, 7 imported
   and 143 needing attention, every row reading `F'ck That's Delicious ·
Episode 1 - Multiculturalism at Its Best.mp4` / _No episode number —
   rename it S01E01 and import again._ with _Skip_ alone.)
2. _The movie detail backdrop needs a light opacity filter over it (maybe
   with FF's primary colour) so the favourite/watched buttons and text read
   better. The backdrop also doesn't take up the full viewport, leaving the
   bottom half black._
3. _We need a "factory reset" with a warning modal: are you sure you want to
   clear everything._
4. _On the movie page, the ⋯ menu can sync with TMDB, but this does it for
   the whole library. We just want it for that movie._
5. _Settings → Managed media folder should have a button that opens that
   folder._
6. _Save CSV should also let you edit the path._

Added during the session, for (1): _For the edit option: the episodes don't
have the format, so we want to link them without changing the file's name.
For example the file is `eps1.0_hellofriend.mov`, and in front of it there
is `S<input> E<input>`. The user just types `01` `01` to say it is S01E01,
which is used as a reference to the actual file._

## Background

What the code does today, read before each answer:

- **(1)** `groupShows` numbers an episode by its **Season folder**, then its
  **Episode tag** (`S01E03`, `1x03`). A video neither numbers, or a second
  video that claims a number already taken, becomes **Unplaced**
  (`groupShows.ts:128–131`). `createImporter` files one `unplaced`
  **Problem** per video, and its reason names the fix: rename the file and
  import again (`unplacedReason`, `createImporter.ts:345`). `ProblemRow`
  withholds _Resolve_ from that kind (`ProblemRow.tsx:27`). FamilyFlix
  never renames anything in a **Library folder**: an Export and the Write
  targets only ever add. So the one fix the reason names happens outside
  the app. A show whose files carry `Episode 1 - …` therefore lands as one
  row per episode, with nothing to do in the app but _Skip_. There is also
  no _Edit_ for a series at all. Only a film has the ⋯ menu.
- **(2)** `ArtArea` is `height: 62%` of the scroll container, under one
  `Scrim` whose top stop is `rgba(20,17,13,.45)`
  (`MovieDetail.styles.ts:11–28`). The series page draws the same two
  (`SeriesDetail.tsx:99`). So the art stops at 62% of the screen, and its top
  third, where the actions sit, is barely dimmed.
- **(3)** No reset exists. Deleting is per film only, from the ⋯ menu.
- **(4)** The ⋯ menu does route to `/enrich?movie=<id>`, the `single`
  **Enrichment scope** (`EditMenu.tsx:57`). The bug is
  `useEnrichmentRun`'s mount: it re-attaches to _any_ **Current enrichment
  run** (`useEnrichmentRun.ts:80`). A library-wide Sync left in review is
  still the current run, so the movie's entry opens on the whole library's
  review. `EnrichmentRun` carries a `scope` but no movie id, so the client
  cannot tell whose run it is.
- **(5)** The Storage card draws the path in mono and the space line.
  _Change…_ is the Roadmap's **Move the media folder** and is undrawn. The
  preload's `folders` member has `pick` and `pickOne`, and no way to open
  anything.
- **(6)** In v0.3.0 _Save to_ is already a typed field with _Browse…_
  (`ExportModal.tsx:170`). What cannot be edited is the **Export name**: the
  name row draws `familyflix-collection_DD-MM-YYYY` as text.

## Problem

Six frictions from real use. Each needs a decision on what it is, what it
touches, and where it sits in a build order. Nothing here may contradict the
rules that stand: nothing is written into a Library folder except by adding;
the prototype is amended before anything is built; and every route answers
in sentences.

## Questions and Answers

### Shape of the session

**Q0. One log for six problems, or six logs?**
✅ One log, one step per feature, in a new **third chain** (steps 16–23),
ordered by the second chain's rule: smallest and most self-contained first.
Each step still gets its own PRD, and a prototype revision where it draws
something new. A step that turns out bigger than this log foresees gets its
own grill-me then.

### 1 — Episodes the scan cannot number

**Q1a. Fix the reader, the review, or both?**
✅ Both. The reader learns one more shape, so most shows never reach review.
The review gains a real _Resolve_, so whatever the reader still misses is
fixed in the app rather than by renaming files.
❌ Reader only: there will always be another naming scheme
(`eps1.0_hellofriend.mov`).
❌ Review only: 143 rows for one show's ordinary `Episode 12` names is the
reader's failure, not the maintainer's work.

**Q1b. What does the reader learn?**
✅ The **Episode word**, a third Episode tag shape: `Episode 12`, `Ep 12`,
`Ep.12`, `E12`, any case, standing as a word of its own. It gives an episode
number only, and the season comes from the Season folder. It is read only
where the season is already known: inside a Season folder, or at the root of
a folder that is already a **Show folder** by another rule, where it means
season 1. It never makes a folder a show on its own, so a film named
`Star Wars Episode 4` is still a film. `readEpisodeTag` mirrors it, held
there by the drift guard.

**Q1c. How does a file the reader still misses get its numbers? (the
maintainer's addition)**
✅ An **Episode link**. The file keeps its name, and the maintainer types its
numbers in front of it: `S[01] E[01]  eps1.0_hellofriend.mov`. The **Episode
file row** already draws exactly this (`mol.EpisodeFileRow`: S and E number
fields, then the filename in mono), so the link is that row filled in by
hand. The numbers are the episode's identity in the library. The filename is
only where its video came from. Nothing on disk is renamed, which keeps the
rule that FamilyFlix only adds to a Library folder.

**Q1d. Is the link remembered?**
✅ Yes. Each episode records its **Source file**: the video's name relative
to its series' **Source folder** (migration 8, `source_file` on `episodes`,
nullable and additive). A later Folder scan treats a video whose Source file
an episode already holds as **Already in library**, so a linked file is never
raised again, whatever its name. Episodes imported before migration 8 have
`null` and are matched by tag, as today.

**Q1e. One Problem per file, or per show?**
✅ Per show. `unplaced` stays the kind, but one Problem gathers a show's
Unplaced videos: _F'ck That's Delicious · 24 episodes need numbers_. A
review of 143 identical rows is a list nobody reads (log 13 Q16's argument).
The ImportProblem gains `videos: string[]`, and its reason no longer tells
anyone to rename anything.

**Q1f. Where does that Problem's _Resolve_ land?**
✅ The **Movie form**, series kind, in import context:
`/add?kind=series&problem=<id>`. The film Resolve's precedent: the form
prefilled from the **Problem detail**, its files travelling as the absolute
paths of their **Found files** rather than as bytes, saved through
`POST /api/import/current/problems/:id/resolve`. The show's shared fields are
prefilled from its row (or from the held series, which they then edit). Each
Unplaced video is one Episode file row, prefilled by the **Numbering
guess**: the season from its folder, else the next free number after the
show's last placed one, in name order. Every guess stays editable. The Save
gate is the series gate (every row numbered, no pair twice, and none
clashing with an episode the series already holds). A save creates the
series, or joins the held one, records each Source file, and takes the
Problem off the list.

**Q1g. And after import: can a series be fixed later?**
✅ Yes. That is **Edit a series** (Q7), the second way in to the same rows.

### 2 — The detail page's backdrop

**Q2a. How much screen does the art cover?**
✅ The whole viewport. `ArtArea` fills the scroll container's visible height
and stays put while the content scrolls over it, fading into `bg` only at
its last stop. On the movie page and the series page alike, because both
draw the same `ArtArea` and `Scrim`.

**Q2b. What makes the text read?**
✅ The **Backdrop veil**, which replaces the `Scrim`. It has two layers: an
accent wash (the theme's `accentSoft`, so it follows `createTheme(accent)`),
under a darker gradient that starts at about `.65` at the top, where the
actions sit, rather than `.45`. The exact stops are settled in the prototype
revision of `FamilyFlix.dc.html`'s detail hero and `page.SeriesPage`, then
built 1:1. ❌ A blur: it costs a full-screen filter on every scroll frame
and makes the art read as a loading state.

### 3 — Factory reset

**Q3a. What does it erase?**
✅ Everything FamilyFlix made:

- every row of every table: films, series, episodes, subtitles, ratings,
  hearts, watch history, the **Library folders** list, and every setting,
  the TMDB key included; the twelve genres are re-seeded, so the database
  is a fresh one
- the managed media directory's contents
- an uploaded **Playback component**; the slot falls back to the **Default
  component**

What stays: the Library folders on disk and every file in them (including
any Metadata sheet or `poster.jpg` a Sync added), every Export folder, the
Shell log, and the installed app and its version.

**Q3b. Where is it drawn?**
✅ The last row of the Storage card, under a divider: **Factory reset**,
_Erase every title, watch history and setting, and empty the media folder.
Your own folders are not touched._, with a `danger` `sm` Button. Storage is
where the media folder already is, and the maintainer is the only one who
opens Settings.

**Q3c. The warning?**
✅ The **Reset dialog**, the Delete dialog's precedent: `Modal`, the heading
_Erase everything?_, the two lists from Q3a (_What goes_, _What stays_),
_This can't be undone._, and _Cancel_ / _Erase everything_ (danger). Focus
lands on _Cancel_, not on the danger button, so a stray Enter cancels.
❌ Type-to-confirm: one deliberate press behind a dialog that names every
consequence is the household's level of ceremony, and the user's own brief
asks for an are-you-sure.

**Q3d. The wire, and the order of the erase?**
✅ `POST /api/reset` → `204`, or `409` with a sentence while an import or a
Sync is running. A run waiting in review is let go. The order is: the
database in one transaction first, then the media root emptied best-effort
(the Delete's cleanup precedent), then the slot. A media file that will not
go only costs space, which Space used will show. A database left holding
titles whose files are gone would be broken. The database half lives in
`db/` (`resetDatabase`, beside the migrations that know every table), the
media half is a new `createMedia` member (`emptyRoot`, since only `media/`
touches managed storage), and the slot half is `Playback.removeComponent`,
with its `404` meaning there was nothing to take back.

**Q3e. What does the client do after?**
✅ A full reload onto `/`, a **Fresh home**. Every provider (the display
preference, the Snackbar stack) starts over from nothing, which is what a
reset is. The library then reads _Your library is empty_.

### 4 — _Fetch from TMDB_ fetches the whole library

**Q4a. What is wrong?**
✅ A bug, not a missing feature: the ⋯ menu opens the `single` scope, and the
flow then re-attaches to whatever run is current. The fix is a `fix:` step,
first in the chain because it is the smallest.

**Q4b. The rule?**
✅ `EnrichmentRun` gains `movieId?: string`, set for a `single` run. Opened
with `?movie=<id>`, the flow re-attaches only to a single run for _that_
movie. Otherwise it shows setup for the one movie. If a library-wide run is
waiting in review, setup adds one line, _Starting lets go of the library
sync waiting for review._, because Start replaces it (the server already
starts over a run in review). If one is _running_, Start's `409` is
answered by the notice _A sync is already running._. Opened without a movie,
the flow keeps today's rule.

### 5 — Open the media folder

**Q5a. What opens it, and how?**
✅ _Open folder_, a `secondary` `sm` Button on the Storage card's path row,
in the slot _Change…_ would hold. It goes through a third member on the
folders bridge, `openMedia()` over `FOLDER_CHANNELS.openMedia`, which takes
**no argument**. Main opens the media root it already knows (a new
`mediaRoot` on **Shell paths**: `userData\media` installed, the repo's
`media/` unpackaged) with `shell.openPath`, making the directory first if
nothing has been imported yet. ❌ `openPath(path)` from the renderer: a
renderer that can name any path for main to open is a capability the window
should not hold. The button is not drawn in a browser, `folderBridge`'s
`null` (the _Browse…_ precedent).

### 6 — _Save CSV_ and its path

**Q6a. What is not editable?**
✅ _Save to_ is already editable in v0.3.0. What is not is the folder's own
name, so the **Export name** becomes a field. The name row's text becomes a
mono `TextField`, prefilled with today's `familyflix-collection_DD-MM-YYYY`
and never overwritten once edited (the _Save to_ rule). `StartExport` gains
`name`. The route refuses an empty name or one a folder cannot be called,
each with a sentence; it never silently strips characters. A name already
taken is still numbered. If the maintainer's install predates v0.3.0, the
update gives them _Save to_ too.

### 7 — Edit a series, and Delete a series

**Q7a. Is a series edit in this session's scope?**
✅ Yes. It is the "edit the files through FF" half of (1) once a show is in
the library, and today a series has no ⋯ menu at all. The series page gains
the ⋯ menu (Edit details, then a Danger row): the movie page's `EditMenu`
shape, drawn by `features/series/` itself.

**Q7b. What does the edit job do?**
✅ The Movie form's edit job for the series kind, `/add?series=<id>`. It has
the shared fields, the poster, and one Episode file row per held episode,
each with its numbers editable (an Episode link redrawn), its subtitles, and
its ✕. _＋ Add episode files_ adds new ones. A held file travels as the
stored path it already has, and only a freshly picked one travels as bytes,
the movie edit's rule. `PATCH /api/series/:id`, atomic like the add. A
renumbered episode keeps its watch state, because the row is the same
episode. A ✕'d one is deleted with its files. The Save gate is the series
gate. It lands on the series page.

**Q7c. Delete a series?**
✅ Its own step, the Delete dialog's precedent: _Delete series_ on the
Danger row, the dialog, `DELETE /api/series/:id`, then the Series folder
under best-effort cleanup, landing on the Series tab. It is separate from
the edit because it is separately small, and the scan in the screenshot is
exactly what makes a maintainer want to undo a show.

### Order

**Q8. The third chain?**
✅

16. **Single-title Sync** — the ⋯ menu's fetch, for that movie alone (fix).
17. **Backdrop veil** — the art over the whole screen, veiled in the accent.
18. **Open the media folder** — Settings → Storage's _Open folder_.
19. **Export name** — the Export folder's name as a field.
20. **Factory reset** — erase everything FamilyFlix made, behind a dialog.
21. **Episode links** — the Episode word, one Problem per show, its
    _Resolve_ numbering each file in the form, and the Source file
    remembered.
22. **Edit a series** — the series ⋯ menu and the form's series edit job.
23. **Delete a series** — the Danger row, the dialog, the cleanup.

21 comes before 22 because 22 reuses 21's Source file and its numbering
rows over held episodes. 23 comes last because it hangs off 22's menu.

## Design

### Chosen and rejected

- ✅ Number a file in place of renaming it (Episode link). ❌ Renaming files
  in a Library folder: FamilyFlix only ever adds there.
- ✅ One `unplaced` Problem per show. ❌ One per video.
- ✅ A no-argument `openMedia` channel. ❌ A general `openPath(path)`.
- ✅ The Reset dialog with focus on Cancel. ❌ Type-to-confirm.
- ✅ Database first, then media best-effort. ❌ Media first: it leaves a
  database pointing at nothing.
- ✅ The Export name as a field. ❌ A second _Save to_: it already exists.

### Types

```ts
// src/types/import.ts
interface ImportProblem {
  /* … */ videos?: string[];
} // `unplaced`: the show's videos
// src/types/series.ts
interface Episode {
  /* … */ sourceFile: string | null;
} // the Episode link's file
// src/types/enrichment.ts
interface EnrichmentRun {
  /* … */ movieId?: string;
} // set for a `single` run
// src/types/export.ts
interface StartExport {
  /* … */ name: string;
} // the Export name
// src/types/libraryFolders.ts
FOLDER_CHANNELS.openMedia; // FolderBridge gains `openMedia(): Promise<void>`
```

### Where things live

| Step | Backend                                                                                          | Shell                                    | Frontend                                                       |
| ---- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| 16   | `createEnrichment` records `movieId`                                                             | —                                        | `useEnrichmentRun` re-attach rule, setup's line                |
| 17   | —                                                                                                | —                                        | `MovieDetail.styles.ts` `ArtArea` + `BackdropVeil`             |
| 18   | —                                                                                                | `shellPaths.mediaRoot`, `main`/`preload` | `folderBridge.openMedia`, `StorageSection`                     |
| 19   | `exportBody`, `writeExport` take `name`                                                          | —                                        | `ExportModal`, `useExport`                                     |
| 20   | `db/resetDatabase`, `createMedia.emptyRoot`, the route                                           | —                                        | `StorageSection` row, `ResetDialog`, `api/factoryReset`        |
| 21   | `episodeTag` (Episode word), `groupShows`, `createImporter`, migration 8, `seriesFormBody` paths | —                                        | `readEpisodeTag`, `ProblemRow`, `useMovieForm` import context  |
| 22   | `library/series/write` (update), `PATCH /api/series/:id`                                         | —                                        | `SeriesEditMenu`, `useMovieForm` series edit, `useEpisodeList` |
| 23   | `DELETE /api/series/:id`, `createMedia` Series folder removal                                    | —                                        | `DeleteSeriesDialog`, `useDeleteSeries`                        |

### Prototype revisions before build

`FamilyFlix.dc.html` detail hero and `page.SeriesPage` (17, 22, 23);
`page.SettingsPage` (18, 20, and the Reset dialog); `feat.ExportModal` (19);
`feat.ImportFlow` and `feat.MovieForm` (21, 22). Step 16 draws one line of
setup copy and needs none beyond it.

## Implementation Plan

1. Single-title Sync: `movieId` on the run, the re-attach rule, setup's
   line. The thinnest slice, and it ships alone.
2. Backdrop veil: the prototype first, then `ArtArea` and the veil on both
   detail pages.
3. Open the media folder: `mediaRoot`, the channel, the button.
4. Export name: the field, the body, the refusals.
5. Factory reset: `POST /api/reset` over the three halves, then the row and
   the dialog, then the reload.
6. Episode links: the Episode word; migration 8 and Source files on every
   import; one Problem per show; its Resolve in the form.
7. Edit a series: the ⋯ menu, the edit job, `PATCH`.
8. Delete a series: the Danger row, the dialog, `DELETE`.

## Trade-offs

- **Easier:** a show with any naming at all can be brought in without
  leaving the app, and stays linked across scans. A maintainer can start
  over without finding `%APPDATA%`. The detail pages read at a glance.
- **Harder:** an episode's identity is now its numbers _and_ a Source file,
  so a scan has two ways to recognise a held episode, and a file renamed on
  disk after linking is seen as new. The form grows a fourth job (a series
  resolve) and a fifth (a series edit) over one hook, `useMovieForm`, which
  will want its refactor.
- **Out of scope:** renaming source files; editing an episode's numbers from
  the Season page itself; resetting only part of the library; a TMDB fetch
  for a single _series_ from its ⋯ menu; opening a Library folder or an
  Export folder from the app (the `openMedia` channel is deliberately one
  folder wide, and each other folder would be its own decision).
