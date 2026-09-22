# Plan: Motion & interaction states — controls signal with colour, cards with elevation

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/180

The prototype revision of 2026-09-22 gave every interactive surface one
**Interaction contract** (COMPONENT-SPEC §2a), and the app follows none of it:
nothing answers a press, the keyboard draws Chromium's ring, the two cards
disagree, a link face has never had a hover, the accent scale is typed rather
than derived, and reduced motion is ignored.

This initiative is not a new feature. It adds three shared style fragments, a
tested pure helper, a token file and a theme factory, and then moves six built
surfaces onto them one family at a time. There is nothing new to draw — every
state is already in a prototype file — and no route, schema or wire change.

The slicing follows the two vocabularies, with the shared values first so
every surface after has something to read:

**tokens, scale and theme** (Phase 1) → **the control vocabulary, on Button**
(Phase 2) → **Chip and the Filter dropdown** (Phase 3) → **IconButton and its
extensions** (Phase 4) → **the card vocabulary, on both cards** (Phase 5) →
**docs and the refactor filing** (Phase 6).

Phase 1 is the one deliberately non-vertical slice — values with no surface
reading them yet, apart from the Reduced motion block — kept separate on the
Snackbar's, the FAB's and Back navigation's precedent, so each surface phase
gets a RED step about its own vocabulary rather than about a token's spelling.
Phases 2–5 are the tracer bullets: from each one on, that family of surfaces
is on the contract end to end, under a pointer, a keyboard and the OS
reduced-motion setting.

