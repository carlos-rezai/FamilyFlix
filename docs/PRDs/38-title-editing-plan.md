# Plan: Title editing — fix, re-fetch, number and remove any title, film or series

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/302

A film can be edited, re-fetched and deleted from its ⋯ menu, but a series
has no menu at all. A Sync's review drops a series TMDB can't settle, and a
pick never fixes a title. A wrong match can't be undone from the form. Import
files a show it can't number as one Skip-only Problem per file, and a
two-video film folder opens a Resolve form whose picker can't reach the
folder.

This is build step 21, the last of the third chain. It folds in log 32's
steps 22 and 23 (log 38 Q1) and is a `feat:`. The rule throughout is **Title
parity**: the same actions on a film and a series, not the same fields.

## Running the phases

**Phase 0 is HITL and docs-only.** It revises the prototype for every surface
this step draws, all at once (log 38 Q19, "before any build"). `issue-loop`
stops there so the maintainer can review the revision.

**Phases 1–7 run AFK under `issue-loop`**, in order. They are log 38 Q20's
seven slices, smallest and most self-contained first. Each one works end to
end. Each later phase leans on the ones before it:

- Phase 2 adds the ⋯ menu's second item, and Phase 4 its first, to the menu
  Phase 1 builds.
- Phase 5 keeps a Source file across a Phase 4 edit.
- Phase 7 reads Phase 5's column and Phase 6's Episode word.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `DELETE /api/series/:id` → `204`, or `404` for a series not held. There
    is no `409` guard (the movie delete's precedent). The database goes
    first, then the Series folder best-effort.
  - `PATCH /api/series/:id`: multipart and atomic, like `POST /api/series`.
    Each `episode` field is `{ id?, season, number, title }`:
    - With an `id`, it is a held episode, kept and possibly renumbered or
      retitled. Its files travel as stored paths, or as a picked
      replacement.
    - Without an `id`, it is a new episode.
    - A held id the body leaves out is removed.
    - `404` for a series not held. `400` for an id the series doesn't hold,
      an id sent twice, a pair of numbers twice, or anything the add
      refuses. Every refusal rolls back the whole edit, files stored on the
      way included.
  - `PATCH /api/movies/:id` and `PATCH /api/series/:id`: a save that changes
    the title or the year clears `tmdb_id`. This is the **Match unlink**. The
    fields the match filled stay.
  - `POST /api/enrichment`: `{ scope: 'single', seriesId }` beside
    `{ scope: 'single', movieId }`. A `single` body carries exactly one of
    the two. A title the library doesn't hold is `400` (`no-title`).
  - `POST /api/import/current/problems/:id/resolve`: read with
    `seriesFormBody` when the Problem is `unplaced`, and with `movieFormBody`
    otherwise. `found` paths copy only from under the run's root.
  - Client routes:
    - `/enrich?series=<id>`: a single-series Sync.
    - `/add?series=<id>`: the **Series edit job**, the form's fifth job.
      There are no Kind tabs, and its Landing is the series page.
    - `/add?kind=series&problem=<id>[&series=<id>]`: the **Series
      Resolve**. `?problem=` wins over `?series=`, as it already does over
      `?movie=`.
- **Schema**: migration 8 adds `episodes.source_file TEXT`, nullable. It
  holds the video's path relative to its series' Source folder, with forward
  slashes. No other migration. `UNIQUE (series_id, season_number,
episode_number)` stays, and a renumber gets around it with the **Two-pass
  renumber** through negative placeholders.
- **Key models**:
  - `StartEnrichment.seriesId?` and `EnrichmentRun.seriesId?`, beside
    `movieId`.
  - `Episode.sourceFile: string | null`.
  - `ImportProblemDetail.files.videos: string[]`: every video as an absolute
    path, in name order, for a show and for a film. `ImportProblem` gains no
    field.
  - Server-only **Title reference** `{ kind: 'movie' | 'series'; id }`,
    held per Decision id. The wire `Decision` stays as it is, with no `kind`.
  - The **Title fix**: a `pick` from a `missing` or `ambiguous` Decision
    writes the Candidate's title, and its year only when ours is null. A
    Confident match and `apply` never write the title. The title is not an
    Enrich field.
- **Boundaries**:
  - `SeriesEditMenu` stays in `features/series/` and is not promoted to
    `components/`.
  - `media/` is still the only code that touches managed storage, so the new
    removal is `Media.removeSeriesFolder`.
  - Library folders on disk are never touched by a delete, an edit or a
    Resolve.

---

## Phase 0: Prototype revisions

**User stories**: 88

### What to build

Docs only, in `docs/handoff/`. **HITL**: the maintainer reviews the revision
before Phase 1 is built.

- **`page.SeriesPage`**: the ⋯ menu in the hero's corner, where the movie
  page's sits, with _✎ Edit details_, _⟳ Fetch from TMDB_ and the Danger row
  _🗑 Delete series_. Also the Delete dialog in the PRD's copy.
- **`feat.MovieForm`**, three things:
  - The Series edit job: the shared fields prefilled, no Kind tabs, the
    poster as held, held Episode file rows with their ✕, and a mono line
    showing the Source file.
  - The Series Resolve: rows of found paths under the Numbering guess.
  - The film's **Found-file choice**: the videos by name, the first
    preselected, the picker beside them.
- **`feat.ImportFlow`**: the `unplaced` row titled with the show, its reason
  the count (_24 episodes need numbers_), with _Resolve_ and _Skip_. Also the
  two-video film's reason, _Two videos — pick the film._
- **`feat.EnrichmentFlow`**: the _Just this series_ scope card, and the Title
  search's caption _Try another title — the one you pick becomes its title._
- **`COMPONENT-SPEC.md`**: entries for `SeriesEditMenu`,
  `DeleteSeriesDialog` and the Found-file choice.

### Acceptance criteria

- [ ] Every surface above is drawn in `docs/handoff/` in the PRD's copy
- [ ] `COMPONENT-SPEC.md` names each new unit and its props
- [ ] No code under `src/`, `server/` or `electron/` changes
- [ ] The maintainer has reviewed the revision

---

## Phase 1: Delete a series

**User stories**: 1–15, 89

### What to build

A ⋯ menu on the series page with its Danger row only. It opens a Delete
dialog that names the show and its episode count. _Delete series_ reads
_Deleting…_ in flight and calls `DELETE /api/series/:id`. The cascade takes
the episodes, `series_genres` and `episode_subtitles`, and then the Series
folder in managed storage is removed best-effort. Afterwards the maintainer
lands back where they came from, with the Series tab as the fallback. The
season page draws no menu.

### Acceptance criteria

- [ ] The series page draws the ⋯ menu in the hero's corner. It opens,
      closes and takes the keyboard as the movie page's does. The season page
      draws none
- [ ] The dialog reads _Delete “<title>”?_ / _This can't be undone._ and the
      body with the episode count, exactly as the PRD gives it
- [ ] _Delete series_ comes before _Cancel_ (`comesBefore`). In flight it
      reads _Deleting…_ and is disabled
- [ ] Escape, the scrim, ✕ and _Cancel_ each close the dialog with no request
      sent
- [ ] Deleting a series removes its row, its episodes, its genres and its
      subtitles. An unknown id answers not-found
- [ ] `removeSeriesFolder` removes the Series folder. A missing folder is
      nothing to do, and a locked file never throws
- [ ] `DELETE /api/series/:id` answers `204`, and then the series page answers
      `404` and its folder is gone. An unknown id answers `404`
- [ ] Nothing under a Library folder is touched
- [ ] After a delete, the app goes back one step, or to the Series tab when
      nothing is behind
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green

---

## Phase 2: Fetch a series from TMDB

**User stories**: 16–22

### What to build

The menu's _⟳ Fetch from TMDB_ opens `/enrich?series=<id>`, a single-title
Sync over that one series. The scope card reads _Just this series_. The flow
re-attaches only to a `single` run for the same series. Another title's run
waiting in review is named by the Let-go line and let go by Start. Another
title's running Sync shows the Busy notice. _Back_ and _Done_ land on the
series page. A series the library doesn't hold is refused.

### Acceptance criteria

- [ ] `enrichmentBody` reads `seriesId`. It refuses a body carrying both ids,
      or a `single` body carrying neither
- [ ] Starting a `single` run for a series the library doesn't hold answers
      `400`
- [ ] A `single` series run fetches that series alone, and the run carries its
      `seriesId`
- [ ] `enrichPath({ series })` spells `/enrich?series=<id>`, with the id
      encoded
- [ ] The flow re-attaches only to a `single` run whose `seriesId` matches.
      The Waiting run, the Let-go line and the Busy notice behave as they do
      for a film
- [ ] The scope card reads _Just this series_. _Back_ and _Done_ land on the
      series page
- [ ] The series ⋯ menu's second item opens the flow for that series
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green

---

## Phase 3: Series in the review, and the Title fix

**User stories**: 23–37, 90

### What to build

The server holds each Decision against a **Title reference** rather than a
movie id. `search`, `pick`, `apply` and _Skip_ then work for a series through
TV search and the series write, and the wire `Decision` doesn't change.

- A series TMDB can't settle gets an `ambiguous` row (candidates read off TV
  results: the show's name and first air year), a `missing` row, or, under
  _Everything_, a `conflict` row. The old _"left for a later Sync"_ log line
  goes.
- A pick from a `missing` or `ambiguous` row applies the **Title fix** to
  both kinds.
- The Title search's caption reads _Try another title — the one you pick
  becomes its title._

### Acceptance criteria

- [ ] A series with several candidates gets an `ambiguous` Decision. Its
      Candidates show TMDB's name and first air year, and the genre off the
      pool
- [ ] A series with no result gets a `missing` Decision. `search` on it
      returns TV candidates
- [ ] An _Everything_ Sync raises series Field conflicts. An _Only what's
      missing_ Sync doesn't. _Apply choices_ and _Keep all mine_ settle them
- [ ] _Skip_ works on every series row. A series row reads exactly like a
      film's
- [ ] A `pick` from `missing` or `ambiguous` writes the Candidate's title,
      for both kinds. It writes the year only when ours is null, and keeps a
      year we hold
- [ ] A Confident match never changes the title. `apply` never writes it, and
      no conflict is raised on the title
- [ ] The caption reads _Try another title — the one you pick becomes its
      title._, and the `missing` reason stays _No result on TMDB_
- [ ] The wire `Decision` carries no `kind`
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green

---

## Phase 4: Edit a series, and the Match unlink

**User stories**: 38–63

### What to build

The menu's _✎ Edit details_ opens `/add?series=<id>`, the **Series edit job**:

- The shared fields are prefilled, with no Kind tabs.
- The poster sits in its slot as the file it already has.
- Each held episode gets one Episode file row, in season then episode order.
  Each row shows its numbers, title, subtitles and ✕. Its mono line shows the
  stored video's name.

The maintainer can renumber (two episodes' numbers swapped included),
retitle, replace a video or subtitles, add rows with _＋ Add episode files_,
and remove rows with ✕. One save sends `PATCH /api/series/:id`, and only
freshly picked files travel as bytes. The save is all or nothing. In one
transaction it writes the fields, then the Two-pass renumber, then the
inserts and removals. A held episode keeps its id, so its watch state, resume
position and still survive. A removed episode's files are cleaned up
best-effort after the commit. A finished save lands on the series page.

On both PATCH routes, a change to the title or the year clears `tmdb_id`.

### Acceptance criteria

- [ ] `/add?series=<id>` prefills the shared fields and the poster, and draws
      held rows in order with no Kind tabs. `movieFormPath({ series })`
      spells it, with the id encoded
- [ ] The series ⋯ menu's first item opens it
- [ ] A title-only edit sends no file part
- [ ] The Save gate refuses a pair of numbers twice before anything is sent
- [ ] Swapping two episodes' numbers in one save succeeds
- [ ] A renumbered, retitled or re-videoed episode keeps its id, watch state,
      resume position and still
- [ ] A held id left out of the body removes that episode, and its files are
      cleaned up best-effort after the commit
- [ ] Each refusal leaves nothing written and no stored file behind: `404` for
      a series not held, `400` for an unknown, repeated or clashing id
- [ ] A finished save lands on the series page
- [ ] On `PATCH /api/movies/:id` and `PATCH /api/series/:id`, a title or year
      change clears `tmdb_id` and keeps the filled fields. Any other change
      keeps `tmdb_id`
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green

---

## Phase 5: Source file

**User stories**: 64–67

### What to build

Migration 8 adds `episodes.source_file`. A sheet import and a Folder scan
record each episode's original path inside its show's Source folder. A later
Folder scan of a held series treats a video whose Source file is held as
Already in library, and checks this before the Episode tag. A Series edit
keeps the Source file for every held file left in place, and a freshly
picked file has none. The edit form's mono line shows the Source file when
it is set.

### Acceptance criteria

- [ ] Migration 8 adds `source_file`, and the `resetDatabase` table guard
      still passes
- [ ] `Episode.sourceFile` is read through to the wire
- [ ] A sheet import and a Folder scan each write the Source file with
      forward slashes, relative to the series' Source folder
- [ ] A re-scan skips a held Source file before reading its tag, even when its
      name gives other numbers
- [ ] A Series edit keeps a kept file's Source file and stores `null` for a
      freshly picked one. The form's add stores `null`
- [ ] The edit row's mono line shows the Source file when set, else the stored
      video's name
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green

---

## Phase 6: The Episode word

**User stories**: 68–71

### What to build

The server's Episode tag reader learns a third shape, the **Episode word**:
`Episode 12`, `Ep 12`, `Ep.12` and `E12`. It gives an episode number only,
and is read only where the season is known: inside a Season folder, or at a
Show folder's root as season 1. It never makes a folder a show. The client
mirror reads the same shapes, and the drift guard's shared table holds both
readers to them.

### Acceptance criteria

- [ ] Inside a Season folder, `Episode 12`, `Ep 12`, `Ep.12` and `E12` are
      each numbered
- [ ] At a Show folder's root, the same words read as season 1
- [ ] A folder holding only an Episode-word file is not grouped as a show, so
      a film called `E12` stays a film
- [ ] The client reader numbers a picked `Ep 12.mkv` as the importer does, and
      the drift guard's table carries the new cases
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green

---

## Phase 7: Series Resolve and the Found-file choice

**User stories**: 72–87

### What to build

**Series.** A show's unnumbered files become one `unplaced` Problem per show.
Its title is the show's, and its reason the count. Its Problem detail lists
`files.videos` in name order. `ProblemRow` gives `unplaced` a _Resolve_
onto `/add?kind=series&problem=<id>`, plus `&series=<id>` when the show is
held. The form opens the series kind in import context:

- One Episode file row per unplaced video, as a found path.
- Each row prefilled by the **Numbering guess**: the season from the folder,
  the episode from the Episode word, else the next free number in name
  order.
- Joining a held series, the fields come from that series. The gate also
  refuses a number the series already holds.

The resolve route reads a series body for an `unplaced` Problem. It accepts
only found paths under the run's root. It creates the series or joins the
held one, records each Source file, and takes the Problem off the list.

**Film.** A film folder with two or more videos lists them all in
`files.videos` and sets no `video`. Its reason reads _Two videos — pick the
film._ Its Resolve form's video slot draws the **Found-file choice**: the
names as options, the first preselected, the picker beside them.

### Acceptance criteria

- [ ] A show with unnumbered files files one `unplaced` Problem. Its title is
      the show's, its reason the count, and its `files.videos` in name order
- [ ] `ProblemRow` draws _Resolve_ for `unplaced`, with `&series=<id>` when
      the show is held
- [ ] The Series Resolve draws one row per video under the Numbering guess,
      and every number is editable
- [ ] Joining a held series prefills its fields, draws rows for only the new
      files, and refuses a number the series holds
- [ ] The resolve route creates or joins the series, records each Source file,
      and takes the Problem off the list
- [ ] The resolve route refuses a found path outside the run's root
- [ ] A film folder with two videos lists both and sets no `video`. Its
      reason reads _Two videos — pick the film._
- [ ] With two or more videos, `MovieFormFiles` draws the Found-file choice
      with the first preselected and the picker beside it. With one video or
      none it draws nothing new, and that Resolve works as it does today
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green
