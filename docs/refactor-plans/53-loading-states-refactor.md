# Refactor plan: Loading states, one import and one button form, the Delete dialog's words in one place, suites on one clock, and the docs that close step 36

> Source initiative: `loading-states`, issue 482 (step 36).
> Shipped by issues 483–489. The prototype lift is 483 `c2fb8fec`; the build
> slices, RED and GREEN each, are 484 to 489 (`cf9f6d00` to `cc601da5`).
> Design log: `docs/design-logs/53-loading-states.md`.
> PRD: `docs/PRDs/53-loading-states.md` (482). Plan:
> `docs/PRDs/53-loading-states-plan.md`.
> This is the initiative's closing round. It ticks **Loading states** and
> closes 482. Filed as issue 490.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`loading-states` shipped every phase of its plan. At `cc601da5` the full
suite has **11093 tests across 695 files, all passing**. `tsc -b --force` is
clean. `eslint src server electron` reports one error and 133 warnings, the
count Keep originals closed on: this initiative added none.

The design held. One hook, `useDelayedBusy`, owns the **Loader timing**, and
every in-flight state is a **Busy phase** under its old name (`saving`,
`clearing`, `deleting`, `resetting`, `testing`, `adding`, `exporting`).
`Button` takes `busy` and `busyLabel` on its button form only. `Modal` takes
`locked`. `LogoLoader` is an atom with the full `prim.LogoLoader` surface,
`DialogLoader` a molecule, and the three Delete dialogs and the Reset dialog
lock from the press and turn into it once **Shown**. The shell opens its
window over `splashPage` before the server's `ready`.

The seams are small, and mostly where the same thing is now said twice.
Every finding was checked against the code for this plan. They fall into
five families.

### 1. One type imported two ways, one button drawn twice

- **`BusyPhase` is imported from `@/types/busy` by `Button` and
  `useDelayedBusy`**, and from `@/types` by every feature that uses it. The
  barrel is how `src/` imports a shared type: 144 shipping imports read
  `@/types`, and the handful that name a file are the shell's bridge types.
  Every other primitive, component and hook in `src/` reads the barrel.
- **`useLibraryTitles` slots its `useDelayedBusy` import between its two
  wire imports** (`deleteMovie`, then the hook, then `deleteSeries`).
- **`Button` draws its button form twice.** An idle branch and a busy
  branch each spell `ref`, `type="button"`, the face and the glyph; they
  differ in `$busy`, `disabled`, `aria-busy`, `onClick`, the held width and
  whether the label sits in a `BusyLabel`.
- **`Button` reads the DOM during render.** The idle width is read off
  `rootRef.current.offsetWidth` in the render body as `busy` leaves `idle`,
  and written to a ref. It is the only render-time DOM read in `src/`; the
  one other measurement (`useDragScalar`) reads in an event handler. React's
  rule is that render stays pure; a layout effect is where a measurement
  belongs.

### 2. The Delete dialog's words, spelled in four places

`DeleteTitleBody`'s docblock says "Its words are `deleteView`'s", and
`deleteView` answers the heading, the subtitle, **What goes**, **What
stays** and the confirm. The two words this initiative added are not
there:

- **The failure line**, _Couldn’t delete “Coco”. Try again._, is a template
  in `DeleteTitleBody`.
- **The loader's label**, _Deleting “Coco”_, is a template in each of
  `DeleteTitleDialog`, `DeleteMovieDialog` and `DeleteSeriesDialog`.

### 3. Comments edited mid-line

- **`DeleteTitleBody`'s docblock** gained "a failed delete's line, then"
  inside a line and was never rewrapped (about 105 columns).
- **`titleDialog.styles`' docblock** likewise ("a failure's line and the two
  buttons. **What goes** beside", about 95 columns).
- **`DeleteTitleDialog`'s `deleting` prop** is a one-line docblock of about
  90 columns.
- **`splashPage`'s docblock** runs one line to 82 columns.
- **`LogoLoader` names its source `brand/familyflix-mark.svg`**;
  `splashPage`, which copies the same paths, names it in full,
  `docs/handoff/brand/familyflix-mark.svg`.

### 4. Seventeen copies of one clock, and suites that wait real time

- **`advance(ms)` is written seventeen times**, letter for letter: `act`
  around `vi.advanceTimersByTimeAsync(ms)`, in every `.busy*` suite, the
  `useDelayedBusy` suite and the `untouched` suite. No suite before this
  initiative had it.
