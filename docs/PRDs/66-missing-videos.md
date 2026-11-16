> **Initiative:** `missing-videos`
> **Issue:** #633 (the PRD, step 49)
> **Design log:** `docs/design-logs/66-missing-videos.md`
> **Handoff:** `docs/handoff/mol.ProblemRow.dc.html` (amended by log 66)
> **Build order:** step 49, **Missing videos**. It ships as thin slices (log 66, _Implementation Plan_). No migration, no page: one route, two Problem kinds, and the walk answering its off-layout folders.

## Problem Statement

The household keeps its films and shows in linked **Library folders**, and they change those folders by hand: a film they are done with is deleted, a season is cleared off a full drive. FamilyFlix never notices. The deleted film stays in the grid, its poster and watch history intact, and the first anyone hears of it is pressing play on a title that cannot play. A show with gone episodes looks whole until one of them is chosen.

_Scan all folders_ already walks every one of those folders, so it is the natural moment to notice, but it says nothing about what it did not find.

The same scan also turns away a folder it cannot read: a Title folder that holds no video (`Heat/`, made in advance and never filled) or one that holds loose videos beside Season folders. Since log 64 those are the only folders left out, and each is mentioned only as one warning line in the **Activity log**, which is closed by default and which the household never opens. The review says nothing at all.

## Solution

Every scan ends by checking what it should have found, and the review lists what is gone and what it could not read. Nothing ever leaves the library or the disk on its own.

- **A gone title is listed.** After a scan's imports, FamilyFlix checks each held title of the folders the scan read. A film whose video is no longer on disk, or a show with one or more episodes' videos gone, appears once in the review under a new _Missing_ kind: _Its video, die-hard.mkv, is no longer on disk._, or for a show _S01E02, S01E03 and 2 more are no longer on disk._ The log gets one warning line each.
- **A moved film is not listed.** The check runs last, so a film the scan already found again (moved to another folder, or renamed inside its own) plays again and is never asked about.
- **Take it out or keep it, on the row.** _Take out of library_ (or _Take out 3 episodes_ for a show that still has others) removes what is gone, at once. _Skip_ keeps the title, and the next scan asks again for as long as the file is gone. A file the household puts back is imported again by the next scan, because taking out a missing title does not mark its file as deliberately left out.
- **A folder the scan could not read is listed.** Each empty or mixed Title folder appears under a new _Off layout_ kind, titled by its name, with the warning's own words as its reason (_Holds no video or Season folder._). It can only be skipped; the fix is on disk, and the next scan reads the folder once it is fixed.
- **Only what the scan looked at.** _Scan new folders_ never lists a title of a folder it did not walk, and a title on an unplugged drive is never called missing.

## User Stories

