## Problem Statement

I am the maintainer, and my family are the people who use this app. The browse
home is the screen they live on: a **Continue Watching** row, a **Favorites**
row, and then one row per genre, twelve of them, for a library of a few hundred
films. On a full library that page is over six thousand pixels tall — measured
at 6390 against a 698px viewport — and the only way back up is the way down:
the wheel, the scrollbar, or a long drag on a trackpad.

That matters more here than on most screens, because the thing at the top is
the thing they came for. The search bar and the genre / rating / sort dropdowns
live in the header — which stays put — but the row they actually wanted is
usually near the top: what they were half-way through, what they had marked to
watch. Reach the bottom looking for something, not find it, and the trip back is
the same trip in reverse.

The prototype answered this in twelve lines: `page.LibraryPage` holds a ref to
its scrolling body, keeps `showFab` as `scrollTop > 420`, mounts `mol.Fab` only
while that is true, and on a press rides the body to the top smoothly. The
molecule was drawn in full — the 52px accent circle, the ink, the shadow, the
lift, two glyphs — and `COMPONENT-SPEC` named its target and drew the line:
presentational, does not own visibility, mount and unmount it.

The codebase has been waiting for it too. `MainLayout`'s root has carried
`position: relative` under the comment _a positioning context for the
back-to-top FAB_ since the search initiative, and its docblock ends on a
placeholder sentence — _the back-to-top FAB still lands with the feature that
owns it_ — that no grill ever examined. And the build order in `CLAUDE.md` names
this step 2 of the four that are left: the last renderer-only slice before the
Electron shell, with nothing under it and nothing above it.

The one thing that is not a straight translation is _who mounts it_. The
prototype's page holds the body ref, so the prototype's page decides. In the
codebase that page was split three ways — chrome to `MainLayout`, rows to
`HomeRows`, composition to `LibraryPage` — and the body ref lives in the layout,
attached by `useRestoredScroll`. Twelve lines of page state need a home in a
codebase whose page is composition only, whose layout is structure only, and
whose features are about movies.

## Solution

The **Back-to-top FAB**: the prototype's `mol.Fab` translated 1:1 as a
presentational molecule, and a control composed of it that owns the **Scroll
threshold**, the listener and the press — mounted by the **Chrome**, which
lends it the body's ref the way it already lends the same ref to scroll
restoration.

**Three rungs, none skipped.** The maintainer's sketch was _a Fab component
which consists of our button component, and a Back-to-top control made of the
Fab_. Read against the app, that ladder is `IconButton` → **FAB** →
**Back-to-top**. The primitive that fits is `IconButton`, not `Button`: a 52px
accent circle around a glyph is an icon-only button, which `IconButton` already
is — the square, the centring, the pill corner, `type="button"`, the required
accessible name — and the **FAB** is that primitive wearing a face, exactly as
the favorite heart, the carousel arrows, the ⋯ trigger and the detail page's
circles already are. `Button`'s `label` is visible text and its sizes are
heights with side padding; making it a circle would fight every rule in it.

**The molecule knows nothing and owns nothing.** `Fab` is handed an icon, a
label, a size and a handler and draws a circle at 28px from the bottom-right
corner, on the accent, in the near-black ink, under the accent shadow, lifting
on hover. It has no listener, no state, no `useEffect`, no idea there is a
threshold. That is the line `COMPONENT-SPEC` draws, and it is what makes it
testable by rendering it.

**The control owns the number, and the chrome mounts the control.** `BackToTop`
takes the scrolling container as a ref, reads its `scrollTop` on every scroll
and once on attach, holds one boolean, and renders the **FAB** past 420 or
nothing under it. Pressing it asks the container for the top, smoothly.
`MainLayout` mounts it in one line beside the body it already owns — the layout
holds no state for it, learns no domain from it, and the argument is the one
that put scroll restoration there: _the body is where the scrolling happens, so
the chrome is what knows how far it has gone_. Not a feature: there is no movie
in a scroll control, and `features/library/home/` would be holding it only
because it happens to share a screen. Not the page: composition only, and a
page that creates a ref has stopped being one.

**The browse home only, as the prototype draws it.** `page.LibraryPage` is the
one prototype file that mounts a **FAB**; the genre page, the movie page and
Settings draw none. `GenreLayout` does not get one, even though a 214-card
shelf is the longer scroll — that is a grill and a prototype amendment first,
not a prop today. `MainLayout` has one consumer and it is the home, so there is
no opt-out prop either.

**Mount and unmount, nothing else.** No transition on hover or on entry: the
prototype declares none, and the spec note is explicit that a prop-driven
entrance is unreliable across re-renders. Under the threshold the control
renders `null`; past it, the **FAB** is simply there.

