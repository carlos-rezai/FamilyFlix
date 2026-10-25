> **Initiative:** `library-audit`
> **Design log:** `docs/design-logs/51-library-audit.md`
> **Issue:** #443 (the PRD, step 34)
> **Build order:** step 34, **Library audit**. It ships as thin slices (log 51, _Implementation Plan_), the prototype revision first. One migration (15: `left_out_videos`), two new routes, a changed delete contract.
> **Follow-up:** log 51, _Follow-up: issues 463, 465 and 466_ (Q18 to Q27), found walking #462. Its slices 10 to 13 are the plan's phases 20 to 23, walked live in phase 24; slice 14 (the docs, then the refactor) stays outside the phases, as the docs always were. No migration, no new route.

## Problem Statement

Testing 0.10.0 live turned up a run of problems in the Library flows. Each step was built on its own and nobody had walked them end to end. Walked against the folder shapes a real household has, they lose titles, make doubles, throw away files nobody asked to lose, and misread how real shows are laid out.

- **Rescans make doubles** (F1). Some titles have no folder on record (added before log 48) and no longer key like their folder because a Sync renamed them (_Rogue One: A Star Wars Story_ for `Rogue One  (2016).mp4`). A rescan links their files a second time: a second _Coco_, a second _Tacoma FD_.
- **Deleting the double throws away the original's files** (F2). The Delete dialog promises to move _Its video file(s)_ to the Recycle Bin, and those are the files the original plays too.
- **Every Delete throws the files away** (F3). A linked title can't be taken out of FamilyFlix with its files kept, so it can never be added back.
- **A title taken out comes back** (F7). Once a Delete keeps the files, the next scan finds them again. That already happens today to an episode removed in the series edit, and to a deleted copied title whose original still sits in the Library folder.
- **Real season folders read as films** (F5, F11). `Seizoen 1` and `Season 1 (2008)` become films named _Aflevering 1_ and _Season 1_. `Release.Show.S01.1080p.WEB-DL` turns each season into its own series. A `Specials` folder becomes a film called _Specials_. `Aflevering 1` gives no episode number, so every Dutch episode is Unplaced.
- **The Show folder pick is mislabelled** (F4, F8). Two seasons' `Aflevering 1.mp4` look identical on the form. A season-2 video lands as S1 E3. The folder row shows `C:\Users\…` and cuts off the folder's own name. A second pick keeps the first pick's title. Picking `Tacoma FD/Season 1` names the show _Season 1_ and misses that _Tacoma FD_ is already held.
- **Films with no genre disappear** (F6). The Movies home is built from genre rows. Every scanned film has no genre until a Sync, so the home says _Your library is empty_ with 11 films held, and search can't find them either.
- **The copy miscounts and misnames** (F9, F10). _Found 15 movies_ counts shows as movies. _Scan complete: 10 imported_ leaves out five new series. The form has two cards headed _FILES_, and its subtitle points to an _Import library_ screen that doesn't exist.

Walking the build against the household's real `D:\Movies` (#462) turned up three more:

