# Plan: Snackbar system — the transient bottom-right notice, its stack and its one timing rule

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/158

Every screen in FamilyFlix answers in place, and there is no surface that
speaks across a route. The **Software update** flow (`17-software-update`)
needs one — an **Update offer** that reaches whoever is in front of the
television wherever they are, and two check outcomes the row that asked cannot
draw — and log 17 Q32 pulled it out to run first, alone, under no Electron
gate. This initiative builds it: the prototype's `mol.Snackbar` translated 1:1
as an inert molecule, and the stack, the queue and every timer as app-level
furniture in `App/`, reached through one hook with two functions.

It ships with **no caller**. That is the one real cost of the reordering, and
it shapes every phase below: the proof is the tests, and the tests assert the
_rule_ a future caller will meet — which notices are on screen, in what order,
after what elapsed — never the implementation underneath.

The slicing puts the drawing first, then the queue as a tracer bullet with its
one timing rule, then the exception to that rule, then the docs:

**the prototype amended** (Phase 0) → **the molecule** (Phase 1) →
**`notify` lands a card that dies at 5s** (Phase 2) → **the action persists,
and pressing it dismisses then runs** (Phase 3) → **docs and the refactor
filing** (Phase 4).

Phase 1 is the one deliberately non-vertical slice — a molecule with no
consumer — kept separate so there are two clean RED steps: one that renders a
card and reads it, one that runs a queue and watches the clock. Phase 2 is the
tracer bullet: from Phase 2 on, a consumer anywhere under `App` can call
`notify` and see a card land in the corner.

## Three things settled before any phase

- **The molecule knows nothing and owns nothing.** No timer, no `useEffect`,
  no idea it is transient. It is handed props and draws them, and the thing
  that unmounts it is the stack. That line is what makes the whole system
  testable in two files, and it is drawn in Phase 1 and never crossed.

- **One timing rule, and no knob.** A notice carrying an action **persists**
  until it is actioned or dismissed; every other notice **dies at 5s**. The
  `SnackbarNotice` type carries no `duration` and no `dismissible` — its
  `action`'s presence _is_ the timing. Log 17's sketch had `duration?`; this
  initiative owns the interface, and it is dropped.

- **Nothing existing changes.** Not one of the six screens that refused a
  snackbar is reopened, and the stack is never suppressed or re-parented by a
  route — including inside the fullscreen player, where a notice raised behind
  the surface simply waits on the other side.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** None. No HTTP route, no schema change, no `src/types/` entry:
  no route will ever see a snackbar, so the variant and props types come off
  the molecule through the `components/` barrel and the notice type off
  `useSnackbar`. The only "route" concern is the React one: the provider sits
  **above the route table**, so no screen can be the reason a notice did not
  appear.

- **The tree.**

  ```
  ThemeProvider
  └── GlobalStyle
      └── SnackbarProvider        ← src/App/SnackbarProvider/
          ├── Routes              ← its children
          └── the stack           ← always mounted, empty or not
  ```

  `App.tsx` does **not** move into a folder of its own; `src/App/` is already
  App's folder and simultaneously the category the two new units join. There
  is **no barrel** at this rung — `App/useSnackbar/` and
  `App/SnackbarProvider/` are imported by path, on `api/`'s and
  `test-support/`'s precedent.

- **Key models.**

  - **The molecule's props**, flat and 1:1 with the prototype's `data-props`
    in its order: `variant` (`info` | `success` | `warning` | `error`,
    required), `title?`, `message` (required), `actionLabel?` + `onAction?`,
    `dismissible?` (default `true`), `onDismiss?`.
  - **`SnackbarNotice`** — `{ variant, title?, message, action? }` with
    `action: { label, onClick }`. Nested on purpose, unlike the molecule's
    flat pair: a label with no handler is meaningless to a queue that must
    wire the dismissal to it. Named `SnackbarNotice`, not `Notice` —
    **Player notice** is already a glossary term.
  - **`useSnackbar()`** → `{ notify, dismiss }`. `notify(notice)` answers the
    `number` id it can be retracted by; `dismiss(id)` is harmless against an
    id already gone. Both close over no state and update through functional
    `setState`, so the context value is memoised once and **never changes
    identity**. Outside a provider the hook **throws**, naming itself.
  - **Ownership.** `useSnackbar/` owns the context object; the provider
    imports it and supplies its value. One direction, provider → hook, so a
    consumer never pulls the provider's styles in behind the hook.