**Both glyphs, one caller.** The prototype's `icon` enum is `arrow-up | plus`,
and only `arrow-up` has a screen. Both ship — the Snackbar's rule: half an enum
is a deviation from the spec dressed up as restraint. The day a screen wants a
`plus` circle, the molecule and the glyph are there and only the caller is new.

## User Stories

### The family, on the browse home

1. As a family member, I want a round arrow button to appear in the
   bottom-right corner once I have scrolled a good way down the home screen,
   so that I know there is a way back up that is not the wheel in reverse.
2. As a family member, I want pressing that button to glide the screen back to
   the top rather than snap, so that I can see where I am going and nothing
   jumps.
3. As a family member, I want the button to disappear once I am near the top,
   so that the corner of a screen I have not scrolled is empty.
4. As a family member, I want the button to already be there when I press Back
   into a home screen that was left far down, so that a screen I return to
   behaves like the one I left.
5. As a family member, I want the button to be gone by the time the glide
   finishes, so that a control whose job is done is not still sitting over the
   first row.
6. As a family member, I want the button to sit over the page without moving
   with it, so that it is in the same corner however far I have scrolled.
7. As a family member, I want the button to be the app's accent colour with a
   soft shadow, so that it reads as a control and not as part of a poster
   behind it.
8. As a family member, I want the button to lift slightly under the mouse, so
   that I know it is pressable before I press it.
9. As a family member, I want the button never to appear on the genre page, a
   movie page or Settings, so that the home is the one screen with it, as
   designed.
10. As a family member, I want scrolling to stay smooth when the button is on
    screen, so that a control watching the scroll does not make the scroll
    stutter.

### Keyboard and assistive technology

11. As a family member using a screen reader, I want the button to announce
    itself as **Back to top**, so that a bare arrow is not read out as
    "button".
12. As a family member using a keyboard, I want the button reachable by Tab
    while it is on screen, so that I can press it without a mouse.
13. As a family member using a screen reader, I want the arrow not to be
    announced separately from the button's name, so that the picture is not a
    second sentence.
14. As a family member using a keyboard, I accept that after the press my
    focus lands on the page body rather than on a control — the button has
    gone, and nothing designed where focus should go instead.

### The maintainer, and the callers to come

15. As the maintainer, I want the **FAB** to be a molecule any screen can
    mount, so that the day one wants a `plus` circle, only the caller is new.
16. As the maintainer, I want the **FAB** to draw the arrow or the plus by an
    `icon` prop and never both, so that the two glyphs the prototype designed
    are both real.
17. As the maintainer, I want the **FAB** to require an accessible name rather
    than default one, so that a `plus` circle is never announced as
    **Back to top** because nobody thought to override it.
18. As the maintainer, I want the **FAB** to take a `size`, so that the 52px
    the home uses is the default and not the only answer.
19. As the maintainer, I want the **FAB** to own no state and no listener, so
    that rendering it is enough to test it.
20. As the maintainer, I want **Back-to-top** to take any scrolling element as
    a ref, so that the day a grill puts it on `GenreLayout`, the layout lends a
    ref and nothing else changes.
21. As the maintainer, I want the **Scroll threshold** to be one named constant
    with a comment saying whose number it is, so that 420 is traceable to the
    prototype and not a magic number.
22. As the maintainer, I want the layout to mount the control in one line and
    hold no state for it, so that `MainLayout` stays structure only.
23. As the maintainer, I want the control to write state only when the answer
    changes, so that a six-thousand-pixel scroll is not six thousand
    re-renders.
24. As the maintainer, I want the scroll listener to be passive, so that the
    browser never waits on it before scrolling.
25. As the maintainer, I want the listener gone when the control unmounts, so
    that a test never leaks one and a gone tree never hears a scroll.
26. As the maintainer, I want the press to ask the container — never the
    document — for the top, so that the control agrees with the app's rule that
    the document never scrolls.
27. As the maintainer, I want scroll restoration to remember 0 for an entry
    the family rode to the top, so that a press and Back agree about where the
    screen was left.
28. As the maintainer, I want the **FAB** built on `IconButton` and not a bare
    `<button>`, so that the round icon-only control has one primitive under
    every face in the app.
29. As the maintainer, I want the **FAB**'s hover to obey `IconButton`'s two
    extension rules, so that a disabled circle never lights up and nothing
    leaks up from the ghost face.
30. As the maintainer, I want the placeholder sentence in `MainLayout`'s
    docblock rewritten by this build, so that the docblock says what the code
    does.

