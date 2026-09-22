## Problem Statement

I am the maintainer, and my family are the people who use this app. The
prototype revision of 2026-09-22 gave every interactive surface one
**Interaction contract** — COMPONENT-SPEC §2a — and the app follows none of
it. Pressing a button, hovering a poster and tabbing through the library each
feel different depending on which screen they are on:

- **Nothing answers a press.** No control and no card has an `:active` state,
  so a click gives no physical feedback before the next screen appears.
- **The keyboard draws the browser's ring.** No component has a
  `:focus-visible` rule, so a keyboard user sees Chromium's default outline —
  on buttons, on posters, on the dropdowns — and none of it is the app's own
  **Focus ring**.
- **The two cards disagree.** A **Poster card** lifts at `.18s ease` with no
  accent border; a **Continue card** does not lift at all, it fades to 94%
  opacity.
- **A link face has never had a hover.** `Button`'s hovers are written
  `:hover:enabled`, which an `<a>` never matches — _Back to library_ on the
  not-found movie page has been inert under the pointer since it shipped.
- **The accent scale is typed, not derived.** `colors.ts` spells
  `accentHover`, `accentSoft` and `accentLine` as literals and has no press or
  focus-ring value. The whole-app prototype derives all five from the one
  accent; the literal hover is a different colour from the one it renders.
- **Reduced motion is ignored.** A household member who has asked their OS for
  less motion still gets every lift, fade and pop-in.

It is step 4 of the build order, ahead of Series, because Series draws two new
**Cards** (`SeasonCard`, `EpisodeRow`) that must be born on the contract rather
than retrofitted to it.

## Solution

**Buttons signal with colour, cards signal with elevation.** One three-state
model — **Hover**, **Press**, **Keyboard focus** — laid over the six built
surfaces the prototype put on the contract, in two vocabularies that never
mix, each written once as a shared style fragment:

- A **Control** — `Button`, `Chip`, `IconButton` and every `styled(IconButton)`,
  the **Filter dropdown** — lightens on hover, darkens and shrinks on press
  (at 60 ms, faster than the 120 ms hover), and wears a 3px **Focus ring** under
  keyboard focus only.
- A **Card** — the **Poster card** and the **Continue card** — lifts 4px with a
  deeper shadow and the accent line on hover, settles to 1px on press (at
  70 ms), and takes a 2px outline 4px out under keyboard focus. It never
  recolours its fill.

The four **Motion tokens** (`durFast` 120ms, `durBase` 180ms, `durSlow` 280ms,
`easeOut`) become their own token file and the only place those values are
spelled. The **Accent scale** is computed from the one accent by a tested pure
helper inside a theme factory, so no primary button can ever lose its hover by
aliasing. One global **Reduced motion** block collapses every transition and
animation in the app.

Each surface is ported **as its prototype file draws it**, not as §2a's prose
summarises it: where `prim.Chip` hovers up a pixel and `prim.IconButton` scales
to 1.06, the files win and §2a is corrected at the refactor. Every other hover
in the app — menus, rows, the Back pill, the Modal's ✕ — stays as drawn,
because their prototype files were not revised.

## User Stories

### The family, with a pointer

1. As a parent, I want a button to brighten when my pointer is over it, so that I know it is the thing I am about to press.
2. As a parent, I want a button to darken and shrink slightly the moment I press it, so that the click feels physical before the next screen appears.
3. As a parent, I want the press to feel quicker than the hover, so that the button answers my finger at once rather than easing in.
4. As a parent, I want a poster to lift toward me with an accent edge when I hover it, so that I can see which film I am pointing at in a row of twenty.
5. As a parent, I want a poster to settle back down slightly as I click it, so that it feels like I pushed it.
6. As a parent, I want a Continue Watching card to lift the same way a poster does, so that both kinds of card feel like one family of things.
7. As a parent, I want hovering the title under a poster not to lift the poster, so that only the artwork reacts to the artwork.
8. As a parent, I want the heart on a poster to grow a little and darken its backing on hover, and shrink on press, so that I can tell I am about to favourite the film rather than open it.
9. As a parent, I want a genre chip to show an accent border and rise a pixel on hover, so that I can see which filter I am about to toggle.
10. As a parent, I want a selected chip to keep its selected fill while hovered, so that hovering never makes it look unselected.
11. As a parent, I want the sort and genre dropdown triggers to respond to hover and press like buttons, so that they read as controls.
12. As a parent, I want the options inside an open dropdown to highlight under my pointer, so that I know which one I am about to choose.
13. As a parent, I want the carousel's prev/next arrows to respond to hover and press without jumping out of their vertical position, so that they stay centred on the row.
14. As a parent, I want the Back-to-top button to keep its lift on hover and give a press, so that it feels like every other button.
15. As a parent, I want the player's transport buttons to show a press, so that I know Play or Pause registered.
16. As a parent, I want the not-found page's _Back to library_ link to brighten on hover like every other primary button, so that it looks pressable.
17. As a parent, I want a disabled button to show no hover and no press, so that it never pretends to be available.
18. As a parent, I want a danger button (Delete movie) to take a faint danger tint on hover and a stronger one on press, so that its consequence stays visible while I press it.

