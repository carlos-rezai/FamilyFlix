# 04 — Movie Detail refactor: stop hoarding components

> Feature shipped across issues #23–#27 (design log
> [`04-movie-detail.md`](../design-logs/04-movie-detail.md), plan
> [`04-movie-detail-plan.md`](../PRDs/04-movie-detail-plan.md)).

## Problem Statement

The movie detail page works and is well tested, but it was built as one screen
rather than as a set of parts. `MovieDetail.tsx` is 415 lines holding **four
components** (`EditMenu`, `LoadingDetail`, `MovieMissing`, `LoadFailed`) plus the
organism and a `metaSegments` helper, beside a `MovieDetail.styles.ts` exporting
**35 styled components**. Nothing else in the codebase has that shape — every
other unit is one folder, one component, one test, one styles file.

The cost is not tidiness. It is that pieces which are obviously reusable were
written in a place nothing else can reach, and the codebase now carries several
copies of the same thing:

**Verbatim duplication, already shipped:**

| Thing                                        | Where it lives                                           |
| -------------------------------------------- | -------------------------------------------------------- |
| `Message` / `MessageTitle` / `MessageBody`   | `HomeRows.styles.ts` **and** `MovieDetail.styles.ts`     |
| `pulse` keyframe + the `Block` skeleton base | `HomeRows.styles.ts` **and** `MovieDetail.styles.ts`     |
| The url-or-gradient art div                  | `MovieDetail`, `PosterCard`, `ContinueCard` — 3 shapes   |
| The 50px bordered button                     | `HomeRows.RetryButton`, `MovieDetail.BackLink`, `Button` |

**Seven hand-styled round icon buttons across five chrome shapes**, none of them
sharing a line of code:

| Call site                         | Size | Chrome                                           |
| --------------------------------- | ---- | ------------------------------------------------ |
| `MainLayout.GearButton`           | 46   | transparent / `textFaint` — matches spec `ghost` |
| `CardCarousel.Left/RightArrow` ×2 | 44   | `rgba(20,17,13,.9)` + `blur(6)` + shadow         |
| `PosterCard.FavButton`            | 34   | `rgba(18,14,10,.5)` + `blur(4)`, absolute        |
| `MovieDetail.MoreButton`          | 44   | `rgba(20,17,13,.6)` + `blur(10)`                 |
| `MovieDetail.CircleToggle` ×2     | 58   | `accentSoft` / `accentLine` / `accent` when on   |

`prim.IconButton` is in COMPONENT-SPEC and was deliberately deferred (design log
Q16) until "three real screens can be compared". Three now exist.

**The `EditMenu` hoards the hardest behaviour on the page.** It owns Escape
close, outside-pointerdown close, close-on-activation, focus return to the
trigger, and `aria-haspopup`/`aria-expanded` — and COMPONENT-SPEC's
`FilterDropdown` (three uses on the browse header) and the `LibraryHeader` gear
menu need every one of those. Today the next menu re-derives it or gets it
wrong.

**One further finding, which explains the drift.** Searching the whole of
`docs/handoff/` for a retry, an error, or an empty state returns nothing: **the
prototype designs none of them.** `HomeRows`' "Your library is empty" and
"Couldn't load your library", and the detail page's two failure screens, are the
only UI in the app with no design source. That is exactly why they diverged
unnoticed — `RetryButton` is `border-radius: 10px` where `BackLink` and
`prim.Button` are `radius.md` (12px). Nothing designed the 10px; it is a
hand-typed literal that predates the primitive.

## Solution

Extract the reusable parts into shared units at their correct rungs, and — this
is the half that makes them real — **migrate every existing call site onto
them**, deleting the copies left behind. A shared unit with one consumer is the
situation that produced this debt; it is not the fix for it.

Six units, in dependency order:

1. **`prim.IconButton`** — the round icon-only button. Owns behaviour and
   geometry only: square size, centring, pill radius, `type="button"`, the
   accessible name, optional pressed state, disabled. **Chrome comes from
   `styled(IconButton)` at the call site**, not from a variant enum. The spec'd
   `ghost` / `outline` faces ship as built-in defaults because they are the two
   the handoff actually names; the three translucent-over-artwork chromes stay
   at their call sites, because `blur(4)` vs `blur(6)` vs `blur(10)` is drift
   between hand-written CSS, and freezing it into a five-member enum would
   encode accidents as API.
2. **`mol.Menu`** — the popup: panel chrome plus the whole dismissal contract
   (Escape, outside pointerdown, activation), focus return, and ARIA wiring. The
   trigger is caller-supplied, because the three menus that need this have
   visually unrelated triggers.
3. **`mol.LoadMessage`** — the centred title / body / action block behind all
   four **Load state** screens.
4. **`prim.Skeleton`** — the pulsing placeholder surface. Each feature keeps its
   own arrangement; only the animation and the surface are shared, because a
   detail-page skeleton and a browse-home skeleton are genuinely different
   pictures.
5. **`prim.Artwork`** — real artwork or the **Gradient fallback**. The glossary
   already defines Gradient fallback as spanning "cards, the detail Poster, and
   the Backdrop", so this is the code catching up to language already agreed.
6. **`prim.Button` gains a router-link form**, so the one bordered 50px control
   that must be an anchor stops being a fourth copy of the same styling.

Then `MovieDetail.tsx` is decomposed: `EditMenu`, **Meta line**, and **Credits
row** each get their own folder, test, and styles, and the two failure wrappers
disappear into `LoadMessage` call sites.

**Zero pixel change, with exactly one recorded exception.** `RetryButton`'s
10px becomes the 12px token it always meant, noted in its commit message and in
the dev journal, because adding a radius prop to `prim.Button` to preserve a
typo would be worse than the 2px.

## Commits

Twenty-five commits in eight groups. Every group is independently revertible,
and the suite (currently **40 files / 459 tests**, green) passes after every
single commit.

The rhythm inside each unit's group is deliberate: **build the shared unit with
its own test and no consumer, then migrate call sites one commit at a time.**
Each migration is small enough to eyeball against the file it replaced, and if
one of them moves a pixel it is obvious which one did.

### Group 0 — Cover before changing (1 commit)

**1. `test: [movie-detail] issue #29 cover the back pill's two paths`**
Add `MoviePage.test.tsx` asserting both back paths against the **current** code:
a normal arrival steps back through history, and a page opened by deep link or
reload (`location.key === 'default'`) lands on `/` instead. This is the one
piece of real logic on this screen with no direct test — today it is covered
only glancingly, by a keyboard-reachability assertion in `App.test.tsx`. Cover
it, then change things around it.

### Group A — `prim.IconButton` and its seven call sites (6 commits)

**2. `feat: [movie-detail] issue #29 add prim.IconButton`**
Build `primitives/IconButton/` to the COMPONENT-SPEC surface, with the icon as a
**child** rather than a name enum, exactly as spec §226 instructs. It forwards
`className` so `styled(IconButton)` works, which is the whole basis of the
chrome strategy. Exported from the primitives barrel. No consumer yet; verified
by its own test.

**3. `refactor: [movie-detail] issue #29 move the gear onto IconButton`**
`MainLayout.GearButton` first, because it is the only call site that matches the
spec'd `ghost` face pixel-for-pixel (46px, transparent, `border: 1px solid
transparent`, `textFaint`, hover `surface` + `textDim`). It proves the default
face is right before any bespoke chrome is layered on it. `GearButton` is
deleted from `MainLayout.styles.ts`.

**4. `refactor: [movie-detail] issue #29 move the card's heart onto IconButton`**
`PosterCard.FavButton` becomes `styled(IconButton)` keeping its absolute
position, `blur(4)`, translucent fill, white/accent colour and hover. It carries
`pressed`, so this commit also proves the toggle half of the API. `PosterCard`'s
existing keyboard test — the one that guards the heart swallowing activation
keys inside a card that is itself activatable — must stay green untouched.