- **Geometry, 1:1.** The card: 360px, `max-width: calc(100vw - 48px)`,
  `surface-2`, 1px `border`, `md` radius, `0 16px 44px rgba(0,0,0,.5)`, a 4px
  accent bar down the left, `ffSnackIn .26s ease` (already in `GlobalStyle`).
  The stack: `position: fixed`, `right: 24px`, `bottom: 24px`,
  `z-index: 200`, `column-reverse`, `gap: 12px`, `align-items: flex-end`,
  `pointer-events: none` with each card's wrapper restoring `auto`. The
  prototype's `absolute` becomes `fixed` for the reason the Modal's scrim did;
  200 clears the scrim at 90 and the header at 40. **No portal** — the
  provider sits directly inside `App`, and `position: fixed` there has
  nothing to escape.

- **Roles.** `role="status"` for `info` and `success`, `role="alert"` for
  `warning` and `error`, on the **cards alone** — the stack container carries
  no live-region attribute. The ✕ is `aria-label="Dismiss"`; the glyphs are
  `aria-hidden`. The variant → colour map is `info` → `info`, `success` →
  `success`, `warning` → `warning`, `error` → **`danger`**; both names stay.

- **The stack's `data-testid`.** The **first in shipping code** in this repo,
  accepted as the cheaper of two costs: the App-level mount test needs a
  queryable handle for an empty roleless div, and the alternatives — an
  `aria-label` on a roleless node, `aria-live` on the container, a probe
  mocked into a route, or a `children` prop on `App` — each shape semantics
  or shipping code around a test.

- **Order.** Notices are **appended**; DOM order is oldest-first and
  `column-reverse` puts the newest nearest the corner. Ids are a `useRef`
  counter, monotonically increasing — not `crypto.randomUUID`, not `useId`.

- **What is not built, in any phase.** A caller; a `types/snackbar.ts`; a
  `test-support/` double; a portal; a cap, dedupe or coalescing; a per-notice
  duration; an exit animation; `prefers-reduced-motion`; Escape-to-dismiss;
  hover-to-pause; route-based suppression; and any line of log 17's copy
  table.

---

## Phase 0: The prototype amended

**User stories**: 34

### What to build

The prototype is the spec, so it is amended before anything is built. One
amendment, inherited from log 17's amendment 2: in `FamilyFlix.dc.html`,
`checkForUpdates()`'s _You're on the latest version._ confirmation carries
`duration: 4000`, and becomes `5000`. It moves to this initiative because it
is the Snackbar's one timing rule that it makes consistent. Log 17 keeps its
amendment 1.

### Acceptance criteria

- [ ] `FamilyFlix.dc.html`'s `checkForUpdates()` pushes its success
      confirmation with `duration: 5000`
- [ ] No other line of the prototype changes — `mol.Snackbar.dc.html` and the
      container's `pushSnack`/`dismissSnack` are untouched

---

## Phase 1: The molecule

**User stories**: 4, 10, 11, 12, 13, 20, 21, 25, 26, 27, 28, 29, 32

### What to build

The card, inert, proven by rendering it.

Four new glyphs in `primitives/Icon/` on the shared `IconBase` frame — a
circled `i`, a circled tick, a triangle with a bang, a circled ✕ — paths
copied from `mol.Snackbar.dc.html`'s SVG and named for **what they draw**,
because a primitive knows nothing about the domain. Not a reuse of the
existing tick, which is the watched toggle's bare tick and a different shape.
Each gets a test on the `UploadIcon` precedent, which amends log 18 Q10. All
four are re-exported from the `primitives/` barrel.

