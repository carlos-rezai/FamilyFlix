# Plan: Intro animation, the Welcome splash on a cold start

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/502

Today a cold start beats the shell's **Start-up splash**, then the home simply
appears. This initiative draws the **Welcome splash** (option 2a of
`docs/handoff/handoff-welcome-splash/`) over the home on a **Cold start**: the
Fs drop in, _FamilyFlix_ rises letter by letter, a light sweeps both, and the
wordmark glides onto the header's own. It waits on the home's frame in the
**Welcome hold**, yields to any click or key, and fades gently under reduced
motion.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** No phase is
HITL.

- The handoff `docs/handoff/handoff-welcome-splash/` is already committed as
  received and stays frozen. Phase 1 carries option 2a into
  `COMPONENT-SPEC.md`, so it needs no Claude Design round. The PRD and log 55
  fully specify every timing, curve, size and copy line, so a phase never
  stops to ask.
- **Each phase stays well under a 100k-token context.** The prototype files
  are large (`COMPONENT-SPEC.md` about 102 KB, the handoff's `support.js`
  about 60 KB, `Welcome Splash.dc.html` about 30 KB). A phase reads the
  handoff's `README.md` (small) whole, then greps the prototype for the
  section it needs (`2a`, `ffDrop`, `ffLetter`, `ffSweep`, `ffTextSweep`,
  `ffMarkOut`, `ffToHeader`, `reduce`) and reads only that range.
- No test runs Electron. Every timeline is driven with fake timers; the
  provider is the clock (Q10), never `animationend`.
- The phases are log 55's _Implementation Plan_ slices 1 to 5, with slice 2
  split into a welcome that ends (phase 2) and the **Wordmark handoff** onto
  the measured header (phase 3), so no issue outgrows one context.
- Log 55's slice 6 is not a phase. Its live walk (a cold start on Movies and
  on Series, a skip by click and by key, a slow settings read held on the
  loader, a reload, reduced motion on) is the maintainer's, after the
  refactor; every behaviour it watches is already pinned by a phase's tests.
  Its documents are spread over the phases: each phase writes the docblocks
  of the units it adds or touches, and phase 1 writes the spec section. The
  glossary already carries the **Intro animation** section and the updated
  **Launch entry**, **Start-up splash** and **Wordmark**. The checklist's
  step 38 row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none added or changed. No migration, no wire call, no server
  change; the welcome is renderer furniture alone.
- **Schema**: none. The one stored value is `sessionStorage`'s
  `familyflix.welcomed` flag, set when the welcome starts. Every access is in
  a `try`: a refused read plays the welcome, a refused write is ignored.
- **Key models**:
  - `isLaunchEntry(location: Pick<Location, 'pathname' | 'search' | 'key'>)`
    in `src/utils/`: bare `/`, no query, key `default`. Read by
    `useStartTabSettled` and by the **Cold start** rule.
  - `WelcomePhase = 'intro' | 'holding' | 'handoff' | 'skipping' | 'done'`;
    `welcomeStep` is pure over `{ phase, ready, skipped }` and the events
    `'introEnded' | 'ready' | 'skip' | 'handoffEnded' | 'skipEnded'`, with
    the transitions of the PRD's Q10 bullet. In `src/App/welcomeStep/`.
  - `WelcomeProvider`, `WelcomeSplash` and `useWelcome` live in `src/App/`
    beside the Snackbar stack. `WelcomeProvider` is mounted in `App` inside
    `SnackbarProvider`, around `<Routes>`, and wraps them in the **Home
    layer**. `useWelcome` answers `{ wordmarkRef, wordmarkHidden }`; outside
    a provider, a no-op ref and `false`.
  - **Ready** is the header wordmark mounted: `wordmarkRef` receiving its
    element, once `StartTabGate` has settled. Never the rows.
  - `MainLayout`'s `LogoMark` takes `wordmarkRef` and is `visibility: hidden`
    while `wordmarkHidden`.
- **Tokens**: `src/tokens/brand.ts` with `MARK_F1`, `MARK_F2` and
  `MARK_VIEWBOX = '160 300 704 424'`, exported from the barrel. `motion.ts`
  gains `easeDrop: cubic-bezier(0.3, 0.6, 0.4, 1)`,
  `easeSweep: cubic-bezier(0.4, 0, 0.2, 1)` and
  `easeGlide: cubic-bezier(0.3, 0.7, 0.2, 1)`. No `cubic-bezier(` outside
  `motion.ts`.
- **Clock**: 1750ms intro, 500ms handoff, 150ms skip; 900ms intro and 400ms
  handoff under reduced motion. Durations and delays are the welcome's own
  constants.