**5. `refactor: [movie-detail] issue #29 move the carousel arrows onto IconButton`**
Both `CardCarousel` arrows become one `styled(IconButton)` base with the two
edge positions on top, preserving `blur(6)`, the shadow, and the accent hover.
The twenty existing carousel tests (paging, edge-hiding, re-measure on resize)
are the safety net and are not edited.

**6. `refactor: [movie-detail] issue #29 move the ⋯ trigger onto IconButton`**
`MovieDetail.MoreButton` becomes `styled(IconButton)` keeping `blur(10)`.

**7. `refactor: [movie-detail] issue #29 move the two circles onto IconButton`**
`MovieDetail.CircleToggle` becomes `styled(IconButton)` keeping its 58px size and
its `$on` chrome (`accentSoft` fill, `accentLine` border, `accent` ink). The
transient `$on` prop is consumed by styled-components and never reaches the DOM.
Both toggles keep `pressed`, their titles, and their labels exactly as they are.

### Group B — `mol.Menu` and the edit menu (2 commits)

**8. `feat: [movie-detail] issue #29 add mol.Menu`**
Build `components/Menu/` owning open state, the three close paths, focus return,
panel chrome, and the pop animation. The trigger is supplied by the caller and
receives the ref and the ARIA props to spread. `MenuItem` ships from the same
file. No consumer yet.

**9. `refactor: [movie-detail] issue #29 give the edit menu its own folder`**
`EditMenu` moves out of `MovieDetail.tsx` into
`features/movie-detail/EditMenu/`, composing `Menu` and keeping only what is
genuinely its own: the ⋯ trigger and the single **Edit details** item navigating
to `/add?movie=<id>`. Every one of the eight existing edit-menu assertions in
`MovieDetail.test.tsx` stays exactly where it is and stays green — that is the
proof the dismissal contract survived the move intact.

### Group C — `mol.LoadMessage` and the bordered button (4 commits)

**10. `feat: [movie-detail] issue #29 let Button render as a router link`**
`prim.Button` gains a narrow polymorphic form: given a `to`, it renders a
`react-router` `Link` with identical styling. This is what lets the one
anchor-shaped call site ("Back to library") share the control instead of being a
fourth copy of it — and it is the semantically correct fix, since that control
is a navigation, and a parent should be able to middle-click it.

**11. `feat: [movie-detail] issue #29 add mol.LoadMessage`**
Build `components/LoadMessage/` — centred title, body, and an optional action
slot that owns the action's top margin. Named after the glossary's existing
**Load state**, since three of its four uses are literally a Load state. No
consumer yet.

**12. `refactor: [movie-detail] issue #29 move the home's messages onto LoadMessage`**
`HomeRows`' empty and error states become `LoadMessage`, and `RetryButton`
becomes `prim.Button variant="secondary"`. **This commit moves the Retry
button's corner radius from a hand-typed 10px to the 12px `radius.md` token that
COMPONENT-SPEC specifies for `size="md"`** — the single pixel change in this
refactor, called out here and in the dev journal. `Message`, `MessageTitle`,
`MessageBody` and `RetryButton` are deleted from `HomeRows.styles.ts`.

**13. `refactor: [movie-detail] issue #29 move the detail's messages onto LoadMessage`**
`MovieMissing` and `LoadFailed` collapse into `LoadMessage` call sites, deleting
both wrapper components; `BackLink` becomes `<Button to="/" variant="secondary">`.
The detail page's copy carried `position: relative; z-index: 10` to clear the
backdrop — that stays, as a `styled(LoadMessage)` at this call site, rather than
being pushed into the shared unit where the browse home would inherit a
stacking context it has no use for.

### Group D — `prim.Skeleton` (3 commits)

**14. `feat: [movie-detail] issue #29 add prim.Skeleton`**
Build `primitives/Skeleton/` owning the `pulse` keyframe and the placeholder
surface, sized by the call site.

**15. `refactor: [movie-detail] issue #29 move the home's skeletons onto Skeleton`**
`HomeRows`' seven skeleton pieces re-express as `Skeleton` extensions; the
duplicate keyframe and `Block` go.

