# Plan: Back-to-top FAB — the accent circle over the browse home, mounted by the chrome past 420

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/165

The browse home is over six thousand pixels tall on a full library, and the
only way back up is the way down. The prototype answered it in twelve lines of
`page.LibraryPage`: a ref to the scrolling body, `showFab` as
`scrollTop > 420`, `mol.Fab` mounted while that is true, and a smooth ride to
the top on a press. This initiative translates that: the molecule 1:1 as a
presentational block on `IconButton`, and a control composed of it that owns
the **Scroll threshold**, the listener and the press — mounted by the chrome,
which lends it the body's ref the way it already lends the same ref to scroll
restoration.

It is step 2 of the four that are left, the last renderer-only slice before
the Electron shell, with nothing under it and nothing above it. The slicing
puts the drawing first, then the control as the tracer bullet, then the docs:

**the molecule** (Phase 1) → **the control, and the mount** (Phase 2) →
**docs and the refactor filing** (Phase 3).

Phase 1 is the one deliberately non-vertical slice — a molecule with no
consumer — kept separate on the Snackbar plan's precedent so there are two
clean RED steps: one that renders a circle and reads it, one that drives a
scroll container and watches what appears. Phase 2 is the tracer bullet: from
Phase 2 on, the home has the feature end to end.

There is **no Phase 0**: the PRD is explicit that nothing in the prototype is
amended, and the `.dc.html` files are translated as written.

## Three things settled before any phase

- **The molecule knows nothing and owns nothing.** `Fab` is handed an icon, a
  label, a size and a handler and draws a circle. No listener, no state, no
  `useEffect`, no idea there is a threshold. That is the line `COMPONENT-SPEC`
  draws for `mol.Fab`, and it is drawn in Phase 1 and never crossed.

- **The control owns the number, and the chrome mounts the control.**
  `BackToTop` takes the scrolling container as a ref and holds one boolean.
  `MainLayout` mounts it in one line beside the body it already owns and
  holds no state for it — the argument that put scroll restoration there:
  _the body is where the scrolling happens, so the chrome is what knows how
  far it has gone_. Not a feature (no movie in a scroll control), not the
  page (composition only), not a hook (one caller).

- **The browse home only, as the prototype draws it.** `page.LibraryPage` is
  the one prototype file that mounts a FAB. `GenreLayout` gets none, and
  `MainLayout` has one consumer, so there is no opt-out prop and no threshold
  prop. A longer shelf wanting one is a grill and a prototype amendment first.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** None. No HTTP route, no schema change, no `src/types/` entry:
  no route will ever see a FAB. The icon and props types come off the molecule
  through the `components/` barrel, `ModalProps`' precedent.

- **The ladder.** Three rungs, none skipped:

  ```
  IconButton                 ← primitives/, already there
  └── Fab                    ← components/Fab/, styled(IconButton)
      └── BackToTop          ← components/BackToTop/, renders Fab or null
          └── MainLayout     ← layouts/MainLayout/, one line after the body
  ```

  `IconButton`, not `Button`: a 52px accent circle around a glyph is an
  icon-only button, which `IconButton` already is — the square, the centring,
  the pill corner, `type="button"`, the required accessible name. The FAB is
  one more `styled(IconButton)` face beside the favorite heart, the carousel
  arrows, the ⋯ trigger and the detail page's circles.

- **The units.** Four new, one amended:
  - `primitives/Icon/ArrowUpIcon` and `PlusIcon`, each with a test, named for
    what they draw, re-exported from the `primitives/` barrel.
  - `components/Fab/` — three files (component, test, styles), re-exported
    from the `components/` barrel with `FabProps` and `FabIcon`.
  - `components/BackToTop/` — **two files, no styles**: it draws nothing of
    its own, `Fab` draws, and the trigger for a companion file is a companion
    file. `LibrarySearch`, `LibraryFilters` and `RetryableFailure` are the
    two-file precedents at this rung. Re-exported from the `components/`
    barrel with `BackToTopProps`.
  - `layouts/MainLayout/` — one line, and the docblock's placeholder sentence
    (_the back-to-top FAB still lands with the feature that owns it_)
    rewritten to say the chrome mounts it and why.

- **Key models.**
  - **`FabProps`**, flat and 1:1 with the prototype's `data-props` in its
    order: `icon?` (`'arrow-up' | 'plus'`, default `'arrow-up'`), `label`
    (**required** — the one deviation from the prototype's _Back to top_
    default, for `IconButton`'s reason: a default right for one icon and wrong
    for the other is not a default), `size?` (default 52), `onClick`
    (required).
  - **`BackToTopProps`** — one prop, `container: RefObject<HTMLElement | null>`,
    the element that scrolls. The one place in `components/` where a prop is
    a ref rather than a value: an honest shape for a control over someone
    else's scroll container, recorded as such.
  - **The Scroll threshold** — a module constant of **420** in `BackToTop`,
    with a comment naming `page.LibraryPage` as whose number it is. The
    comparison is `scrollTop > 420`, strictly: at exactly 420 there is no FAB.