1. As the household, I want a scan to tell me which films' videos are no longer on disk, so that I learn about a deleted file from the scan rather than from a failed play.
2. As the household, I want a scan to tell me which shows have episodes whose videos are gone, so that a half-deleted show doesn't look whole.
3. As the household, I want each missing title listed once, however many of its episodes are gone, so that a deleted show is one row and not 24.
4. As the household, I want a missing film's row to name the file that is gone, so that I recognise which file I deleted.
5. As the household, I want a show's row to name its first gone episodes by tag and count the rest, so that I can tell a whole season from one stray episode.
6. As the household, I want a show whose every episode is gone to say so, so that I know the whole show left the disk.
7. As the household, I want missing titles to appear under their own _Missing_ kind in the Kind filter, so that I can deal with them together.
8. As the household, I want a missing title's row grouped with any other Problem of the same title, so that the review keeps its one-group-per-title shape.
9. As the household, I want to take a missing film out of the library with one press on its row, so that I don't have to find it in Manage library and delete it there.
10. As the household, I want to take a fully gone show out with one press, so that a show I deleted from disk leaves the library too.
11. As the household, I want to take out only a show's gone episodes when others remain, so that the show stays with what still plays.
12. As the household, I want the button to say what it will take out (_Take out of library_, _Take out 3 episodes_, _Take out 1 episode_), so that I know before I press.
13. As the household, I want taking out to answer at once with no confirm dialog, so that it behaves like every other review press.
14. As the household, I want the row to leave the review once the title is taken out, so that the list shows only what is still to settle.
15. As the household, I want a taken-out title gone from the grid, the Continue row, Favorites and Manage library, so that it is really out of the library.
16. As the household, I want _Skip_ to keep a missing title in the library, so that a file I deleted by mistake can come back with its watch history.
17. As the household, I want a skipped missing title asked about again on the next scan, so that nothing is forgotten while it still cannot play.
18. As the household, I want a file I put back after taking its title out to be imported again by the next scan, so that taking out never hides a returned file.
19. As the household, I want a file I put back before taking anything out to make the title play again with no row in the review, so that a mistake fixes itself.
20. As the household, I want a film I moved to another folder or renamed to be found again and not listed as missing, so that reorganising my folders doesn't ask me to delete anything.
21. As the household, I want _Skip all_ on the _Missing_ kind to keep every missing title at once, so that I can postpone the decision in one press.
22. As the household, I want no _Take out all_ press, so that a destructive choice is made one title at a time.
23. As the household, I want no _Resolve_ on a missing row, so that I'm not sent to a form that cannot bring a file back.
24. As the household, I want a title whose drive is unplugged never called missing, so that unplugging a drive never offers to empty my library.
25. As the household, I want _Scan new folders_ to check only the titles of the new folders it walked, so that a quick scan of one folder doesn't list titles of folders it never looked at.
26. As the household, I want a sheet import over my folders to run the same check, so that every run that reads my folders tells me the same thing.
27. As the household, I want a cancelled scan to list nothing missing, so that a scan stopped half-way never calls something gone.
28. As the household, I want a copied title whose original I deleted from my folder to stay unlisted, so that a film still playing from FamilyFlix's own copy isn't called missing.
29. As the household, I want nothing on disk touched when I take a title out, so that my folders stay mine.
30. As the household, I want the missing titles counted in the _need your attention_ tile and in the _Scan complete: N imported, M need attention_ line, so that the numbers match the list.
31. As the household, I want one warning line per missing title in the Activity log (`⚠ Heat (1995) is missing its video`, `⚠ Tidewater (2018) is missing 3 episode videos`), so that the log tells the same story as the review.
32. As the household, I want an empty Title folder listed in the review under _Off layout_, so that I see the folder I meant to fill without opening the log.
33. As the household, I want a folder holding loose videos beside Season folders listed under _Off layout_, so that I know a show wasn't imported and why.
34. As the household, I want an off-layout row titled by the folder's own name and worded like its warning, so that I can find the folder on disk.
35. As the household, I want an off-layout row to offer only _Skip_, so that I'm not offered an action FamilyFlix cannot take.
36. As the household, I want an off-layout folder listed again by every scan until I fix it, so that it isn't forgotten.
37. As the household, I want an off-layout folder that I fix (a video put in, the loose videos sorted) to be imported by the next scan like any new folder, so that fixing it on disk is all I need to do.
38. As the household, I want the off-layout warning line still in the log, so that the log stays a full record of the walk.
39. As the household, I want loose videos in a Library folder's root and doubled posters or tracks to stay log warnings, so that the review lists only what the scan could not settle.
40. As the household, I want off-layout rows grouped with the hard kinds, first in the review, so that what didn't import comes before what wants a look.
41. As the maintainer, I want a take-out of a Problem that is gone, or isn't a missing one, refused as a Skip of a gone Problem is (`404`), so that a stale screen can't take out the wrong thing.
42. As the maintainer, I want a take-out whose title was already deleted elsewhere to settle the row without failing, so that **Gone is gone** holds here too.
43. As the maintainer, I want a missing title's managed files (copied art, subtitles, stills) removed best-effort when it is taken out, as a Delete does, so that no Stranded folder grows from it.
44. As the maintainer, I want the episode removal to free only the files no remaining row points at, as the Series edit job does, so that a shared file is never unlinked.
45. As the maintainer, I want a browser session (no shell) to draw and settle these rows the same way, so that the review is one screen everywhere.

## Implementation Decisions