- **Geometry**: `scale = min(innerWidth / 480, innerHeight / 270)`, read once
  at start. Mark `132·scale × 80·scale`, centred `26·scale` above the
  window's centre; wordmark at `30·scale` px, centred `42·scale` below.
- **Semantics**: the splash root is `role="status"`,
  `aria-label="Opening FamilyFlix"`; every drawn layer is `aria-hidden`; the
  **Home layer** is never hidden from assistive tech nor made `inert`.

---

## Phase 1: The prototype and the tokens

**User stories**: 44, 45, 48 (the spec section and the docblocks it touches)

### What to build

Add the **Welcome splash** section to `COMPONENT-SPEC.md`: option 2a, its
target under the App folder, its units (`WelcomeProvider`, `WelcomeSplash`,
`useWelcome`, `welcomeStep`), the three new curves and the hold and skip
rules. Lift the F paths from `LogoLoader` into the new `brand` token file and
read them back in `LogoLoader`; the shell's splash page keeps its own copy,
its docblock naming the token file as source. Add the three curves to
`motion.ts`. Demo: the loader beats exactly as before, drawn from the tokens.

### Acceptance criteria

- [ ] `COMPONENT-SPEC.md` names the **Welcome splash**, its units, its phases
      and its three curves.
- [ ] `MARK_F1`, `MARK_F2` and `MARK_VIEWBOX` are exported from the `tokens`
      barrel; `LogoLoader` reads them and its tests pass unchanged.
- [ ] `easeDrop`, `easeSweep` and `easeGlide` are in `motion.ts`; the motion
      guard in `interactionStates.test.tsx` still passes.
- [ ] `LogoLoader`'s and the shell splash page's docblocks name `brand.ts`.
- [ ] `handoff-welcome-splash/` is unchanged.

---

## Phase 2: A cold start draws the welcome and ends on the home

**User stories**: 1, 5, 6, 7, 12, 13, 14, 26 to 34, 39 to 43, 46, 47

### What to build

