> **Initiative:** `loading-states`
> **Design log:** `docs/design-logs/53-loading-states.md`
> **Issue:** #482 (the PRD, step 36)
> **Build order:** step 36, **Loading states**, above **Scan new folders**. It ships as thin slices (log 53, _Implementation Plan_), the prototype first. No migration, no new route, no wire change.

## Problem Statement

When the household or the maintainer starts an action, the app's only sign of work is a label that swaps at once to _Saving…_ or _Deleting…_ on a greyed-out button. A quick action flashes; a slow one (a large copy-add, a series delete, a Factory reset) sits on a grey face that looks broken rather than busy. While a Delete or a Reset runs, its dialog can still be dismissed with Escape, the scrim or the ✕, so a destructive action can be half-walked-away-from with no word on how it ended. A Delete that fails changes nothing on screen.

On a cold start the window stays closed until the server is up, so for several seconds a parent double-clicks FamilyFlix and sees nothing at all, and may click again.

The handoff (`docs/handoff/handoff-loading-states/`) answers all of this with the FF mark as a loader and a timing rule. But its copy predates the app's words, the shell loads the renderer from a server it has already waited for (so a renderer splash would never be seen), and `GlobalStyle` collapses every animation under reduced motion, which would freeze a loader at its dimmest frame.

## Solution

Every action gets one calm, honest sign of work in the FF mark, translated from the handoff onto the app as it is: its words, its units, its Modal, its shell.

- **One timing rule**: nothing is drawn for the first 300ms (only the control locks); once drawn, the sign stays for at least 500ms, and the outcome (a leaving, a close, a snackbar, an error line) waits out that hold.
- **Busy buttons**: every button whose label swaps today keeps its variant's face and its width, locks at once, and after 300ms shows its _-ing_ label with a shine sweeping across it in the button's own ink.
- **Destructive dialogs**: the Delete dialog (Manage library, movie page, series page) and the Reset dialog lock from the confirm press, can't be dismissed, and after 300ms turn into a bare card holding the FF mark and _Deleting “Coco”_ or _Erasing everything_. A failure returns the dialog to its idle face with one line: _Couldn’t delete “Coco”. Try again._
- **Start-up splash**: the shell opens its window at once over a static splash (the tile, the beating mark, _Opening your library_) and loads the app over it when the server is ready.
- **Reduced motion**: the loader and the shine fade instead of moving; they never freeze.

## User Stories

### Timing

1. As a parent, I want a quick action to finish without any loader flashing, so that the app feels calm rather than jittery.
2. As a parent, I want a slow action to show a sign of work after a moment, so that I know the app heard me.
3. As a parent, I want a loader, once shown, to stay long enough to read, so that it never blinks in and out.
4. As a parent, I want the dialog to close or the page to leave only after the loader's hold, so that what I see happens in order.
5. As a parent, I want the control I pressed to lock at once, even before any loader appears, so that a double-click never runs an action twice.

### Busy buttons

6. As a parent, I want _Add to library_ to read _Adding…_ with a gentle shine while a movie is added, so that I know it is working.
7. As a parent, I want _Save changes_ to read _Saving…_ while an edit saves, whatever the job (a movie, a series, the series edit), so that every save looks the same.
8. As a parent, I want a busy button to keep its colour rather than go grey, so that it looks at work, not broken.
9. As a parent, I want a busy button to keep its width, so that the form doesn't shift while it works.
10. As a parent, I want the cursor over a busy button to show progress, so that I know waiting is expected.
11. As a parent, I want pressing a busy button to do nothing, so that I can't start the same action twice.
12. As the maintainer, I want _Clear details_ to read _Clearing…_ while it runs, so that the Clear dialog says it is working.
13. As the maintainer, I want _Test connection_ to read _Testing…_ while TMDB answers, so that I know the test is running.
14. As the maintainer, I want Library folders' _Add_ to read _Adding…_ and _Browse…_ beside it to be disabled, so that I can't pick a second folder mid-add.
15. As the maintainer, I want _Export as CSV_ to read _Exporting…_ while the export runs, so that I know the file is being written.
16. As a screen-reader user, I want a busy button announced as busy and its new label read politely, so that I hear the app is working without being interrupted.
17. As the maintainer, I want _Check for updates_ left as it is, so that its _Checking…_ keeps reporting the shell's update status rather than a request.

### Destructive dialogs

