# Refactor plan: Busy overlay, each hidden layer's facts stated once, the Dialog loader's guard on the shared scan, and the docs that close step 53

> Source initiative: `busy-overlay`, issue 675 (step 53).
> Shipped by issues 676 to 683: the prototype's amendment, six slices, RED
> and GREEN each, and the walk and documents slice (`86f8a07d` to
> `888f2313`).
> Design log: `docs/design-logs/71-busy-overlay.md`.
> PRD: `docs/PRDs/71-busy-overlay.md` (675). Plan:
> `docs/PRDs/71-busy-overlay-plan.md`.
> Handoff: `docs/handoff/handoff-loading-states/`, amended by issue 676; no
> further amendment here.
> This is the initiative's closing round. It ticks **Busy overlay** and
> closes 675. Filed as issue #684.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`busy-overlay` shipped every phase of its plan. `BusyOverlay` is drawn last
in every **Busy row**'s root, the status slots keep their dot, line and
caption, and `busyRow` is a containing block at every phase. A **Busy
button** lays both its labels in one cell, and its measured `min-width` is
gone. `Modal` takes `loader`, `DialogLoader` is its layer, and the four
Delete and Reset dialogs keep one `Modal` each. The walk measured every
row's box, every grown button's width and every dialog card's box before,
at and after **Shown**: none moved.

At `888f2313` the full suite has **13043 tests passing across 909 files**
(one skipped), and `tsc -b --force` is clean. `eslint` over every `src/`
file the initiative touched reports **0 errors and 0 warnings**.

The design held, and the build is small. What is left is what one build
across three faces leaves behind: one fact written three ways at the two
new hidden layers, a structural guard that re-implements the shared source
scan it sits beside, a few comments, and the documents, one of them missing
outright. Every finding below was checked against the code at `888f2313`.
They fall into four families.

### 1. A hidden layer says it is hidden three times

- **`Modal`'s idle face spells one fact three ways.** Its `Face` takes
  `$hidden={busy}`, which the style reads for `visibility`, and beside it
  `aria-hidden={busy ? 'true' : undefined}` and `inert={busy}`. The three
  always move together; nothing reads one without the others. Log 69's
  refactor settled where such a pair lives: `busyRowLock`, a styled
  `attrs` function that turns `$busy` into `inert` and `aria-busy` beside
  the face it locks, so the call site passes the phase alone.
- **The two spellings of a falsy attribute disagree.** `inert={busy}`
  passes `false` at idle; `busyRowLock`, the app's one other `inert`, passes
  `undefined` (`|| undefined`), as every busy `aria-*` does (`? 'true' :
undefined`), so nothing is written. Both render the same in React 19;
  only one is the house style.
- **`Button`'s label cell does the same, twice.** Each `LabelLayer` takes
  `$hidden` for `visibility` and, beside it, an `aria-hidden` computed from
  the same boolean: `aria-hidden={shown ? 'true' : undefined} $hidden={shown}`
  and its mirror. `LabelLayer`'s `$hidden` is optional and read as
  `$hidden === true`; `Face`'s is required and read as a ternary, for the
  same job.
- **`Modal`'s `busy` is declared between its effects**, under a comment
  for the effect that follows it, where every other derived value in the
  app's components sits at the top of the body beside `titleId` and the
  ref.

### 2. The Dialog loader's guard re-implements the shared scan

- **`DialogLoader.onlyInModal.test` walks the source tree by hand.** It
  writes its own recursive `shippingTsx` over `readdirSync` and
  `statSync`, joins its owner paths with the platform `sep`, and reads
  every file raw. `test-support/shippingSources/` already answers this
  question for every other structural guard (`useCardPreferences`,
  `useGoBack`, `GlobalStyle`, `interactionStates`, `brand`, `main`):
  shipping files by forward-slash path, tests and `test-support/` left
  out, and `withoutComments` so that a docblock naming the guarded pattern
  is not a hit.