`isLaunchEntry` lands and `useStartTabSettled` asks it. `welcomeStep` lands
whole, every transition of Q10, so later phases only wire events to it.
`useWelcome` and `WelcomeProvider` decide a **Cold start**, set the session
flag, run the clock, and wrap the routes in the **Home layer** at opacity 0
until the handoff. `WelcomeSplash` draws the background (the **Start-up
splash**'s), the static mark from the `brand` tokens and the static
wordmark (_Family_ in the text colour, _Flix_ in the accent, the header's
typography at splash size), sized by the geometry. `MainLayout`'s `LogoMark`
takes the ref and hides while `wordmarkHidden`. At the end of intro plus
handoff, in one frame, the header wordmark shows, the splash unmounts and the
Home layer loses its style; focus moves to the header's logo button. The
handoff here is a plain fade; phase 3 gives it the glide. Docblocks of
`App`, `MainLayout` and `useStartTabSettled` name the welcome. Demo: open
the app at `/`; the static welcome shows for about 2.25s, then the home, with
focus on the logo; a reload shows the home at once.

### Acceptance criteria

- [ ] `isLaunchEntry`: bare `/` with key `default` is a Launch entry; a
      query, another path or another key isn't. `useStartTabSettled`'s
      existing cases pass on it.
- [ ] `welcomeStep` answers every transition of Q10; an early `ready` is
      recorded without leaving `intro`; an event with no transition leaves
      the state unchanged.
- [ ] A cold start at `/` draws the splash with `role="status"` named
      _Opening FamilyFlix_, its drawn layers `aria-hidden`, and the header
      wordmark hidden.
- [ ] At 1750ms plus 500ms the splash is gone, the header wordmark shown, and
      focus on the logo button.
- [ ] A second mount in the same session, a deep link, a query or a
      non-`default` key draws nothing.
- [ ] A throwing `sessionStorage` read still plays the welcome; a throwing
      write doesn't throw.
- [ ] It plays whether the **Start tab** is Movies or Series.
- [ ] The Home layer is never `aria-hidden` nor `inert`.
- [ ] `MainLayout` mounted alone shows its wordmark; `App`'s routes render
      inside the provider; unrelated tests are untouched.

---

## Phase 3: The Wordmark handoff lands on the header

**User stories**: 8, 9, 10, 11

### What to build

At the handoff's start the provider measures the header `LogoMark`
(`getBoundingClientRect()` and its computed `font-size`). The splash wordmark
glides (`ffToHeader`, 500ms `easeGlide`, `transform-origin: 0 0`) to that
rect's top-left, scaling by `headerSize / (30·scale)`, its tracking and word
gap scaled by the same ratio so it lands in the header's typography. The mark
fades and shrinks (`ffMarkOut`, 300ms ease-out), the background fades out
from 50ms for 400ms, and the Home layer fades in from 100ms for 400ms
ease-out. Demo: the wordmark travels from the centre onto the header's own
and the swap at the end is invisible.

### Acceptance criteria

- [ ] At the handoff's start the splash wordmark's glide ends at the measured
      header rect, scaled by the header's size over the splash's.
- [ ] The splash wordmark uses the theme's serif 700, the header's 0.3px
      tracking and 2px word gap at the splash scale, `line-height: normal`.
- [ ] The mark, the background and the Home layer run their handoff
      keyframes with the PRD's delays and durations.
- [ ] The header wordmark stays hidden through the glide and is shown in the
      frame the splash unmounts.

---

## Phase 4: The intro

**User stories**: 2, 3, 4

### What to build

The **Welcome intro** to the timeline, the prototype's keyframes verbatim as
`styled-components` keyframes: F1 and F2 drop from 0 and 150ms for 520ms
`easeDrop` (`ffDrop`); letter i rises and unblurs from `520 + i·40` for
420ms `easeOut` (`ffLetter`); the mark sweep from 1000ms for 700ms
`easeSweep` (`ffSweep`), a 220-unit band from −260 to +760 viewBox units
clipped to each F (orange `rgb(255,150,90)` at 0.95 over F1, white at 0.7
over F2), clip ids from `useId` stripped as `LogoLoader`'s are; letter sweep
i from `1150 + i·45` for 380ms linear (`ffTextSweep`), a transparent glyph
copy on top with `background-clip: text`, a 100° band 300% wide (orange at 1
over _Family_, white at 0.9 over _Flix_), `background-position` 160% to
−60%. Demo: a cold start plays the drop, the rising letters and the shine
before the glide.

### Acceptance criteria

- [ ] The splash draws two Fs, ten letters and their sweep layers, all
      `aria-hidden`.
- [ ] Each F and each letter carries its keyframe, delay, duration and curve
      from the timeline.
- [ ] The sweep's clip-path ids are free of `useId`'s colons and each F's
      band is clipped to its own path.
- [ ] _Family_'s sweep is orange and _Flix_'s white.

---

## Phase 5: The Welcome hold and the skip

**User stories**: 15 to 25

### What to build

If the home isn't ready when the intro ends, the splash holds its last frame
with a `LogoLoader` at the mark's width (`132·scale`) in the mark's place,
beating, unlabelled, `aria-hidden`, and the handoff runs from there the
moment the header wordmark mounts, the loader fading out as the mark would.
A home that is ready early still sees the whole intro. Any `pointerdown` or
`keydown` on `window`, in the capture phase while the welcome is up, is
swallowed (`preventDefault`, `stopPropagation`) and skips: ready, the splash
goes at once, the Home layer fades in over 150ms (`ffIn`), the header
wordmark shows, then `done` and the focus move; not ready, the Welcome hold,
ending the same way on ready. A skip during the handoff finishes it at once.
Demo: a slow settings read holds on the beating mark; a click mid-intro lands
on the home in 150ms without opening the poster beneath.

### Acceptance criteria

- [ ] A home not ready at 1750ms holds with the loader in the mark's place,
      then hands off on ready.
- [ ] A home ready before 1750ms still plays to 1750ms.
- [ ] A `pointerdown` or `keydown` in `intro`, `holding` or `handoff` skips;
      ready, the home shows in 150ms with focus on the logo button.
- [ ] A skip before ready holds, then goes straight to the home on ready.
- [ ] The click or key that skips doesn't reach the element beneath.
- [ ] Once `done`, clicks and keys reach the home as usual.

---

## Phase 6: Reduced motion

**User stories**: 35 to 38

### What to build

Read `matchMedia('(prefers-reduced-motion: reduce)')` once at start. Under
it, no drop, blur, sweep or glide: the mark and wordmark fade in over 300ms,
the intro ends at 900ms, the splash fades out over 300ms while the home fades
in from 100ms, the handoff 400ms, 1300ms in all. The header wordmark is shown
at the handoff's start and fades in with the home. The splash's rules carry
the specificity and `!important` to beat `GlobalStyle`'s collapse, as
`LogoLoader`'s do. The hold and the skip behave as with full motion. Demo:
with reduced motion on, a cold start fades in and out with nothing moving.

### Acceptance criteria

- [ ] Under a reduced-motion `matchMedia` the splash is gone at 900ms plus
      400ms, with focus on the logo button.
- [ ] No drop, letter rise, sweep or glide layer animates; the header
      wordmark is shown from the handoff's start.
- [ ] The splash's rules inside `prefers-reduced-motion: reduce` carry
      `!important` with the specificity to beat `GlobalStyle`.
- [ ] The hold and the skip pass their phase 5 cases under reduced motion.
