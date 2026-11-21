# Plan: Busy overlay, a loader never moves what is around it

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/675

Each of the three action loaders that shifts its surroundings today is
redrawn so that nothing around it changes size or position as it appears or
goes: a **Busy row** draws a **Busy overlay** over the whole row, a **Busy
button** is always as wide as its wider label, and the **Dialog loader** is
drawn inside its dialog's own card. The spec is design log 71; the
loading-states handoff is amended first.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** Phase 8's walk is done by the agent itself in the dev app with each
write held open, as log 71's audit was made. No decision is left open: log
71 settled them all, approved in advance by the maintainer.

- The phases are log 71's _Implementation Plan_ slices, thinned: the
  prototype's amendment becomes its own phase 1; slice 2 splits into the
  import review's rows (phase 3) and the Season choice (phase 4); slice 4
  into one dialog end to end (phase 6) and the other three (phase 7).
- **Phases 2 to 7 each start from their own RED test** (`tdd`). Phase 1 is
  documents only, and phase 8's documents are proved by the walk and a green
  suite.
- **Phase 2 lays the shared overlay** phases 3 and 4 use; **phase 6 lays the
  `Modal` change** phase 7 uses. Phase 5 stands alone. All eight land before
  the next `npm version`.
- **Every existing test stays green after every phase**, except where a test
  asserted the face this initiative replaces (the slot loader, the second
  `Modal`, the held `min-width`); each such test is rewritten in its phase's
  RED commit, never deleted without a replacement.
- The glossary's **Busy overlay** section was written in the grill-me; the
  checklist's step 53 row stays 🔜 until the refactor. CLAUDE.md is
  untouched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: no migration.