### The family, with a keyboard

19. As a keyboard user, I want every control to show one app-coloured ring when I tab onto it, so that I always know where I am.
20. As a keyboard user, I want every card to show an outline standing clear of the poster when I tab onto it, so that the focus is visible against dark artwork.
21. As a keyboard user, I want the ring on a control to follow its rounded corners, so that it looks like part of the control.
22. As a pointer user, I want no ring drawn when I click a control, so that the screen does not light up with outlines after every click.
23. As a keyboard user, I want the poster's heart to show the control ring and the poster itself to show the card outline, so that I can tell which of the two I am on.
24. As a keyboard user, I want the ring colour to come from the same accent the rest of the app uses, so that it looks designed rather than default.

### The family, with reduced motion

25. As a household member who has asked the OS for reduced motion, I want every lift, fade, pop-in and transition to happen instantly, so that the app does not move under me.
26. As that household member, I want the hover and press _states_ still shown, only without the animation, so that I still get the feedback.
27. As that household member, I want infinitely repeating animations (the buffering spinner) to stop repeating, so that nothing spins forever.
28. As that household member, I want the motions that shipped before this initiative — the Snackbar's slide, the modal pop-in, the menus — honoured by the same rule, so that I do not have to wait for each to be fixed.

### The maintainer

29. As the maintainer, I want the four motion values spelled in one token file only, so that retuning the app's pace is one edit.
30. As the maintainer, I want a test that fails if any other shipping file spells `120ms`, `180ms`, `280ms` or a `cubic-bezier(`, so that nobody re-types a duration inline.
31. As the maintainer, I want the 60 ms and 70 ms press durations each written once in their vocabulary's fragment, and a test that fails if any other shipping file spells them, so that no component equalises press with hover.
32. As the maintainer, I want the accent's five derivatives computed from the accent by a tested function, so that the hover, press, soft, line and ring values can never drift from their formula.
33. As the maintainer, I want a test that pins the stock accent's five derived values to the amended `tokens.css`, so that the code and the prototype provably agree.
34. As the maintainer, I want a test that a second accent derives a different scale and that hover and press never equal the accent, so that "never aliased" is enforced rather than remembered.
35. As the maintainer, I want the theme built by a factory taking the accent, so that re-theming is one argument if an accent picker ever arrives.
36. As the maintainer, I want `colors.ts` to spell the accent once and the theme to still expose every accent name, so that the eighteen files reading `accentHover`, `accentSoft` and `accentLine` do not change.
37. As the maintainer, I want new theme names `accentPress` and `focusRing` available on `theme.colors`, so that components read them like every other colour.
38. As the maintainer, I want the motion tokens mounted on the theme as `theme.motion`, so that styles read them the way they read colours and spacing.
39. As the maintainer, I want a `styled(IconButton)` extension to inherit the primitive's press, ring and transition automatically, so that a new extension is on the contract by default.
40. As the maintainer, I want the rule for extensions that position with `transform` written in `IconButton`'s docblock, so that the next extension restates its transform in its hover and composes it into its press instead of losing it.
41. As the maintainer, I want the card lift and the card focus to be two separate fragments, so that Series' `SeasonCard` and `EpisodeRow` compose them and add nothing.
42. As the maintainer, I want `Toggle`, `TextField` and `Textarea` left with their recorded focus behaviour, so that this initiative does not overturn decisions made in their own logs.
43. As the maintainer, I want every surface whose prototype file was not revised left exactly as drawn, so that no state is invented.
44. As the maintainer, I want the `ffSpin` keyframe kept even though the revision dropped it, so that the player's buffering spinner keeps turning.
45. As the maintainer, I want COMPONENT-SPEC §2a corrected at the refactor to say what shipped — Chip's 1px lift and IconButton's 1.06 scale — so that the prose stops contradicting its own files.
46. As a future Series builder, I want the card states already written, so that the season card and episode row are born on the contract.

## Implementation Decisions

### Tokens, scale and theme

- **Motion tokens** — a new flat `as const` token file, `motion`, with
  `durFast: '120ms'`, `durBase: '180ms'`, `durSlow: '280ms'` and
  `easeOut: 'cubic-bezier(0.2, 0.7, 0.3, 1)'`, named off the CSS vars the way
  the colour tokens are, re-exported from the `tokens/` barrel. `durSlow` ships
  with no caller: the prototype's scale is shipped whole.