### What is deliberately absent

31. As the maintainer, I want no **FAB** on `GenreLayout`, so that a screen the
    prototype does not draw one on does not get one on the strength of a longer
    scroll.
32. As the maintainer, I want no opt-out prop on `MainLayout` and no threshold
    prop on the control, so that there is no knob nobody turns.
33. As the maintainer, I want no `useBackToTop` hook, so that `hooks/` keeps its
    2+ features rule and the layout is never the thing holding `visible`.
34. As the maintainer, I want no transition on hover or on mount, so that the
    prototype's snap is the app's snap and the spec's warning is honoured.
35. As the maintainer, I want `prefers-reduced-motion` left unhonoured here, so
    that a convention belonging to `GlobalStyle` and to every motion at once is
    not started in one component.
36. As the maintainer, I want no focus management after the press, so that a
    control that lets focus go is not replaced by one that teleports it.
37. As the maintainer, I want the corner shared with the **Snackbar stack** left
    as the prototype draws both, so that a problem no screen has today is not
    solved in code before it is solved in the prototype.
38. As the maintainer, I want no amendment to the prototype, so that the
    `.dc.html` files are translated as written.

## Implementation Decisions

### The units

Four units and one amended file, in two phases:

- **`primitives/Icon/`** gains two glyph files, each on the shared `IconBase`
  frame, stroking in `currentColor`, decorative unless titled — named for
  **what they draw**, because a primitive knows nothing about the domain:
  **`ArrowUpIcon`** (the prototype's `M12 19V5m0 0l-6 6m6-6l6 6`, stroke 2.2,
  round caps and joins) and **`PlusIcon`** (`M12 5v14M5 12h14`, stroke 2.2,
  round caps). Their sizes — 24 and 26 in the prototype — are the molecule's
  to pass, not the glyphs' to know. Both re-exported from the `primitives/`
  barrel.
- **`components/Fab/`** — the molecule, its test and its styles, re-exported
  from the `components/` barrel with its props and icon types. A composed,
  domain-free block: it does not know what it floats over or why.
- **`components/BackToTop/`** — the control and its test, re-exported from the
  `components/` barrel with its props type. **Two files, no styles**: it draws
  nothing of its own, `Fab` draws — and the rule is that the trigger for a
  folder is companion files, so a unit with no styles has no styles file. The
  two-file precedents at this rung are `LibrarySearch`, `LibraryFilters` and
  `RetryableFailure`.
- **`layouts/MainLayout/`** — one line added after the body, and the docblock's
  placeholder sentence rewritten.

`BackToTop` lives in `components/` and nowhere else. It is domain-free; it is
composed of a molecule, which `FilterDropdown` and `SubtitleRow` composing
`MenuItem` already do at this rung; and it owns DOM-derived local state, which
`ExpandableText`'s `overflowing` and `Modal`'s listeners already do. Not
`layouts/MainLayout/BackToTop/`: no layout has sub-units, and a control that
takes any container is reusable by another layout the day a grill says so.
Not `features/`: no domain. Not `hooks/`: one caller.

### The molecule's contract

Flat, and 1:1 with the prototype's `data-props` in its order — `CLAUDE.md`'s
rule is that the `data-props` **is** the prop interface:

- `icon?` — `'arrow-up' | 'plus'`, defaulting to `'arrow-up'`.
- `label` — the accessible name, **required**.
- `size?` — the circle's diameter in px, defaulting to 52.
- `onClick` — required.

**One deviation, on `label`.** The prototype defaults it to _Back to top_;
here it is required. A default that is right for one icon and wrong for the
other is not a default, and `IconButton` requires a name for the same reason —
an icon-only button without one announces as "button". The type is the
prototype's; only the preview convenience is dropped, as `COMPONENT-SPEC` §226
dropped `IconButton`'s seven-name list.

### The molecule's chrome, 1:1

`Fab` is `styled(IconButton)` — one more `styled(IconButton)` face beside the
favorite heart, the carousel arrow, the ⋯ trigger, the detail page's circle
toggle and the chrome's icon button — and passes `label`, `size` and `onClick`
straight through, choosing the glyph by `icon`.