- **Routes**: none new, no wire change, no server change.
- **Prototype**: `docs/handoff/handoff-loading-states/` amended in phase 1
  (README rows 3 and 5, the _Inside a row_ size, the rule _Lock the control,
  not the layout_ in the README and in `Loading States.dc.html`'s `rules`).
  No demo is redrawn; `screenshots/05-rules.png` keeps its old sentence. One
  new `mol.*`, `BusyOverlay`.
- **Key models**:
  - `BusyOverlay`, a molecule in the `components` barrel, one prop,
    `label: string`. It composes `LogoLoader` at `BUSY_ROW_LOADER_SIZE`
    (18px, `inline`) and knows no domain. Absolutely placed, `inset: 0`,
    `border-radius: inherit`, `cursor: progress`, a grid centring the
    loader; the scrim `rgba(20, 17, 13, 0.55)` under
    `backdrop-filter: blur(4px)`, fading in on `ffFade` 0.18s; the label the
    loader's 15/600 `text`.
  - `busyRow` makes a row's root `position: relative` at every phase; its
    opacity and cursor go. `busyRowLock` and `BUSY_ROW_LOADER_SIZE` are
    unchanged.
  - `Button`'s `busyLabel` contract and shine are unchanged; its face lays
    both labels in one grid cell, the one not drawn `visibility: hidden` and
    `aria-hidden`.
  - `Modal` takes `loader?: string`. Given, the card is `aria-busy`, its
    idle face (header and ✕ included) stays laid out but
    `visibility: hidden`, `DialogLoader` is drawn over it, and the card
    takes focus. Absent, `Modal` is unchanged.
  - `DialogLoader` keeps its `label` prop and becomes a layer: `inset: 0`,
    the 64px `LogoLoader` and label centred on `surface2`, no `Modal` of its
    own.
- **The rules**:
  - A loader never moves what is around it: it is drawn over what is busy,
    never in its flow.
  - **Loader timing**, the lock, `useBusyRow` and which presses are Busy are
    unchanged: `inert` and `aria-busy` from `waiting`, nothing drawn until
    `shown`, the 500ms hold after settling.
  - A Busy row's status slot keeps its content at every phase; the overlay
    is drawn last in the root while the row's label is set. A bulk press
    still hands its rows `waiting` and draws its one loader in its Busy
    button (log 69 Q10).
  - A dialog keeps one `Modal` in its tree; its card is never remounted
    across the loader coming or going.
  - The overlay sits inside the `inert` root, so its `status` stays out of
    the accessibility tree, as log 69's slot loader was.

---

## Phase 1: Amend the prototype

**User stories**: 40, 41

### What to build

The handoff draws what is about to be built. The loading-states README's
row 5 and its _Inside a row_ size describe the Busy overlay over the whole
row; row 3 says the Dialog loader keeps its dialog's size, drawn in the same
card; the rule _Lock the control, not the layout_ says how, stating _a
loader never moves what is around it_, in the README and in the prototype's
`rules`. No demo is redrawn.

### Acceptance criteria

- [ ] README row 5 and _Inside a row_ draw the overlay: scrim, light blur,
      18px inline loader and label centred, the row unmoved under it.
- [ ] README row 3 says the dialog keeps its size and is not remounted.
- [ ] The rule states _a loader never moves what is around it_ and how, in
      the README and in `Loading States.dc.html`'s `rules`, word for word
      the same.
- [ ] No demo, screenshot or other handoff folder is changed.

---

## Phase 2: One row, end to end

**User stories**: 1 to 7, 9 to 14, 42, 43

### What to build

The shared overlay and the first row through it. `BusyOverlay` draws the
scrim, the blur and the 18px loader with its label, centred. `busyRow`
makes every Busy row's root a containing block at every phase and drops the
dim and the cursor. The Decision row keeps its kind dot at every phase and,
once `shown`, draws `BusyOverlay` last in its root. Demo: on the Sync
review, with the pick route held open, the row reads _Saving match…_ past
300ms over the row, its title and posters unmoved, and nothing is drawn for
a save under 300ms.

### Acceptance criteria

- [ ] `BusyOverlay` draws its label with the 18px inline loader, adds no
      control and takes no focus.
- [ ] Decision row: at `idle` and `waiting` no overlay; once `shown`, the
      kind dot is still in the document alongside _Saving match…_.
- [ ] The lock is unchanged: `inert` and `aria-busy` from `waiting`, absent
      at `idle`.
- [ ] Every other Busy row still renders and its suite is green (their face
      changes in phases 3 and 4).
- [ ] The overlay fades rather than moves under reduced motion.

---

## Phase 3: The import review's rows

**User stories**: 15, 16, 18

### What to build

The Problem row and the Folder row draw `BusyOverlay` the same way. The
Problem row keeps its kind dot; the Folder row keeps its _N titles_ line and
never grows taller. A bulk press still leaves its rows `waiting`, locked and
quiet, with its one loader in its Busy button. Demo: on the Bulk import's
review, a held confirm or folder press shows the overlay over its row and
nothing beside it moves.

### Acceptance criteria

- [ ] Problem row: once `shown`, the kind dot and the overlay's label are
      both in the document; no overlay at `idle` or `waiting`.
- [ ] Folder row: once `shown`, the _N titles_ line and the overlay's label
      are both in the document; no overlay at `idle` or `waiting`.
- [ ] A bulk press draws no overlay on any row it covers.
- [ ] The lock on both rows is unchanged.

---

## Phase 4: The Season choice

**User stories**: 17

### What to build

The Season choice keeps its 112px held-poster caption at every phase and,
on `busy === 'shown'`, draws `BusyOverlay` over the card, so _Saving
poster…_ is never squeezed into the caption. Demo: on the Sync review, a
held season poster pick shows the overlay centred over the card, the
caption unwrapped under it.

### Acceptance criteria

- [ ] Once `shown`, the held-poster caption and _Saving poster…_ are both
      in the document; no overlay before.
- [ ] The lock is unchanged.
- [ ] No Busy row draws a slot loader any more; the slot-loader code is
      gone.

---

## Phase 5: The Busy button

**User stories**: 19 to 25, 44

### What to build

A Busy button is always as wide as its wider label. Its face lays out its
label and its `busyLabel` in one grid cell, the one not drawn hidden and
`aria-hidden`; the held-width measure (its state, its layout effect, its
ref) goes. The shine stays on the busy label. A button without a
`busyLabel` is as today. Demo: _Add_ beside the folder field, _Skip all_
and an Export's button keep one width as they become _Adding…_,
_Skipping…_, _Exporting…_.

### Acceptance criteria

- [ ] With a `busyLabel`, both labels are in the document at every phase
      and exactly one is `aria-hidden`.
- [ ] The accessible name is the visible label: the idle label at `idle`
      and `waiting`, the busy label at `shown`.
- [ ] Without a `busyLabel`, the button renders as today.
- [ ] The Button primitive holds no ref, no layout effect and no measured
      width.

---

## Phase 6: The Dialog loader, through one dialog

**User stories**: 26 to 35, 37, 45

### What to build

`Modal` takes `loader`: given, the card is `aria-busy`, its idle face stays
laid out but hidden, `DialogLoader` is drawn over it, and the card takes
focus. `DialogLoader` becomes that layer, with no `Modal` of its own. The
_Delete movie_ dialog drops its early return of a second dialog for its one
`Modal` with `loader` set once **Shown**; on a failure its confirmation and
error come back in the same card. The focus trap's ring must skip the
hidden face's buttons, which a plain focusable query still matches. The
Export dialog's **Export ready** face is untouched. Demo: on a movie's
detail page, a held delete shows the loader in the dialog's own card at
its own size, with no second pop-in; a failed delete shows the
confirmation again in that card.

### Acceptance criteria

- [ ] `Modal` with `loader`: the card is `aria-busy`, the loader's label is
      drawn, the idle face is in the document but out of the accessible
      tree, and focus is on the card.
- [ ] Tab and Shift+Tab stay inside the card and never land on a hidden
      button.
- [ ] Escape and a press on the scrim ask nothing while `locked`.
- [ ] Going from no `loader` to a `loader` and back keeps the same card
      element.
- [ ] `Modal` without `loader`, `bare` included, behaves as today.
- [ ] `DialogLoader` draws its 64px loader and label and no dialog of its
      own.
- [ ] _Delete movie_: once Shown, one dialog on screen with the loader's
      label and the confirmation hidden; on a failure the confirmation and
      its error return in the same dialog.

---

## Phase 7: The other three dialogs

**User stories**: 36

### What to build

_Delete title_, _Delete series_ and _Reset_ drop their early return of a
`DialogLoader` for their one `Modal` with `loader` set once **Shown**, as
_Delete movie_ did. The lock is unchanged. Demo: each, with its write held
open, keeps its card and size as its loader shows, and a failure returns
its confirmation in the same card.

### Acceptance criteria

- [ ] Each of the three: once Shown, one dialog on screen with the loader's
      label and the confirmation hidden.
- [ ] Each of the three: on a failure, the confirmation and its error
      return in the same dialog.
- [ ] No dialog in the app renders `DialogLoader` outside a `Modal`'s
      `loader`.

---

## Phase 8: Walk it live, then the documents

**User stories**: 38, 39, 46

### What to build

The acceptance walk in the dev app, each write held open: every Busy row
(Decision, Problem, Folder, Season choice), every Busy button that grew
(_Add_, _Skip all_, _Exporting…_) and the four dialogs, with a row's box, a
button's width and a dialog card's box measured before and after **Shown**.
The faces log 71 left alone (_＋ Add show folder_, the Component drop zone,
the Player notice, the splash and Welcome hold, the Skeletons, the live
logs) are checked unchanged. Then the documents: `COMPONENT-SPEC.md`'s new
`BusyOverlay` section and its `DialogLoader` and `Modal` sections; the
checklist's step 53 entry, widened to the three faces; the docblocks of
every unit touched.

### Acceptance criteria

- [ ] Every measured box and width is identical before and after **Shown**
      and after the loader goes.
- [ ] Every face left alone behaves as before.
- [ ] `COMPONENT-SPEC.md` has a `BusyOverlay` section, and its
      `DialogLoader` and `Modal` sections describe the layer and `loader`.
- [ ] The checklist's step 53 entry names the three faces and stays 🔜.
- [ ] Every touched unit's docblock describes its new face; none still
      mentions the dim, the slot loader, the held width or a second `Modal`.
- [ ] The full suite and the typecheck are green.