**16. `refactor: [movie-detail] issue #29 move the detail's skeletons onto Skeleton`**
The same for the detail page's six, deleting the second copy of the keyframe.
Both screens keep their own arrangement, which is the point — they draw
different pictures out of the same material.

### Group E — `prim.Artwork` (4 commits)

**17. `feat: [movie-detail] issue #29 add prim.Artwork`**
Build `primitives/Artwork/` — an optional url plus the two **Gradient fallback**
stops, resolving to `center / cover` artwork or the deterministic
`linear-gradient(155deg, …)`.

**18. `refactor: [movie-detail] issue #29 move the poster card onto Artwork`**

**19. `refactor: [movie-detail] issue #29 move the continue tile onto Artwork`**
`ContinueCard` passes no url. That is not a gap to fill later: design log 03
decided the continue tile has no image slot, permanently. Passing nothing is how
that decision reads in code once the shared unit exists.

**20. `refactor: [movie-detail] issue #29 move the detail art onto Artwork`**
Both the **Backdrop** and the detail **Poster**, which are the same component
used twice with different sources.

### Group F — decompose `MovieDetail.tsx` (3 commits)

**21. `refactor: [movie-detail] issue #29 give the meta line its own component`**
`metaSegments` and its rendering become
`features/movie-detail/MetaLine/`, with its own test and styles. It is a
glossary term (**Meta line**, **Meta segment**) that had no component. The
guarantee it owns — that a dangling separator is unrepresentable, because
separators are generated _between_ survivors — becomes testable in isolation
rather than only through the whole page.

**22. `refactor: [movie-detail] issue #29 give the credits row its own component`**
`features/movie-detail/CreditsRow/`, owning the "—" for one missing credit and
the omit-only-when-both-are-missing rule. Also a glossary term (**Credits row**).

**23. `refactor: [movie-detail] issue #29 give the loading state its own folder`**
`LoadingDetail` moves to `features/movie-detail/LoadingDetail/`. `MovieDetail.tsx`
is now one component in one file, like every other unit in the codebase.

### Group G — Documentation (2 commits)

**24. `docs: [movie-detail] issue #29 record the new units in the glossary`**
Add `docs/ubiquitous-language.md` rows for **Load message**, **Skeleton**, and
**Menu**, and extend the **Gradient fallback** row to name `Artwork` as the
component that draws it. `IconButton` and `Button` are already spec'd terms.

**25. `docs: [movie-detail] issue #29 journal the refactor`**
A dev-journal entry, newest first: what shipped, the one moved pixel, what was
deliberately not changed (below), and the follow-ups this surfaced.

## Decision Document

- **Six shared units, at these rungs.** `IconButton`, `Skeleton`, and `Artwork`
  are **primitives** — no domain knowledge, no composition. `Menu` and
  `LoadMessage` are **components** (molecules) — composed, still domain-free.
  `MetaLine`, `CreditsRow`, `EditMenu`, and `LoadingDetail` stay inside
  `features/movie-detail/`, because they know what a movie is.
- **`IconButton` owns behaviour and geometry; chrome comes from
  `styled(IconButton)`.** Rejected: a `variant` enum covering all five chromes.
  Three of the five would exist only because two hand-written CSS blocks picked
  different blur radii and alphas; an enum would freeze that accident into the
  API and invite a sixth member the next time someone needs a slightly different
  translucency. The spec's `ghost` and `outline` ship as built-in defaults
  because the handoff names those two deliberately. Consequence: `IconButton`
  must forward `className`.
- **`IconButton`'s accessible name is a required `label` prop**, distinct from
  the optional `title`. Rejected: following COMPONENT-SPEC's table, where one
  `title` sets both. Four current call sites would gain a hover tooltip they do
  not have today, and the two toggle call sites would lose `aria-pressed`. A
  required `label` also makes an unnamed icon-only button unrepresentable, which
  the current hand-styled buttons could not guarantee. `pressed` is an optional
  prop mapping to `aria-pressed`, for the favourite heart and the two circles.
