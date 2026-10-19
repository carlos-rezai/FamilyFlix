> **Initiative:** `manage-library`
> **Design log:** `docs/design-logs/47-manage-library.md`
> **Issue:** #406 (the PRD, step 30)
> **Build order:** step 30, **Manage library**, now the overview alone. _Add a show folder_ becomes step 31 with its own grill and prototype (log 47 Q1). It ships as thin slices (log 47, _Implementation Plan_), the prototype revision first.

## Problem Statement

No single place shows me everything the library holds. To find out which titles are linked from a Library folder, which were copied in, where each one's files are, and whether TMDB ever matched it, I have to open titles one by one.

I can't take a title out completely either. A Delete today removes the rows and FamilyFlix's managed folder but leaves a **Linked video** where it was. It still uses the disk, and the next **Scan folders** brings the title back as if nothing happened. A dead drive's titles stay in the library with nothing to clear them out.

When TMDB matches a title to the wrong film, nothing undoes it. A **Rematch** was ruled out in step 25, and a later Sync never touches a title that already has a match. The wrong poster, synopsis and cast stay until I correct every field by hand.

## Solution

**A Manage library page.** Settings' Library group gets a fourth row after _📁 Library folders_: _☰ Manage library — Edit, clear or delete any title in your library._ It opens `/settings/library`. The page has a header (Back onto Settings, _Manage library_, a lede) over _Movies N_ / _Series N_ pill tabs, with a summary at the toolbar's right (_6 movies · 1 without details_). Under the tabs, every title of the tab is listed A–Z, one **Title row** each.

**A Title row says where a title lives and what it knows.** Each row shows:

- a folder tile, the title and its year (a show's **Year range**);
- the path in mono: a linked title's Source folder, else FamilyFlix's own folder for it;
- _Linked_ or _Copied_;
- the files: _3 files_ for a film, _3 seasons · 151 episodes_ for a show;
- a coloured dot with the title's **Details state**: _Synced with TMDB_, _Your own details_ or _No details_.

A linked title on a drive that is unplugged shows _Can’t be reached right now_ under its path.

**Edit ▾** holds _Edit details_, which opens the Movie form's edit, and _Sync with TMDB_. The Sync opens the title's page with its Sync **Started on arrival** on top, so Back from the flow lands on the title and Back from there lands on the overview.

**⋯** holds **Clear details** and _Delete…_.

**Clear details is the undo of a wrong match.** Behind a dialog listing what goes and what stays, it clears everything a Sync can write except the runtime:

- the TMDB match and score;
- the year, synopsis, credits, genres, poster, backdrop and original title;
- for a show, its Season posters and each episode's title, air date and Still.

The title, its files, its runtime, its watch history, its **Rating** and its heart are kept. The title becomes **Unmatched**, so the next _Only what's missing_ Sync searches it afresh.

**Delete takes a title out completely.** The dialog lists what goes and what stays. For a linked title, its files go to the **Recycle Bin**, never deleted outright, so one wrong press can be undone from Windows. A title alone in its folder loses the whole folder. A title in a shared folder (a Collection folder, or loose episodes at a Library folder's root) loses only its own videos. A title whose drive is unplugged loses its rows, and the dialog says its files stay where they are. A copied title loses FamilyFlix's copy. Its original in a Library folder is the family's and is never touched, and the dialog says a Scan would bring it back.

The overview and the detail pages use one and the same Delete. The detail pages' Delete dialogs gain one sentence for a linked title, and a refusal line.

## User Stories

### Reaching the page

1. As the maintainer, I want a _Manage library_ row in Settings' Library group, so that I can find the overview where the other library tools are.
2. As the maintainer, I want the row placed after _Library folders_, so that the folders come before the titles found in them.
3. As the maintainer, I want the row's line to say I can edit, clear or delete any title, so that I know what the page is for before I open it.
4. As the maintainer, I want the page at its own address, `/settings/library`, so that Back and a reload behave like every other Settings sub-page.
5. As the maintainer, I want Back on the page to step back to wherever I came from, else to Settings, so that it follows the app's one Back rule.
6. As the maintainer, I want the page drawn in the same column as the Library folders and Codecs pages, so that it reads as part of Settings.

### The tabs and the list

7. As the maintainer, I want Movies and Series on two tabs, so that a long list of shows doesn't bury the films.
8. As the maintainer, I want each tab's count in its label (_Movies 6_, _Series 4_), so that I know both totals without switching.
9. As the maintainer, I want the tab I chose kept in the URL as a replace, so that a reload keeps it and Back doesn't step through tab switches.
10. As the maintainer, I want Movies to be the tab with no query, so that the plain address opens on films.
11. As the maintainer, I want a summary at the toolbar's right (_6 movies · 1 without details_), so that I see at a glance how many titles still need details.
12. As the maintainer, I want the _without details_ part left out when every title has details, so that the summary never says _0 without details_.
13. As the maintainer, I want every title listed A–Z by title, the Export's order, so that I can find one by scanning.
14. As the maintainer, I want nothing drawn until the list has loaded, and nothing on a failed read, so that the page never shows a guess (the Settings rule).
15. As the maintainer, I want an empty tab to say _No movies in your library._ or _No series in your library._, so that an empty list doesn't look broken.
16. As the maintainer, I want both tabs' rows to arrive in one read, so that switching tabs is instant and both counts are true.

### A Title row

17. As the maintainer, I want each row to show the title and its year, so that I can tell two films of the same name apart.
18. As the maintainer, I want a show's year spelled as its series page spells it (`2019–2023`, `2021–`), so that the two surfaces agree.
19. As the maintainer, I want no year drawn for a title that has none, so that the row never shows a placeholder.
20. As the maintainer, I want a linked title's path to be its Source folder, so that I can see where in my Library folders it lives.
21. As the maintainer, I want a Collection folder film's path to be its video file, so that I can tell it from the other films sharing its folder.
22. As the maintainer, I want a copied title's path to be FamilyFlix's own folder for it, so that I know where its copy is.
23. As the maintainer, I want every path absolute and in mono, so that I can find it in Explorer.
24. As the maintainer, I want a _Linked_ or _Copied_ badge, using the Import mode's words, so that I know whether deleting it touches my Library folders.
25. As the maintainer, I want a show marked _Linked_ when any of its episodes is linked, so that a mixed show is never shown as safe to delete.
26. As the maintainer, I want a film's file count (its video and subtitles), so that I can see a subtitle is missing.
27. As the maintainer, I want a show's seasons and episodes counted as the series page counts them, so that I can see at a glance whether every episode was found.
28. As the maintainer, I want _Synced with TMDB_ with a success dot on a matched title, so that I know TMDB's details are in place.
29. As the maintainer, I want _No details_ with a warning dot on a title that holds nothing a Sync would write, so that I can see what still needs a Sync.
30. As the maintainer, I want _Your own details_ with an info dot on a title that has details but no TMDB match, so that hand-typed and sheet details aren't mistaken for TMDB's.
31. As the maintainer, I want the dot read off what the title holds now, never a history, so that it is always true.
32. As the maintainer, I want a linked title whose Library folder can't be read marked _Can’t be reached right now_ in danger ink, so that I know its drive is unplugged.
33. As the maintainer, I want reachability read afresh on each visit, so that plugging the drive back in clears the line.

### Edit ▾

34. As the maintainer, I want an _Edit ▾_ button on each row, so that the everyday actions are one press away.
35. As the maintainer, I want _Edit details_ to open the Movie form on that film or series, so that I edit it with the form I already know.
36. As the maintainer, I want Back and a save on the form to bring me back to where I was, so that I can carry on down the list.
37. As the maintainer, I want _Sync with TMDB_ to open the title's Sync, started on arrival, so that one press fetches its details.
38. As the maintainer, I want the title's page pushed under the flow, so that Back from the flow lands on the title and Back again on the overview.
39. As the maintainer, I want the flow's own rules (no key, offline, another Sync busy, a run waiting) to apply, so that a Sync from here behaves as one from the ⋯ menu.
40. As the maintainer, I want each Edit item to carry a short hint line (_Change the title, year and poster by hand_ / _Fetch details and artwork again_), so that I know the difference before I press.

### ⋯ and Clear details

41. As the maintainer, I want a ⋯ button named _More actions for “Coco”_, so that a screen reader says which title it acts on.
42. As the maintainer, I want _Clear details_ and _Delete…_ under ⋯, with Delete as the danger row below a divider, so that the destructive actions sit apart from the everyday ones.
43. As the maintainer, I want _Clear details_ disabled on a title with no details, so that I am not offered something that does nothing.
44. As the maintainer, I want Clear details behind a dialog, so that one stray press doesn't wipe a title's poster.
45. As the maintainer, I want the dialog to list what goes (_Year, synopsis, credits and genres_; _Poster, backdrop and artwork_; _Its TMDB match and score_) and what stays (_Its title and files_; _Watch history, rating and heart_), so that I know exactly what I am clearing.
46. As the maintainer, I want the title's path shown in the dialog, so that I am sure which title it is.
47. As the maintainer, I want _Clear details_ before _Cancel_, reading _Clearing…_ while it works, so that it matches every other confirm in the app.
48. As the maintainer, I want the title kept after a clear, so that the row is still recognisable.
49. As the maintainer, I want the runtime kept after a clear, so that a value the file itself gave isn't lost.
50. As the maintainer, I want the household Rating, the heart and the watch history kept, so that clearing a wrong match never costs the family's own marks.
51. As the maintainer, I want a show's Season posters and each episode's title, air date and Still cleared too, so that nothing of the wrong match survives.
52. As the maintainer, I want a cleared title Unmatched, so that the next _Only what's missing_ Sync searches it afresh.
53. As the maintainer, I want the cleared art files removed from managed storage, so that a clear doesn't leave orphaned images.
54. As the maintainer, I want the row redrawn from the server's answer, its dot now _No details_, so that the page shows what is true.
55. As the maintainer, I want a success notice, _Details cleared for “Coco”._, so that I know it worked.

### Delete

56. As the maintainer, I want _Delete…_ to open a dialog titled _Delete “Coco”?_, so that I confirm the right title.
57. As the maintainer, I want the dialog to say the title leaves FamilyFlix and can't be undone from here, so that I understand it is final in the app.
58. As the maintainer, I want What goes to list its details and artwork, and its watch history, rating and heart, so that I know the family's marks go with it.
59. As the maintainer, I want What goes, for a copied title, to say _FamilyFlix’s copy of its video and subtitles_, so that I know which copy is removed.
60. As the maintainer, I want What stays, for a copied title with an original in a Library folder, to say the original stays and Scan folders would bring it back, so that I'm not surprised when it returns.
61. As the maintainer, I want a linked title alone in its folder to send the whole folder to the Recycle Bin, so that its extras go with it.
62. As the maintainer, I want a linked title in a shared folder to send only its own videos to the Recycle Bin, so that the other films in that folder are untouched.
63. As the maintainer, I want a title whose Source folder is a Library folder itself never to send that folder to the bin, so that a Library folder is never removed whole.
64. As the maintainer, I want a callout on a linked title's dialog saying its files go from my Library folder to the Recycle Bin, so that I know this one reaches the disk.
65. As the maintainer, I want linked files moved to the Recycle Bin and never deleted outright, so that I can restore a film deleted by mistake.
66. As the maintainer, I want a title on an unplugged drive still deletable, so that I can clear out a dead drive's titles.
67. As the maintainer, I want that title's dialog to say its files stay on that path because they can't be reached, so that I know nothing on the drive was touched.
68. As the maintainer, I want _Delete movie_ / _Delete series_ in danger before _Cancel_, reading _Deleting…_ while it works, so that it matches the app's other deletes.
69. As the maintainer, I want focus on the dialog's card when it opens, so that a stray Enter doesn't confirm.
70. As the maintainer, I want the row to leave the list once the delete is done, with a success notice _“Coco” was deleted._, so that I see it worked.
71. As the maintainer, I want the tab's count and the summary updated at once after a delete, so that the numbers stay true.
72. As the maintainer, I want a deleted linked title not to come back on the next Scan folders, so that a delete actually takes it out.

### Refusals

73. As the maintainer, I want a linked title's delete refused in a browser with _Only the desktop app can move a linked title’s files to the Recycle Bin._, so that nothing is half-deleted where the bin can't be reached.
74. As the maintainer, I want a delete refused, with _Couldn’t move <path> to the Recycle Bin. Close anything playing it and try again._, when a file is locked, so that I know what to do.
75. As the maintainer, I want the title's rows kept when a delete is refused, so that a refusal never leaves a title with no files and no row.
76. As the maintainer, I want files already moved to the bin before a refusal left there, and a retry to count them as gone, so that trying again finishes the job.
77. As the maintainer, I want the refusal shown in danger above the dialog's buttons until my next press is answered, so that I read it where I pressed.
78. As the maintainer, I want a copied title's delete never refused, so that a copied title can always be removed, even in a browser.

### The detail pages

79. As the maintainer, I want the movie page's and the series page's Delete to do the same as the overview's, so that a title deleted anywhere is gone the same way.
80. As the maintainer, I want the movie page's dialog to add _Its video goes to the Recycle Bin._ for a linked film, so that it never hides a disk change.
81. As the maintainer, I want the series page's dialog to add _Its files go to the Recycle Bin._ for a linked show, for the same reason.
82. As the maintainer, I want both detail dialogs to draw the same refusal line, so that a locked file is explained there too.

## Implementation Decisions

### The wire

- New shared types: `DETAILS_STATES` (`synced`, `own`, `none`) and `DetailsState`, `LinkedFiles` (`folder` | `videos` | `unreachable`), `LibraryTitle` and `LibraryTitles`. They are typed for both build targets.
- `LibraryTitle` is a union on `kind`. Both kinds carry `id`, `title`, `year`, `path` (absolute: a linked title's Source folder or a Collection film's video, else its Media folder), `linkedFiles` (`null` for a copied title), `originalPath` (a copied title's Source folder, absolute, else `null`) and `details`. A movie also carries `files`. A series also carries `endYear`, `seasons` and `episodes`.
- `GET /api/library-titles` → `{ movies, series }`. Both lists are A–Z by title, and reachability is read afresh on every call. It is one read for both tabs, because both labels count. There is no `?kind=` (log 47 Q18).
- `POST /api/movies/:id/clear-details` and `POST /api/series/:id/clear-details` → `200 LibraryTitle`, the echo the row redraws from. They answer `404` for an id not held. This follows the per-title sub-route precedent (`/favorite`, `/rating`).
- `DELETE /api/movies/:id` and `DELETE /api/series/:id` keep their path and their `204`. They learn **Linked files** and two `409`s, each one sentence: no shell, and a path the shell could not trash. There is no second delete route.
- No migration.

### Server: `library/titles/`

- `libraryTitles()` is the list's one query over both kinds. It returns each row's raw facts: the linked videos, the Source and Media folders, the Library folder, the counts and the Details state.
- `detailsStateSql` spells the **Details state** once in SQL, `fullDetails`' precedent:
  - `synced` when `tmdb_id` is set;
  - `none` when none of year, synopsis, director, cast, original title, poster, backdrop, genres and TMDB score is held;
  - `own` for anything else.
- `clearMovieDetails` and `clearSeriesDetails` each run one transaction that clears `tmdb_id`, year (a show's end year too), synopsis, director, cast, original title, TMDB score, genres, poster and backdrop. For a show they also clear its Season posters and each episode's title, air date, Still and Still source. Each answers the Stored paths it let go. It keeps the title, the files, the runtime, the watch state, the Rating and the heart.
- The clear routes remove the paths it let go from managed storage after the transaction. **Row first, then bytes, best-effort**, the delete's rule.

### Server: `media/`

- `linkedFiles`, new and pure, is shared by the list read and the delete. It takes a title's linked videos, its Source folder, its Library folder's path and reach, and every other held title's linked videos, and answers a `LinkedFiles` kind plus the absolute paths to trash:
  - `folder`: the Source folder holds no other held title's video and is not a Library folder itself. Its path is the folder.
  - `videos`: the folder is shared (a Collection folder, or a show's loose episodes at a Library folder's root). Its paths are the title's linked videos alone.
  - `unreachable`: the Library folder can't be read. It has no paths.
  - `null`: no linked video.

  It lives in `media/` because deciding which of a Library folder's files belong to a title is folder knowledge, even though a Linked video is not managed storage.

- `createMedia` gains `trashLinked(paths)` over an injected `Trash`, so no route learns there is a shell. A path already gone counts as trashed.

### Server: `shell/` and the Electron shell

- The **Shell handshake** grows one exchange, the **Shell trash**. `ServerMessage` gains `{ type: 'trash'; id; paths }` and `ShellCommand` gains `{ type: 'trashed'; id; failed: string | null }`.
- `createShellTrash(parentPort)` → a `Trash` whose `trash(paths)` answers `{ kind: 'trashed' }`, `{ kind: 'failed'; path }` or `{ kind: 'unavailable' }`. It matches answers to requests by id and is inert with no parent port, `shellHandshake`'s precedent.
- `electron/trashItems/` is main's half: each path through `shell.trashItem` in order, a missing path counted as gone, stopping at the first failure. It works over an injected world, the `openMediaFolder` shape. `main.ts` and `serverHandle` wire it.

### The delete, in order

1. The route reads the title's Linked files.
2. If there are paths to trash, it calls `media.trashLinked`.
   - `unavailable` → `409`, the no-shell sentence.
   - `failed` → `409`, the locked-path sentence.

   Either way the rows are untouched.

3. Delete the rows (the cascade, as today).
4. `media.removeTitleFolder` over the Media folder, best-effort, as today.
5. Answer `204`.

`unreachable` trashes nothing and goes straight to the rows. There is no guard while a run runs, the delete's precedent. **Trash first, rows after**, so a refusal changes nothing but what already went to the bin (log 47 Q14).

### Frontend: `features/manage-library/`

- `ManageLibraryPage` in `pages/` puts `MaintainerLayout` around the organism. The route is `/settings/library`, the hub's third nested route.
- `ManageLibrary`, the organism, holds `PageHeader` (Back through `useGoBack('/settings')`, the heading, the lede), `PillTabs` with `kindFilter`'s spelling of the counts, `tab` in the URL as a replace (omitted at `movies`, `LibraryTabs`' precedent), the summary, the list, and whichever dialog is open.
- `TitleRow` extends the `FolderRow` furniture (the accent tile, the mono path, `folderLine`'s danger line) with the title and year, the badge, the files, the dot and its words, and the two menus on `Menu`:
  - **Edit ▾** is a secondary sm `Button` with a trailing chevron, the `FilterDropdown` trigger's shape.
  - **⋯** is a ghost `IconButton` with `MoreIcon`.
- `DeleteTitleDialog` and `ClearDialog` sit on `Modal` with the **Reset dialog**'s **What goes** / **What stays** lists, the path in the mono well, the confirm before Cancel, focus on the card, and the refusal line above the buttons.
- `useLibraryTitles` owns the read on mount (`null` until it lands, `null` on failure), `deleteTitle` (the row taken off on `204`, the refusal held on `409`) and `clearDetails` (the row replaced by the echo). Neither write rejects.
- `titleRowView`, pure, turns a `LibraryTitle` into the row's words (year, badge, files, dot) and both dialogs' lists, callout and title, so every sentence is spelled once.
- `api/` holds `fetchLibraryTitles`, `clearMovieDetails` and `clearSeriesDetails`, one caller each.
- _Sync with TMDB_ pushes the title's page, then `enrichPath({ movie | series: id, start: true })`. This is log 45's leaving, with a push where the add replaces.
- The success notices go through `useSnackbar()`: _“Coco” was deleted._ and _Details cleared for “Coco”._

### Shared changes

- `deleteMovie` and `deleteSeries` each now have two features calling them, so they move to `src/api/` by the `api/` rule. Both answer `deleted` on `204`, `refused` with the route's sentence on `409`, and reject otherwise, `factoryReset`'s shape.
- `MenuItem` gains an optional `hint` line and a `disabled` state, as props rather than a second item component.
- `DeleteMovieDialog` and `DeleteSeriesDialog` keep their paragraph. For a linked title they add one sentence, and both draw the refusal line. Each reads whether its title is linked off the record it already holds.
- The Library group gains an `ActionRow` after _📁 Library folders_: glyph `☰`, **Manage library**, _Edit, clear or delete any title in your library._

### Prototype first (log 47 Q20)

- `page.ManageLibraryPage.dc.html` is promoted into `docs/handoff/`, amended to the log: counts in the labels, _Copied_, the Details state's words, _Clear details_, no syncing row, the dialogs' lists, words, order and refusal, and `success` notices.
- `page.SettingsPage` gains the row, `FamilyFlix.dc.html` gains the screen, and `page.MoviePage` and `page.SeriesPage` draw the linked sentence and the refusal.
- `handoff-manage-library/` stays as received.

## Testing Decisions

- A good test drives a unit through its public surface: returned values for pure units, status and body for routes, rendered output and user events for components, returned state for hooks. It never reads internals. The wire is faked at `fetch` with `fakeResponse`, and the shell is faked at the `Trash` seam and the parent port. No test runs Electron or touches a real Recycle Bin.
- **`linkedFiles`**:
  - a lone film's Source folder → `folder` with that path;
  - a Collection folder film → `videos` with its video alone;
  - a show whose loose episodes sit at a Library folder's root → `videos`;
  - a Source folder that is a Library folder → never `folder`;
  - an unreadable Library folder → `unreachable` with no paths;
  - a copied title → `null`;
  - a mixed show → its linked episodes only.
- **`libraryTitles` / `detailsStateSql`**: each Details state at its boundary (a `tmdb_id` alone is `synced`; one Sync field alone is `own`; a title alone is `none`), A–Z order, a show's season and episode counts, and `_Linked_` for a show with one linked episode. Prior art: `fullDetails` and `syncGap`'s suites.
- **`clearMovieDetails` / `clearSeriesDetails`**: every listed column cleared, every kept column kept (title, runtime, files, watch state, Rating, heart), Season posters and episode titles, air dates and Stills cleared, and the Stored paths answered.
- **`createShellTrash`**: a request posted with an id and resolved by its matching answer, `failed` carrying the path, `unavailable` with no parent port, and two requests in flight answered in their own order. Prior art: `shellHandshake`'s suite.
- **`trashItems`**: each path trashed in order, a missing path counted as gone, the first failure stopping the rest and named. Prior art: `openMediaFolder`'s suite over an injected world.
- **`createMedia.trashLinked`**: forwards to the injected `Trash`, and an empty list asks nothing.
- **Routes**:
  - `GET /api/library-titles`: both kinds, the paths absolute, a reachable and an unreachable linked title;
  - clear-details for both kinds: `200` echo, `404` unknown, the art files removed;
  - `DELETE` of a copied title: unchanged, and never asks the trash;
  - `DELETE` of a linked title: the trash asked before the rows;
  - `unavailable` and `failed` → `409` with the sentence and the rows kept;
  - `unreachable` → `204` with nothing trashed;
  - a deleted linked title not found again by a Folder scan.

  Prior art: `routes.linkedVideo.test.ts`, `routes.libraryFolders.test.ts`, the delete suites.

- **`titleRowView`**: every badge, file count, dot and year rule, and each dialog's What goes, What stays and callout for copied (with and without an original), `folder`, `videos` and `unreachable`. Prior art: `importView`, `enrichmentView`.
- **`useLibraryTitles`**: `null` until the read lands and on failure; a delete takes the row off; a refusal is held and cleared by the next press; a clear replaces the row from the echo. Prior art: `useLibraryFolders`, `useFactoryReset`.
- **`ManageLibrary` / `TitleRow` / the two dialogs**:
  - the labels' counts and the summary;
  - `tab` written as a replace;
  - the empty card;
  - _Clear details_ disabled at `none`;
  - _Edit details_ pushes `movieFormPath`;
  - _Sync with TMDB_ pushes the title's page then the flow (checked with `LocationProbe`);
  - the dialogs' order, focus, in-flight words and refusal line;
  - the success notices.

  Prior art: `LibraryFolders`, `ResetDialog`, `SeriesEditMenu`.

- **`MenuItem`**: `hint` drawn under the label, `disabled` neither pressable nor skipped wrongly by the roving focus. Prior art: `Menu`'s suite.
- **`DeleteMovieDialog` / `DeleteSeriesDialog`**: the linked sentence only for a linked title, and the refusal line.
- **Package smoke**: a linked delete landing in the real Recycle Bin, and a locked file's refusal, are checked by hand in the installed app, `docs/release-checklist.md`.

## Out of Scope

- _Add a show folder_ in the series form. It is step 31, with its own grill and prototype revision, and it reopens design log 11 Q6.
- Search, sort controls, filters and bulk actions on the page.
- Size on disk per title. It would mean walking every linked folder on each visit.
- An episode-level delete.
- _Clear details_ on the detail pages' ⋯ menus.
- A remembered exclusion list that keeps a deleted title out of later scans.
- A permanent delete that bypasses the Recycle Bin.
- Trashing a copied title's original in its Library folder.
- An inline or background Sync on the row.
- _Move the media folder_.

## Further Notes

- Glossary terms (log 47 Q3): **Manage library page**, **Title row**, **Library title**, **Details state**, **Clear details**, **Linked files**, **Shell trash**. Avoid "admin", "manager", "folder list", "wipe", "reset title", "unlink", "Imported" (say _Copied_) and "metadata" for anything new (say _details_).
- The rule that changes: until now FamilyFlix never took anything out of a Library folder. From this step a **Delete** moves a title's **Linked files** to the Recycle Bin, and only there. A Factory reset, removing a Library folder and Clear details still never touch one.
- Trade-offs accepted: a browser build can no longer delete a linked title. The shell carries a request/answer exchange beside its shutdown. Three Delete dialogs say the same truth in two shapes.
- Docs per log 47 Q21:
  - README's and CLAUDE.md's step 30 (the overview alone) and a new step 31, _Add a show folder_, 🔜;
  - the feature entries;
  - CLAUDE.md's folder tree and _Settings Hub_ routes;
  - the Linked video and Library folder rules ("never removed by the app" becomes "only ever to the Recycle Bin, by a Delete").

  Ticked ✅ only after the refactor.
