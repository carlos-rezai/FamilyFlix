# Plan: Loading states, the FF mark while an action runs

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/482

Today an action's only sign of work is a label that swaps at once on a
greyed-out button: a quick action flashes, a slow one looks broken, a running
Delete or Reset can be dismissed, a failed Delete changes nothing, and a cold
start shows no window for several seconds. This initiative gives every action
one calm, honest sign of work in the FF mark, under one timing rule (nothing
for 300ms, then held at least 500ms), and opens the shell's window at once
over a static splash.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** No phase is
HITL.

- The handoff `docs/handoff/handoff-loading-states/` is already committed as
  received and stays frozen. Phase 1 lifts only `prim.LogoLoader.dc.html` to
  `docs/handoff/` and adds the spec rows, so it needs no Claude Design round.
  The PRD and log 53 fully specify every departure from the handoff (the
  app's words, the mask shine, the shell splash), so a phase never stops to
  ask.
- **Each phase stays well under a 100k-token context.** The prototype files
  are large (`COMPONENT-SPEC.md` about 96 KB, `FamilyFlix.dc.html` about
  142 KB, the handoff's `Loading States.dc.html` about 36 KB). A phase greps
  for the section it needs (`LogoLoader`, `shimmer`, `Deleting`, `splash`)
  and reads only that range. `electron/main.ts` is read whole only in
  phase 7.
- Every timing test runs on fake timers; no test waits real time. No test
  runs Electron, FFmpeg or TMDB.
- Log 53's slices 3 and 4 are each split in two so no issue outgrows one
  context, and `LogoLoader` lands with its first caller (`DialogLoader`) in
  phase 5 rather than in slice 2.
- The live walk of log 53's slice 6 (story 42: a slow series delete, a reset,
  a large copy-add, a cold start) is not a phase: it is the release
  checklist's **Loading states** smoke, walked by the maintainer before the
  release. The documents (story 41: the checklist's row _Loading states: the
  FF mark while an action runs_, the glossary's **Loading states** section
  moving from planned to shipped, **Delete dialog**, **Modal** and **Reset
  dialog** updated, the docblocks of every unit touched) are not a phase
  either: they are ticked ✅ only after the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none new, none changed. No migration, no wire change.
- **Key models**:
  - `BusyPhase` (`src/types/busy.ts`): `'idle' | 'waiting' | 'shown'`.
  - `useDelayedBusy()` (`src/hooks/`) answers `{ phase, run }` and exports
    `SHOW_AFTER_MS = 300` and `MIN_SHOWN_MS = 500`. `run(work)` sets
    `waiting` at once, `shown` at 300ms if the work still runs, and settles
    (passing the result or the error through) no sooner than 500ms after
    `shown`, then `idle`. Work settled before 300ms settles at once, never
    `shown`. `run` wraps the request only; the caller's outcome follows its
    promise.
  - Each feature's in-flight `useState(false)` becomes a `useDelayedBusy()`,
    keeping its name, now a `BusyPhase`: `saving`, `clearing`, `deleting`
    (three hooks), `resetting`, `testing`, `adding`, `exporting`.
  - `Button`, button form only (`busy?: never` on the link): `busy?:
BusyPhase` (`idle`), `busyLabel?: string` (`label`). `waiting`: disabled,
    `aria-busy`, idle label, the variant's face kept, `cursor: progress`.
    `shown`: `busyLabel` in an `aria-live="polite"` span with a `mask-image`
    shine in the button's own ink. The idle width is held as `min-width`
    while busy. `onClick` never fires while busy.
  - `LogoLoader` (`primitives/`, in the barrel): `size` (48), `progress` (0
    to 1), `tone` (`brand | current`), `tile`, `label`, `detail` (`NN%` with
    `progress`), `inline`; `role="status"`; a `url(#…)`-safe clip id from
    `useId`. Never drawn inside a button.
  - `Modal`: `locked?: boolean`; Escape and the scrim ask nothing, no ✕.
  - `DialogLoader` (`components/`): `{ label: string }`, a 64px `LogoLoader`
    with its label, `aria-busy`, inside a **Bare** `Modal`.
  - The delete hooks' failed flag: `deleteFailed` on `useLibraryTitles`,
    `failed` on `useDeleteMovie` and `useDeleteSeries`, cleared by the next
    confirm.
  - `splashPage` (`electron/`), a pure unit answering a `data:` URL of static
    HTML. The shell imports only types from `src/`.
- **Reduced motion**: the loader's beat and the button shine carry their own
  fade-only keyframes, with the specificity to beat `GlobalStyle`'s `*` rule;
  they never freeze. The loader's mount pop-in collapses like every other
  animation.
- **Copy**: _Save changes → Saving…_, _Add to library → Adding…_, _Clear
  details → Clearing…_, _Delete movie / Delete series → Deleting…_, _Erase
  everything → Erasing…_, _Test connection → Testing…_, _Add → Adding…_,
  _Export as CSV → Exporting…_. Dialog loaders: _Deleting “<title>”_,
  _Erasing everything_. The failure line: _Couldn’t delete “<title>”. Try
  again._ The splash: _Opening your library_. The handoff's _Save movie_,
  _Clear metadata_, _Delete folder_ are not used.
- **Unchanged throughout**: every action's successful outcome (its snackbar,
  leaving, close or reload); _Check for updates_; the Reset dialog's refusal
  sentence; page and detail loads keep their **Skeletons**; the frozen
  `handoff-loading-states/`.