- **`Menu`'s trigger is caller-supplied.** The three menus that need this
  behaviour — the ⋯ overflow, `FilterDropdown` ×3, and the `LibraryHeader` gear
  — have visually unrelated triggers, so a `Menu` that rendered its own trigger
  would be widened on first contact with the second one. It supplies the ref and
  the ARIA props for the caller to spread. Rejected: a `useMenu` hook instead of
  a component — the panel chrome (surface, border, radius, shadow, pop
  animation) is as duplicated as the behaviour, and a hook shares only half.
- **`LoadMessage`, not `EmptyState`.** Two of its four uses are failures, not
  empty states, so `EmptyState` would misname half its call sites; and the
  glossary has no "empty state" concept to hang it on, whereas **Load state** is
  already defined. Rejected: `Notice` — general enough to tell a reader nothing.
- **`prim.Button` gains a `to` form** rather than the app keeping a separate
  link-shaped twin. Rejected: extracting the chrome into a shared `css` fragment
  consumed by both a `Button` and a `BackLink` — two components kept in sync by
  hand is the exact failure mode this refactor exists to undo.
- **Skeletons share the material, not the picture.** Only the pulse and the
  surface are extracted. Rejected: full per-screen skeleton components — the
  arrangements have exactly one caller each and always will, because they are
  tracings of two different screens.
- **`Artwork` absorbs all three card/detail art divs, `ContinueCard` included.**
  The glossary already defines **Gradient fallback** as covering cards, the
  detail Poster, and the Backdrop, so one component drawing it is the code
  agreeing with the language. `ContinueCard` passing no url is design log 03's
  decision made visible, not an omission.
- **Zero pixel change, one recorded exception.** Every extraction is pure.
  `HomeRows.RetryButton` moves 10px → 12px, because nothing in `docs/handoff/`
  designs that button at all, COMPONENT-SPEC states `md = radius-md`, and the
  10px is a hand-typed literal predating `prim.Button`. Rejected: a `radius`
  escape hatch on `Button` to preserve it — encoding a typo as API.
- **`MoviePage.BackPill` is deliberately not migrated.** It is a labelled pill,
  not an icon-only button, so `IconButton` is the wrong home for it. It keeps
  its own copy of the translucent-over-artwork chrome, which is now shared with
  nothing. Recorded as accepted rather than fixed: a shared overlay treatment
  wants a real design decision about what "chrome floating over artwork" is, and
  that belongs to a grill, not to a refactor.
- **One issue, eight independently revertible groups**, matching the
  card-carousel refactor's proven shape (#21, 17 commits, one issue, one journal
  entry).
- **COMPONENT-SPEC is not amended.** `LoadMessage`, `Skeleton`, and `Artwork`
  are structural decisions about our code, not design additions — CLAUDE.md
  gives the prototype the visual surface and our patterns the code. The glossary
  is updated instead, because that is where our own vocabulary lives.
- **No barrel churn beyond the category barrels.** New units are re-exported
  from `primitives/index.ts` and `components/index.ts` directly from their
  files; no per-unit barrels.
- **No server change, no schema change, no API change.** This refactor does not
  cross `src/`.

## Testing Decisions

**What makes a good test here:** assert what a caller or a parent can observe —
the text on the screen, which control is offered, what happens when it is
clicked or a key is pressed. Never assert a styled-component's class name, a
mapper's intermediate value, or that a helper was called. This is the convention
every existing test file already follows, and it is why this refactor is
tractable: a test that never knew which file a button lived in does not care
that the button moved.

- **The existing 459 tests are the safety net and are not edited.** They pass
  before every commit and after every commit. `MovieDetail.test.tsx` (876
  lines), `HomeRows.test.tsx` (461), `CardCarousel.test.tsx`, `PosterCard.test.tsx`
  (162) and `MainLayout.test.tsx` between them cover every migration target's
  behaviour. An untouched test file passing after an extraction **is** the proof
  the extraction was pure — which is why they stay whole rather than being split
  to follow the code.
- **One characterization test is added first** (`MoviePage.test.tsx`), covering
  the back pill's two paths against the current implementation, because it is
  the only behaviour in the area with no direct coverage.