`components/Snackbar/` — the molecule, its test and its styles, re-exported
from the `components/` barrel with its props and variant types. 1:1 with the
prototype: the accent bar, the glyph wrapper in the variant's colour, the
optional bold title over the dim message, the optional bordered action
button, the molecule's **own** 28px ✕ (not `RemoveButton`, which names itself
_Remove <thing>_ and turns the danger colour — `Modal`'s `CloseButton` is the
precedent), and `ffSnackIn` on entry. The role is by variant, which amends the
prototype's flat `role="status"` per log 17 Q20. The molecule has no timer, no
effect, and no idea it is transient.

### Acceptance criteria

- [ ] Each of the four variants draws its own glyph and carries its own role:
      `status` for `info` and `success`, `alert` for `warning` and `error`
- [ ] The accent bar, the glyph and the action button's border all take the
      variant's colour, with `error` reading the `danger` token
- [ ] A `title` draws the bold line above the message; no `title` draws no
      line at all
- [ ] The `message` is always drawn
- [ ] An `actionLabel` draws a button carrying those words, and pressing it
      asks `onAction`; no `actionLabel` draws no button
- [ ] The ✕ is present by default, announces itself as **Dismiss**, is
      reachable by Tab, and asks `onDismiss` when pressed; `dismissible={false}`
      draws no ✕
- [ ] The glyph is `aria-hidden`, so the picture is not a second sentence
- [ ] The card is 360px with `max-width: calc(100vw - 48px)`, so a narrow
      window shrinks it rather than scrolling the page sideways
- [ ] The card enters on `ffSnackIn`; there is no exit animation and no
      reduced-motion branch
- [ ] Each of the four icons has a test pinning its path data to the
      prototype's, its size on the 24×24 frame, `currentColor`, and that it
      is decorative unless titled
- [ ] `Snackbar`, `SnackbarProps` and `SnackbarVariant` come off the
      `components/` barrel; the four glyphs off `primitives/`
- [ ] The molecule owns no timer and no effect — nothing in it unmounts itself

---

## Phase 2: `notify` lands a card that dies at 5s

**User stories**: 1, 3, 4, 6, 7, 8, 9, 15, 16, 17, 18, 19, 22, 23, 24, 30, 31, 33, 35, 36, 37, 39, 40

### What to build

The tracer bullet: from here, anything under `App` can raise a notice and see
it land in the corner, outlive a route change, and go away on its own.

`App/useSnackbar/` — the context object, the `useSnackbar()` hook, and the
`SnackbarNotice` type. Outside a provider the hook throws, naming itself in
the message (the `useGenreMovies` precedent).

`App/SnackbarProvider/` — the fixed `column-reverse` column and its styles,
the queue as an array appended to, the `useRef` id counter, one `setTimeout`
per notice held in a ref keyed by id, and teardown. `notify` pushes and
answers the id; `dismiss(id)` filters and clears the timer, harmless when the
filter finds nothing. Every card's `onDismiss` is `dismiss` of its own id.
Both functions update through functional `setState` and close over no state,
so the memoised context value never changes identity. Every outstanding timer
is cleared when the provider unmounts. The stack is **always mounted**, empty
or not, and carries the `data-testid`.

`App.tsx` mounts the provider inside `ThemeProvider`, after `GlobalStyle`,
around `Routes`. `App.test.tsx` gains one check: the stack's node is present
on several different routes.

In this phase a notice's `action` is accepted by the type but the persistence
it implies is Phase 3's — the provider passes `actionLabel` and `onAction`
through, and the timer rule is uniform. Nothing caps, dedupes or coalesces.

### Acceptance criteria

- [ ] A consumer rendered under the real provider calls
      `notify({ variant, message })` and the card appears in the stack, drawn
      by the Phase 1 molecule with the variant's glyph and role
- [ ] That notice is gone at 5s, and not before
- [ ] `notify` answers a `number` id, and successive calls answer different ids
- [ ] The ✕ takes a notice off before its 5s
- [ ] `dismiss(id)` retracts a notice nobody pressed; `dismiss` on an id that
      is already gone does nothing and throws nothing
- [ ] Two notices are both on screen, and the **newest is nearest the
      corner** — asserted with `comesBefore` over document order, never by
      reading a CSS property