---

## Phase 1: Prototype, lift the loader

**User stories**: 40, 41 (the spec)

### What to build

Lift `docs/handoff/handoff-loading-states/prototype/prim.LogoLoader.dc.html`
to `docs/handoff/prim.LogoLoader.dc.html`, as received. Add
`COMPONENT-SPEC.md` rows (grep for the `prim.Button` and `Modal` rows and
read only those ranges) for `prim.LogoLoader` (its full surface), `Button`'s
`busy` and `busyLabel`, `Modal`'s `locked`, and `mol.DialogLoader`, each in
the app's words and with log 53's departures (the mask shine in the
button's own ink, no step detail in the dialog loader). Leave
`handoff-loading-states/` as it is.

### Acceptance criteria

- [ ] `docs/handoff/prim.LogoLoader.dc.html` exists, byte-identical to the
      handoff's copy.
- [ ] `COMPONENT-SPEC.md` has rows for `prim.LogoLoader`, `mol.DialogLoader`,
      `Button`'s busy props and `Modal`'s `locked`.
- [ ] The rows use the app's labels, not _Save movie_, _Clear metadata_ or
      _Delete folder_.
- [ ] `handoff-loading-states/` is unchanged.

---

## Phase 2: A save that waits

**User stories**: 1 to 11, 16, 35, 37, 38

### What to build

The timing rule and the busy button, proven end to end on the Movie form's
save. `BusyPhase` and `useDelayedBusy` land as above. `Button` gains `busy`
and `busyLabel`: it locks at once on `waiting` with its variant's face and
width kept and a progress cursor, and on `shown` reads its `busyLabel`
politely with the shine sweeping across it (a fade under reduced motion).
`useMovieForm`'s `saving` becomes a `BusyPhase`, and the form's save
(every job, both kinds, the series edit included) passes it to its button:
_Adding…_ for an add, _Saving…_ for an edit, shown only after 300ms, and the
leaving waits out the hold.

### Acceptance criteria

- [ ] `useDelayedBusy`: `waiting` at once; work under 300ms settles at once
      and is never `shown`; `shown` at 300ms; a resolve or a reject after
      `shown` is held until 500ms after `shown`, then `idle`; the result and
      the error pass through.
- [ ] A `waiting` button is disabled and `aria-busy` with its idle label; a
      `shown` one draws `busyLabel` in a polite live region; `busyLabel`
      defaults to `label`; `onClick` never fires while busy.
- [ ] A busy button keeps its variant's face, not the grey disabled face,
      and keeps its idle width.
- [ ] The shine has a reduced-motion fade that `GlobalStyle` does not
      collapse.
- [ ] The Movie form's save draws its busy label only after 300ms, and the
      form leaves only after the hold, for an add and an edit of either kind.
- [ ] A double click on the save sends one request.

---

## Phase 3: Busy buttons in the Clear and Export dialogs

**User stories**: 12, 15, 27

### What to build

`clearing` and `exporting` become `BusyPhase`s, and the Clear dialog's
confirm and the Export dialog's confirm become busy buttons: _Clearing…_ and
_Exporting…_ after 300ms, each dialog's outcome waiting out the hold. Both
dialogs stay dismissable while they work: neither is locked.

### Acceptance criteria

- [ ] Clear's confirm locks at once and reads _Clearing…_ only after 300ms;
      the dialog closes only after the hold.
- [ ] Export's confirm locks at once and reads _Exporting…_ only after
      300ms; the export's outcome waits out the hold.
- [ ] Escape, the scrim and the ✕ still dismiss both dialogs while busy.

---

## Phase 4: Busy buttons in Settings

**User stories**: 13, 14, 17

### What to build

`useTmdbKey`'s `testing` and `useLibraryFolders`' `adding` become
`BusyPhase`s. _Test connection_ reads _Testing…_ and Library folders' _Add_
reads _Adding…_ after 300ms, their answer (the test's result, the new row
or the refusal line) waiting out the hold. _Browse…_ beside _Add_ is
disabled from the press until the add settles. _Check for updates_ is not
touched: its _Checking…_ keeps reporting the shell's update status.

### Acceptance criteria

- [ ] _Test connection_ locks at once, reads _Testing…_ after 300ms, and
      its result is drawn only after the hold.
- [ ] _Add_ locks at once, reads _Adding…_ after 300ms (it had no label
      change before), and the row or refusal appears only after the hold.
- [ ] _Browse…_ is disabled while an add runs and live again once it
      settles.
- [ ] _Check for updates_ behaves exactly as before.

---

## Phase 5: The loader and the Reset dialog

**User stories**: 19 to 21, 25, 26, 28, 34, 36, 39

### What to build

`LogoLoader` lands with its full surface, translating phase 1's prototype:
the two Fs take turns rising, or fill left to right with `progress` and draw
`NN%`; under reduced motion the beat fades instead of freezing, and the
mount pop-in collapses. `Modal` gains `locked`. `DialogLoader` draws a 64px
loader with its label inside a Bare `Modal`.

The Reset dialog is its first caller: `resetting` becomes a `BusyPhase`; the
dialog is locked and _Cancel_ disabled from the confirm press (in `waiting`
too) until the reset settles; once `shown` it becomes the dialog loader
reading _Erasing everything_. A reset that lands ends as it does today; a
refused one returns to the idle face with its own refusal sentence.

### Acceptance criteria

- [ ] `LogoLoader` is a `status` with its label; `progress` draws `NN%`;
      `tile`, `tone` and `inline` change what is drawn; two loaders on a
      page get distinct, `url(#…)`-safe clip ids.
- [ ] The loader's beat has a reduced-motion fade that `GlobalStyle` does
      not collapse.
- [ ] A `locked` `Modal` draws no ✕ and ignores Escape and the scrim; an
      unlocked one behaves as today.
- [ ] `DialogLoader` draws its label as a busy status.
- [ ] From the confirm press the Reset dialog can't be dismissed and
      _Cancel_ is disabled; after 300ms it shows _Erasing everything_.
- [ ] A reset that lands keeps its shipped outcome after the hold; a refused
      one shows its refusal sentence on the live idle face.

---

## Phase 6: The Delete dialogs

**User stories**: 18, 20 to 24, 26, 28

### What to build

The three Delete dialogs (Manage library, movie page, series page, through
`DeleteTitleBody`) take the Reset dialog's shape. `deleting` in
`useLibraryTitles`, `useDeleteMovie` and `useDeleteSeries` becomes a
`BusyPhase`; each dialog is locked and _Cancel_ disabled from the confirm
press until the delete settles, and once `shown` becomes the dialog loader
reading _Deleting “<title>”_, saying nothing about files. A delete that
lands ends as it does today. A delete that fails returns the dialog to its
idle face, live, with _Couldn’t delete “<title>”. Try again._ above the
buttons in the Reset dialog's refusal style; the hook's failed flag
(`deleteFailed`, `failed`) clears on the next confirm.

### Acceptance criteria

- [ ] Each Delete dialog can't be dismissed from the confirm press, with
      _Cancel_ disabled, and shows _Deleting “<title>”_ after 300ms.
- [ ] A delete that lands keeps its shipped outcome (snackbar, leaving,
      row gone) after the hold.
- [ ] A rejected delete returns the live idle face with the exact failure
      line; the title stays.
- [ ] Confirming again clears the failure line before the new attempt.
- [ ] The loader says nothing about removing files, for a linked or a
      copied title.

---

## Phase 7: The start-up splash

**User stories**: 29 to 33

### What to build

`splashPage` answers a `data:` URL of static HTML on `bg`: the 88px tile and
mark (the F paths copied from `docs/handoff/brand/familyflix-mark.svg`, the
accent as the token's value), the beat with its reduced-motion fade, and
_Opening your library_. `main.ts` stays wiring only: at `whenReady` it opens
the window over the splash and shows it, and when the server's `ready` lands
`loadRenderer` loads the app over it in the same window. A server that never
comes still reaches the 15s timeout and the **startupFailed** dialog (_Quit_
/ _Show data folder_). A browser dev session draws no splash.

### Acceptance criteria

- [ ] `splashPage`'s URL decodes to HTML carrying _Opening your library_,
      the mark's paths and a reduced-motion rule.
- [ ] The splash loads nothing from the network or the server.
- [ ] The window opens at `whenReady`, before the server's `ready`, and the
      app replaces the splash in the same window.
- [ ] A server that never starts still brings up the startupFailed dialog.
- [ ] `npm run dev` in a browser draws no splash.
- [ ] The shell's existing tests pass.