- **One initiative**, `missing-videos`, step 49, design log 66. It holds two things: the **Missing check** with its **Take out**, and **Off-layout folders** in the review (log 66 Q1).
- **The spec** (Q2): the ProblemRow prototype, already amended by the grill-me. A `missing` row's face is one `secondary` `sm` button worded _Take out of library_, _Take out N episodes_ or _Take out 1 episode_. Neither `missing` nor `off-layout` has _Resolve_. COMPONENT-SPEC's ProblemRow entry says the same. The Review step, its tiles, Kind filter and Review groups don't change.
- **Two new Problem kinds** on the shared `PROBLEM_KINDS` list:
  - `off-layout`, hard, placed with the hard kinds;
  - `missing`, soft, last. It carries `movieId` or `seriesId`, and a new optional `takeOut` field with the button's words, so the client never counts episodes.
  - Labels _Off layout_ and _Missing_. Dots `textFaint` and `danger`.
- **The Missing check** (import-export domain, Q3 to Q5):
  - A pure-ish unit inside the importer. Every run ends in the same place (the completion step that marks the read folders scanned and sets the phase to review), and that place already holds the folders the run read. The check runs there, after the imports and before the completion line, so its Problems are counted in the line and in the tile.
  - Over the held titles whose recorded **Library folder** is one the run read. Each film's video, and each episode's video, is asked of `playback.videoFile`. A `missing` answer marks it missing; `unreachable` and a found file never do.
  - One `missing` Problem per title. For a series: _None of its N episodes' videos are on disk._ when every episode is gone. Otherwise the first three gone episodes' tags in season-and-episode order, then _and N more_, then _are no longer on disk._ (_is_ for one). For a film: _Its video, <file name>, is no longer on disk._
  - One Warning line each, spelled by `spellFolderKey`: `⚠ <key> is missing its video`, or `⚠ <key> is missing N episode videos`.
  - A cancelled run never reaches the check.
- **Take out** (Q8 to Q11):
  - `Importer.takeOutMissing(id): boolean`, on `apply`'s precedent. It answers `false` for an id not held or not `missing`. Otherwise it takes out and removes the Problem.
  - A film: its rows, then its Media folder best-effort, as the movie Delete does, without `leaveOut`.
  - A series with every episode gone: as the series Delete, without `leaveOut`.
  - Some episodes: a new library write, `removeEpisodes(seriesId, episodeIds)`. It deletes those rows (their tracks by cascade) and answers the paths no row points at any more. The importer unlinks each through `media.removeFile`, as the Series edit job does.
  - A title already gone answers `true` and only takes the Problem off (**Gone is gone**).
  - The episodes to take out are the ones the check found, recorded beside the Problem in the importer's own source map, the way other kinds keep their row and folder. They are checked again at press time, so an episode whose file came back is kept.
- **The route** (Q11): `POST /api/import/current/problems/:id/take-out`. `204` once taken out. `404` with the Skip's own `noSuchProblem` sentence for a Problem not there or not `missing`. `500` with _Could not take that title out_ if the write throws. No route learns what a take-out deletes.
- **Off-layout folders** (Q12, Q13):
  - The media domain's walk answers `LayoutWalk.offLayout: OffLayoutFolder[]`, each `{ dir, name, reason: LeftOutReason }`, beside its `warnings`. The warning text is unchanged.
  - The importer files one `off-layout` Problem per entry: titled by `name`, reason _Holds no video or Season folder._ (`empty`) or _Holds loose videos and Season folders._ (`mixed`).
  - _Skip_ only; no route beyond the existing Dismiss.
- **Client** (import-export feature):
  - The feature wire gains `takeOutMissing(id)`, which resolves on `204` and returns `null` on `404`, as `applySheetChoices` does.
  - The **Run hook** gains `takeOut(id)`, which takes the row off on success as `apply` does.
  - `ImportReview` gains `onTakeOut(id)`.
  - `ProblemRow` gains `onTakeOut`, draws the face from `problem.takeOut`, and drops _Resolve_ for the two new kinds.
  - `importView` gains the two labels and counts `off-layout` as hard for group order.