18. As a parent, I want the Delete dialog to become a bare card with the FF mark and _Deleting “Coco”_ while a slow delete runs, so that I see what is happening to which title.
19. As a parent, I want the Reset dialog to become the FF mark with _Erasing everything_ while a Factory reset runs, so that I know the reset is under way.
20. As a parent, I want a running Delete or Reset not to close on Escape, the scrim or a ✕, so that I can't walk away from a half-done destructive action.
21. As a parent, I want _Cancel_ disabled from the moment I confirm, so that the first 300ms is no escape hatch either.
22. As a parent, I want the loader to say only what is true (no _Removing files from disk_ for a linked title), so that I'm never told something false about my files.
23. As a parent, I want a failed Delete to return the dialog to its usual face with _Couldn’t delete “Coco”. Try again._, so that I know nothing happened and can retry.
24. As a parent, I want that failure line gone when I confirm again, so that an old error doesn't sit over a new attempt.
25. As a parent, I want a failed Reset to keep its own refusal sentence, so that its message stays as it is.
26. As a parent, I want a Delete or Reset that succeeds to end exactly as it does today (the snackbar, the leaving, the reload), so that nothing new surprises me.
27. As the maintainer, I want the Export and Clear dialogs to stay dismissable while they work, so that only destructive dialogs lock.
28. As a screen-reader user, I want the dialog loader announced as a busy status with its label, so that I hear which title is being deleted.

### Start-up

29. As a parent, I want the window to open at once when I start FamilyFlix, so that I don't double-click it again thinking nothing happened.
30. As a parent, I want the window to show the FamilyFlix tile, the beating mark and _Opening your library_, so that I know the library is on its way.
31. As a parent, I want the app to appear over the splash when it is ready, so that start-up is one window, not two.
32. As a parent, I want a server that never starts to bring up the existing _Quit_ / _Show data folder_ dialog, so that a broken start still says what to do.
33. As the maintainer, I want a browser dev session (`npm run dev`) to draw no splash, so that the splash stays the shell's alone.

### Reduced motion

34. As a parent who turns animations off, I want the loader to fade gently rather than freeze, so that it still says work is happening.
35. As a parent who turns animations off, I want a busy label's shine to fade instead of sweep, so that nothing moves on screen.
36. As a parent who turns animations off, I want the loader's pop-in to collapse like every other animation, so that only the beat stays.

### The maintainer

37. As the maintainer, I want one hook to own the 300 / 500 rule, so that every action keeps the same timing and a change happens in one place.
38. As the maintainer, I want every in-flight state typed as one **Busy phase**, so that buttons, dialogs and hooks speak the same vocabulary.
39. As the maintainer, I want `LogoLoader` built to the full `prim.LogoLoader` surface (size, progress, tone, tile, label, detail, inline), so that determinate progress is ready when something reports a count.
40. As the maintainer, I want the handoff committed as received and this PRD's departures recorded in the design log, so that the prototype stays the frozen source and the reasons are written down.
41. As the maintainer, I want `COMPONENT-SPEC.md`, the checklist and the glossary to name the new units, so that the next change reads them.
42. As the maintainer, I want a live walk in the shell (a slow series delete, a reset, a large copy-add, a cold start), so that I see each loader in the real app before shipping.

## Implementation Decisions

