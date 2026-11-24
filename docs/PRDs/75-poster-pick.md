> **Initiative:** `poster-pick`
> **Issue:** #707 (the PRD, step 57)
> **Design log:** `docs/design-logs/75-poster-pick.md`
> **Handoff:** `docs/handoff/handoff-poster-pick/README.md`, until phase 3 amends `feat.EnrichmentFlow.dc.html` and `COMPONENT-SPEC.md` (its **Seasons** paragraph) to it.
> **Build order:** step 57, **Poster pick**. Brings back log 41's rule that a linked title still has a **Media folder** for everything except its videos, and adds one line to the **Season choice**'s card. No migration, no new dependency, no new route.

## Problem Statement

The maintainer added Death Note through the **Show folder pick**. It had no art of its own, and its videos are linked where they lie. They synced the series on its own. The review offered each season a row of TMDB posters, but pressing one did nothing. The held tile kept reading _No poster yet_ however many times a poster was pressed, while the pressed card looked chosen.

The cause is upstream of the press. A title added linked with no art is written with no **Media folder**: a linked video names none, and nothing else asked for one. The Sync stores images only into a recorded Media folder. So for such a title it quietly stores nothing at all: no poster, no backdrop, no **Season poster** and no **Still**, not even the **Frame still**. The **Season choice** then answers `404` _No sync holds that season._, and the page swallows that refusal. A linked film added through the Movie form with no art has the same gap. **Add and sync** hits it on every such add.

## Solution

**A synced title's art always lands, however the title was added, and a refused season poster says so.**

- **The Late reserve.** The Sync, or a Season choice, may have an image in hand for a title whose Media folder is missing or gone. The first time that happens, FamilyFlix reserves a Media folder by the title's name and year, records it, and stores the image there. The title keeps that folder from then on. The poster, the backdrop, every Season poster and every Still from that pass go into the same one folder. The videos stay where they lie.
- **No folder for nothing.** The folder is made only after an image has arrived. A Sync with Poster turned off, or one where every TMDB image fails, makes no folder.
- **A held library heals itself.** There is no migration. A folder-less title already in the library gets its folder at its next Sync, which is exactly when the maintainer will Sync to pick its posters.
- **The Poster refusal.** TMDB or the disk may refuse a pressed season poster. Once that season's busy overlay has gone, the season's card says _That poster wasn’t saved. Try again._ under its picker, and none of its choices reads pressed. The next press on that season clears the line. Other seasons are untouched. There is no snackbar and no confirm.

## User Stories

1. As the maintainer who added a show by the Show folder pick with no art, I want its Sync to store its series poster, so that the show has a face on the Series page.
2. As that maintainer, I want the Sync to store the show's backdrop too, so that the Series page header isn't blank.
3. As that maintainer, I want every season's TMDB poster stored, so that each season tile has art.
4. As that maintainer, I want each episode's Still stored, so that the episode list isn't a column of blanks.
5. As that maintainer, I want the Frame still taken again for an episode TMDB has no Still for, so that a linked show is treated like a copied one.
6. As the maintainer reviewing a single-series Sync, I want pressing a season's poster to replace the held tile, so that the press does what it looks like it does.
7. As the maintainer who added a linked film through the Movie form with no art, I want its Sync to store its poster and backdrop, so that films and shows follow one rule.
8. As the maintainer using **Add and sync** on a linked title, I want its art to land the first time, so that the flow I use most just works.
9. As the maintainer, I want all of one Sync's images for a title to go into one folder, so that a title never has its art scattered across several folders.
10. As the maintainer, I want that folder named by the title's name and year like any other Media folder, so that I recognize it in the managed directory.
11. As the maintainer, I want the folder recorded on the title, so that the next Sync, the **Layout fill** and a Delete all find it.
12. As the maintainer, I want a title's videos left exactly where they lie, so that linking still means linking.
13. As the maintainer, I want no folder made by a Sync that stores no image (Poster off, or TMDB unreachable), so that the managed directory doesn't fill with empty folders.
14. As the maintainer, I want a title whose recorded folder was deleted by hand to get a new one at its next Sync, so that a lost folder doesn't stop art for good.
15. As the maintainer, I want a reserve whose store then fails to leave its folder recorded and reused next time, so that a retry never makes a second folder.
16. As the maintainer with a library added before this step, I want its folder-less titles fixed at their next Sync, so that I don't need a migration or a special step.
17. As the maintainer, I want no empty folder made for a linked title that is never synced, so that the managed directory holds only what's used.
18. As the maintainer, I want a title that already has a working Media folder to keep using it, so that nothing moves for titles that never had the gap.
19. As the maintainer, I want art never written into a Library folder by the Sync, so that only the Layout fill and the Library sheet writer ever write there.
20. As the maintainer, I want a disk that refuses the reserve to read as an image not stored, so that one bad write never fails the whole Sync.
21. As a household member pressing a season poster while the Wi-Fi drops, I want the card to say _That poster wasn’t saved. Try again._, so that I know nothing changed.
22. As that household member, I want no choice to look pressed while the line is drawn, so that the card never reads chosen when nothing was.
23. As that household member, I want the line shown only after the busy overlay's _Saving poster…_ has gone, so that the card never shows a spinner and an error together.
24. As that household member, I want the line gone the moment I press again, so that a retry starts clean.
25. As the maintainer picking posters for several seasons, I want the line only on the season that failed, so that I know which one to redo.
26. As the household, I want the held caption (_No poster yet_ or _Current poster_) left as it is, so that it keeps telling the truth about the tile.
27. As the household, I want no snackbar for a refused pick, so that the Seasons section looks as the prototype draws it.
28. As the household, I want one sentence for every kind of refusal, so that I'm not shown TMDB or disk details I can't act on differently.
29. As the maintainer, I want the line announced to a screen reader (`role="status"`), so that it isn't only visual.
30. As a developer, I want `404` from a Season choice to mean only "no single-series run holds that season", so that its docblock and its behaviour agree.
31. As a developer, I want one unit to hand out a title's Media folder lazily, so that films, series and Season choices share a single rule.
32. As a developer, I want the library domain to own the write that records a Media folder, so that enrichment composes storage and media the way the edit routes do.

