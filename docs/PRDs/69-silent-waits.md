> **Initiative:** `silent-waits`
> **Issue:** #652 (the PRD, step 51)
> **Design log:** `docs/design-logs/69-silent-waits.md`
> **Handoff:** `docs/handoff/handoff-loading-states/`, read as received; no prototype is amended
> **Build order:** step 51, **Silent waits**. It ships as thin slices (log 69, _Implementation Plan_). No migration, no route, no wire change: the faces of presses that wait.

## Problem Statement

Dad syncs a show with TMDB and picks its poster on the review. The card stays where it is for seconds, nothing on screen moves, and he presses it again: two picks go to the server. The same thing happens wherever a press waits on the server outside the forms and dialogs that step 36 (**Loading states**) gave a **Busy button** or a **Dialog loader**. The audit of 2026-11-19 found each such **Silent wait**:

- **Sync review:** a candidate poster, _Apply choices_, _Skip_, _Keep all mine_, _Search_ and _Skip all_ draw nothing until the route answers, and stay pressable. So does a **Season choice**'s poster.
- **Start sync** and _Fetch details_: nothing drawn and still pressable until the first snapshot lands, so a slow TMDB start invites a second press.
- **Import review:** _Import as “…”_, _Import all as guessed_, _Take out of library_, _Skip_, _Skip all_, a picked candidate folder and _Apply choices_ are the same. _Start import_ is only disabled by its form.
- **Library folders:** a folder's ✕ and _Bring back_ show nothing and stay pressable. _Scan new folders_ and _Scan all folders_ lock, but draw no _Scanning…_ until the progress screen opens.
- **Edit form:** an edit, a series edit or a Resolve opens as a blank _Add a movie_ form, its _Add to library_ shown, until the record lands; a slow read then overwrites whatever was typed.
- **Show folder pick** (shell only): after the folder dialog closes, a large show is read with nothing drawn until its episode rows appear.

## Solution

Every one of these presses locks at once and, if it runs past 300ms, says it is working, in a face the loading-states handoff already draws. No prototype is amended.