- **Geometry, 1:1.** `position: absolute; right: 28px; bottom: 28px;
z-index: 60`; `background` the accent token; `color: #1a1109`;
  `border: none`; `box-shadow: 0 8px 28px rgba(217, 122, 78, 0.42)`. Hover,
  guarded `&:hover:enabled`: the accent-hover token, the same ink again, and
  `transform: translateY(-2px) scale(1.05)`. `border-radius` is left to
  `IconButton`'s pill, which on a square is the prototype's `50%`. Four
  literals stay literal because translating is not inventing: 28px is no
  spacing token, `#1a1109` is ink on the accent fill and no `--color-*` fits
  it, `tokens.css` declares no shadow token, and the prototype writes 60.
  `absolute` rather than the spec prose's _fixed_: inside a `100vh` root the
  two are the same box, and it sits over `MainLayout.Root`'s existing
  `position: relative`, whose comment is already correct and stays. **No
  `transition`** — the prototype declares none, so the lift snaps.

- **The glyphs.** `ArrowUpIcon`: `M12 19V5m0 0l-6 6m6-6l6 6`, stroke 2.2,
  round caps and joins. `PlusIcon`: `M12 5v14M5 12h14`, stroke 2.2, round
  caps. Both on the shared 24×24 `IconBase` frame in `currentColor`,
  decorative unless titled. Their sizes — 24 and 26 — are the molecule's to
  pass, not the glyphs' to know. Both ship, though only `arrow-up` has a
  screen: half an enum is a deviation dressed up as restraint.

- **The control's behaviour.** The position is read on every `scroll` event
  of the container, **passive**, and **once on attach** — the second is not in
  the prototype and is needed here because `useRestoredScroll` puts a
  revisited home back to its remembered position before the family touches
  anything, and the FAB must already be there. State is written only when the
  answer changes. The listener is removed on unmount. The press calls the
  container's `scrollTo({ top: 0, behavior: 'smooth' })` — never anything on
  the document, which never scrolls in this app. Entrance and exit are mount
  and unmount, nothing else; after the press, focus falls to the body, the
  prototype's behaviour, accepted rather than managed.

- **Tests, and no new double.** `stubScrollMetrics` already gives every
  element a writable `scrollTop`; the press's `scrollTo` is stubbed per test
  on the carousel suite's `scrollBy` precedent. Nothing lands in
  `test-support/`. Each glyph gets a test on the `UploadIcon` precedent —
  which amends log 19 Q23's three suites to five, the same amendment the
  Snackbar PRD made to log 18 Q10.

- **What is not built, in any phase.** A FAB on any screen but the home; a
  `GenreLayout` mount, an opt-out prop, a threshold prop or a `useBackToTop`
  hook; a `Button` base, a bare `styled.button` or an `accent` variant on
  `IconButton`; a transition, an animation, `prefers-reduced-motion` or focus
  management; a fix for the corner shared with the **Snackbar stack** (a
  notice at `z-index: 200` covers the FAB while it is up, as the prototype
  draws both, and no screen raises one on the home today); a `plus` FAB with
  a screen; a `types/` entry; a prototype amendment of any kind.

---

## Phase 1: The molecule

**User stories**: 15, 16, 17, 18, 19, 28, 29, 34

### What to build

The circle, inert, proven by rendering it.

Two new glyphs in `primitives/Icon/` on the shared `IconBase` frame, paths
copied from `mol.Fab.dc.html`'s two SVGs and named for what they draw —
`ArrowUpIcon` and `PlusIcon` — each with a test, both re-exported from the
`primitives/` barrel.

`components/Fab/` — the molecule, its test and its styles, re-exported from
the `components/` barrel with its props and icon types. `styled(IconButton)`,
passing `label`, `size` and `onClick` straight through and choosing the glyph
by `icon`: the arrow at 24, the plus at 26, never both. The face is the
prototype's inline style literally — the absolute corner, the accent fill, the
near-black ink, the shadow, the `:hover:enabled` lift that replaces both
`background` and `color` so nothing leaks up from the ghost face. No
`transition`. The molecule has no listener, no state, no effect, and no idea
what it floats over or why.

### Acceptance criteria

- [ ] `Fab` renders a button whose accessible name is `label`; `label` is
      required by the type, not defaulted
- [ ] `icon="arrow-up"` draws the arrow's path and not the plus's;
      `icon="plus"` draws the plus's and not the arrow's; no `icon` draws the
      arrow
- [ ] Pressing the button asks `onClick`
- [ ] `size` is the square's edge, and 52 is the default
- [ ] The button is `absolute` at `right: 28px; bottom: 28px; z-index: 60`,
      on the accent, in `#1a1109`, under `0 8px 28px rgba(217, 122, 78, 0.42)`,
      with no border
- [ ] The hover is `&:hover:enabled` — the accent-hover fill, the same ink,
      `translateY(-2px) scale(1.05)` — so a disabled circle never lights up