The face is the prototype's inline style, literally: `position: absolute;
right: 28px; bottom: 28px; z-index: 60`; `background` the accent token;
`color: #1a1109`; `border: none`; `box-shadow: 0 8px 28px rgba(217, 122, 78,
0.42)`. Hover, guarded `:enabled`: the accent-hover token, the same ink again,
and `transform: translateY(-2px) scale(1.05)`.

Four literals stay literal because translating is not inventing: **28px** is
not a spacing token (`s5` is 24, `s6` is 32); **`#1a1109`** is ink on the
accent fill rather than a surface, so no `--color-*` fits it, the same
explanation `Button.styles` already carries; the **shadow** because
`tokens.css` declares no shadow token; and **`z-index: 60`** because the
prototype writes it. `border-radius` is left to `IconButton`'s pill, which on
a square is the prototype's `50%`. `position: absolute` rather than the spec
prose's _fixed_: inside a `100vh` root the two are the same box, and the
`.dc.html` is the prototype — it sits over `MainLayout.Root`'s existing
`position: relative`.

`IconButton`'s two extension rules are obeyed: the hover is `&:hover:enabled`,
and it replaces both `background` and `color`, so nothing leaks up from the
ghost face underneath.

No `transition`. The prototype declares none, so the lift snaps.

### The control's contract

`BackToTop` takes one prop — `container`, a `RefObject` to the element that
scrolls — and renders `<Fab icon="arrow-up" label="Back to top" onClick={…} />`
past the threshold, or `null` under it. It is the one place in `components/`
where a prop is a ref rather than a value: an honest shape for a control over
someone else's scroll container, recorded as such.

The **Scroll threshold** is a module constant of 420, with a comment naming
`page.LibraryPage` as whose number it is. The comparison is `scrollTop > 420`,
strictly — at exactly 420 there is no FAB. Not a prop: no caller wants
another, and a knob nobody turns is a knob.

The position is read **on every `scroll` event of the container, passive, and
once on attach**. The second is not in the prototype and is needed here: a
screen returned to by Back is put to its remembered position by
`useRestoredScroll` before the family touches anything, and the FAB must
already be there when the rows land. The restore's writes do fire `scroll` in
a browser; the read on attach is what the tests can hold to. State is written
only when the answer changes — the prototype's own
`if (show !== this.state.showFab)` — so a long scroll is not a long
re-render. The listener is removed on unmount.

The press calls the container's `scrollTo({ top: 0, behavior: 'smooth' })`,
1:1. Never anything on the document: the document never scrolls in this app.
`useRestoredScroll` sees the ride as scroll events and ends up remembering 0
for the entry — correct, because the family asked for the top.

Entrance and exit are mount and unmount, nothing else. The button unmounts the
moment the ride drops the body under 420, and focus falls to the body; that
is the prototype's behaviour, accepted rather than managed.

### The mount

`MainLayout` renders the control immediately after its body, handing it the
same ref `useRestoredScroll` attached — the body, then `BackToTop` with that
ref as its container. The layout holds no state for it. Its docblock's _still
lands with the feature that owns it_ is rewritten to say the chrome mounts it
and why. `MainLayout.Root`'s `position: relative` and its comment are already
correct and stay.

No opt-out prop. `MainLayout` has one consumer, the home, and the prototype
puts the FAB on it.

### Nothing in `src/types/`, nothing in `test-support/`

No `types/` entry: no route will ever see a FAB. The icon and props types come
off the molecule through the `components/` barrel, `ModalProps`' precedent.
No new test double: `stubScrollMetrics` already gives every element a writable
`scrollTop`, and the press's `scrollTo` is stubbed per test on the carousel
suite's `scrollBy` precedent.

### What is not built

No FAB on any screen but the home. No `GenreLayout` mount, opt-out prop,
threshold prop or `useBackToTop` hook. No transition, animation, reduced-motion
handling or focus management. No fix for the corner shared with the **Snackbar
stack** — both bottom-right, the stack above at `z-index: 200`, so a notice
covers the FAB while it is up, as the prototype draws both; no screen raises a
notice on the home today. No `plus` FAB with a screen. No prototype amendment.

## Testing Decisions

**A good test here renders the thing and reads what is on screen.** The
molecule is tested by rendering it and querying the button by its name; the
control by owning a container, moving its `scrollTop`, firing `scroll`, and
asking whether the button is there. Never a state variable, a listener's
handle or a styled-component's class. The prior art is the suite's own:
`CardCarousel.test.tsx` proves a scroll-driven control by moving a stubbed
`scrollLeft` and firing `scroll`, and stubs `scrollBy` with a spy to assert
what the row asked for; `MainLayout.test.tsx` already proves the body's scroll
restoration over `stubScrollMetrics`; `Modal.test.tsx` proves listeners are
gone by pressing keys after unmount.

### `Fab.test.tsx` — the molecule, by rendering it

- A button named by `label`.
- `icon` chooses the glyph: the arrow's path is drawn for `arrow-up`, the
  plus's for `plus`, never both.
- The default icon is the arrow.
- Pressing it asks `onClick`.
- `size` is the square's edge, and 52 is the default.