- **A held `fetch` is written in each of them too**: a `fetchMock` whose
  answer is a promise kept open until `respond(response)` resolves it under
  `act`, sometimes answering the page's read first. The shape is the same in
  every suite; only the read it lets through differs. Earlier journals
  already carry "a shared held-response test helper" as a follow-up; this
  initiative is where the copies multiplied.
- **Seven cases in older suites wait real time** for a busy label: four in
  `MovieForm.test`, one in `MovieForm.showFolder.test`, one in
  `ExportModal.test` and one in `ManageLibrary.test`. Each was amended to
  assert the lock at once and then `waitFor` the _-ing_ label, which now
  takes 300ms of real clock and its 500ms hold. The plan's rule was that no
  test waits real time, and the `.busy*` suites already pin each label on
  fake timers; except two: `MovieForm.busySave`'s table has no **Series
  Resolve** / resolve row (_Save and continue_) and no show-folder add.
- **The suite headers number the phases wrong.** The headers of issue 487's
  suites (`LogoLoader`, `DialogLoader`, `Modal`'s locked block, `ResetDialog`
  and `useFactoryReset`) say _Phase 4_; 487 is phase 5, and 486's suites
  already say _Phase 4_.
- **Fifty-seven added lines carry an em dash**, every one in a test: the
  headers (`53 — Loading states, Phase 2 (issue #484)`), the `describe`
  titles (`Modal locked — no way out`, `useDeleteMovie — on the Loader
timing`) and one docblock clause in `ClearDialog.test`. Library audit's
  round settled the forms: `53, Loading states, …` and `Modal locked: no way
out`. No shipping line gained one.
- **`GlobalStyle.test`'s guard narrates its amendments** ("Amended by 53 —
  Loading states (issue #484): … Issue #487 adds the second"). A comment
  says what the guard allows and why, not which issue changed it.

### 5. The documents (log 53 Q22, and the plan's release smoke)

- **Feature checklist**: the row is still _Loading states — spinners and an
  FF loading overlay_, 🔜, and there is no step 36 entry.
- **README**: the folder tree names none of the new units: `LogoLoader`
  under `primitives/`, `DialogLoader` under `components/`, `useDelayedBusy`
  under `hooks/`, `busy.ts` under `types/`, `splashPage/` under
  `electron/`.
- **Release checklist**: the plan put the live walk (a slow series delete,
  a reset, a large copy-add, a cold start) in the release checklist as the
  **Loading states** smoke. It is not there.
- **Glossary**: the _Loading states_ section is still `(new)` and "Planned
  (🔜)".

## Solution

One round, in five groups, each commit leaving the suite green and the
typecheck clean:

1. **One import and one button form.** `BusyPhase` comes from `@/types`
   everywhere; `Button` draws its button form once and measures its idle
   width in a layout effect.
2. **The Delete dialog's words in `deleteView`.** The failure line and the
   loader's label join the view; the four places that spell them read it.
3. **Comments rewrapped**, and the brand mark named the same way twice.
4. **Suites on one clock.** `advanceClock` and `heldFetch` in
   `src/test-support/`, each with its test; the busy suites use them; the
   older suites stop waiting real time; the headers number their phases
   right and lose their dashes.
5. **The docs that close step 36.**

No behaviour changes. No wire, schema, Settings or prototype change. The
household sees nothing new.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [loading-states] issue #490 …`, except where a commit is named
`test:` or `docs:`.

### Group 1: one import and one button form

1. **`BusyPhase` comes from `@/types`.**
   - `Button` and `useDelayedBusy` import it from the barrel, as every
     feature does.
   - `useLibraryTitles` moves its `useDelayedBusy` import below its two wire
     imports, beside the file's other `@/` hook imports.
   - Imports only. Guarded by `tsc -b --force`.
2. **`Button` draws its button form once.**
   - One `Root` for the button form, its props chosen by the phase:
     `$busy`, `disabled` (busy, or the caller's `disabled`), `aria-busy`
     only while busy, `onClick` only while idle, the held width only while
     busy. The glyph is drawn once; the label is the plain text idle and the
     `BusyLabel` busy, as now.
   - The link form and the `ButtonProps` union are untouched.
   - Guarded by `Button.test` whole (the disabled, busy, glyph, link and
     state cases), unchanged, and by every caller's busy suite.
3. **`Button` measures its idle width in a layout effect.**
   - The width is state, read in a `useLayoutEffect` keyed on whether `busy`
     is `idle`: leaving `idle` it reads `offsetWidth` (the `waiting` face
     still draws the idle label, so the width is the idle one), and back at
     `idle` it clears. The render body reads no ref.
   - It runs before paint, so no frame draws without the held width.
   - Guarded by `Button.test`'s width case (`offsetWidth` stubbed: no
     `min-width` idle, the idle width held through `waiting` and `shown`,
     none again at `idle`), unchanged.

### Group 2: the Delete dialog's words in `deleteView`

4. **`deleteView` answers the loader's label and the failure line.**
   - `DeleteView` gains `loader` (_Deleting “Coco”_) and `failure`
     (_Couldn’t delete “Coco”. Try again._), each with a one-line docblock in
     the shape of its neighbours.
   - `DeleteTitleBody` draws `view.failure`; `DeleteTitleDialog` hands
     `DialogLoader` `view.loader`.
   - `libraryTitleView.test` gains both words for a film and a show, in the
     shape of its heading cases. Guarded otherwise by `DeleteTitleDialog.test`
     and `ManageLibrary.busyDelete`, unchanged.
5. **The page dialogs read their loader from `deleteView`.**
   - `DeleteMovieDialog` and `DeleteSeriesDialog` already build a
     `DeleteSubject` for `DeleteTitleBody`; each names it once and reads
     `deleteView(subject).loader` for its `DialogLoader`.
   - Their headings stay their own: their subtitle is _This can’t be
     undone._, not `deleteView`'s, as `page.MoviePage` and `page.SeriesPage`
     draw it.
   - Guarded by `DeleteMovieDialog.busy` and `DeleteSeriesDialog.busy`,
     unchanged.

### Group 3: comments rewrapped

6. **The docblocks this initiative edited mid-line are rewrapped** to 80
   columns: `DeleteTitleBody`, `titleDialog.styles` and `DeleteTitleDialog`'s
   `deleting` prop (two lines), and `splashPage`'s long line. `LogoLoader`
   names `docs/handoff/brand/familyflix-mark.svg`, as `splashPage` does.
   Older em dashes on lines only rewrapped are kept, Library audit's rule.
   Comments only.

### Group 4: suites on one clock

7. **`test: [loading-states] issue #490 advanceClock and heldFetch`.**
   - `src/test-support/advanceClock/`: `advanceClock(ms)` moves a faked
     clock on under `act` and lets every promise it frees settle. Its test
     pins that a timer due inside `ms` has fired and a state set by it has
     rendered, and one due after has not.
   - `src/test-support/heldFetch/`: `heldFetch(pass?)`, in `stubLocation`'s
     shape (called inside a `describe`, registering its own `beforeEach` and
     `afterEach`): `fetch` is stubbed so every request is held open, except
     one `pass(url)` answers with a response; it answers the mock, to read
     calls from, and `respond(response)`, which answers the latest held
     request under `act`. `afterEach` unstubs the global. Its test pins a
     held request staying open, `respond` settling it, `pass` answering a
     read at once, and the global restored after the block.
   - The hook suites use them: `useDelayedBusy` the clock alone, and the six
     feature hooks' both (`useLibraryFolders.busy`,
     `useLibraryTitles.busyDelete`, `useDeleteMovie.busy`,
     `useDeleteSeries.busy`, `useFactoryReset.busy`, `useTmdbKey.busy`).
   - Every assertion is unchanged; only the harness goes.