- **No migration, no page, no setting, no new screen, no snackbar.** The glossary, checklist and prototype were done in the grill-me. The docblocks of `walkLibraryFolder`, `PROBLEM_KINDS`, `ImportProblem`, `ProblemRow`, `ImportReview` and the importer's completion step change with the code.
- **Slices** (log 66, _Implementation Plan_):
  1. A gone film is listed: the film check, the `missing` kind, the row with Skip.
  2. Take out a film: `takeOutMissing`, the route, the button.
  3. Gone episodes: the episode check, the folded reason, `removeEpisodes`, _Take out N episodes_.
  4. Off-layout folders: `offLayout` and the hard kind.
  5. The documents, and a walk in the shell on the dev library.

## Testing Decisions

- A good test drives a unit through its public face and checks what a caller or the household would see: the Problems a run lists and their words, what the library holds after a press, the status a route answers, and what a review row draws and reports. It never checks which helper ran or how the importer stores its sources.
- **`walkLibraryFolder`**: an empty and a mixed folder each answer one `offLayout` entry with its reason, and the warning lines are unchanged. Prior art: `walkLibraryFolder.test.ts`, `walkLibraryFolder.hollowShow.test.ts`.
- **The importer**, a new `createImporter.missingCheck.test.ts` over temp Library folders. Prior art: `createImporter.missingVideo.test.ts`, `createImporter.foundAgain.test.ts`. It covers:
  - a deleted linked film listed with its reason and warning line, and counted in the completion line;
  - a moved film Found again and not listed;
  - an unreachable folder's film not listed;
  - _Scan new folders_ not listing a title of an unwalked folder;
  - a copied film whose original left not listed;
  - a series with some episodes gone, and with all;
  - a sheet run listing too;
  - `takeOutMissing` for a film, a whole series and some episodes, each leaving the rest held, recording no Left-out video, and letting a put-back file import on the next scan;
  - `false` for a non-`missing` id;
  - an `off-layout` Problem per off-layout folder.
- **`removeEpisodes`**: the rows go, tracks with them, and only unreferenced paths are answered. Prior art: the series write tests.
- **Routes**: `take-out` answers `204` and the Problem is gone, `404` for an unknown or non-missing id. Prior art: the `routes.import*` suites for `apply` and `pick`.
- **Client**:
  - `ProblemRow`: the `missing` face and its three wordings, no Resolve on `missing` or `off-layout`, and `onTakeOut` reported.
  - `ImportReview`: `onTakeOut(id)`.
  - `useImportRun`: a `takeOut` test file on `useImportRun.apply.test.ts`'s pattern, with the row off on success and nothing on `404`.
  - `importView`: the labels, and `off-layout` grouped as hard.
  - The api's `takeOutMissing`.
  - Prior art: `ProblemRow.test.tsx`, `ImportReview.test.tsx`, `importView.test.ts`, `api.test.ts`.
- The shell walk on the dev library is the acceptance:
  - delete `Die Hard (1988)/`'s video and see it listed, then taken out;
  - put it back and see it imported;
  - delete one Tidewater episode and take out one episode;
  - make an empty `Heat/` and see it under _Off layout_.

## Out of Scope

- Loose videos in a Library folder's root, and Doubled places, as Problems. They stay warnings, and **Tidy into folders** owns loose videos (Q1).
- Found again for episodes: log 51's _films only_ stands (Q5).
- Remembering a kept missing title between scans (Q10).
- A bulk _Take out all_ (Q8).
- Marking a missing title in the grid, on its detail page or in Manage library.
- Checking titles outside the folders a run read, or checking on launch.

## Further Notes

- The trade-offs are accepted (log 66): a title kept on purpose is asked about on every scan; a renamed episode is listed missing rather than found again, and the next _Scan all folders_ reads the renamed file once the old episode is taken out; an empty folder left on purpose is listed until removed or filled.
- The maintainer approved every recommendation of log 66 in advance. This PRD adds three details the log leaves open:
  - the episodes to take out are re-checked at press time (an episode whose file came back is kept);
  - a take-out of an already deleted title is **Gone is gone**;
  - the reason's _is_/_are_ agreement for a single episode.