- **No press token.** The prototype writes 60 ms (controls) and 70 ms (cards)
  as literals and names no var for them; each is written once, in its
  vocabulary's fragment.
- **Accent scale** — a new pure util, `accentScale(accent: string):
AccentScale`, returning `{ accentHover, accentPress, accentSoft, accentLine,
focusRing }`. The prototype's `shade(accent, .18)` for hover,
  `shade(accent, -.12)` for press, `rgba(accent, .14)` soft,
  `rgba(accent, .32)` line and `rgba(shade(accent, .18), .55)` the ring, with
  `shade` and `rgba` as private helpers in the same unit. For the stock
  `#d97a4e`: hover `#e0926e`, press `#bf6b45`, soft
  `rgba(217, 122, 78, 0.14)`, line `rgba(217, 122, 78, 0.32)`, ring
  `rgba(224, 146, 110, 0.55)` — the values `tokens.css` was amended to in the
  grill session.
- **Theme factory** — the theme module gains `createTheme(accent =
colors.accent)`, spreading `accentScale(accent)` over the colour tokens and
  mounting `motion`; `theme = createTheme()`, and `Theme` stays
  `typeof theme`. The colour tokens **lose** their three accent-derivative
  literals; `theme.colors` keeps all three names and gains `accentPress` and
  `focusRing`. No runtime accent picker.
- **Reduced motion** — ported verbatim into the global stylesheet, once:
  `*, *::before, *::after` under `@media (prefers-reduced-motion: reduce)`
  collapsing `animation-duration`, `animation-iteration-count` and
  `transition-duration` with `!important`. Never per component.
- **`ffSpin` stays** — `PlayerNotice` uses it. Recorded as a prototype/code
  gap for the player's next revision.
- **Untouched literals stay literal** — `Toggle`'s `.18s ease`,
  `ProgressBar`'s `.2s ease`, `SubtitleOverlay`'s `.25s ease`, the player
  chrome's fade and every `ffPop .14s ease` are the prototype's literals in
  files the revision left alone, and `ease` is not `easeOut`.

### The shared fragments

A new shared-CSS unit beside `visuallyHidden` in `styles/`, in its own folder
because it has a test:

- **`controlStates(press: string)`** — the transition list (`background`,
  `border-color`, `color`, `transform`, `box-shadow` at `durFast` `easeOut`);
  `&:active:not(:disabled)` applying the given press transform at
  `transition-duration: 60ms`; `&:focus-visible { outline: none; box-shadow:
0 0 0 3px focusRing }`. The press transform is the parameter because the
  prototype's differ per control. The hover stays in each component — its
  colours _are_ the component.
- **`cardLift`** — resting `box-shadow: 0 6px 20px rgba(0,0,0,.35)`; the
  transition (`transform`, `box-shadow`, `border-color` at `durBase`
  `easeOut`); `&:hover` to `translateY(-4px)`, `0 14px 34px rgba(0,0,0,.5)`
  and an `accentLine` border; `&:active` to `translateY(-1px)` at `70ms`.
  Applied to the tile.
- **`cardFocus`** — `&:focus-visible { outline: 2px solid focusRing;
outline-offset: 4px }`, the radius left to the caller. Applied to the
  focusable root.
- Split because the prototype puts the lift on the tile and the focus on the
  root: hovering the title under a poster does not lift it.

### The surfaces, as each file draws them