- [ ] No `transition` is declared on the face
- [ ] `Fab` is built on `IconButton`, not a bare `<button>`, so `type="button"`
      and the pill corner come from the primitive
- [ ] Each glyph has a test pinning its path data to the prototype's, its
      size on the 24×24 frame, `currentColor` at stroke 2.2, and that it is
      decorative unless titled
- [ ] `Fab`, `FabProps` and `FabIcon` come off the `components/` barrel;
      `ArrowUpIcon` and `PlusIcon` off `primitives/`
- [ ] The molecule owns no state, no listener and no effect — rendering it is
      enough to test it

---

## Phase 2: The control, and the mount

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 20, 21, 22,
23, 24, 25, 26, 27, 30, 31, 32, 33, 35, 36, 37

### What to build

The tracer bullet: from here, the family scrolls the home past 420, the
accent circle is in the corner, and a press glides them back to the top.

`components/BackToTop/` — the control and its test, no styles. It takes the
scrolling container as a ref, reads its `scrollTop` on every passive `scroll`
event and once on attach, holds one boolean written only when the answer
changes, and renders `<Fab icon="arrow-up" label="Back to top" onClick={…} />`
past the **Scroll threshold** or `null` under it. The threshold is a module
constant of 420 with a comment naming `page.LibraryPage`. The press calls the
container's `scrollTo({ top: 0, behavior: 'smooth' })`. The listener is
removed on unmount. Re-exported from the `components/` barrel with its props
type.

`layouts/MainLayout/` — the control rendered immediately after the body,
handed the same ref `useRestoredScroll` attached. The layout holds no state
for it. The docblock's _still lands with the feature that owns it_ is
rewritten to say the chrome mounts it and why. `Root`'s `position: relative`
and its comment stay as they are.

`useRestoredScroll` needs no change: it sees the ride as scroll events and
ends up remembering 0 for the entry, which is correct because the family asked
for the top.

No `LibraryPage` test — composition only, nothing to assert. No
`GenreLayout` mount.

### Acceptance criteria

- [ ] With the container at 0, nothing is rendered
- [ ] After the container's `scrollTop` moves past 420 and `scroll` fires,
      the button named **Back to top** is on screen
- [ ] At exactly 420 there is no button
- [ ] Back under the line, the button is gone again
- [ ] When the container is already past the line before the control mounts,
      the button is there on attach without any `scroll` event — the Back case
- [ ] Pressing the button calls the container's `scrollTo` with
      `{ top: 0, behavior: 'smooth' }`, and nothing on `window` or `document`
- [ ] After unmount, a `scroll` fired on the container changes nothing — the
      listener is gone
- [ ] The listener is registered `passive`
- [ ] State is written only when the answer changes — successive scrolls on
      the same side of the line do not re-render the control
- [ ] The button is reachable by Tab while on screen, and its glyph is
      decorative (not announced separately from the name)
- [ ] `MainLayout.test.tsx`: past the threshold the FAB appears over the
      layout's own body, and pressing it asks that body — not the document —
      for the top
- [ ] `MainLayout` holds no state for the control and gains no prop; its
      docblock no longer says the FAB lands with a feature
- [ ] `GenreLayout` renders no FAB; there is no `useBackToTop` in `hooks/`;
      nothing lands in `features/`, `src/types/` or `test-support/`
- [ ] `BackToTop` and `BackToTopProps` come off the `components/` barrel

---

## Phase 3: Docs and the refactor filing

**User stories**: 38 — the initiative's close, as the Snackbar's Phase 4 was
for it.

### What to build

CLAUDE.md's folder map and README's tree gaining `components/Fab/`,
`components/BackToTop/` and the two glyphs under `Icon/`; the **Back-to-top
FAB** section of `docs/ubiquitous-language.md` — **FAB**, **Back-to-top**,
**Scroll threshold** — checked against what shipped; the dev journal
paragraph, which records that the chrome mounts it and why, and that the read
on attach is the one thing not in the prototype. Then `request-refactor-plan`
over the round.

**The feature list's _Back-to-top FAB_ row is ticked ✅ when the refactor
closes, not here** — in README and CLAUDE.md. The build-order chain then loses
step 2, and the remaining three keep their numbers and their gates.
COMPONENT-SPEC's `mol.Fab` row gains its _what shipped_ note (the layout
mounts it, `label` is required) at the same moment — the `mol.Snackbar`
precedent, not an amendment.

### Acceptance criteria

- [ ] CLAUDE.md's folder map and README's tree match what shipped — `Fab/`
      and `BackToTop/` under `components/`, `ArrowUpIcon` and `PlusIcon`
      named under `Icon/`, and `MainLayout`'s line saying it mounts the
      control
- [ ] The glossary's Back-to-top FAB section names the **FAB**, the
      **Back-to-top** control and the **Scroll threshold**, checked against
      the code
- [ ] The dev journal carries the round's paragraph
- [ ] A refactor issue is filed by `request-refactor-plan`, and the feature
      list's tick, the chain's step 2 and COMPONENT-SPEC's note all wait for it