- **A Busy row** for a press on a row or a card (a **Decision row**, a review's **Problem** row, a **Folder row**, a **Season choice**): from the press, nothing in the row can be pressed, and every control keeps its own face. Past 300ms the row dims to .75 and the FF mark, 18px and inline, stands in its status slot with the press's _-ing_ words: _Saving match…_, _Skipping…_, _Removing…_. This is the handoff's _Inside a row_ treatment.
- **Busy buttons** for the presses that are buttons: _Skip all_ (_Skipping…_), _Import all as guessed_ (_Importing…_), _Start sync_ and _Start import_ (_Starting…_), _Fetch details_ (_Fetching…_), and the pressed scan button (_Scanning…_, the other one disabled). While a bulk press runs, every row it covers is locked and draws nothing of its own: one loader for one wait.
- **The Loader timing** holds as everywhere else: nothing drawn for 300ms, then at least 500ms shown, and the outcome (the row leaving, _Match saved._, the progress screen, the leaving to `/import`) waits out the hold.
- **A Form skeleton** while the form reads an edit's or a Resolve's record: the form's own shape in Skeleton blocks, drawn at once as the detail pages draw theirs, with no save button. The form appears whole when the record lands; a record that is gone still leaves the add standing.
- **The Show folder pick** locks _＋ Add show folder_ while the folder is read, and past 300ms draws the mark with _Reading folder…_ in its place.

A press the server refuses returns its row or button to its idle face, pressable again, as today.

## User Stories

1. As the household, I want a candidate poster I pressed on the Sync review to stop answering presses at once, so that a second press never sends a second pick.
2. As the household, I want a pick that takes longer than a moment to dim its row and say _Saving match…_, so that I know it is working rather than broken.
3. As the household, I want a pick that lands quickly to show no loader at all, so that the screen doesn't flash.
4. As the household, I want a loader, once shown, to stay at least half a second, so that it never flickers.
5. As the household, I want the row to leave and _Match saved._ to appear only after the loader's hold, so that the row never vanishes mid-loader.
6. As the household, I want _Apply choices_ on a conflict row to lock the row and say _Updating details…_ when slow, so that I can't apply twice.
7. As the household, I want _Skip_ and _Keep all mine_ on a Decision row to lock the row and say _Skipping…_ when slow, so that a slow skip doesn't look ignored.
8. As the household, I want _Search_ on a Decision row to lock the row and say _Searching TMDB…_ when slow, so that I don't search twice while TMDB answers.
9. As the household, I want the _Searching TMDB…_ snackbar to appear as it does today, so that the prototype's notice is unchanged.
10. As the household, I want a searched row to redraw with its new candidates only after the hold, so that the new face doesn't flash under the loader.
11. As the household, I want a Season choice's poster press to lock that season and say _Saving poster…_ when slow, so that a second press doesn't send a second choice.
12. As the household, I want the other seasons and the other rows to stay pressable while one row works, so that I can keep working down a long review.
13. As the household, I want _Skip all_ to become a Busy button reading _Skipping…_, so that I can see the bulk skip is working.
14. As the household, I want every row _Skip all_ covers to be locked while it runs, without a loader of its own, so that I can't press a row that is about to leave and I see one loader, not twenty.
15. As the household, I want _Start sync_ to lock at once and read _Starting…_ when slow, so that a slow TMDB start doesn't invite a second press.
16. As the household, I want _Fetch details_ for one title to read _Fetching…_ when slow, so that its words match its label.
17. As the household, I want a Sync started on arrival from a title's Edit menu to show the same busy button, so that the arrival start looks like a press.
18. As the household, I want a refused Sync start to put its button back as it was, with the busy notice where it applies today, so that I can press again.
19. As the maintainer, I want _Import as “…”_ and a picked candidate folder on a Problem row to lock the row and say _Importing…_ when slow, so that a title is never imported twice.
20. As the maintainer, I want _Take out of library_ on a missing row to lock the row and say _Taking out…_ when slow, so that I can see the take-out is working.
21. As the maintainer, I want _Apply choices_ on a differs row to say _Updating details…_ when slow, and _Skip_ and _Keep all mine_ to say _Skipping…_, so that every import press reads the same as its Sync counterpart.
22. As the maintainer, I want _Resolve_ on a Problem row to stay a plain link, so that it opens the form as today.
23. As the maintainer, I want _Import all as guessed_ to become a Busy button reading _Importing…_, with every row it covers locked, so that a bulk import is never sent twice.
24. As the maintainer, I want the Import review's _Skip all_ to read _Skipping…_ the same way, so that both reviews behave alike.
25. As the maintainer, I want _Start import_ to lock at once and read _Starting…_ when slow, and to stay disabled while its form is unfilled, so that a slow start never starts two runs.
26. As the maintainer, I want a refused _Start import_ to put its button back with the refusal under its field, as today, so that I can fix and retry.
27. As the household, I want a folder's ✕ on Library folders to lock the row and say _Removing…_ in place of its _N titles_ line when slow, so that I can't remove twice.
28. As the household, I want a refused remove to put the row back with its refusal sentence, as today, so that I know why it stayed.
29. As the household, I want _Bring back_ to lock the row and say _Bringing back…_ when slow, so that I can see it working.
30. As the household, I want the pressed scan button to read _Scanning…_ when slow and the other scan button disabled, so that I know a scan is on its way before the progress screen opens.
31. As the household, I want the move to the progress screen to wait out the loader's hold, so that _Scanning…_ never flickers.
32. As the household, I want a scan refused for a run already going to take me to that run, as today, after the hold, so that I see what is running.
33. As the maintainer, I want an edit, a series edit and a Resolve to open on a skeleton of the form, so that I never see _Add a movie_ for a film I'm editing.
34. As the maintainer, I want no save button drawn while the record is read, so that I can't add the title a second time by mistake.
35. As the maintainer, I want nothing to be typed into before the record lands, so that a slow read never overwrites what I typed.
36. As the maintainer, I want the form skeleton drawn at once, with no delay, so that a read looks like the detail pages' reads.
37. As the maintainer, I want an edit whose record is gone to fall back to the add as today, so that a stale link still lands somewhere.
38. As the maintainer, I want a plain add to open as it does today with no skeleton, so that nothing changes where nothing is read.
39. As the maintainer, I want _＋ Add show folder_ to lock while a picked folder is read and say _Reading folder…_ when slow, so that I can't pick a second folder over the first's read.
40. As the maintainer, I want the folder dialog's own time not counted as the read, so that the loader appears only after I chose a folder.
41. As the maintainer, I want a refused folder read to put the control back with its refusal sentence, as today, so that I can pick again.
42. As a screen reader user, I want a working row announced through its loader's status and marked busy, so that I hear what is happening once, not every hidden box.
43. As a screen reader user, I want the form skeleton announced once as _Loading movie_ or _Loading series_, so that I know what is loading.
44. As a household member who prefers reduced motion, I want every new loader to fade rather than move, so that it still says it's working without animation.
45. As the maintainer, I want the 300 / 500 rule written once in the code, so that every loader in the app keeps the same timing.

## Implementation Decisions

- **One initiative**, `silent-waits`, step 51, design log 69. No migration, no route, no wire change, no new `prim.*` or `mol.*`, no prototype amended.
- **The handoff read as received:** the **Busy row** is the loading-states handoff's _Inside a row_ (table row 5). Its _Not used here: Import and TMDB enrichment_ is read as the running screens with their live log; a review press comes after that log.
- **The Loader timing, stated once:** the body of `useDelayedBusy`'s `run` moves to an exported `onLoaderTiming(work, setPhase)` beside it. `useDelayedBusy` and a new keyed sibling both call it. `SHOW_AFTER_MS` and `MIN_SHOWN_MS` stay where they are.
- **`useDelayedBusyByKey`**, a new shared hook (two features use it): `phaseOf(key): BusyPhase`, `idle` for any key not running, and `run(key, work)`, which times `work` per key and passes its result or its error through.
- **The timing wraps the request, inside the hook that owns it.** Each run hook calls the route inside the keyed `run`, then settles the row (drops it, redraws it, counts it) after the promise, so the outcome follows the hold. A row never wraps its own press.
- **Each owning hook answers `rowPhase(id)`:** `useEnrichmentRun`, `useImportRun`, `useLibraryFolders`. `useEnrichmentRun` also answers `seasonPhase(season)`. The row methods keep their signatures and still reject on a refusal.
- **Bulk and start presses** each sit on their own `useDelayedBusy`, in the run hook, answered as a `BusyPhase` under log 53's naming: `skippingAll` (both run hooks), `importingAll` (`useImportRun`), `starting` (both run hooks). While a bulk phase is past `idle` the review hands every row `waiting`: locked, no loader.
- **`useFolderScan`'s `scanning`** becomes a `BusyPhase` on `useDelayedBusy`, beside `scope`, the scope pressed. The navigation on a `201` or `409` follows the hold.
- **The Busy row**, drawn by each row itself:
  - From `waiting`, the row root is `inert` and `aria-busy`, so every control inside keeps its own face. The grey disabled face is for a control that can't be used, not one at work (log 53 Q9).
  - Once `shown`, a shared css helper gives the row opacity .75 and a progress cursor, and an 18px `inline` `LogoLoader` with its label replaces the status slot. The slot is the Decision row's and Problem row's kind dot, the Folder row's line, and a Season choice's held-poster caption.
  - Which press it was is the row's own state; the phase is the hook's.
- **Labels**, in the app's voice:
  - Decision row: _Saving match…_, _Searching TMDB…_, _Updating details…_, _Skipping…_.
  - Problem row: _Importing…_ (a folder or _Import as_), _Updating details…_, _Taking out…_, _Skipping…_.
  - Folder row: _Removing…_, _Bringing back…_.
  - Season choice: _Saving poster…_.
  - Buttons: _Skipping…_, _Importing…_, _Starting…_, _Fetching…_, _Scanning…_.
- **The _Searching TMDB…_ snackbar stays**, as the prototype draws it.
- **The form skeleton:**
  - A new `LoadingForm` feature unit in the movie form, on the `LoadingDetail` / `LoadingSeries` pattern: the real form's frame imported from its styles, Skeleton blocks for the heading, fields and files card, a `role="status"` named _Loading movie_ or _Loading series_ by the job's kind, its insides hidden from assistive technology.
  - `useMovieForm` answers `loading: boolean`: true while the job names a record and its read has not answered. Drawn at once, with no Loader timing, since it is a read, not an action.
- **The Show folder pick:** `useShowFolderPick` answers `reading: BusyPhase`, wrapping the folder read and the held series' title read, never the dialog. `useMovieForm` passes it on as `readingShowFolder`. The dashed _＋ Add show folder_ row draws the 18px inline mark with _Reading folder…_ once shown.
- **Refusals:** a refused row press settles back to `idle`, its row as it was; existing refusal sentences (a folder remove, an import start, a Show folder read) stay as they are.
- **Slices** (log 69, _Implementation Plan_):
  1. One row end to end: the timing extraction, the keyed hook, the busy-row style, the Decision row's pick.
  2. The Sync review whole.
  3. The Import review.
  4. Library folders.
  5. The form: skeleton and Show folder read.
  6. Walk it live, then the documents.

## Testing Decisions

- A good test drives a unit through its public face with fake timers and a held-open route, and checks what the household would see or be able to press: whether a second press sends a second request, what is drawn before and after 300ms, when the row leaves. It never checks which helper ran.
- **`onLoaderTiming` / `useDelayedBusy`:** the existing suite stays green unchanged after the extraction, which proves the rule moved whole. Prior art: `useDelayedBusy.test.ts`.
- **`useDelayedBusyByKey`:** two keys run independently; an unknown key is `idle`; a key under 300ms never shows; a shown key holds 500ms; an error passes through after the hold.
- **Run hooks:** for each row method, `rowPhase(id)` is `waiting` at once, `shown` at 300ms, and the row is still on the run until the hold ends; a refusal returns it to `idle` with the run unchanged. The same for `seasonPhase`, `skippingAll`, `importingAll`, `starting`. Prior art: `useEnrichmentRun.seasonPoster.test.ts`, `useImportRun.pick.test.ts`, `useLibraryFolders.busy.test.ts`.
- **Rows:** given a `busy` phase, the row is `inert` and `aria-busy` from `waiting`, and once `shown` draws the loader with the label of the press it reported in place of its status slot. Prior art: `DecisionRow.test.tsx`, `ProblemRow.test.tsx`, `FolderRow.test.tsx`, `SeasonChoices.test.tsx`.
- **Flows:** a second press on a waiting row sends no second request; _Skip all_ locks every row it covers and draws one loader; Start, _Start import_ and the scans show their Busy button. Prior art: `EnrichmentFlow.decisions.test.tsx`, `LibraryFolders.busyAdd.test.tsx`, `LibraryFolders.scan.test.tsx`.
- **The form:** an edit, a series edit and a Resolve draw `LoadingForm` and no save until the record lands; a plain add never draws it; a gone record falls back to the add. `LoadingForm` is announced once by its kind. Prior art: `LoadingDetail.test.tsx`, `LoadingSeries.test.tsx`.
- **The Show folder pick:** `reading` is `idle` while the dialog is open, then `waiting` and `shown` across a held read.
- Every slice starts RED (`tdd`); the acceptance is the walk in the dev app with each write held open, as the audit was made.

## Out of Scope

- A failure face for a refused row press: no prototype draws one. The row returns to idle as today.
- Server-reported progress for any of these presses.
- Everything the audit lists as **Already covered**: the browse and detail Skeletons, the forms' and dialogs' Busy buttons and Dialog loader, the Sync and Import progress screens, the Export, _Testing…_, the codec drop zone, Software update's _Checking_, the player's buffering notice, and the optimistic Favorite, Watched, Rating and Settings writes. Settings sub-pages drawing nothing until their read lands is a Product Rule, not a gap.
- Any change to the loading-states handoff or any other prototype.

## Further Notes

- `inert` takes focus out of a working row, so focus falls back to the page when it was on the pressed control. This is accepted: the loader's status is announced, and the row usually leaves.
- A row press's outcome now waits up to 500ms more when it ran past 300ms. Log 53 accepted that cost.
- The checklist's step 51 entry and the glossary's **Silent waits** section were written in the grill-me (log 69).