- **Without `withoutComments` the guard fails on prose.** A docblock that
  wrote `` `<DialogLoader label=… />` `` (as log 71 Q10 itself does) in any
  dialog would fail the first case; the shared helper exists because an
  earlier guard did exactly that.

### 3. Comments

- **`DeleteTitleDialog`'s docblock runs to 108 columns** on the line issue
  682 rewrote (Prettier leaves comments alone).
- **`Button`'s `busyLabel` docblock** still reads _the -ing form drawn once
  `shown`_ and says nothing of the one cell, which is now what decides the
  button's width at every phase. `BusyLabel`'s styles docblock does not
  say it is a `LabelLayer`, nor why it keeps `aria-live` when hidden (the
  reduced-motion rule keys on `[aria-live]`).

### 4. The documents

- **The build has no journal entry.** Every build before it (silent waits,
  video quality) wrote _the build_ in its walk slice; issue 683's commit
  carries the walk's measurements in its message but never touched
  `docs/dev-journal.md`.
- **The README's `components/` line** names `DialogLoader` as _a Locked
  dialog's face once its loader shows_ and does not name `BusyOverlay`;
  its `styles/` line does not name `busyRow` (log 69 added it); its
  frontend `test-support/` line does not name `visibleLabel` or
  `shownText`.
- **`COMPONENT-SPEC.md`'s `BusyOverlay` section** ends on one unwrapped
  line of some 300 characters, where every other section wraps at the
  file's width.
- **The glossary's Busy overlay section** updates the **Busy row**, the
  **Busy button** and the **Dialog loader**, but not **Modal**, whose
  row still describes a header over a body and no `loader`.
- **The feature checklist's row** reads _Busy overlay: a row's loader over
  it, not beside it_, ⬜ Planned, naming one face of three; step 53 is 🔜.

## Solution

One round in four groups, each commit leaving the suite green and the
typecheck clean:

1. **Each hidden layer states its facts once**: `Modal`'s `Face` and
   `Button`'s `LabelLayer` each take an `attrs` function, as `busyRowLock`
   does, so `$hidden` alone gives `visibility`, `aria-hidden` and (for the
   face) `inert`.
2. **The Dialog loader's guard on `shippingSources`**, comments aside.
3. **Comments**: the long line, `busyLabel`'s and `BusyLabel`'s docblocks.
4. **The documents**: the README, the spec's wrap, the glossary's
   **Modal**, the build's missing journal entry, and the entry and ticks
   that close step 53 and issue 675.

## Commits

Every commit is `refactor:` (or `docs:` / `test:` where it says so), titled
`refactor: [busy-overlay] issue #<n> <description>` with `<n>` this plan's
issue. Each runs the suites of the units it touches; each group ends on the
full suite and `tsc -b --force`. No test is weakened, and no test changes
in groups 1 and 3: the existing `aria-hidden`, `inert`, focus-ring and
`visibleLabel` assertions are the proof that the move kept the behaviour.

### Group 1: each hidden layer states its facts once