8. **`test: [loading-states] issue #490 the dialog suites on the shared clock`.**
   `ManageLibrary.busyDelete`, `ManageLibrary.busyClear`,
   `DeleteMovieDialog.busy`, `DeleteSeriesDialog.busy` and
   `ResetDialog.busy` drop their `advance` and held `fetch` for the two
   helpers (`ManageLibrary`'s two pass its list read). Assertions unchanged.
9. **`test: [loading-states] issue #490 the form and settings suites on the shared clock`.**
   `MovieForm.busySave`, `ExportModal.busyExport`,
   `LibraryFolders.busyAdd` and `NetworkSection.busyTest` likewise, each
   passing the reads its screen makes on mount; `SoftwareUpdateRow.untouched`,
   which holds its check on `fakeUpdateBridge`, takes the clock alone.
   Assertions unchanged. After this commit no suite defines its own
   `advance`.
10. **`test: [loading-states] issue #490 no suite waits real time for a busy label`.**
    - `MovieForm.busySave`'s table gains two rows: _Save and continue_ over
      a resolve (_Saving…_) and a show-folder add (_Adding…_), so every save
      the form makes has its label pinned on fake timers.
    - The seven older cases keep what they owned before this initiative,
      the lock: disabled at once, a second press sending no second request,
      and drop the real-clock `waitFor` on the _-ing_ label, which the
      `.busy*` suites now pin. Each case is renamed for what it asserts
      (_locks at once and takes no second press while the add is in
      flight_), and its comment says the label's timing is the busy suite's.
    - The commit body lists the seven cases and the busy case that carries
      each label.
11. **`test: [loading-states] issue #490 the suites name their phases`.** - Every header this initiative wrote reads `53, Loading states, Phase N
(issue #n): …`, with 487's suites corrected to _Phase 5_ and the
    splash suite's _Issue #489_ header in the same form (_Phase 7_).
    `describe` titles take a colon (`Modal locked: no way out`).
    `ClearDialog.test`'s clause takes a comma. - `GlobalStyle.test`'s guard keeps its assertions; its comment says the
    two allowed exceptions and why (a shown busy label and a beating mark
    must still say they are working when nothing may move), and its title
    drops the dash. - Headers of suites from earlier initiatives that this one only amended
    keep their own first line. - No code changes; every suite passes with the same count.

### Group 5: the docs

12. **`docs: [loading-states] issue #490 the docs know the loader`.**
    - **Feature checklist**: the row becomes _Loading states: the FF mark
      while an action runs_, ✅. A step 36 entry under step 35's, in its
      shape: where it came from (a slow save that sat on a grey button, a
      Delete that could be walked away from, a cold start that showed
      nothing) and what shipped: a quick action shows nothing, a slow one
      its _-ing_ label after a moment; a Delete or a Factory reset can't be
      dismissed once confirmed and shows the FF mark; a failed Delete says
      so; FamilyFlix opens its window at once on _Opening your library_.
    - **README**: the tree names `LogoLoader` (primitives), `DialogLoader`
      (components), `useDelayedBusy` (hooks), `busy.ts` (types) and
      `splashPage/` (electron, beside `loadRenderer/`).
    - **Release checklist**: a **Loading states** smoke, in the shell over
      a sandbox library: a cold start opens on the splash and the app loads
      over it; a large copy-add reads _Adding…_ and leaves after it; a long
      series' Delete locks, shows _Deleting “<title>”_ and lands with its
      snackbar; a Factory reset shows _Erasing everything_ and reloads; with
      Windows animations off, the mark and the shine fade, not freeze.
    - **Glossary**: the _Loading states_ section loses `(new)` and "Planned
      (🔜)". The dialogue is a snapshot and stays.
13. **`docs: [loading-states] issue #490 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape: what
    shipped, what each group changed, where the round left the plan, what
    was deliberately not changed, the follow-ups. The commit closes 482 in
    words, not with a keyword, and this issue with one.

## Decision Document

- **The barrel is how `src/` imports a shared type.** `@/types/busy` and
  `@/types` name the same `BusyPhase`; the codebase reads the barrel.
- **`Button` stays one component with two forms.** The busy face is the
  button form's phase, not a third form: folding the branches keeps the
  `ButtonProps` union as it is and removes the second spelling of the face.
- **The idle width is measured in a layout effect, as state.** It costs one
  render per action, before paint, and makes the render pure. The ref-in-
  render read was correct only because the `waiting` face happens to draw
  the idle label; the effect relies on the same fact, and says so.
- **`deleteView` owns every word the Delete dialog draws.** `DeleteTitleBody`
  already claimed it did. The page dialogs keep their own heading and
  subtitle, which are the page prototypes' words, not Manage library's.
- **Two test-support helpers, not one harness.** The clock and the held
  `fetch` are independent; a suite that holds nothing (`useDelayedBusy`)
  uses the clock alone. `heldFetch` takes `stubLocation`'s shape, the
  test-support convention for a stub scoped to a `describe`, and is named
  beside the server's `heldCopy`. Both live in `src/test-support/`, never
  imported by shipping code, each with its own test, as every unit there
  has.
- **A busy label's timing is pinned once, on fake timers.** The older
  suites owned the lock (no second request), which they keep; the label
  after 300ms and the hold are the `.busy*` suites'. Two rows join
  `busySave` so no save loses its label.
- **The `.busy` suite names stay.** `.busy` on a hook or dialog with one
  action, `.busy<Action>` on a page that has two or on a screen named for
  its control: renaming would cost the files' history for no reader.
- **Em dashes**: only those this initiative wrote; none is household copy.
- **Nothing on the schema, the wire, Settings, the shell's wiring or the
  prototype changes.**

## Testing Decisions

- **A good test asserts what a caller or the household sees**: the label
  drawn and when, whether a press or a dismissal does anything, the
  request sent, the status announced, when a promise settles. It never
  asserts which helper ran or how the harness is built.
- **The initiative's behavioural suites carry every refactor commit**:
  `useDelayedBusy`, `Button`, `LogoLoader`, `Modal`, `DialogLoader`,
  `splashPage`, every `.busy*` suite and `SoftwareUpdateRow.untouched`.
  Groups 1 to 3 change no assertion. Group 4 changes harnesses, not
  assertions, except commit 10, which removes seven real-clock label waits
  and adds two `busySave` rows that carry them, each named in the body.
- **New tests**: `libraryTitleView.test`'s two new words (commit 4), and the
  two helpers' own tests (commit 7). Prior art: `libraryTitleView.test`'s
  heading cases; `stubLocation.test` and `fakeResponse.test` for a
  test-support unit's test.
- **Characterization before change.** A suite that has to change anywhere
  else than named here is reading an implementation detail, and is fixed in
  the same commit with the reason in the body.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at one error and 133
  warnings, or fewer.

## Out of Scope

- **The Reset dialog's idle face between the hold and the reload.** A reset
  that lands sets the **Busy phase** back to `idle` before
  `location.assign('/')`, so the live _Erase everything?_ face is drawn,
  unlocked, while the page reloads; before this initiative `resetting`
  stayed true while the page went. It is a behaviour change, so it is a
  `fix:` of its own, filed separately, not a refactor commit. The Delete
  dialogs' leavings land in the same task as their `idle` and are not
  affected.
- **`useDeleteMovie` and `useDeleteSeries` as twins.** Each now also carries
  the `failed` flag, the same way; a shared hook would still be the first
  in `src/hooks/` to take a wire call as a parameter. Carried from Keep
  originals.
- **A danger-line primitive.** The Delete dialog's `Failure` and the Reset
  dialog's `Refusal` are one 13px danger line; twelve `styles.ts` files
  draw one. A primitive is its own round, beside the text-button one.
- **The splash's copies** of the tokens and the F paths, and
  `LogoLoader`'s: log 53 Q20 chose them, and `splashPage.test` holds the
  shell's copy to the brand file.
- **`LogoLoader`'s literal sizes** (`8px`, `14px`, `15px`): the primitives
  write theirs literally.
- **CLAUDE.md's barrel list** names four barrels while `src/types/index.ts`
  is a fifth, and older than this initiative: a CLAUDE.md edit of its own.
- **Server-reported progress**, upload progress in the Movie form, **Scan
  new folders**, and everything else log 53 put out of scope.
- **The frozen `handoff-loading-states/`.**

## Further Notes

- Group 4 is the round's reason to exist: seventeen suites carry the same
  clock and nearly the same held `fetch`, and seven older cases quietly made
  the suite slower by waiting on a real clock.
- Order: commit 2 before 3 (3 edits the one branch 2 leaves). Commit 4
  before 5. Commit 7 before 8 and 9; 10 after 9 (it adds rows to
  `busySave`, which 9 moves onto the helpers). Commit 11 after 7 to 10, so
  it rewrites only the headers that stay. Groups are otherwise independent.
- Follow-ups this plan already sees, each for the journal, not this round:
  - the Reset dialog's idle face before the reload, as a `fix:`;
  - a danger-line primitive;
  - CLAUDE.md's barrel list;
  - from earlier entries: `useDeleteMovie` and `useDeleteSeries` as one
    hook, the Delete routes as a domain step, a shared error-reason helper
    and a plural helper, a text-button primitive, the `routes.enrichment`
    409 case under load and the sandbox teardown flake, a shared
    player-harness test helper, the repo-wide em dash pass, the lint error
    in `EnrichmentReview.test.tsx`, and `libraryTitleView.test`'s _no
    callout_ key-list absence.