There is **no Phase 0**: the prototype was already amended in the grill
session (`tokens.css`'s hover, press and ring now match the derivation), and
§2a's prose correction waits for Phase 6, when it can say what shipped.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none. No route, no wire call, no server change.
- **Schema**: none.
- **Key models**:
  - **Motion tokens** — a flat `as const` token file beside `colors`:
    `durFast '120ms'`, `durBase '180ms'`, `durSlow '280ms'`,
    `easeOut 'cubic-bezier(0.2, 0.7, 0.3, 1)'`, re-exported from the `tokens/`
    barrel and mounted on the theme as `theme.motion`. `durSlow` ships with no
    caller.
  - **Accent scale** — `accentScale(accent) → { accentHover, accentPress,
accentSoft, accentLine, focusRing }`, a pure `utils/` helper. For the stock
    `#d97a4e`: `#e0926e`, `#bf6b45`, `rgba(217, 122, 78, 0.14)`,
    `rgba(217, 122, 78, 0.32)`, `rgba(224, 146, 110, 0.55)`.
  - **Theme factory** — `createTheme(accent = colors.accent)`; `theme =
createTheme()`; `Theme` stays `typeof theme`. The colour tokens spell the
    accent once; `theme.colors` keeps `accentHover`, `accentSoft`,
    `accentLine` and gains `accentPress` and `focusRing`. No runtime picker.
  - **The two vocabularies** — one shared-CSS unit in `styles/`, in its own
    folder because it has a test: `controlStates(press)` for a **Control**,
    and `cardLift` + `cardFocus` for a **Card**. Hover colours stay in each
    component; press duration, transition and focus live in the fragment.
  - **Press durations** — 60 ms (control) and 70 ms (card), each spelled once
    in its fragment. No press token.
  - **Structural guard** — over `shippingSources`: no shipping file but the
    motion token file spells `120ms`, `180ms`, `280ms` or `cubic-bezier(`;
    none but the fragment file spells `60ms` or `70ms`.
  - **Reduced motion** — one global block in the global stylesheet, never per
    component.
- **Testing boundary**: jsdom computes no `:hover`, `:active` or
  `:focus-visible`, so no test asserts a computed style and no
  `toHaveStyleRule` / `jest-styled-components` is added. Surfaces keep their
  existing behaviour tests; each surface phase is checked visually against its
  prototype file.
- **Files over prose**: each surface is ported as its prototype file draws
  it. Where `prim.Chip` lifts 1px and `prim.IconButton` scales 1.06, the files
  win; §2a is corrected in Phase 6.
- **Untouched stays untouched**: `Toggle`, `TextField`, `Textarea` focus; the
  `ease` literals in `Toggle`, `ProgressBar`, `SubtitleOverlay`, the player
  chrome and every `ffPop`; `Menu`, `SubtitleRow`, `ActionRow`, _View all_,
  the Modal's ✕, `Snackbar`, the Back pill, `SettingsHeader`; `ffSpin`.

---

## Phase 1: The tokens, the scale and the theme

**User stories**: 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 37, 38, 44

### What to build

The shared values every later phase reads. A motion token file with the four
values, re-exported from the token barrel. A pure accent-scale helper that
derives the five accent values from one accent through private `shade` and
`rgba` helpers, using the prototype's formula. A theme factory that spreads the
derived scale over the colour tokens and mounts the motion tokens, with the
default theme built from it. The colour tokens lose their three typed
derivative literals, and the theme keeps every existing name and adds
`accentPress` and `focusRing`. The Reduced motion block is ported verbatim
into the global stylesheet, which puts the motions that already shipped
(Snackbar slide, modal pop-in, menus, buffering spinner) under the rule at
once.

### Acceptance criteria

- [ ] `accentScale('#d97a4e')` returns exactly the five values of the amended `tokens.css`
- [ ] A second accent derives a different scale, and for both accents hover and press never equal the accent
- [ ] `createTheme()` exposes `theme.colors.accentHover`, `accentPress`, `accentSoft`, `accentLine`, `focusRing` and `theme.motion`'s four values
- [ ] The colour tokens spell the accent once and none of its derivatives
- [ ] Every existing reader of `accentHover` / `accentSoft` / `accentLine` typechecks unchanged
- [ ] With the OS set to reduce motion, the Snackbar, the modal pop-in, the menus and the buffering spinner run with no motion, and the spinner stops repeating, while each state is still shown
- [ ] `ffSpin` is still defined and `PlayerNotice` still spins with motion allowed

---

## Phase 2: The control vocabulary, on Button

**User stories**: 1, 2, 3, 16, 17, 18, 19, 21, 22, 24, 30, 31 (the 60 ms half)

### What to build

The control fragment: the transition list at `durFast` / `easeOut`, a press
that applies a given transform at 60 ms on anything not disabled, and a 3px
Focus ring drawn as a box-shadow under `:focus-visible` only, following the
control's radius. The structural guard lands with it, covering the three
durations, the curve and the 60 ms press. Button is the first caller. Its four
variants get their prototype hovers and presses at `scale(.98)`: primary moves
to `accentHover` then `accentPress`, secondary to `surface2` then `surface3`,
ghost to `surface` then `surface2`, and danger takes two commented literal
tints. The hover and press guards change from `:enabled` to `:not(:disabled)`,
so the link face (_Back to library_ on the not-found movie page) gets hover,
press and ring for the first time. `sm` shares every state with `md`.

### Acceptance criteria

- [ ] The guard fails if any shipping file but the motion tokens spells `120ms`, `180ms`, `280ms` or `cubic-bezier(`, or any but the fragment file spells `60ms`, and passes on the current tree
- [ ] Each Button variant, at `sm` and `md`, hovers and presses as `prim.Button` draws it, and the press visibly answers faster than the hover eases in
- [ ] A disabled Button shows no hover and no press
- [ ] _Back to library_ on the not-found page brightens on hover, presses, and shows the ring under Tab
- [ ] Tabbing onto a Button draws the app's Focus ring in the accent, following its corners; clicking it draws none
- [ ] Button's existing behaviour tests stay green

---

## Phase 3: Chip and the Filter dropdown

**User stories**: 9, 10, 11, 12

### What to build

The selectable chip goes on the control fragment. It hovers to an
`accentLine` border, takes a `surface2` fill unless selected, and rises 1px.
It presses at `translateY(0) scale(.97)`. A selected chip keeps its selected
fill under the pointer, and the non-interactive Tag shape gets nothing. The
Filter dropdown's trigger goes on the fragment with an `accentLine` border and
`surface2` hover and a `scale(.98)` press. Its option rows hover to `surface3`
with a `durFast` transition on background and colour. Both the sort and the
genre dropdowns pick this up.

### Acceptance criteria

- [ ] A selectable chip on the library filters hovers, lifts 1px and presses as `prim.Chip` draws it
- [ ] A selected chip keeps its selected fill while hovered
- [ ] A Tag shows no hover, press or ring
- [ ] The sort and genre dropdown triggers hover, press and take the Focus ring like a Button
- [ ] Options in an open dropdown highlight to `surface3` under the pointer
- [ ] Chip's and the Filter dropdown's existing tests stay green, and the guard stays green

---

## Phase 4: IconButton and its extensions

**User stories**: 13, 14, 15, 39, 40

### What to build

IconButton goes on the control fragment. It hovers at `scale(1.06)`, and the
outline variant also moves its border to `textFaint`. It presses at
`scale(.94)`. Every `styled(IconButton)` inherits the press, the ring and the
transition automatically. IconButton's docblock rule 2 widens so an extension
replaces `background`, `color`, `border-color` and `transform`, and it writes
the rule for extensions that position with `transform`: restate the transform
in the hover and compose it into the press. Then the five extensions follow
that rule:

- the carousel arrow hovers at `translateY(-50%)` and presses at `translateY(-50%) scale(.94)`
- the FAB keeps its lift on hover, now easing at `durFast`, and presses at `scale(.94)`
- the ⋯ more button, the movie page's circle toggles and the player's chrome icon button restate `transform: none` on hover

### Acceptance criteria

- [ ] A bare IconButton grows on hover, shrinks on press and takes the Focus ring under Tab
- [ ] The carousel's prev/next arrows stay vertically centred through hover and press
- [ ] The Back-to-top FAB lifts on hover with an ease rather than a snap, and gives a press
- [ ] The ⋯ button, the movie page's circle toggles and the player's transport and chrome buttons show a press and the ring, and do not scale on hover
- [ ] IconButton's docblock states the widened rule 2 and the transform rule
- [ ] Every existing IconButton, Fab, CardCarousel, EditMenu, MovieDetail and PlayerControls test stays green, and the guard stays green

---

## Phase 5: The card vocabulary, on both cards

**User stories**: 4, 5, 6, 7, 8, 20, 23, 31 (the 70 ms half), 41, 46

### What to build

The two card fragments. `cardLift`, applied to the tile, gives a resting
shadow and a `durBase` / `easeOut` transition on transform, shadow and border.
It lifts 4px on hover with a deeper shadow and the `accentLine` border, and
settles to 1px at 70 ms on press. `cardFocus`, applied to the focusable root,
draws a 2px Focus ring outline 4px out and leaves the radius to the caller.
The guard gains its 70 ms clause. On the Poster card, the tile goes on
`cardLift` and the root on `cardFocus` with the poster's radius. That drops
its old `0.18s ease` transition, and hovering the title under the poster no
longer lifts it. The heart hovers to its darker backing and brighter border
at `scale(1.08)`, and presses at `scale(.92)`, with the control ring under
Tab. The Continue card gets the same two fragments: its tile gains the
resting shadow it never had, and its `opacity: .94` hover goes. Neither card
recolours its fill. The two fragments are then ready for Series'
`SeasonCard` and `EpisodeRow` to compose unchanged.

### Acceptance criteria

- [ ] The guard now also fails if any shipping file but the fragment file spells `70ms`, and passes on the tree
- [ ] A poster lifts with an accent edge on hover, settles on press, and does not lift when only its title is hovered
- [ ] A Continue Watching card lifts, settles and outlines exactly as a poster does, and no longer fades
- [ ] Tabbing onto a poster draws the card outline clear of the artwork; tabbing onto its heart draws the control ring instead
- [ ] The heart grows and darkens its backing on hover and shrinks on press
- [ ] PosterCard's and ContinueCard's existing tests stay green

---

## Phase 6: Docs and the refactor filing

**User stories**: 42, 43, 45

### What to build

Go back over the finished work and record what shipped. Correct §2a in
COMPONENT-SPEC so its table matches the files: Chip lifts 1px and IconButton
scales 1.06. Record `ffSpin` as a known gap between prototype and code for the
player's next revision. Check that `Toggle`, `TextField`, `Textarea` and every
surface the revision did not touch are exactly as drawn. File the refactor
request. README's and CLAUDE.md's _Motion & interaction states_ entries stay
🔜 until that refactor is done, and only then are they ticked ✅.

### Acceptance criteria

- [ ] §2a states Chip's 1px lift and IconButton's 1.06 scale, and no longer says buttons never lift
- [ ] The `ffSpin` gap is recorded in design log 21
- [ ] `Toggle`, `TextField` and `Textarea` keep their existing focus behaviour, and `Menu`, `SubtitleRow`, `ActionRow`, _View all_, the Modal's ✕, `Snackbar`, the Back pill and `SettingsHeader` are unchanged from before the initiative
- [ ] A refactor-plan issue is filed for the initiative
- [ ] README and CLAUDE.md are ticked ✅ only after that refactor closes