## Implementation Decisions

- **`lateReserve`** (new enrichment module, in its own folder with its test) gives a title's **Media folder** as a lazy, memoised getter. It takes `{ storage, media }`, a kind (`'movie' | 'series'`) and the title's `{ id, title, year }`, and returns `() => string`.
  - It answers the recorded folder when `media.openFolder` opens it.
  - Otherwise it calls `media.reserveFolder(title, year)`, records the new folder's name through `recordMediaFolder`, and answers that name.
  - The answer is always the recorded name that `storeNamed` takes.
  - It reserves at most once, however often it is asked, and does nothing until it is first asked.
  - It throws whatever `reserveFolder` throws. Every caller already wraps its store in a `try`.
  - It lives in enrichment because `Media` knows folders and not rows, and the library domain owns the row. Enrichment is where the two are composed, as the routes compose them for an edit.
- **`LibraryStorage`** (changed): it gets `recordMediaFolder(kind, id, folder)`, beside `mediaFolderOf`. The call records `folder` as the title's Media folder, over a gone one, for a film or a series.
- **`createEnrichment`** (changed):
  - `storeImage` takes `folder: () => string` instead of `string | null`. It calls the getter inside its `try`, only after the image has arrived and the run is not aborted. Its `folder === null` branch goes.
  - `write` (a film) makes one `lateReserve(deps, 'movie', movie)` for its poster and backdrop.
  - `writeShow` makes one for the series and hands it to `writeSeries` and `writeEpisodes`.
  - `writeEpisodes` loses its `seriesFolder !== null` guard, so TMDB Stills and the Frame still are stored again for a linked show.
  - `chooseSeasonPoster` makes its own getter and calls it inside its `try`, after the image has arrived. The name-collision rule (`-poster-2.jpg`) and the removal of the old poster are unchanged.
  - Its `folder === null → not-found` goes, so `not-found` means only that no single-series run holds that season. The route's `404` copy is unchanged.
- **Timing.** The getter is made once per title pass. A recorded folder that is gone is reserved over and the new one recorded, as the edits do (log 51). A reserve whose store then fails leaves the folder recorded and empty. The next Sync reuses it.
- **`useEnrichmentRun`** (changed): it answers `seasonRefused(season): boolean` beside `seasonPhase`.
  - It is set when that season's `saveSeasonPoster` rejects, and cleared when that season is sent again.
  - The hook still rejects to its caller.
  - It is drawn only once the season's **Busy phase** is back to `idle`, the Loader timing's rule (log 69).