### `BackToTop.test.tsx` — the threshold, over `stubScrollMetrics`

Driven over a container the test owns, whose ref it hands in:

- Nothing at 0.
- The FAB after a scroll past 420.
- Nothing at exactly 420.
- Gone again on the way back under the line.
- Already there on attach when the container was past the line before the
  control mounted — the Back case.
- The press calls the container's `scrollTo` (stubbed — jsdom has none on
  elements) with `{ top: 0, behavior: 'smooth' }`.
- The listener is gone after unmount: a scroll fired afterwards changes
  nothing.

### `MainLayout.test.tsx` — extended

- Past the threshold the FAB appears over the layout's own body, and pressing
  it asks that body for the top.

No `LibraryPage` test: composition only, nothing to assert.

### The two Icon tests

One test file per glyph, on the `UploadIcon` / `DownloadIcon` precedent: the
path data matches the prototype's, the icon renders at the size given on the
shared 24×24 frame, it strokes in `currentColor` at the prototype's 2.2, and
it is decorative unless titled. **This amends design log 19 Q23**, which lists
three suites and no icon tests. The Snackbar PRD made the same amendment to
log 18 Q10 once `Icon/` had test files; it now has seven, and two glyphs
copied path-for-path from a prototype are worth pinning the same way.

## Out of Scope

- **Any screen but the browse home.** `GenreLayout`, the movie page and
  Settings draw none in the prototype. A 214-card shelf wanting one is a grill
  and a prototype amendment first.
- **An opt-out prop** on `MainLayout`, and **a threshold prop** on the control.
- **A `useBackToTop` hook**, a slot, a context or a render-prop to hand the
  body out of the layout.
- **A `Button` base, a bare `styled.button`, or an `accent` variant on
  `IconButton`.**
- **A transition** on hover or on mount, and **`prefers-reduced-motion`** —
  now seven motions wait on the `GlobalStyle` pass.
- **Focus management** after the press.
- **The corner shared with the Snackbar stack.** A notice covers the FAB while
  it is up; solving that is a prototype amendment for the day it is a problem
  on screen.
- **A `plus` FAB with a screen.** The glyph and the enum ship; a caller does
  not.
- **A prototype amendment** of any kind.
- **A `types/` entry** and **a new `test-support/` double.**

## Further Notes

**The instruction that was read rather than followed.** The maintainer's
sketch said the FAB _consists of our button component_, and the app has two —
`Button`, whose `label` is visible text, and `IconButton`, the round icon-only
one every `styled(IconButton)` face extends. Log 19 Q5 reads the instruction as
the second. The ladder the maintainer drew holds — `IconButton` → **FAB** →
**Back-to-top** — and only the bottom rung is renamed. Flagged here as it was
in the glossary, so it can be overruled rather than discovered.

**Who mounts it is the only real decision in the slice, and it supersedes a
sentence.** `MainLayout`'s docblock has promised since the search build that
_the back-to-top FAB still lands with the feature that owns it_. No feature
owns it, because there is no movie in it; the chrome that owns the body owns
how far it has scrolled, which is the same argument that put scroll
restoration there. The build rewrites the sentence.

**The read on attach is the one thing not in the prototype.** The prototype's
page has no scroll restoration, so its FAB never has to be there before anyone
scrolls. Ours does — `useRestoredScroll` puts a revisited home back to 3700
before the rows have landed — and a FAB that waited for the first wheel tick
would be the one thing on a restored screen that was not restored.

**"Fab" and "FAB".** The prototype file and the component are `Fab`
(`mol.Fab.dc.html`, `components/Fab/`); the term in prose, in the feature
lists and in the glossary is **FAB**. Code follows the component convention,
prose follows the acronym.

**The focus drop is the prototype's, and it is recorded rather than fixed.**
Pressing the FAB ends with focus on the body, which is where the prototype
leaves it and where a keyboard user will notice. Moving focus to the header or
the first card was rejected: nothing designed it, and a control that teleports
focus is a bigger surprise than one that lets it go.

**What gets ticked, and when.** **Back-to-top FAB** ✅ in README and
`CLAUDE.md`'s feature lists, the build-order chain losing step 2 with the
remaining three keeping their numbers and their gates, and `COMPONENT-SPEC`'s
`mol.Fab` row gaining a _what shipped_ note (the layout mounts it, `label` is
required) — all of it **after this initiative's refactor**, not when the build
issues close.

---

Design log: `docs/design-logs/19-back-to-top-fab.md`
Glossary: the **Back-to-top FAB** section of `docs/ubiquitous-language.md`