- **Button** — hover: primary `accentHover`; secondary `surface2` fill and
  `textFaint` border; ghost `surface`; danger `rgba(201,122,106,.12)` fill and
  `danger` border. Press: primary `accentPress`, secondary `surface3`, ghost
  `surface2`, danger `rgba(201,122,106,.2)`, all `scale(.98)`. The two danger
  tints are the prototype's literals, commented. Guards move from `:enabled`
  to `:not(:disabled)`, so the link face gets hover, press and ring. `sm` and
  `danger` stay (the Review step's pair, and `renderVals`); `sm` shares every
  state with `md`.
- **Chip** — the selectable (`Control`) shape only: hover `accentLine` border,
  `surface2` fill unless selected, `translateY(-1px)`; press
  `translateY(0) scale(.97)`. The non-interactive `Tag` shape gets nothing.
- **IconButton** — hover adds `scale(1.06)`, and the `outline` variant also
  moves its border to `textFaint`; press `scale(.94)`.
- **Filter dropdown** — trigger hover `accentLine` border and `surface2` fill,
  press `scale(.98)`; option rows hover `surface3` with a `durFast` transition
  on `background` and `color`.
- **Poster card** — the poster tile on `cardLift`, the root on `cardFocus`
  with the poster radius; the heart hovers to `rgba(18,14,10,.82)`, border
  `rgba(255,255,255,.45)`, `scale(1.08)`, press `scale(.92)`.
- **Continue card** — the tile on `cardLift` (gaining the resting shadow it
  never had), the root on `cardFocus`; the `opacity: .94` hover goes.

### The `styled(IconButton)` extensions

- Press, focus ring and transition belong to the primitive; every extension
  inherits them. The hover is the extension's own, as its file draws it.
- **An extension that positions with `transform` restates it in its hover and
  composes it into its press**, because the primitive's `scale(1.06)` hover and
  `scale(.94)` press out-rank a plain `transform`:
  - the carousel arrow hovers at `translateY(-50%)` and presses at
    `translateY(-50%) scale(.94)`;
  - the FAB keeps its lift on hover and presses at `scale(.94)`; its lift now
    eases at `durFast` rather than snapping;
  - the ⋯ more button, the detail page's circle toggles and the player's
    chrome icon button restate `transform: none` on hover, since their files
    draw no scale.
- `IconButton`'s docblock rule 2 widens from "replace `background` and
  `color`" to those two plus `border-color` and `transform`.

### Where the files and the prose disagree

- `prim.Chip` hovers up 1px and `prim.IconButton` scales 1.06, though §2a's
  table says buttons never lift. **The files win**; both are ported as drawn,
  and §2a is corrected at the refactor.
- `tokens.css`'s old hover / press / ring literals disagreed with the
  derivation; **the derivation won**, and `tokens.css` was amended in the grill
  session. Soft and line already matched.

## Testing Decisions

- A good test here observes a value or a rule the code can be held to without
  a rendering engine. jsdom computes no `:hover`, `:active` or
  `:focus-visible`, so no test asserts a surface's computed style, and no
  style snapshot is taken.
- **`accentScale`** is tested as a pure function: the stock accent maps to the
  five exact strings of the amended `tokens.css`; a second accent derives a
  different scale; hover and press never equal the accent — the "never
  aliased" rule as a test. Prior art: every `utils/` helper's co-located test
  (`formatBytes`, `gradientFromId`).
- **`interactionStates`**' test carries the **structural guard** over
  `shippingSources`: no shipping file but the motion token file spells `120ms`,
  `180ms`, `280ms` or `cubic-bezier(`, and none but the fragment file spells a
  `60ms` or `70ms` press. Prior art: the `useGoBack` and `usePlayback`
  structural guards over the same walk.
- **The six surfaces' suites gain nothing they cannot observe.** Their
  existing behaviour tests stay green; the typecheck proves the eighteen
  readers of the accent names still resolve after the colour tokens shrink.
- **The build's own check is visual**: the prototype files side by side with
  the running app, surface by surface, with a pointer, a keyboard, and the OS
  reduced-motion setting.
- ❌ `jest-styled-components` / `toHaveStyleRule` — a dependency to assert that
  CSS says what the CSS file says.

## Out of Scope

- States on the surfaces the revision did not touch — `Menu` items,
  `SubtitleRow`, `ActionRow`, _View all_, the Modal's ✕, `Snackbar`, the
  `GenreLayout` Back pill, `SettingsHeader`.
- `Toggle`, `TextField` and `Textarea` focus — their UA ring is a recorded
  decision of their own logs.
- `SeasonCard` and `EpisodeRow` — built in step 5 on these fragments.
- A runtime accent picker — the factory makes one possible; nothing asks for
  it.
- A press-duration token.
- Tokenising the untouched `ease` literals.
- Removing `ffSpin`.
- Style-rule assertions of any kind.

## Further Notes

- Design log: `docs/design-logs/21-motion-interaction-states.md` (initiative
  `motion`), run against prototype revision `1a9a656` and code at `ef1dc27`.
- Glossary: the _Motion & interaction states_ section of
  `docs/ubiquitous-language.md` — **Interaction contract**, **Control**,
  **Card**, **Hover**, **Press**, **Keyboard focus**, **Focus ring**, **Accent
  scale**, **Motion tokens**, **Reduced motion**.
- Build order: step 4, ahead of Series (5), Enrichment (6) and the Electron
  shell (7).
- Suggested slices, per the log's plan: (1) tokens, scale, theme factory and
  reduced motion; (2) the control vocabulary and its guard, then Button, Chip,
  IconButton, Filter dropdown and the five extensions; (3) the card
  vocabulary, then Poster card and Continue card; (4) the refactor, §2a
  corrected, and only then README and CLAUDE.md ticked.
- Known trade-off: the guard forbids `180ms` in any shipping file, which a
  future unrelated literal may trip over — it is meant to.