- [ ] Two identical notices are two notices
- [ ] `notify` and `dismiss` keep the same identity across renders, so an
      effect depending on `notify` fires once
- [ ] `useSnackbar()` outside a provider throws, and the message names the hook
- [ ] Unmounting the provider clears every outstanding timer — nothing fires
      afterwards
- [ ] The stack paints nothing when empty, and its node is present anyway
- [ ] The stack's node is present on `/`, `/movie/:id`, `/settings` and
      `/import` alike, so the provider is above the route table
- [ ] A notice raised on one route is still on screen after navigating to
      another
- [ ] The stack is `fixed` at `right: 24px; bottom: 24px; z-index: 200`,
      `pointer-events: none` with each card's wrapper restoring `auto`, so a
      notice over the Modal's scrim is readable and pressable
- [ ] The stack container carries no `aria-live` and no role; the roles are
      on the cards alone
- [ ] Escape does not dismiss; no route suppresses or re-parents the stack
- [ ] No portal; `App.tsx` stays where it is; nothing lands in `src/types/`
      or `test-support/`

---

## Phase 3: The action persists, and pressing it dismisses then runs

**User stories**: 2, 5, 14

### What to build

The one exception to the timer rule, and the one thing the stack does on a
caller's behalf.

A `SnackbarNotice` whose `action` is present gets **no timer** — it persists
until it is actioned or dismissed. The provider wires the molecule's
`onAction` to **take its own notice off first, then run `onClick`**, so no
future actionable caller has to remember the step the prototype's `runUpdate`
does by hand. `dismiss(id)` retracts an actionable notice nobody pressed —
the case the update flow needs when the maintainer installs from the Settings
row while the offer is still up.

A notice raised while the player is fullscreen is not seen until fullscreen
exits, and is not suppressed or re-parented for it: an actionable one is
waiting on the other side.

### Acceptance criteria

- [ ] A notice **with an action** is still on screen at 5s and well beyond
- [ ] A notice **without** one still dies at 5s — the rule is unchanged for it
- [ ] Pressing the action takes its own notice off first, then runs `onClick`
      — observable as the notice being gone by the time the handler's effect
      is visible
- [ ] The ✕ takes an actionable notice off without running its `onClick`
- [ ] `dismiss(id)` retracts an actionable notice, and does nothing against
      one already actioned
- [ ] No `duration` and no `dismissible` exist on `SnackbarNotice`; the
      action's presence is the whole of the timing
- [ ] Unmounting the provider with an actionable notice up leaks nothing

---

## Phase 4: Docs and the refactor filing

**User stories**: 38 — the initiative's close, as #148 was for the Settings hub
and the component upload's Phase 5 was for it.

### What to build

`docs/handoff/COMPONENT-SPEC.md`'s `mol.Snackbar` row and its Icons table; the
**Snackbar system** section of `docs/ubiquitous-language.md` checked against
what shipped; CLAUDE.md's folder map (`App/useSnackbar/`,
`App/SnackbarProvider/`, the four glyphs under `Icon/`) and README's tree; the
dev journal paragraph, which states plainly that this shipped with no caller
and why. Then `request-refactor-plan` over the round.

**The feature list's _Snackbar system_ row is ticked ✅ when the refactor
closes, not here** — in README, in CLAUDE.md, and in COMPONENT-SPEC's row. The
build-order chain in CLAUDE.md then loses step 1, and the remaining four keep
their numbers and their gates.

### Acceptance criteria

- [ ] COMPONENT-SPEC's `mol.Snackbar` row describes the molecule's props, the
      role by variant, and the provider/hook split; the Icons table lists the
      four glyphs
- [ ] The glossary's Snackbar system section names the **Snackbar notice**,
      the **Snackbar stack**, the timing rule and the dismiss-then-run action,
      checked against the code
- [ ] CLAUDE.md's folder map and README's tree match what shipped, and
      CLAUDE.md records that none of the six refusing screens was reopened
- [ ] The dev journal carries the round's paragraph
- [ ] A refactor issue is filed by `request-refactor-plan`, and the feature
      list's tick waits for it