- **Each new shared unit gets its own test**, covering its own contract and
  nothing else:
  - `IconButton` — renders its child icon, carries its accessible name, reflects
    `pressed`, raises `onClick`, blocks the click when disabled.
  - `Menu` — starts shut and says so; opens on the trigger; closes on Escape, on
    an outside pointerdown, and on activating an item; returns focus to the
    trigger every time; reports `aria-expanded` correctly.
  - `LoadMessage` — renders title and body, renders an action when given one and
    no action affordance when not.
  - `Skeleton` — presentational; asserts it is hidden from assistive technology
    rather than announced as content.
  - `Artwork` — draws artwork when given a url and the gradient stops when not.
  - `Button` — the new `to` form renders a link to that destination, and the
    existing button form is unchanged.
  - `MetaLine` — the separator rules, in isolation: one separator between two
    survivors, none beside an absent segment, stars alone when nothing else
    survives.
  - `CreditsRow` — "—" for one missing credit, omitted only when both are gone.
- **Prior art for each of these** is already in the repo: `Button.test.tsx` and
  `Chip.test.tsx` for a presentational primitive; `ExpandableText.test.tsx` for a
  molecule with local state and a measurement it must not assert directly;
  `MovieDetail.test.tsx`'s edit-menu block for a dismissal contract driven by
  real Escape presses and pointerdowns; `PosterCard.test.tsx` for a toggle nested
  inside a larger activatable surface.
- **Test count only grows.** No assertion is deleted or moved in this refactor.

## Out of Scope

- **`MoviePage.BackPill`** — a labelled pill, not an icon button; keeps its own
  translucent chrome (see Decision Document).
- **A shared "chrome over artwork" treatment** spanning `BackPill`,
  `MoreButton`, the carousel arrows and `FavButton`. Their alphas, blur radii,
  borders and hovers all differ, and deciding what they _should_ be is a design
  question for a grill, not something to settle inside a refactor.
- **Building the rest of COMPONENT-SPEC's primitives** — `TextField`,
  `Textarea`, `Toggle`. They have no call site yet; this refactor only extracts
  things that already exist two or more times.
- **`FilterDropdown` and `LibraryHeader`** — `Menu` is built so they inherit the
  dismissal contract, but they belong to the Search + filter feature and are not
  built here.
- **Re-homing `saveFavorite`** out of `features/library/api/`. It moves when the
  Favorites feature lands and both call sites move together, as design log Q7
  decided. Nothing about this refactor changes that timing.
- **The watched/resume-position semantics** (design log Q11) — flagged for the
  watch-tracking grill, and a behaviour question rather than a structural one.
- **`eslint-plugin-jsx-a11y` severity**, the missing `@testing-library/user-event`,
  and the tsconfig scaffolding leftovers — three follow-ups the card-carousel
  refactor recorded in the dev journal. All still worth doing, all their own
  issues.
- **Any change to `server/`.**

## Further Notes

**Why the migrations are the deliverable, not the extractions.** The tempting
version of this refactor stops after Group A's first commit: `prim.IconButton`
exists, the box is ticked, and seven hand-styled buttons carry on unchanged. That
version is worse than doing nothing, because it adds an eighth way to make a
round button. Each unit is only finished when the copies it replaced are deleted,
which is why every group is written as build-then-migrate-then-delete.

**The prototype has no failure states, and that is the root cause.** The one
piece of UI in this app with no design source is the one piece that drifted. It
is worth noticing that the refactor which fixes it is also the one that has to
invent a name (`LoadMessage`) with no handoff file to check it against. Two of
these screens will be seen by a parent — an empty library on first run, and a
failure — and neither has ever been designed. Worth raising at the next grill.

**The `MovieDetail.tsx` decomposition is deliberately last.** Groups A–E remove
roughly a third of that file by moving pieces into shared units, so the split in
Group F is over what genuinely remains rather than over its current shape.
Splitting first would mean writing folders for components that Group C then
deletes.

**Fowler's rule is the whole structure of this plan.** Each commit is small
enough that the program is visibly working after it, the suite is green at every
step, and if a pixel moves it is obvious which of twenty-five commits moved it.