1. **`Modal`'s face hides itself from `$hidden`.** `Modal.styles.ts`'s
   `Face` takes `.attrs` from its `$hidden`: `aria-hidden` `'true'` and
   `inert` `true` when hidden, both `undefined` otherwise, in the house's
   `|| undefined` shape. Its docblock says the face is laid out but unseen,
   unread and off the Tab ring, one prop for all three. `Modal` passes
   `$hidden={busy}` alone; its hand-written `aria-hidden` and `inert` go.
   `Modal.loader.test`, `Modal.test` and the four dialogs' suites stay
   green unchanged (the ring's `aria-hidden` filter still finds the face).

2. **`Modal`'s `busy` beside its other derived values.** The
   `const busy = loader !== undefined` moves to the top of the body with
   `titleId` and `cardRef`, docblocked as _a **Dialog loader** is drawn_;
   the comment above the second focus effect keeps only what that effect
   does. No behaviour moves.

3. **`Button`'s label layer hides itself from `$hidden`.**
   `Button.styles.ts`'s `LabelLayer` takes `.attrs` from a required
   `$hidden: boolean`, giving `aria-hidden` as `Face` does, and reads it for
   `visibility` in the same ternary shape as `Face`. The two layers in the
   cell pass `$hidden` alone; the fallback `BusyLabel` (a busy button with
   no `busyLabel`) passes `$hidden={false}`. `BusyLabel` still extends
   `LabelLayer` and keeps `aria-live`. `Button.test`, `visibleLabel.test`
   and every feature suite reading `visibleLabel` or `shownText` stay
   green unchanged.

### Group 2: the Dialog loader's guard on the shared scan

4. **`test:` `DialogLoader.onlyInModal` on `shippingSources`.** The
   hand-written `shippingTsx`, `statSync`, `relative` and `sep` go. The
   guard reads `shippingSources(SRC)` filtered to `.tsx` and outside the
   two owners (`components/Modal/`, `components/DialogLoader/`, by
   forward-slash path), each file's text through `withoutComments`. The
   first case (_no dialog draws `<DialogLoader` of its own_) becomes
   `shippingSourcesMatching` over the same set; the second (_a file that
   passes `loader=` holds exactly one `<Modal`_) counts on the
   comment-stripped text. Both cases keep their names and stay green;
   a hit still names its file.

### Group 3: comments

5. **Docblocks.** `DeleteTitleDialog`'s long line rewrapped. `Button`'s
   `busyLabel` docblock: _laid out with the label in one cell, so the
   button is as wide as the wider of the two at every phase; drawn once
   `shown`, with a shine_. `BusyLabel`'s styles docblock names it a
   `LabelLayer` and says its `aria-live` stays while hidden because the
   reduced-motion rule keys on it. No code moves.

### Group 4: the documents

6. **`docs:` the README and the spec's wrap.** The README's `components/`
   line names `BusyOverlay (a Busy row's face once Shown)` and
   `DialogLoader (the layer Modal's loader draws)`; its `styles/` line
   names `busyRow` (a **Busy row**'s containing block, lock and loader
   size); its frontend `test-support/` line names `visibleLabel` and
   `shownText`. `COMPONENT-SPEC.md`'s `BusyOverlay` section's last
   sentence is wrapped to the file's width, no word changed.

7. **`docs:` the glossary's Modal.** The Busy overlay section gains a
   **Modal** (updated) row: since log 71 it takes `loader`, the
   **Dialog loader**'s label; given, the card is `aria-busy` and focused,
   its idle face laid out but hidden, the loader drawn over it, the card
   never remounted.

8. **`docs:` the build's journal entry.** _2026-11-21: Busy overlay, the
   build (issues 676 to 683)_, placed before this round's: what each slice
   shipped, the walk's measurements as issue 683's commit recorded them
   (each row's box, each grown button's width, each dialog card's box,
   before, at and after **Shown**), the faces left alone and checked, and
   the two the walk did not reach (the **Start-up splash**, shell only, and
   the **Player notice**). Its counts are the ones this plan records at
   `888f2313`.

9. **`docs:` step 53 is done.** The feature checklist's row is retitled
   _Busy overlay: no loader moves what is around it_ and reads ✅ Done;
   step 53 reads ✅. The dev journal gains this round's entry: counts
   before and after, what each group changed, where the round left the
   plan, and the follow-up below. The commit's body closes 675.

## Decision Document

- **A layer's hidden face is one prop.** `$hidden` on a styled unit gives
  every attribute that goes with it through `.attrs`, beside the
  `visibility` it reads, as `busyRowLock` gives `inert` and `aria-busy`
  from `$busy`. The call site passes one boolean; it cannot hide a layer
  from sight and leave it in the accessible tree.
- **Per unit, not a shared helper.** `Face` (a molecule's style) adds
  `inert`, for its buttons; `LabelLayer` (an atom's style) has nothing
  focusable and adds `aria-hidden` alone. Two four-line `attrs` in two
  rungs do not earn a `styles/` module; a third hidden layer would.
- **A falsy attribute is `undefined`, never `false`**, so nothing is
  written at idle: the shape of `busyRowLock`, `Button`'s `aria-busy` and
  `Modal`'s own `aria-busy`.
- **A transient boolean prop on a style is required** where its one
  caller always knows it, as `Face`'s `$hidden` and `busyRow`'s `$busy`
  are; `LabelLayer`'s follows.
- **Every structural guard reads the tree through `shippingSources`.** No
  guard walks the filesystem itself or matches inside comments.
- **Unchanged, as settled by log 71:** `Modal`'s `loader?: string` (not a
  `BusyPhase`), `DialogLoader` in the `components` barrel (every unit there
  is), `BUSY_ROW_LOADER_SIZE` in `styles/busyRow.ts` (read by
  `BusyOverlay` and _＋ Add show folder_), the overlay inside the `inert`
  root.
- **No route, no wire, no schema, no prototype, no visible change.**

## Testing Decisions

- A good test drives a unit through its public face and checks what the
  household would see, hear or be able to press: which label is shown and
  which is hidden from assistive technology, where focus is and where Tab
  can go, whether a dialog's confirmation is still in the document. It
  never checks a styled-component's class or which `attrs` function ran.
- **Groups 1 and 3 change no test.** The pins already in place are the
  proof: `Modal.loader.test` (the face out of the accessible tree, focus on
  the card, Tab never landing on a hidden button, the same card across the
  change), `Button.test`'s busy cases (both labels in the document, exactly
  one `aria-hidden`, the accessible name the visible one), and the feature
  suites that read `visibleLabel` and `shownText`.
- **Group 2 rewrites one guard's body, not its claims.** Prior art: the
  guards in `useCardPreferences.test`, `useGoBack.test` and
  `interactionStates.test`, all on `shippingSources` or
  `shippingSourcesMatching`.
- **No walk.** Nothing drawn or announced changes; issue 683's walk
  stands. The full suite and `tsc -b --force` close each group, and
  `eslint` over the touched files stays clean.

## Out of Scope

- **Whether a Busy label is still announced.** Before log 71 the
  `aria-live` label mounted at `waiting` reading the idle label and its
  text changed to the busy label once `shown`; now it is mounted with the
  busy label from the start, `aria-hidden` until `shown`. A live region
  announces a change of content, so a screen reader may no longer read
  _Adding…_ out. jsdom cannot tell, and the walk ran no screen reader. It
  is a behaviour question, not a refactor: recorded in the journal as a
  follow-up for a grill and a check with a screen reader.
- **The `rgba(20, 17, 13, …)` glass literals**, eleven in ten files
  (`BusyOverlay`, the **Player notice**, `PlayerControls`, `BackButton`'s
  `GLASS` and others) as a token: older than this initiative, and a
  palette change of its own.
- **`Modal` taking a `BusyPhase`** so the four dialogs stop writing
  `loader={x === 'shown' ? label : undefined}` beside `locked={x !==
'idle'}`: log 71 Q10 settled `loader?: string`, and `bare` dialogs and
  callers with no phase would pay for it.
- **The dialogs' busy suites' parallel helpers** (`dialog`, `liveDialog`,
  `loader`, `pressDelete`, `failOnce`): each suite's own, over a different
  dialog and route, as the house writes them.
- **The five suites that read a Busy label through
  `[aria-live="polite"]`**: they pin the live region's text, which is
  behaviour, and `visibleLabel` answers a different question.
- **Moving the lock off a Busy row's root** so the overlay's `status`
  reaches the accessible tree (log 71, kept as is).
- **`DeleteSeriesDialog`'s 81-column docblock line** and every long
  comment line this initiative did not add.

## Further Notes

- Groups 1 to 3 are independent of each other; group 4's commits 8 and 9
  come last, since 9 records this round's counts.
- Commits 1 and 2 touch the same file and may be squashed if the second
  turns out trivial.
- Nine commits; the build was small and held, and the round is mostly the
  documents a closing round always writes.