- **A title whose video is gone keeps a real one out** (#463). The older _Guardians of the Galaxy_ record points at a folder that no longer exists, yet a scan matches it by title and never links the real `Guardians of the Galaxy.mp4`. The dead _Star Wars_ record, copied long ago from `Star Wars/The Last Jedi (2017).mp4`, sits beside a newly linked _The Last Jedi_: the film is held twice.
- **The Found line still miscounts** (#465). It counts held films but not held shows, so a rescan of everything held reads _Found 6 titles_ above eleven _Already in library_ lines. The live stat says _Found N movies so far_ while counting folders.
- **Empty folders are left in managed storage** (#466). `media/the-last-jedi-2017/` and `media/guardians-of-the-galaxy-vol-2/` hold nothing and no title names them, so the next _The Last Jedi_ lands in `the-last-jedi-2017-2/`.

## Solution

One predictable way to add, edit, take out and bring back a film, a series or an episode, its files or its details.

- **A scan knows a file it already plays.** After the folder-on-record rule and before the title key, a new **Held video** rule applies. A found video that is already a held title's **Linked video**, or a held episode's **Source file**, makes that title held. The scan then records the folder, so the next scan matches by folder. A Movie form add of a video that is already held is refused: _Coco already plays this file._
- **A Delete keeps the files unless asked.** For a linked title in the shell, the Delete dialog shows the **Recycle choice**: **Keep the files** (picked on every open) or **Move them to the Recycle Bin**. _What goes_ and _What stays_ change with the choice. Keeping is the default, and it works in a browser too.
- **A Delete never trashes another title's file.** Videos that another held title links are dropped from what goes to the Recycle Bin. When no video is left, the Recycle Bin card isn't drawn and _What stays_ says _Its video file(s), which another title plays_.
- **A title taken out stays out.** A Delete that keeps the files, and an episode removed in the series edit, record each video as a **Left-out video**. Every scan and sheet import skips them and logs one line per run. A hand add (the form, or a Show folder pick) brings back what it picks. The Library folders page shows _3 videos left out_ on a folder that has any, with a _Bring back_ button.
- **Season folders read the way real shows are named.** `Season 1`, `Season 01`, `Seizoen 1`, `S01`, with or without trailing text. A release name holding a standalone `S01`. `Specials` and `Season 0` as season 0. `Aflevering 12` and `Afl. 12` give episode numbers.
- **The Show folder pick reads right.** Each picked episode shows its path inside the show (`Seizoen 2/Aflevering 1.mp4`). The folder row truncates from the start so its own name always shows. The title follows each new pick until the maintainer types one. A picked Season folder is titled and held-checked by its show.
- **Every film is on the home.** An **Other row**, _Other movies_, sits last on the Movies home and holds every film with no genre. Its _View all_ opens `/genre-less`.
- **The copy is right.** Scans count titles: _Found 15 titles across 22 folders_; _Scan complete: 15 imported_. The Import mode card is headed _Link or copy_. The form's subtitle points to _Library folders_.
- **The Found line counts what was found** (follow-up). Every title found, held or new, films and shows alike; _Scan complete_ still counts only the new. The live stat reads _Found N folders so far_ and ends at the found line's folder count.
- **A title whose video is gone holds only on evidence** (follow-up). A film whose video is a **Missing video** never holds a found video by its title, so the real film is imported and plays. When its folder on record, or the **Missing video** rule (the found file has the name of exactly one missing film's video), points at it, the film is **Found again**: it takes the found video, its details and watch history kept.
- **An edit owns the folder it makes** (follow-up). An edit that needs a new Media folder records it when it saves, and a refused edit removes it, so nothing in `media/` is left unnamed.

## User Stories

### Rescanning

1. As the maintainer, I want a rescan of an older library to add nothing that's already held, so that I never find two of the same film.
2. As the maintainer, I want a title that a Sync renamed to still be recognised by the file it plays, so that a better title never costs me a double.
3. As the maintainer, I want a series recognised as held when any one of its episode videos is found, so that a show folder rescanned after a rename isn't added again.
4. As the maintainer, I want a title matched by its video to have its folder recorded, so that every later scan recognises it the quick way.
5. As the maintainer, I want a held series found by its video to still take any new episodes in its folder, so that recognising it doesn't stop it growing.
6. As the maintainer, I want a title I typed by hand, with no TMDB title, to be recognised by its file too, so that the rule doesn't depend on online details.
7. As the maintainer, I want a held film's video picked again in the Movie form refused with _Coco already plays this file._, so that the form can't make the double a scan no longer makes.
8. As the maintainer, I want a picked Show folder whose episode is already held to be refused like a held folder is, so that both add paths follow one rule.
9. As the maintainer, I want an older library that already holds doubles to keep working after this update, so that nothing fails to start over data I can tidy by hand.

### Deleting

10. As a parent, I want Delete to take a title out of FamilyFlix and leave its files where they are, unless I ask otherwise, so that pressing Delete never loses a film from the family folder.
11. As the maintainer, I want a deliberate second choice to move a linked title's files to the Recycle Bin, so that I can still clear disk space when I mean to.
12. As a parent, I want **Keep the files** chosen every time the dialog opens, so that the safe choice never depends on what someone picked last time.
13. As a parent, I want each choice explained in one line (_They stay in your library folder. A scan won't add it again._ / _From your library folder, so it can be restored from there._), so that I know what each one does.
14. As a parent, I want _What goes_ and _What stays_ to change with my choice, so that the dialog always describes what will happen.
15. As a parent, I want the Recycle Bin warning shown only when I choose the Recycle Bin, so that the warning isn't there when nothing is being thrown away.
16. As a parent, I want the confirm button to stay _Delete movie_ / _Delete series_, so that the button means the same thing whatever I chose.
17. As the maintainer, I want the choice on all three Delete dialogs (Manage library, the movie page, the series page), so that a Delete works the same wherever I start it.
18. As the maintainer, I want a copied title's Delete unchanged, with no choice drawn, so that FamilyFlix's own copy still goes with its title.
19. As the maintainer using FamilyFlix in a browser, I want a plain Delete to work, so that taking a title out no longer fails with _Only the desktop app can…_.
20. As the maintainer, I want the Recycle Bin choice not drawn in a browser, so that I'm never offered something only the shell can do.
21. As the maintainer, I want a Delete never to trash a file that another held title plays, so that deleting a double can't break the original.
22. As the maintainer, I want only the unshared files trashed when a title shares some of its videos, so that the files that are only this title's still go.
23. As the maintainer, I want no Recycle Bin card when every video is another title's, and _What stays_ to say _Its video file(s), which another title plays_, so that I know why the choice isn't there.
24. As the maintainer, I want a whole Source folder that another title lies in to still be refused for trashing, so that the existing safety rule stays.
25. As the maintainer, I want a title's art, subtitles and Media folder removed by every Delete, so that keeping the video never leaves FamilyFlix's own files behind.

### Staying out and coming back

26. As the maintainer, I want a title I deleted with its files kept to stay out on the next scan, so that a Delete actually lasts.
27. As the maintainer, I want an episode I removed in the series edit to stay out on the next scan, so that removing it lasts too.
28. As the maintainer, I want a deleted copied title's original in the Library folder to stay out on the next scan, so that a copied title deleted doesn't come straight back.
29. As the maintainer, I want a sheet import to skip left-out videos as a scan does, so that every import path respects a Delete.
30. As the maintainer, I want one log line per run, _· Left out 3 videos you deleted earlier_, so that a scan tells me what it skipped and why.
31. As the maintainer, I want a Show folder where every video is left out skipped whole, so that a deleted series doesn't come back as an empty shell.
32. As the maintainer, I want a Show folder with new videos beside left-out ones to take only the new ones, so that a new episode still arrives.
33. As the maintainer, I want trashed files left unrecorded, so that the record holds only files that are still there.
34. As the maintainer, I want picking a left-out video in the Movie form to bring it back, so that a hand pick always does what I asked.
35. As the maintainer, I want a Show folder pick to bring back the left-out videos it adds, so that re-adding a series by hand just works.
36. As the maintainer, I want the Library folders page to show _3 videos left out_ on a folder row that has any, so that I can see a folder is holding things back.
37. As the maintainer, I want a _Bring back_ button on that line, so that one press lets the next scan add them all again.
38. As the maintainer, I want no left-out line on a folder with none, so that the page stays quiet when there's nothing to say.
39. As the maintainer, I want a removed Library folder's left-out entries removed with it, so that nothing is left pointing at a folder FamilyFlix no longer knows.
40. As the maintainer, I want a Factory reset to empty the left-out list, so that a reset really starts from nothing.

### Season folders and episodes

41. As the maintainer, I want `Seizoen 1` read as season 1, so that our Dutch shows are shows.
42. As the maintainer, I want `Season 1 (2008)` and `Season 1 - 1080p` read as season 1, so that a season folder with extra text is still a season.
43. As the maintainer, I want `Release.Show.S01.1080p.WEB-DL` read as season 1 of its parent show, so that a release-named season doesn't become its own series.
44. As the maintainer, I want a name like `S01E01` never read as a season folder, so that an episode-named folder isn't mistaken for a season.
45. As the maintainer, I want a `Specials` folder, and `Season 0`, read as season 0, so that specials sit with their show and not as a film.
46. As the maintainer, I want the year in `Season 1 (2008)` ignored when reading the season number, so that a season is never numbered 2008.
47. As the maintainer, I want any case read (`season 1`, `SEIZOEN 1`), so that how a folder is capitalised doesn't matter.
48. As the maintainer, I want `Aflevering 12` and `Afl. 12` read as episode 12, so that Dutch episodes are numbered rather than Unplaced.
49. As the maintainer, I want the server's reading and the form's reading of season folders to agree, so that a scan and a pick never disagree about a folder.

### The Show folder pick

50. As the maintainer, I want each picked episode row to show its path inside the show (`Seizoen 2/Aflevering 1.mp4`), so that two seasons' same-named files read apart.
51. As the maintainer, I want a file I picked by hand to keep showing its own name, so that the relative path appears only where a folder pick placed it.
52. As the maintainer, I want the Show folder row to cut off the start of the path, not the end, so that the folder's own name always shows.
53. As the maintainer, I want the full path on hover, so that I can still read where it is.
54. As the maintainer, I want a season-2 video numbered from its season folder, so that it never lands as S1 E3.
55. As the maintainer, I want the Numbering guess to start each season's free numbers from that season, so that guessed numbers make sense per season.
56. As the maintainer, I want a second pick to replace the title the first pick filled in, so that a corrected pick isn't stuck with the wrong name.
57. As the maintainer, I want a title I typed never overwritten by a pick, so that my own words win.
58. As the maintainer, I want picking `Tacoma FD/Season 1` to be titled _Tacoma FD_, so that a season folder picked by mistake still names its show.
59. As the maintainer, I want that pick refused while _Tacoma FD_ is held, so that picking one season of a held show can't make a double.
60. As the maintainer, I want a picked season folder read for its own episodes only, so that I get what I pointed at.

### Films with no genre

61. As a parent, I want every film on the Movies home from the moment it's scanned, so that the home never says the library is empty when it isn't.
62. As a parent, I want films with no genre in a last row titled _Other movies_, so that they're there without a fake genre.
63. As a parent, I want that row capped at 15 like a genre row, so that the home keeps its shape.
64. As a parent, I want _View all_ on it to open a page of every film with no genre, headed _Other movies_, so that I can see them all.
65. As a parent, I want a search, the rating filter and the sort to narrow the Other row like any row, so that search finds films with no genre.
66. As a parent, I want a genre filter to leave the Other row out, so that filtering by Comedy shows only comedies.
67. As a parent, I want no Other row when every film has a genre, so that an empty row is never drawn.
68. As the maintainer, I want the page at its own `/genre-less` route, so that a genre the family names _Other_ still lands on its own page.
69. As the maintainer, I want no genre written to those films, so that a Sync or the form's genre chips never pick up a made-up genre.

### Copy and tallies

70. As the maintainer, I want a scan to report _Found 15 titles across 22 folders_, so that shows aren't counted as movies.
71. As the maintainer, I want _Scan complete: 15 imported_ to count a new series as one import, like a film, so that the tally matches what arrived.
72. As the maintainer, I want a held series that took new episodes not counted as an import, so that the tally counts new titles only.
73. As the maintainer, I want the Import mode card headed _Link or copy_ wherever it's drawn (the form, Library folders, Import setup), so that it never repeats the Files card's _FILES_.
74. As the maintainer, I want the form's subtitle to point to _Library folders_, so that it names a page that exists.

### The follow-up: tallies

75. As the maintainer, I want _Found N titles_ to count every title the scan found, held or new, films and shows alike, so that a rescan's found line matches the titles it lists.
76. As the maintainer, I want the live stat to read _Found N folders so far_ and end at the found line's folder count, so that the progress counts what it says it counts.

### The follow-up: a title whose video is gone

77. As the maintainer, I want a film whose video is gone never to keep a found video out by its title alone, so that the real film is imported and plays.
78. As the maintainer, I want a film whose drive is only unplugged still to count as held, so that an offline drive never makes a double.
79. As the maintainer, I want a dead copy found again when a scan finds a video with its file's name, so that an older library's mistitled copy gets its film back without a double.
80. As the maintainer, I want a film whose folder is on record but whose video is gone to take the video the scan finds in that folder, so that a file renamed on disk is not lost.
81. As the maintainer, I want a film found again to take its video the run's way, linked in Link and copied in Copy, so that it follows the Import mode I chose.
82. As a parent, I want a film found again to keep its title, details, rating and watch history, so that mending its file changes nothing else.
83. As the maintainer, I want the log to say the film was updated, naming its video, so that I can see what the scan mended.
84. As the maintainer, I want two missing films with the same file name both left alone, so that the scan never guesses between them.

### The follow-up: folders nothing names

85. As the maintainer, I want an edit that needed a new Media folder to record it as the title's, so that a later edit and a Delete use the folder its files are in.
86. As the maintainer, I want a refused or failed edit to leave no new folder in `media/`, so that folder names stay free for the next import.
87. As the maintainer, I want a series edit whose recorded folder is gone to record the one it made, so that series and films follow one rule.

## Implementation Decisions

- **One initiative** (log 51 Q1): `library-audit`, step 34, findings F1 to F11. Not built here: Loading states, Scan new folders, cleaning up doubles an older library already holds, the Details state reading a parsed year as _Your own details_.
- **Prototype first** (Q2): the Delete dialog's Recycle choice; the Other row and the Genre page's `other` mode; the Folder row's left-out line; the Episode file row's relative path and the Show folder row's start ellipsis; the form's _Link or copy_ heading. Files: `page.ManageLibraryPage`, `page.MoviePage`, `page.SeriesPage`, `page.LibraryPage`, `feat.GenreRow`, `page.LibraryFoldersPage`, `mol.EpisodeFileRow`, `feat.MovieForm`. This revision lands before any build slice.
- **Glossary**: **Held video**, **Left-out video**, **Recycle choice** and **Other row** are new. **Already in library**, **Season folder**, **Episode word**, **Linked video**, **Linked files** and **Library folder** are updated. The glossary already carries all of them.
- **The Held video rule** (Q3, Q4) is a deep read in the library domain's storage: `titleHolding(folderId, videoPath)`, answering `{ kind: 'movie' | 'series', id }` or `null`. It looks at `movies` and `episodes` by `video_folder_id` and `video_path`, and covers a held episode's Source file. Four callers ask it:
  - the importer's held-film check;
  - the importer's held-show check, where any one held episode video holds the whole Show folder;
  - `readShowFolder`'s held series;
  - the Movie form's add.

  On a match the importer records the folder with `setSourceFolder`, as the key rule already does. Rejected: matching on TMDB title or original title; a unique index on `video_path` (a held double would fail the migration).

- **The movie add's refusal** (Q4): a linked video already held by a title is refused with _&lt;Title&gt; already plays this file._, the same way a held Show folder is refused (log 48 Q10).
- **Delete contract** (Q5, Q7): `DELETE /api/movies/:id` and `/api/series/:id` keep a linked title's files by default. With `?files=trash`, the delete runs `trashedFirst` and moves the **Linked files** to the Recycle Bin. A plain Delete never asks the shell, so a browser Delete no longer answers `409`. A copied title is unchanged.
- **`linkedFiles`** (Q8): its `videos` answer drops every path another held title links. When nothing is left it answers `shared` with no paths. `LinkedFiles` in `src/types` gains `'shared'`. The whole-folder refusal stays.
- **The Recycle choice** (Q6) is drawn in `DeleteTitleDialog`, and so in `DeleteMovieDialog` and `DeleteSeriesDialog` that use it. It is two `ChoiceCard`s between _What goes / What stays_ and the buttons, drawn only for a linked title in the shell whose Linked files aren't `shared`. **Keep the files** is chosen on every open. _What goes_, _What stays_ and the callout follow the choice. The confirm copy is unchanged. When the files are `shared`, _What stays_ reads _Its video file(s), which another title plays_. Rejected: a checkbox (no primitive exists); two menu items.
- **Left-out videos** (Q9, Q10):
  - **The table.** Migration 15 (the log's "17" miscounted; the newest today is 14) adds `left_out_videos (library_folder_id, video_path)`: relative paths with forward slashes, spelled as a Linked video's `video_path`, primary key on both columns, `ON DELETE CASCADE` from `library_folders`. `resetDatabase` empties it.
  - **Storage.** `leaveOut(entries)`, `leftOut(folderId): ReadonlySet<string>`, `clearLeftOut(entries)` and `bringBack(folderId): number`.
  - **Writers.** A keep-files Delete records each Linked video. A copied title's Delete records its Source folder's Source file(s) where its Library folder is known. The **Series edit job** records each removed episode's video. A trash Delete records nothing.
  - **Readers.** A Folder scan and a sheet import skip left-out videos before any match. A Show folder whose every video is left out is skipped whole; one with new videos takes only those. Each run logs one `info` **Log line**: _· Left out N videos you deleted earlier_.
  - **Clearing.** A Movie form add and a Show folder pick clear the entries they add.
- **Bring back** (Q10): `DELETE /api/library-folders/:id/left-out` forgets that folder's entries and answers `204`. `GET /api/library-folders` gives each folder's `leftOut` count (`LibraryFolderView.leftOut`). `FolderRow` draws a second line, _N videos left out_, with a _Bring back_ text button when the count is above zero. Rejected: a browser of left-out files.
- **Season folders** (Q11): `seasonOf` (server, `groupShows`) and its client mirror `readSeasonFolder` read, in any case:
  - `Season N`, `Season 0N`, `Seizoen N` and `SNN`, alone or followed by a separator and anything;
  - a name holding a standalone `SNN` token not followed by `E\d`, whose parent is then the Show folder;
  - `Specials` and `Season 0` as season 0.

  The number must come straight after the word. The existing drift guard keeps the two readings in step. Rejected: every language's season word.

- **The Episode word** (Q11): `episodeTag` (server) and `readEpisodeTag` (client) gain `Aflevering N` and `Afl. N`.
- **Season 0** is already valid on the form and the wire (`season >= 0`). Nothing changes there.
- **`readShowFolder` and `GET /api/show-folder`** (Q12, Q13):
  - each found video is answered with its path relative to the Show folder;
  - a picked Season folder is read for its own episodes but titled and held-checked by its Show folder (`showFolderOf`);
  - the held check uses `titleHolding` as well as the folder on record.
- **The Movie form's pick** (Q12, Q13): Episode file rows a pick lands show the relative path, and a hand-picked file keeps its name. The Show folder row truncates from the start, with the full path as its `title`. `useShowFolderPick` remembers whether the title came from a pick: a new pick replaces a picked title and never a typed one (log 29 Q19). The Numbering guess starts each season's free numbers from that season.
- **The Other row** (Q14):
  - **Home.** The home read gains `other: HomeRow | null` on `HomePayload`, after `rows`. It holds every film with no Genre, capped at 15. A search, the rating filter and the sort narrow it; a genre filter leaves it out (`null`). It is also `null` when empty.
  - **Client.** `HomeRows` draws it last, titled _Other movies_. Its _View all_ goes to `/genre-less`.
  - **The page.** A new `GET /api/genre-less` answers every film with no genre, uncapped. The **Genre page** gains an `other` mode on its own route, headed _Other movies_.
  - **Rejected.** A fake _Other_ genre; `/genre/other`; a plain grid of every film.
- **Tallies** (Q15): the importer's found-count and imported-count count titles, with a new series counted as one. A held series that only gained episodes isn't counted. The log lines read _Found N titles across M folders_ and _Scan complete: N imported_. Revised for the found-count by the follow-up (Q19): it counts every title found, held or new.
- **Copy** (Q16): `ImportModeChoice`'s heading becomes _Link or copy_ wherever it's drawn. The Movie form's lede names _Library folders_.
- **Slices** (log 51, _Implementation Plan_):
  1. the prototype;
  2. season folders;
  3. the Held video rule;
  4. Delete keeps the files;
  5. Left-out videos;
  6. the Show folder pick;
  7. the Other row;
  8. copy and tallies;
  9. walk it again (the sandbox shapes and the real layout, live in the shell) and the docs.

### The follow-up (log 51 Q18 to Q27)

- **Scope** (Q18): one follow-up, same initiative and PRD; #463, #465 and #466 are closed by the log. The prototype's two scan lines are already amended (_titles across_, _folders so far_); nothing new is drawn.
- **The found-count** (Q19): `walkListed` counts every film and every show it grouped and loses its `isHeldShow` parameter. _Scan complete_ is unchanged. Rejected: counting new titles only.
- **`ImportRun.found`** (Q20): the folders the walk has gone through so far, by `foldersUnder`'s rule (every Source folder and every shelf above it, the Library folder not), kept as the walk goes, so its last value is the found line's M. M is counted before left-out videos come off. `importView` reads _Found N folders so far_.
- **Missing video** (Q21): a held film whose `playback.videoFile` answers `missing`. `unreachable` is not missing and still holds.
- **The Title key rule** (Q22) passes over a film with a Missing video wherever a found video is at stake. A Sheet row with no folder found still reaches it by key, for Sheet fills only. Rejected: giving the key-matched film the found video (the household's dead _Guardians_ is _Vol. 2_).
- **The Missing video rule** (Q23), third in `heldFilm`, after the folder on record and the Held video rule: a found video whose file name is the file name of exactly one held film's Missing video, linked or copied. Two such films answer neither. Read once per run, as `heldFilmsByKey` is. Films only; rejected for episodes.
- **Found again** (Q24): when the folder on record or the Missing video rule finds a film whose video is missing, the importer places the found video by the run's Import mode (in Copy, into the film's Media folder, reserved and recorded when it is gone), derives its runtime again, records its folder with `setSourceFolder`, and updates only `videoPath`, `videoFolderId`, `runtimeMinutes` and, when reserved, `mediaFolder`. It logs the Sheet fills' `✓ Updated` line naming `video`. Rejected: a new Problem kind.
- **The edits' folder** (Q25, Q26): `PATCH /api/movies/:id` and `PATCH /api/series/:id` record a folder they reserve as the title's **Media folder** on commit (`MoviePatch.mediaFolder` in `src/types/write.ts`, `SeriesEdit.mediaFolder` in the series write), replacing a recorded folder that is gone. The movie edit's rollback removes a folder it reserved, as the series edit's already does. Rejected: removing a folder when its last file goes.
- **The household's two empty folders** (Q27) are removed by hand. Rejected: a sweep.
- **Slices** (the follow-up's 10 to 13): every title found; an edit owns its folder; a missing film holds by evidence; Found again. Then the docs and the initiative's refactor (slice 14).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the household sees: the answer read, the rows written, the log lines, the request sent, the copy and cards drawn. It never asserts which helper ran or what internal state looks like.
- **`seasonOf` / `readSeasonFolder`** (pure, table-driven):
  - every spelling in either case;
  - trailing text, with the year never read as the number;
  - release names with `S01`, and `S01E01` refused;
  - `Specials` and `Season 0` as 0;
  - a film folder that isn't a season.

  Prior art: the existing `groupShows` and `readSeasonFolder` tests and the drift guard.

- **`episodeTag` / `readEpisodeTag`**: `Aflevering 12` and `Afl. 12` give 12; the existing shapes are unchanged. Prior art: their existing tests.
- **`linkedFiles`** (pure): shared videos dropped from `videos`; all shared gives `shared` with no paths; the whole-folder rule and `unreachable` unchanged. Prior art: `linkedFiles.test.ts`.
- **`titleHolding`** (storage, real SQLite): a film's Linked video; an episode's Linked video; an episode's Source file; a different Library folder with the same path is not held; `null` when nothing holds it. Prior art: the library storage tests over a fresh migrated database.
- **Left-out storage and migration 15**: `leaveOut`, `leftOut`, `clearLeftOut` and `bringBack` round-trip; the cascade on Library folder removal; `resetDatabase` empties the table; the migration runs on a version-14 database. Prior art: `db.test.ts` and the folders storage tests.
- **`createImporter`** (the deep module, over a fixture tree):
  - a renamed title with no folder on record is _Already in library_ on rescan, and its folder is then recorded;
  - a Show folder with one held episode video is the held series and gains its new episodes;
  - left-out videos are skipped with one log line;
  - an all-left-out Show folder is skipped whole;
  - the four sandbox shapes make four series;
  - the tallies count titles.

  Prior art: `createImporter.test.ts` and its `fixture/`.

- **`readShowFolder`**: relative paths per video; a picked Season folder is titled and held-checked by its show; held through `titleHolding`. Prior art: its existing tests.
- **Delete routes** (supertest over the router with injected domains):
  - a plain delete keeps files, records left-out videos and never calls the shell trash;
  - `?files=trash` trashes only unshared paths;
  - a browser (no shell) plain delete answers success;
  - a copied title is unchanged.

  Prior art: the existing delete route tests.

- **Library folder routes**: `leftOut` counts on the list; `DELETE …/left-out` answers `204` and the next scan adds the videos.
- **Movie add**: a held linked video is refused with the title's name; an add clears its left-out entry.
- **Home and Genre-less reads**: no-genre films in `other`, capped at 15; narrowed by search, rating and sort; `null` under a genre filter or when empty; `/api/genre-less` uncapped. Prior art: the home read tests.
- **`DeleteTitleDialog`** (and the two dialogs that draw it):
  - the cards drawn only for a linked title in the shell;
  - _Keep the files_ chosen on open;
  - _What goes / What stays_ and the callout follow the choice;
  - the request carries `files=trash` only on the second card;
  - the `shared` wording, with no cards.

  Prior art: `DeleteTitleDialog.test.tsx`.

- **`FolderRow`**: the left-out line and _Bring back_ drawn only with a count; pressing it calls the route and the line goes. Prior art: its existing tests.
- **`useShowFolderPick` / the form**: a second pick replaces a picked title and leaves a typed one; relative paths on picked rows; the start-truncated Show folder row with its `title`; per-season Numbering guess. Prior art: `useShowFolderPick.test.ts`, the MovieForm show-folder tests.
- **`HomeRows` and the Genre page**: the Other row drawn last as _Other movies_ with _View all_ to `/genre-less`; the `other` mode's heading and grid. Prior art: their existing tests.
- **`ImportModeChoice`**: heading _Link or copy_. Prior art: its existing test.
- **The follow-up's tallies** (`createImporter`, real runs over a built tree): a rescan with a held film and a held show counts both in _Found N titles_; _Scan complete_ still leaves them out; `run.found` ends at the found line's M, shelves included. `importView` reads _Found N folders so far_. Prior art: `createImporter.tallies.test.ts` (its _is not counted among the titles found_ case flips) and the `importView` tests.
- **The follow-up's missing films** (`createImporter`, real storage, media and playback over a sandbox, the dead file removed on disk):
  - a key match whose video is missing is passed over and the found video imported;
  - an unreachable film still holds;
  - a dead copy with the found file's name is found again, in Link and in Copy, its title, rating and watch history unchanged, one `✓ Updated` line naming `video`;
  - a film whose folder is on record and whose video is gone takes the found video;
  - two missing films of one name are both left alone;
  - a Sheet row with no folder found still fills a missing film by key.

  Prior art: `createImporter.heldVideo.test.ts`, `createImporter.sourceFolders.test.ts`.

- **The follow-up's edit folders** (supertest over the router, a real `Media` over a sandbox): a movie edit whose recorded folder is gone records the folder it reserved and a later Delete removes it; a refused movie edit leaves no new folder; the series edit records a reserved folder over a dead one. Prior art: the existing movie and series PATCH route tests and `routes.linkedDelete.test.ts`.

## Out of Scope

- **Loading states** and **Scan new folders**: each has its own planned step (log 51 Q1).
- Cleaning up doubles an older library already holds.
- Season words in languages other than English and Dutch.
- The Details state reading a year parsed from a folder name as _Your own details_ (noted, deferred).
- A browser of left-out files.
- A unique index on `video_path`.
- Matching held titles by TMDB or original title.
- **The follow-up:** a missing episode; a sweep of folders no title names; a missing film no evidence reaches (no folder on record, its file renamed), which stays the maintainer's to delete.

## Further Notes

- **Copy rule changes.** CLAUDE.md's **Media** rule changes from "removed only by a Delete, only to the Recycle Bin" to "kept by a Delete unless the household asks, then only to the Recycle Bin". This narrows log 47 Q14.
- **A wider season rule.** A film folder named `S01 Something` will now read as a season. That is accepted: no film the household holds is named that way.
- **A new file state.** A file in a Library folder now has three states: held, left out, or new. Every scan reads the new table.
- **Documents** (log 51 Q17): these change and are ticked ✅ only after the refactor.
  - the checklist's step 34 entry and row;
  - README's Library paragraph;
  - CLAUDE.md _Product Rules_;
  - the glossary;
  - the docblocks of `linkedFiles`, `trashedFirst`, `seasonOf`, `readSeasonFolder`, `episodeTag`, `walkLibraryFolder`'s callers and `HomeRows`.
- **The follow-up's glossary** is already written: **Missing video** and **Found again** are new; **Already in library**, **Media folder** and **Stranded folder** are updated. Its docblocks: `heldFilm`, `walkListed`, `ImportRun.found`, `importView`, the movie and series PATCH routes.
- **The key rule now reads the disk.** A scan checks the held films' videos once per run to know which are missing. A missing film whose file had a generic name (`movie.mp4`) can be given the wrong file by the Missing video rule; the log names it, and the Movie form edit picks the right one.
