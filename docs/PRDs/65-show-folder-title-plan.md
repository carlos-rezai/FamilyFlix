# Plan: Show folder title, a picked show named as a scan names it

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/628

A **Show folder pick** on the **Movie form** names the show exactly as
_Scan all folders_ would: the picked folder's **Folder key** gives the
title, and a year at the end of its name gives the year. Title and year are
each filled only when the field is empty or still holds what the previous
pick filled. The spec is design log 65 and one comment in
`docs/handoff/feat.MovieForm.dc.html`; nothing on screen changes apart from
what the two fields are filled with.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** The shell demos are backed by the integrated `MovieForm` suites, so
the acceptance never waits on a hand. No decision is left open: the
maintainer approved every recommendation of log 65 in advance, and this plan
adds none.

- The phases are log 65's _Implementation Plan_ slices, one to one.
- **Each phase starts from its own RED test**, except phase 3, whose
  deletions are proved by a green suite (the `searchQuery` and `titleKey`
  tables unchanged).
- **Every existing show folder, movie form and import test stays green after
  every phase**, apart from fixtures and expectations that name the retired
  `titleGuess`, which move to `title` and `year` in phase 1.
- The glossary, checklist and prototype comment were done in the grill-me;
  the feature checklist's step 48 row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: no migration.
- **Routes**: none new. `GET /api/show-folder` keeps its path and query and
  answers the new `ShowFolderRead` shape.
- **Key models**:
  - `ShowFolderRead` loses `titleGuess: string` and gains `title: string`
    and `year: number | null`, flat beside its other fields, documented as
    the picked folder's Folder key. No nested `folderKey`.
  - The **Show folder read** names the Show folder by the media domain's
    `folderKeyOf`, the scan's own reader, with no guess on top. A picked
    Season folder is resolved to its Show folder first, unchanged.
  - The form's prefill input is `prefillFolderKey(key, picked)`, both
    `Pick<ShowFolderRead, 'title' | 'year'>`, `picked` being `null` before
    any pick.
- **The rules**:
  - Title and year are decided independently. Each is replaced when it is
    empty (trimmed) or still equals what the previous pick filled;
    otherwise it stays.
  - The year is written as the field's text, `String(year)`, or `''` for a
    `null` year.
  - The held refusal names `held?.series.title ?? read.title`.
  - A picked year is saved like any typed year; a Sync fills only an empty
    year.
  - `titleFromFilename`, the Search query and `titleKey` are untouched.

---

## Phase 1: The read answers the Folder key

**User stories**: 1, 4 (title), 6 to 10, 14, 17 (title), 19, 20, 23 to 25

### What to build

The Show folder read answers the picked folder's Folder key as `title` and
`year` in place of `titleGuess`, and the route returns that shape. The
show folder pick prefills the title from `title` by the existing
picked-or-empty rule (the year is carried but not yet written), and the held
refusal falls back to `read.title`. Every `ShowFolderRead` literal in the
movie form's tests moves to the new shape. Demo: in the shell, pick
`Severance (2022–)/` on a series add and the title reads _Severance_.

### Acceptance criteria

- [ ] The Show folder read: `Severance (2022–)` answers _Severance_, 2022;
      `Heat (1995)` answers _Heat_, 1995; `Heat` answers _Heat_, `null`;
      `Severance.S01.1080p.WEB-DL`, `Seinfeld 1989` and
      `Heat (1995) [1080p]` answer their names verbatim with `null`; a
      picked `Season 1/` answers its Show folder's key.
- [ ] `GET /api/show-folder` answers `title` and `year` and no `titleGuess`.
- [ ] The pick hook calls `prefillFolderKey` with the read's key and `null`
      on a first pick, with the first pick's key on a second, and not at all
      on a held (refused) pick.
- [ ] The held refusal names the held series' title, else `read.title`
      (`Severance is already in your library.`).
- [ ] The integrated form: picking `Severance (2022–)/` types _Severance_; a
      typed title survives a pick; a second pick replaces a picked title; a
      title typed after the first pick survives the second.
- [ ] Episode numbering, Unplaced videos, stray subtitles, Link or Copy, the
      browser add and `titleFromFilename` behave as before.

---

## Phase 2: The year is prefilled

**User stories**: 2, 3, 4 (year), 5, 11 to 13, 15 to 18 (year), 21, 22

### What to build

`prefillFolderKey` writes the year beside the title in one update, by the
same picked-or-empty rule, decided independently of the title. A `null`
year empties only a field that was empty or picked. Demo: in the shell, pick
`Severance (2022–)/` and the Year field reads 2022; pick a yearless folder
next and it is emptied; type a year and pick again, and it stays.

### Acceptance criteria

- [ ] An empty Year field takes the picked year; `Severance (2022-2025)/`
      and `Severance (2022–2025)/` fill 2022.
- [ ] A yearless folder leaves an empty Year field empty.
- [ ] A typed year survives a pick; a typed title with an empty year takes
      only the year; a typed year with an empty title takes only the title.
- [ ] A second pick replaces the picked year (`Heat (1995)/` then
      `Heat (1986)/` shows 1986), and empties it for a yearless folder.
- [ ] A year typed after the first pick survives the second; a field
      cleared by hand is filled by the next pick.
- [ ] A saved picked year is kept by a Sync; a Sync still fills an empty
      year from TMDB.

---

## Phase 3: The guess retires

**User stories**: 23, 26

### What to build

`titleGuess` is deleted from the `titleKey` unit with its test tables;
`dropReleaseNoise`, `stripTails` and `RELEASE_NOISE` stay for the Search
query. The docblocks of the Show folder read, `ShowFolderRead`, the pick
hook and the form's prefill describe the Folder key, and `titleFromFilename`'s
docblock and test header no longer name `titleGuess` as their counterpart.

### Acceptance criteria

- [ ] No code or test names `titleGuess`, `prefillTitle` or `pickedTitle`.
- [ ] The `searchQuery` and `titleKey` tables pass unchanged; a release-named
      title still yields a clean Search query.
- [ ] The docblocks name the Folder key as the pick's title and year.
- [ ] The full suite and the typecheck are green.
