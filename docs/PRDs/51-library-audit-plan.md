# Plan: Library audit, one predictable way to add, take out and bring back

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/443

Testing 0.10.0 live turned up eleven findings (F1 to F11) in the Library
flows: rescans make doubles, a Delete throws away files (sometimes another
title's), a title taken out comes back, real season folders read as films, the
Show folder pick mislabels what it picked, films with no genre vanish from the
home, and the scan's copy miscounts. This initiative fixes all of them. It adds
the **Held video** rule, a Delete that keeps the files unless asked (the
**Recycle choice**), **Left-out videos** with _Bring back_, the wider **Season
folder** and **Episode word** readings, a Show folder pick that reads right, the
**Other row**, and title tallies.

## Running the phases

**Phases 1 to 18 are AFK and run under `issue-loop`, in order. Phase 19 is
HITL.** The follow-up (log 51, _Follow-up: issues 463, 465 and 466_) adds
phases 20 to 23, AFK and in order, and phase 24, HITL. Its slices 10 to 13
are phases 20 to 23; phase 24 walks them on the real library, as phase 19
did; its slice 14 (the docs, then the refactor) is not a phase.

- The prototype already lives in `docs/handoff/`, so amending it needs no
  Claude Design round. Its revision is phases 1 to 3, and lands before any
  build phase (log 51 Q2). The PRD and log 51 fully specify the amendment
  (copy, cards, lines, placement), so a phase never stops to ask.
- **Each phase stays well under a 100k-token context.** The prototype files
  are large (`page.ManageLibraryPage.dc.html` is about 49 KB,
  `COMPONENT-SPEC.md` about 93 KB, `feat.MovieForm.dc.html` about 32 KB). A
  phase greps for the section it amends and reads only that range. The suites
  are large too (`routes.test.ts` is about 6,500 lines, `MovieForm.test.tsx`
  about 4,800, `createImporter.test.ts` about 2,500). A phase adds its own
  focused suite (as `routes.linkedDelete.test.ts` and
  `createImporter.series.test.ts` did) and reads the big ones only by grep.
- No test runs Electron, FFmpeg or TMDB. The shell's trash and path bridge are
  injected fakes; the importer runs over its `fixture/` tree or a temp tree.
- The docs (the checklist's step 34 entry and row, README's Library paragraph,
  CLAUDE.md _Product Rules_, the docblocks of log 51 Q17) are not a phase:
  they are ticked ✅ only after the refactor. The glossary already carries
  **Held video**, **Left-out video**, **Recycle choice** and **Other row**, and
  the updated terms.

The phases are log 51's _Implementation Plan_ slices 1 to 9, the larger ones
split so no issue outgrows one context.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `DELETE /api/movies/:id` and `DELETE /api/series/:id`: a linked title's
    files are kept by default; `?files=trash` moves the **Linked files** to
    the Recycle Bin. A plain Delete never asks the shell, so a browser Delete
    no longer answers `409`. A copied title is unchanged.
  - `DELETE /api/library-folders/:id/left-out` (new): _Bring back_, forgets
    that folder's entries, answers `204`.
  - `GET /api/library-folders`: each folder gains its `leftOut` count.
  - `GET /api/home`: gains `other`, the **Other row**, after `rows`.
  - `GET /api/genre-less` (new): every film with no genre, uncapped.
  - `GET /api/show-folder`: each video answered with its path relative to the
    Show folder; a picked Season folder climbs to its Show folder for the
    title and the held check.
- **Client routes**: `/genre-less` (new), the Genre page in its `other` mode.
  Never `/genre/other`, so a genre named _Other_ keeps its own page.
- **Schema**: migration 15 adds `left_out_videos (library_folder_id,
video_path)`, primary key on both, `ON DELETE CASCADE` from
  `library_folders`. `video_path` is relative with forward slashes, spelled as
  a Linked video's. `resetDatabase` empties it. No unique index on
  `movies.video_path` or `episodes.video_path`: an older library that already
  holds doubles must still migrate.
- **Key models**:
  - `titleHolding(folderId, videoPath): { kind: 'movie' | 'series'; id } |
null`, in the library domain's storage. It reads `movies` and `episodes`
    by `video_folder_id` and `video_path`, and covers a held episode's Source
    file.
  - Left-out storage: `leaveOut(entries)`, `leftOut(folderId):
ReadonlySet<string>`, `clearLeftOut(entries)`, `bringBack(folderId):
number`; entries are `{ folderId, videoPath }`.
  - **Already in library** runs in order: folder on record, the **Held
    video** rule, the title key. A match by held video records the folder with
    `setSourceFolder`. The follow-up puts the **Missing video** rule third,
    before the title key, and the title key passes over a film whose video
    is a **Missing video** (`playback.videoFile` answers `missing`) wherever
    a found video is at stake. A missing film the folder on record or the
    Missing video rule finds is **Found again**.
  - `MoviePatch.mediaFolder?: string` (`src/types/write.ts`) and
    `SeriesEdit.mediaFolder?: string` (the series write): an edit records a
    folder it reserved. `ImportRun.found` is the folders the walk has gone
    through so far, ending at the found line's M.
  - `LinkedFiles` in `src/types` is `'folder' | 'videos' | 'shared' |
'unreachable'`. `videos` never holds a path another held title links.
  - `LibraryFolderView.leftOut: number`; `HomePayload.other: HomeRow | null`.
  - `seasonOf` (server) and `readSeasonFolder` (client) read, in any case,
    `Season N`, `Season 0N`, `Seizoen N`, `SNN` (alone or followed by a
    separator and anything), a standalone `SNN` not followed by `E\d` (its
    parent is then the Show folder), and `Specials` and `Season 0` as season 0. The number comes straight after the word. The drift guard keeps the two
    in step.
  - `episodeTag` (server) and `readEpisodeTag` (client) gain `Aflevering N`
    and `Afl. N`.
- **Copy**: the Recycle choice reads **Keep the files** (_They stay in your
  library folder. A scan won't add it again._) and **Move them to the Recycle
  Bin** (_From your library folder, so it can be restored from there._). The
  shared wording is _Its video file(s), which another title plays_; the log
  line is _· Left out N videos you deleted earlier_; the Folder row reads
  _N videos left out_ with _Bring back_; the row title is _Other movies_; the
  tallies are _Found N titles across M folders_ and _Scan complete: N
  imported_; the Import mode heading is _Link or copy_. The follow-up's live
  stat is _Found N folders so far_, and a film found again logs the Sheet
  fills' `✓ Updated` line naming `video`.
- **Unchanged throughout**: the whole-folder refusal for a Source folder
  another title lies in; a copied title's Delete; season `>= 0` on the form
  and the wire; Enrichment as the only network client.

---

## Phase 1: Prototype, the Recycle choice

**User stories**: 10 to 18, 20, 23 (as spec)

### What to build

Amend the Delete dialog in `docs/handoff/page.ManageLibraryPage.dc.html`,
`page.MoviePage.dc.html` and `page.SeriesPage.dc.html`. For a linked title in
the shell, two `ChoiceCard`s sit between _What goes / What stays_ and the
buttons: **Keep the files** (chosen on every open) and **Move them to the
Recycle Bin**, each with its one-line explanation. _What goes_, _What stays_
and the Recycle Bin callout follow the choice: keeping moves the video file(s)
to _What stays_ and hides the callout. The confirm stays _Delete movie_ /
_Delete series_. A copied title draws no cards. A title whose videos are all
another title's draws no cards and no Recycle Bin card, and _What stays_ reads
_Its video file(s), which another title plays_. A browser draws no cards.

Amend `COMPONENT-SPEC.md`'s rows for the three pages' Delete dialogs (grep for
`DeleteTitleDialog` and the page names): the choice, its default, and the
`shared` wording.

Read only the Delete dialog's range of each file (grep for `What goes`) and
the matching spec rows.

### Acceptance criteria

- [ ] All three prototypes draw the two cards for a linked title, with **Keep
      the files** chosen on open.
- [ ] _What goes_, _What stays_ and the callout follow the choice; the
      callout shows only on the Recycle Bin card.
- [ ] The confirm copy is unchanged on both choices.
- [ ] A copied title, and a browser, draw no cards.
- [ ] The all-shared state draws no cards and the shared wording.
- [ ] The spec rows name the choice and the shared wording.

---

## Phase 2: Prototype, the Other row

**User stories**: 61 to 64, 66, 67 (as spec)

### What to build

Amend `docs/handoff/page.LibraryPage.dc.html` and `feat.GenreRow.dc.html`: the
Movies home draws a last row titled _Other movies_ holding the sample films
with no genre, capped at 15 like a genre row, its _View all_ opening the Genre
page in an `other` mode headed _Other movies_ with every such film. Under a
genre filter the row is not drawn; when every film has a genre it is not
drawn. Give the sample library a few films with no genre so the row shows.

Amend `COMPONENT-SPEC.md`'s `feat.GenreRow`, `HomeRows` and Genre page rows
(grep for them): the Other row and the `other` mode.

### Acceptance criteria

- [ ] The prototype's home draws _Other movies_ last, holding only the
      genre-less films, at most 15.
- [ ] Its _View all_ opens a page headed _Other movies_ with all of them.
- [ ] A genre filter hides the row; a library with no genre-less film draws
      none.
- [ ] The spec rows name the Other row and the `other` mode.

---

## Phase 3: Prototype, Library folders and the Movie form

**User stories**: 36 to 38, 50 to 53, 73, 74 (as spec)

### What to build

Amend `docs/handoff/page.LibraryFoldersPage.dc.html`: a Folder row with
left-out videos draws a second line, _3 videos left out_, with a _Bring back_
text button; pressing it removes the line. A folder with none draws no line.

Amend `mol.EpisodeFileRow.dc.html`: a row placed by a folder pick shows its
path inside the show (`Seizoen 2/Aflevering 1.mp4`); a hand-picked file shows
its name.

Amend `feat.MovieForm.dc.html`: the Show folder row truncates from the start
(its own name always shows) with the full path on hover; the Import mode card
is headed _Link or copy_; the lede names _Library folders_.

Amend the matching `COMPONENT-SPEC.md` rows (`FolderRow`, `mol.EpisodeFileRow`,
`feat.MovieForm`, `ImportModeChoice`). Read only the ranges each change
touches.

### Acceptance criteria

- [ ] The Folder row draws the left-out line and _Bring back_ only with a
      count, and the line goes on press.
- [ ] Picked Episode file rows show the relative path; a hand pick shows the
      name.
- [ ] The Show folder row ellipsises the start and carries the full path as
      its title.
- [ ] The Import mode card reads _Link or copy_; the lede names _Library
      folders_.
- [ ] The spec rows match.

---

## Phase 4: Season folders read as real shows name them

**User stories**: 41 to 47, 49

### What to build

The wider Season folder rule in `seasonOf` (server, `groupShows`) and its
client mirror `readSeasonFolder`: `Season N`, `Season 0N`, `Seizoen N` and
`SNN` in any case, alone or with trailing text after a separator (the year in
`Season 1 (2008)` never read as the number); a release name holding a
standalone `SNN` not followed by `E\d`, whose parent is the Show folder;
`Specials` and `Season 0` as season 0. `S01E01` is never a Season folder. The
drift guard runs both readings over one table. Their docblocks are rewritten.

Demo: a scan of `Seizoen Show/Seizoen 1`, `Year Show/Season 1 (2008)`,
`Release Show/Release.Show.S01.1080p.WEB-DL` and `Specials Show/Specials`
makes four series, no films.

### Acceptance criteria

- [ ] Table tests: every spelling in either case; trailing text; the year
      ignored; release `S01`; `S01E01` refused; `Specials` and `Season 0` as
      0; a film folder that isn't a season.
- [ ] The drift guard passes over the same table.
- [ ] The importer test over the four shapes makes four series with their
      seasons.
- [ ] The existing `groupShows`, `readSeasonFolder` and importer suites pass.

---

## Phase 5: The Episode word, `Aflevering` and `Afl.`

**User stories**: 48

### What to build

`episodeTag` (server) and `readEpisodeTag` (client) read `Aflevering 12` and
`Afl. 12` as episode 12, in any case. Every existing shape reads as before.
Demo: a scanned `Seizoen 1/Aflevering 3.mp4` lands as S1 E3, not Unplaced.

### Acceptance criteria

- [ ] `Aflevering 12` and `Afl. 12` give 12 on both sides.
- [ ] The existing shapes are unchanged.
- [ ] A scanned Dutch season places its episodes by number.

---

## Phase 6: A scan knows a file it already plays

**User stories**: 1 to 6

### What to build

`titleHolding(folderId, videoPath)` in the library domain's storage, and the
importer's second **Already in library** rule. A found film whose video is a
held title's Linked video is _Already in library_. A Show folder with any one
held episode video (Linked video or Source file) is the held series, and still
takes its new episodes. On either match the folder is recorded with
`setSourceFolder`, so the next scan matches by folder. The rule ignores TMDB
and original titles, so a hand-typed title is held too.

Demo: rename a title with no folder on record (as a Sync would) and rescan:
nothing is added, and its folder is now on record.

### Acceptance criteria

- [ ] `titleHolding` (real SQLite): a film's Linked video; an episode's Linked
      video; an episode's Source file; the same path in another Library folder
      is not held; `null` when nothing holds it.
- [ ] A renamed film and a renamed series with no folder on record are
      _Already in library_ on rescan, and their folders are recorded.
- [ ] A held series found by one episode gains the folder's new episodes.
- [ ] A database already holding a double still migrates and scans.

---

## Phase 7: The add paths refuse a held video

**User stories**: 7 to 9

### What to build

The Movie form's add refuses a linked video a held title already plays, with
_&lt;Title&gt; already plays this file._, the way a held Show folder is refused
(log 48 Q10). `readShowFolder` (and so `GET /api/show-folder`) calls a picked
Show folder held when any of its videos is held through `titleHolding`, as
well as by the folder on record.

Demo: pick _Coco_'s video again in the form and the add is refused by name;
pick a renamed show's folder and it is refused as held.

### Acceptance criteria

- [ ] An add of a held linked video answers the refusal naming the holder,
      and adds nothing.
- [ ] The form shows that refusal.
- [ ] A Show folder with one held episode reads as held.
- [ ] Unheld picks add as before.

---

## Phase 8: A plain Delete keeps the files

**User stories**: 10, 19, 21, 22, 24, 25

### What to build

The delete contract. `DELETE /api/movies/:id` and `/api/series/:id` keep a
linked title's files by default and never ask the shell; with `?files=trash`
they run `trashedFirst` over the Linked files. Every Delete still removes the
row, art, subtitles and Media folder. `linkedFiles` drops every path another
held title links from `videos`, and answers `shared` with no paths when none
is left; `LinkedFiles` gains `'shared'`. The whole-folder refusal stays. The
dialogs send a plain Delete (the choice arrives in phase 9). The `linkedFiles`
and `trashedFirst` docblocks are rewritten.

Demo: in a browser, delete a linked film: it goes, and its file stays where
it was.

### Acceptance criteria

- [ ] A plain delete keeps the files and never calls the shell trash.
- [ ] A browser (no shell) plain delete succeeds; no `409`.
- [ ] `?files=trash` trashes only the unshared paths.
- [ ] `linkedFiles`: shared videos dropped; all shared gives `shared` with no
      paths; `folder` and `unreachable` unchanged.
- [ ] A copied title's delete is unchanged.
- [ ] Art, subtitles and the Media folder go on every Delete.

---

## Phase 9: The Recycle choice in the dialog

**User stories**: 11 to 18, 20, 23

### What to build

`DeleteTitleDialog` draws the Recycle choice per phase 1: two `ChoiceCard`s,
drawn only for a linked title in the shell whose Linked files aren't `shared`,
**Keep the files** chosen on every open. _What goes_, _What stays_ and the
callout follow the choice; the confirm copy is unchanged; the request carries
`files=trash` only on the second card. When the files are `shared`, no cards
and _What stays_ reads _Its video file(s), which another title plays_.
`DeleteMovieDialog` and `DeleteSeriesDialog` draw it, so Manage library, the
movie page and the series page all have it.

Demo: in the shell, delete a linked film choosing the Recycle Bin and the file
is in the Recycle Bin; delete another with the default and the file stays.

### Acceptance criteria

- [ ] The cards are drawn only for a linked title in the shell.
- [ ] **Keep the files** is chosen on every open, even after a Recycle Bin
      pick last time.
- [ ] _What goes_, _What stays_ and the callout follow the choice.
- [ ] The request carries `files=trash` only on the second card.
- [ ] The `shared` state draws no cards and the shared wording.
- [ ] A copied title and a browser draw no cards.
- [ ] All three dialogs draw it; their existing suites pass.

---

## Phase 10: A title taken out stays out

**User stories**: 26, 28 to 33, 40

### What to build

Migration 15 and the left-out storage (`leaveOut`, `leftOut`, `clearLeftOut`,
`bringBack`). A keep-files Delete records each Linked video. A copied title's
Delete records its Source folder's Source file(s) where its Library folder is
known. A trash Delete records nothing. A Folder scan and a sheet import skip
left-out videos before any match; a Show folder whose every video is left out
is skipped whole, one with new videos takes only those. Each run logs one
`info` line, _· Left out N videos you deleted earlier_, when N is above zero.
`resetDatabase` empties the table.

Demo: delete a linked film keeping its files, rescan: it stays out, and the
log says why.

### Acceptance criteria

- [ ] The migration runs on a version-14 database; the storage round-trips;
      `resetDatabase` empties it.
- [ ] A keep-files Delete records the videos; a trash Delete records none.
- [ ] A deleted copied title's original stays out on rescan.
- [ ] A scan and a sheet import skip left-out videos, with one log line per
      run.
- [ ] An all-left-out Show folder is skipped whole; new videos beside
      left-out ones arrive.

---

## Phase 11: Removed episodes stay out; a hand add brings back

**User stories**: 27, 34, 35

### What to build

The **Series edit job** records each removed episode's video as left out. A
Movie form add clears the left-out entry of the video it adds, and a Show
folder pick clears the entries of the videos it adds.

Demo: remove an episode in the series edit, rescan: it stays out. Pick it in
the form: it comes back.

### Acceptance criteria

- [ ] An episode removed in the series edit stays out on rescan.
- [ ] A form add of a left-out video adds it and clears its entry.
- [ ] A Show folder pick adds its left-out videos and clears their entries.
- [ ] A later scan does not skip what a hand add brought back.

---

## Phase 12: Bring back on Library folders

**User stories**: 36 to 39

### What to build

`GET /api/library-folders` gives each folder's `leftOut` count
(`LibraryFolderView.leftOut`). `DELETE /api/library-folders/:id/left-out`
forgets that folder's entries and answers `204`. `FolderRow` draws the second
line per phase 3, _N videos left out_ with _Bring back_, only when the count
is above zero; pressing it calls the route and the line goes. Removing a
Library folder cascades its entries.

Demo: on Library folders, a folder reads _1 video left out_; press _Bring
back_, rescan, and the film is back.

### Acceptance criteria

- [ ] The list carries each folder's count.
- [ ] `DELETE …/left-out` answers `204` and the next scan adds the videos.
- [ ] The line and button are drawn only with a count; pressing removes it.
- [ ] Removing a Library folder removes its entries.

---

## Phase 13: Picked episodes read apart

**User stories**: 50 to 53

### What to build

`readShowFolder` and `GET /api/show-folder` answer each found video with its
path relative to the Show folder. Episode file rows a pick lands show that
relative path; a hand-picked file keeps its own name. The Show folder row
truncates from the start, with the full path as its `title`.

Demo: pick a show with two seasons' `Aflevering 1.mp4`; the rows read
`Seizoen 1/Aflevering 1.mp4` and `Seizoen 2/Aflevering 1.mp4`, and the folder
row ends in the show's own name.

### Acceptance criteria

- [ ] The read answers relative paths per video.
- [ ] Picked rows show the relative path; hand-picked rows show the name.
- [ ] The Show folder row ellipsises the start and carries the full path as
      its `title`.

---

## Phase 14: Episodes numbered by their season

**User stories**: 54, 55

### What to build

A picked video in a Season folder is numbered from that folder's season
(through the wider `readSeasonFolder`), so a season-2 video never lands as S1
E3. The **Numbering guess** starts each season's free numbers from that
season.

### Acceptance criteria

- [ ] A video under `Seizoen 2` lands in season 2.
- [ ] The guess numbers free episodes per season, from 1 in each.
- [ ] Videos with an Episode tag keep their tagged numbers.

---

## Phase 15: The title follows the pick; a Season folder climbs

**User stories**: 56 to 60

### What to build

`useShowFolderPick` remembers whether the title came from a pick: a new pick
replaces a picked title and never a typed one (log 29 Q19). A picked Season
folder (`Tacoma FD/Season 1`) is read for its own episodes only, but titled
and held-checked by its Show folder (`showFolderOf`), on the server read and
so on the form.

Demo: pick `Tacoma FD/Season 1` while _Tacoma FD_ is held: refused as held.
Pick the wrong show, then the right one: the title follows.

### Acceptance criteria

- [ ] A second pick replaces a picked title; a typed title is never
      overwritten.
- [ ] A picked Season folder is titled by its show and reads only its own
      episodes.
- [ ] That pick is refused while the show is held.

---

## Phase 16: Every film on the Movies home

**User stories**: 61 to 63, 65 to 67, 69

### What to build

The home read gains `other: HomeRow | null` on `HomePayload`, after `rows`:
every film with no Genre, capped at 15, narrowed by a search, the rating
filter and the sort; `null` under a genre filter and when empty. No genre is
written to those films. `HomeRows` draws it last, titled _Other movies_, its
_View all_ to `/genre-less` (the page lands in phase 17). The `HomeRows`
docblock is rewritten.

Demo: scan a folder of films with no Sync: the home shows them under _Other
movies_ instead of _Your library is empty_, and search finds them.

### Acceptance criteria

- [ ] `other` holds only genre-less films, at most 15.
- [ ] Search, rating and sort narrow it; a genre filter makes it `null`; empty
      is `null`.
- [ ] `HomeRows` draws it last as _Other movies_ with _View all_ to
      `/genre-less`, and draws nothing for `null`.
- [ ] No genre is written to those films.

---

## Phase 17: The Other movies page

**User stories**: 64, 68

### What to build

`GET /api/genre-less` answers every film with no genre, uncapped. The
`/genre-less` route draws the **Genre page** in its `other` mode, headed
_Other movies_, with the grid of those films. `/genre/Other` still lands on a
genre named _Other_.

### Acceptance criteria

- [ ] The route answers all genre-less films, uncapped.
- [ ] `/genre-less` draws _Other movies_ and its grid.
- [ ] A genre named _Other_ keeps its own `/genre/:name` page.

---

## Phase 18: Copy and tallies

**User stories**: 70 to 74

### What to build

The importer's found-count and imported-count count titles: a new series is
one, a held series that only gained episodes is none. The log lines read
_Found N titles across M folders_ and _Scan complete: N imported_.
`ImportModeChoice`'s heading becomes _Link or copy_ wherever it's drawn (the
form, Library folders, Import setup). The Movie form's lede names _Library
folders_.

### Acceptance criteria

- [ ] A scan of 10 films and 5 new series logs _Found 15 titles across M
      folders_ and _Scan complete: 15 imported_.
- [ ] A held series that gained episodes is not counted.
- [ ] `ImportModeChoice` reads _Link or copy_; the lede names _Library
      folders_.

---

## Phase 19: Walk it again (HITL)

**User stories**: all, as a walk

### What to build

Walk the flows live in the shell, end to end, against the sandbox shapes and
the real household layout: rescan an older library, delete with each choice,
rescan, bring back, pick the Dutch and release-named shows, check the home.
Anything that still misbehaves is filed as a new issue, not fixed here. This
phase needs a person at the shell.

### Acceptance criteria

- [ ] A rescan of the real library adds no double.
- [ ] A keep Delete stays out and comes back with _Bring back_; a Recycle Bin
      Delete trashes only that title's files.
- [ ] The four sandbox shapes and the real layout read as their shows.
- [ ] Every held film is on the Movies home.
- [ ] Findings, if any, are filed by number.

---

## Phase 20: Every title found

**User stories**: 75, 76

### What to build

`walkListed` counts every film and every show it grouped in _Found N titles
across M folders_, held or new, and loses its `isHeldShow` parameter. _Scan
complete: N imported_ is unchanged. `run.found` counts folders by
`foldersUnder`'s rule as the walk goes (every Source folder and every shelf
above it, before left-out videos come off), so its last value is M.
`importView` reads _Found N folders so far_. The prototype already reads so.

### Acceptance criteria

- [ ] A rescan with one held film, one held show that gained an episode and
      three new titles logs _Found 5 titles_ and _Scan complete: 3 imported_.
- [ ] `run.found` at the end of the walk equals the found line's M.
- [ ] The running step reads _Found N folders so far_.

---

## Phase 21: An edit owns its folder

**User stories**: 85 to 87

### What to build

`PATCH /api/movies/:id` and `PATCH /api/series/:id` record a folder they
reserved as the title's **Media folder** when the edit commits:
`MoviePatch.mediaFolder` and `SeriesEdit.mediaFolder`, written over a recorded
folder that is gone. The movie edit's rollback removes a folder it reserved,
as the series edit's already does, and still removes only its own files from
a folder it reused.

### Acceptance criteria

- [ ] A movie edit whose recorded folder is gone, with a new poster, records
      the reserved folder; a Delete afterwards leaves nothing in `media/`.
- [ ] A refused movie edit that had reserved a folder leaves no new folder.
- [ ] A series edit whose recorded folder is gone records the one it reserved.
- [ ] An edit that reuses its recorded folder is unchanged.

---

## Phase 22: A missing film holds by evidence

**User stories**: 77, 78

### What to build

The title key in `heldFilm` passes over a held film whose
`playback.videoFile` answers `missing`, so the found video is imported. A
film whose video answers `unreachable` still holds. The folder on record and
the **Held video** rule are unchanged. A Sheet row with no folder found still
reaches a missing film by key, for Sheet fills.

### Acceptance criteria

- [ ] A scan beside a held _Guardians of the Galaxy_ whose copied video is
      gone imports the found `Guardians of the Galaxy.mp4` as a new film.
- [ ] A held film on an unreadable Library folder still holds by key.
- [ ] A sheet row with no folder found still fills a missing film.

---

## Phase 23: Found again

**User stories**: 79 to 84

### What to build

The **Missing video** rule sits third in `heldFilm`: a found video no earlier
rule placed, whose file name is the file name of exactly one held film's
Missing video (read once per run). When it, or the folder on record, finds a
film whose video is missing, the film is **Found again**: the found video is
placed by the run's Import mode (in Copy, into its Media folder, reserved and
recorded when that is gone, as phase 21 records one), its runtime is derived
again, its folder is recorded, and only `videoPath`, `videoFolderId`,
`runtimeMinutes` and, when reserved, `mediaFolder` change. The run logs the
Sheet fills' `✓ Updated` line naming `video`; nothing is filed in review.

### Acceptance criteria

- [ ] A dead copy `star-wars/The Last Jedi (2017).mp4` is found again by a
      scan of `Star Wars/The Last Jedi (2017).mp4`, in Link and in Copy; no
      second film is added.
- [ ] Its title, rating and watch history are unchanged, and the log holds
      one `✓ Updated` line naming `video`.
- [ ] A film whose folder is on record and whose video is gone takes the
      video found there.
- [ ] Two missing films of one file name are both left alone.

---

## Phase 24: Walk the follow-up (HITL)

**User stories**: 75 to 87, as a walk

### What to build

Remove the two empty folders in `media/` by hand, then scan `D:\Movies` in
the shell and edit a title whose folder is gone. Anything that still
misbehaves is filed as a new issue, not fixed here.

### Acceptance criteria

- [ ] The real _Guardians of the Galaxy_ is imported and plays.
- [ ] _Star Wars_ plays _The Last Jedi_; no second one is held.
- [ ] A rescan's _Found N titles_ matches the titles it lists.
- [ ] No folder in `media/` is left that no title names.