- **One initiative** (log 53 Q1): `loading-states`, step 36. Not built here: server-reported progress for any action, upload progress in the Movie form, **Scan new folders**.
- **The handoff is committed as received** (Q2), frozen like `handoff-manage-library/`. Phase 1 lifts `prim.LogoLoader.dc.html` to `docs/handoff/` and adds `COMPONENT-SPEC.md` rows for `prim.LogoLoader`, `Button`'s busy props, `Modal`'s `locked` and `mol.DialogLoader`.
- **The app's words** (Q3): _Save changes → Saving…_, _Add to library → Adding…_, _Clear details → Clearing…_, _Delete movie / Delete series → Deleting…_, _Erase everything → Erasing…_, _Test connection → Testing…_, _Add → Adding…_, _Export as CSV → Exporting…_. The handoff's _Save movie_, _Clear metadata_, _Delete folder_ are not used.
- **`LogoLoader`** (Q4), a new atom in `primitives/`, exported from the `primitives` barrel: `size` (48), `progress` (0 to 1, determinate), `tone` (`brand | current`), `tile`, `label`, `detail` (`NN%` when `progress` is set), `inline`. A `role="status"`. Its clip path id comes from `useId`, stripped of characters a `url(#…)` reference can't carry. No per-unit `index.ts`. Never drawn inside a button.
- **Reduced motion** (Q5): the loader's beat and the button shine carry their own reduced-motion keyframes (fade only, no movement), with the specificity to beat `GlobalStyle`'s `*` rule; the mount pop-in collapses with everything else.
- **`BusyPhase`** (Q6): `'idle' | 'waiting' | 'shown'`, a new shared type in `types/`.
- **`useDelayedBusy`** (Q6, Q7), a new shared hook in `src/hooks/` (five features use it). It exports `SHOW_AFTER_MS = 300` and `MIN_SHOWN_MS = 500` and answers `{ phase, run }`. `run(work)` sets `waiting` at once, `shown` at 300ms if the work is still running, and settles (resolve or reject, passing the work's result or error through) no sooner than 500ms after `shown`, then returns to `idle`. Work that settles before 300ms settles at once, never having been `shown`. `run` wraps the request only; the caller's outcome (a leaving, a close, a snackbar) follows `run`'s promise. Rejected: the timing inside `Button`.
- **Feature hooks** (Q8): each in-flight `useState(false)` becomes a `useDelayedBusy()`, keeping its name, now typed `BusyPhase`: `saving` (`useMovieForm`), `clearing`, `deleting` (`useLibraryTitles`, `useDeleteMovie`, `useDeleteSeries`), `resetting` (`useFactoryReset`), `testing` (`useTmdbKey`), `adding` (`useLibraryFolders`), `exporting` (`useExport`).
- **`Button`'s busy props** (Q9 to Q11), on the button form only (`busy?: never` on the link): `busy?: BusyPhase` (default `idle`) and `busyLabel?: string` (default `label`). `waiting`: disabled, `aria-busy`, the idle label, the variant's face kept (not the grey disabled face), `cursor: progress`. `shown`: `busyLabel` in a span with `aria-live="polite"` and the shine. A busy button's `onClick` never fires. The shine is a moving `mask-image` over the label in its own ink, so one rule serves every variant (rejected: the handoff's `background-clip: text` gradient in one fixed ink, wrong on our bordered `danger`). The idle width is measured when `busy` leaves `idle` and held as `min-width` until it returns (rejected: stacking both labels in a grid, which widens the idle button).
- **No _Saved ✓_** (Q12): no caller stays on screen after a save.
- **Callers of the busy button** (Q13): the Movie form's save (every job, both kinds, the series edit included), the Clear dialog's confirm, _Test connection_, Library folders' _Add_ (with _Browse…_ disabled beside it), the Export dialog's confirm. Not _Check for updates_.
- **No Sync row** (Q14): _Sync with TMDB_ leaves for the **Enrichment flow**, which has its own live log.
- **`Modal`'s `locked`** (Q16): `locked?: boolean`; when set, Escape and the scrim ask nothing and the ✕ is not drawn. The Delete dialogs and the Reset dialog are locked from the confirm press (in `waiting` too), with _Cancel_ disabled, until the action settles. Export and Clear stay live.
- **`DialogLoader`** (Q15), a new molecule in `components/`: `{ label: string }`, a 64px `LogoLoader` with its label, `aria-busy`, drawn inside a **Bare** `Modal`. Once `shown`, the three Delete dialogs (`DeleteTitleDialog`, `DeleteMovieDialog`, `DeleteSeriesDialog`, through `DeleteTitleBody`) and `ResetDialog` render it: _Deleting “Coco”_, _Erasing everything_. No step detail and no determinate mode: a Delete is one request, and a Factory reset reports no count.
- **A failed Delete** (Q17): the dialog returns to its idle face, live, with one line above the buttons in the Reset dialog's refusal style: _Couldn’t delete “<title>”. Try again._ The hooks own the flag: `deleteFailed` on `useLibraryTitles`, `failed` on `useDeleteMovie` and `useDeleteSeries`, cleared by the next confirm. The Reset dialog keeps its own refusal sentence. Rejected: a new error face with _Close_.
- **A Delete or Reset that lands** (Q18): unchanged, each surface's shipped outcome. No new **Snackbar variant** and no new snackbar.
- **The splash in the shell** (Q19, Q21): `main.ts` opens the window at `whenReady` over the splash page and shows it; when the server's `ready` lands, `loadRenderer` loads the app over it. A server that never comes is still the 15s `READY_TIMEOUT_MS` and the **startupFailed** dialog (_Quit_ / _Show data folder_). No 10s _Can’t reach the FamilyFlix server_, no _Try again_, no cross-fade, no timing rule (the splash is the window's first paint). A browser draws no splash. Rejected: a renderer splash, which the server-served renderer can never show in time.
- **`splashPage`** (Q20), a new pure unit in `electron/`: answers a `data:` URL of static HTML on `bg` with the 88px tile and mark, the beat and its reduced-motion fade, and _Opening your library_. The F paths are copied from `docs/handoff/brand/familyflix-mark.svg` (the shell imports only types from `src/`); the accent is the token's value.
- **Documents** (Q22): the checklist's row becomes _Loading states: the FF mark while an action runs_; `COMPONENT-SPEC.md` (Q2); the glossary (the **Loading states** section moves from planned to shipped; **Delete dialog**, **Modal**, **Reset dialog** updated); the docblocks of every unit touched.
- **Slices** (log 53, _Implementation Plan_):
  1. the prototype;
  2. a save that waits: `LogoLoader`, `BusyPhase`, `useDelayedBusy`, `Button`'s `busy`, the Movie form's save on it end to end;
  3. every busy button: Clear, _Test connection_, _Add_, Export;
  4. destructive dialogs: `Modal`'s `locked`, `DialogLoader`, the three Delete dialogs and the Reset dialog, the failure line;
  5. the splash: `splashPage`, and `main.ts` opening the window first;
  6. walk it live in the shell (a slow series delete, a reset, a large copy-add, a cold start), then the documents.

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the household sees: the phase answered, the words and roles drawn, whether a click or a dismissal does anything, when a promise settles. It never asserts which helper ran or which styled-component class applied.
- **`useDelayedBusy`**, the deepest module, with fake timers: `waiting` at once; work under 300ms settles at once and is never `shown`; `shown` at 300ms; a resolve or reject after `shown` is held until 500ms after `shown`, then `idle`; the result and the error pass through. Prior art: `useOptimisticEdit` and `useRestoredScroll` in `src/hooks/`.
- **`LogoLoader`**: a `status` with its label; determinate `progress` draws the detail as `NN%`; `tile`, `tone` and `inline` change what is drawn; two loaders on a page get distinct, `url(#…)`-safe clip ids. Prior art: the primitives' existing tests.
- **`Button`**: `waiting` is disabled and `aria-busy` with the idle label; `shown` draws `busyLabel` in a polite live region; `onClick` never fires while busy; `busyLabel` defaults to `label`. Prior art: `Button`'s own test.
- **`Modal`**: `locked` draws no ✕, and Escape and a scrim click call nothing; unlocked behaves as today. Prior art: `Modal`'s own test.
- **`DialogLoader`**: draws its label as a busy status. Prior art: the components' existing tests.
- **The feature hooks**: each in-flight state moves through `waiting` and `shown` and back; the delete hooks set and clear their failed flag. Prior art: each hook's own test.
- **The dialogs**: the three Delete dialogs and the Reset dialog lock from the confirm press, turn into the dialog loader once shown, return live with the failure line on a reject, and keep their shipped outcome on success; Clear and Export stay dismissable while busy. Prior art: their existing tests.
- **The Movie form, Clear, _Test connection_, Library folders, Export**: the busy label appears only after 300ms and the outcome (leaving, close, row) waits out the hold. Prior art: their existing tests.
- **`splashPage`**: the `data:` URL decodes to HTML carrying _Opening your library_, the mark's paths and a reduced-motion rule. Prior art: the shell's pure units' tests in `electron/`.
- **`main.ts`** stays wiring only and is walked live, not unit-tested.

## Out of Scope

- Server-reported progress for any action: the determinate mode ships with no caller.
- Upload progress in the Movie form.
- **Scan new folders**: its own step.
- A renderer splash for a browser session.
- _Saved ✓_, the Sync row, the handoff's _danger_ / _info_ snackbars, a 10s unreachable state with _Try again_.
- Page and detail loads: they keep their **Skeletons**.

## Further Notes

- The trade-off is accepted: an action that runs past 300ms now waits up to 500ms more for its outcome; the rule is the point.
- The splash's mark is a second copy of the brand paths, in the shell; it changes only if the brand mark does.
- The maintainer approved every recommendation of log 53 in advance; this PRD adds no decision the log doesn't hold.