- **`EnrichmentReview`** (changed): it passes `seasonRefused` through to `SeasonChoices`, as it passes `seasonPhase`.
- **`EnrichmentFlow`** (changed): it hands `seasonRefused` down. Its catch on `onChooseSeasonPoster` stays, and its comment now says the card shows the refusal.
- **`SeasonChoices`** (changed) draws the **Poster refusal** when `seasonRefused(season)` is true:
  - The line reads _That poster wasn’t saved. Try again._
  - It sits inside the card, under the picker, 10px above, in 13px sans, `--color-danger`, line-height 1.5, with `role="status"`.
  - While it is drawn, none of that season's choices carries the pressed mark, overriding the local `picked` mark.
  - Every other part of the section is unchanged: the heading, the held tile and its caption, the rule, the choices, the _Series poster_ pill and the Busy overlay's _Saving poster…_.
- **No change** to the adds (`POST /movies`, `POST /series`, the Bulk import), to what a Sync fetches or offers, or to the wire's error shapes.
- **Documents:** the handoff README rules until phase 3. Phase 3 amends `feat.EnrichmentFlow.dc.html` (a refused state on one season card) and `COMPONENT-SPEC.md`'s **Seasons** paragraph. Also updated: the docblocks of `storeImage`, `writeSeries`, `writeShow`, `chooseSeasonPoster` (in the `Enrichment` interface too), `SeasonChoices` and `useEnrichmentRun`, plus the checklist's step 57. CLAUDE.md and the README are untouched.
- **Terms** (already in the glossary from log 75): new, **Late reserve** and **Poster refusal**. Updated: **Media folder**, **Series folder** and **Season choice**.

## Testing Decisions

- A good test drives a unit through its public face and checks what a caller or the household sees: the folders on disk and the recorded row after a Sync, the outcome a Season choice answers, the words and the pressed state on screen. It never checks which helper ran.
- **`lateReserve.test.ts`** (new):
  - A recorded folder that opens is answered and nothing is reserved.
  - With no folder recorded, one is reserved by title and year and recorded.
  - A recorded folder that is gone is reserved over and recorded.
  - Asked three times, it reserves once.
  - Never asked, it reserves nothing.
- **`recordMediaFolder`**: it records for a film and for a series, and `mediaFolderOf` reads the value back. Prior art: `enrich.mediaFolder.test.ts`.
- **`createEnrichment.lateReserve.test.ts`** (new suite named for its concern), over a real library and `Media` and the fake TMDB:
  - A series with no Media folder, synced, lands its poster, backdrop, Season posters and Stills in one new folder, which is recorded.
  - A film the same.
  - With Poster off, no folder is made.
  - A Season choice on such a series answers `chosen`, and the held tile's url follows it.

  Prior art: `createEnrichment.mediaFolder.test.ts`, `createEnrichment.seasonPosters.test.ts`, `createEnrichment.frameStill.test.ts`.

- **`createEnrichment.seasonChoices.test.ts`**: the `not-found` case for a folder-less series goes. `not-found` stays for no run.
- **`useEnrichmentRun.seasonPoster.test.ts`**:
  - A refused choice answers `seasonRefused(n) === true` once its phase is idle.
  - The next press clears it.
  - Another season is untouched.
- **`SeasonChoices.test.tsx`**: with `seasonRefused`, the line is drawn under the picker and no choice reads pressed. Without it, there is no line.
- Every slice starts RED (`tdd`). The acceptance is the walk in the shell:
  - A show added by the Show folder pick with no art, then synced on its own: its poster, backdrop, Season posters and Stills land, and pressing a season's poster replaces the held tile.
  - A linked film added through the Movie form with _Add and sync_: its poster and backdrop land.
  - With the network cut after the review opens, a press draws the Poster refusal and no choice reads pressed. With the network back, a press lands and the line goes.

## Out of Scope

- Changing the adds to reserve a folder up front (Q3). The Sync is the one writer that finds the gap.
- A migration to make folders for held titles (Q4).
- Storing a linked title's art in its Library folder (Q3).
- Reserving before the fetch (Q5).
- A snackbar, or the server's own sentence per refusal (Q9).
- Any change to which posters a Season choice offers, or to what a Sync fetches.

## Further Notes

- Trade-offs accepted:
  - The Sync now creates folders in the managed directory, a write that only adds and edits made before.
  - A reserve whose store then fails leaves one empty recorded folder. It is harmless and gets reused.
- Implementation plan (log 75):
  1. **A linked show's poster lands:** `recordMediaFolder`, `lateReserve`, and `chooseSeasonPoster` and `writeShow` (with `writeSeries` and `writeEpisodes`) using it.
  2. **A linked film's art lands:** `write` on the same unit.
  3. **A refused pick says so:** the prototype and `COMPONENT-SPEC.md` amended to the handoff; `seasonRefused` in the hook, the review and the Flow; the line in `SeasonChoices`; the walk in the shell.
