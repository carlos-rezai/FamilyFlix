# Refactor plan: Intro animation, a wordmark that is no button, a sweep that paints only its band, a start-up that gives way to the welcome, and the docs that close step 38

> Source initiative: `intro-animation`, issue 502 (step 38).
> Shipped by issues 503 to 508. The prototype lift is 503; the build slices,
> RED and GREEN each, are 504 to 508 (up to `655f45a8`).
> Design log: `docs/design-logs/55-intro-animation.md`.
> PRD: `docs/PRDs/55-intro-animation.md` (502). Plan:
> `docs/PRDs/55-intro-animation-plan.md`.
> This is the initiative's closing round. It ticks **Intro animation** and
> closes 502. Filed as issue 509.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`intro-animation` shipped every phase of its plan. Walking it in the shell,
the maintainer found three things wrong with what the family sees.

### 1. The wordmark turns into a focused button

The header **Wordmark** sits inside `MainLayout`'s `Logo`, a `<button>` that
navigates to `/`. The design log made it the focus target: at `done`,
`WelcomeProvider` moves focus to `wordmark.closest('button')` (log 55 Q18,
after the README's "move focus to the first focusable element"). So every
**Cold start** ends with the wordmark wearing a focus ring, reading as a
link. The maintainer's rule: **the wordmark is never clickable, anywhere in
FamilyFlix**, and nothing is focused when the welcome ends.

Verified in the code:

- `MainLayout` is the only place the **Wordmark** is pressable. The About card
  and the **Default poster** draw it inert; `GenreLayout` has no logo.
- `MainLayout` is composed by `LibraryPage` alone, so the logo only ever
  pressed home from the home. The tabs, _Back to library_, every **Landing**
  and **Fresh home** still reach `/` without it.
- The prototype draws it pressable: `page.LibraryPage.dc.html`'s header `div`
  carries `onClick="{{ lib.onLogo }}"` and `cursor: pointer`, and
  `FamilyFlix.dc.html` defines `onLogo` (set the Movies tab, `goBrowse`).
  The prototype is the spec, so it is amended first.

### 2. A light rests on _Flix_ before the sweep

Before the letter sweep reaches them, the right side of each _Flix_ glyph
carries a pale tint instead of the plain accent. Traced to the per-glyph
sweep copies (`LetterSweep`): a `background-clip: text` gradient 300% wide,
positioned `160% 0` before its run. The background **repeats** by default,
so the neighbouring tile's band lands on the glyph's right 30%: white over
_Flix_ (seen), orange over _Family_ (near its own glow, so missed). At the
end position (`-60% 0`) the same repeat leaves a faint band on each glyph's
left edge. The frozen prototype has the same flaw (`Welcome Splash.dc.html`,
the 2a `letters` copies set `backgroundSize: '300% 100%'` and no repeat), so
this is a handoff fix, recorded where the build records departures from a
frozen handoff: `COMPONENT-SPEC.md`.

### 3. Two brand moments back to back

Opening the app shows the shell's **Start-up splash** (the 88px tile, the
FF beat, _Opening your library_) and then the **Welcome splash**. Log 55
accepted that as a trade-off (Q4, "unchanged"; the glossary's "after the
**Start-up splash** and never instead of it"). The maintainer now wants the
welcome to **replace** that loader when the app opens, and only there: the
**Logo loader** stays where else it is drawn (the **Welcome hold**, the
**Dialog loader**).

Verified in the code and the logs:

- The **Start-up splash** is drawn once per window, at `whenReady`, by
  `openWindow` loading `splashPage()`; nothing else loads it (a crash reload
  or a **Factory reset** reload reloads the renderer, not the splash).
- It can't simply go: it is the window's first paint and covers the
  server's start, which the renderer (served by that server) can't.
- The **Shell log**'s last six starts took 0.58s to 1.05s from _Starting the
  server_ to _Server ready_. The welcome's first frame is bare `bg`, the
  splash's own background.

### What else the round found

- `WelcomeSplash`'s docblock has one run-on line (the `useId` sentence) past
  80 columns.
- `WelcomeSplash.styles.ts` docblocks read `i�40`, `i�45` and `100�` where
  `·` and `°` were meant (the letter cell, the sweep copy).
- The feature checklist row is still 🔜 and step 38's entry still planned.

## Solution

1. **The wordmark is no button.** The prototype's header loses `onLogo` and
   its pointer; `MainLayout` draws `LogoMark` straight in the header, inert;
   `WelcomeProvider` moves no focus at `done`.
2. **The sweep paints only its band.** A **Welcome splash** amendment in
   `COMPONENT-SPEC.md`; `LetterSweep` sets `background-repeat: no-repeat`.
3. **The Start-up splash gives way to the welcome.** It draws bare `bg`, the
   **Welcome splash**'s first frame; the tile, its beat and _Opening your
   library_ fade in only on a **Slow start**, when the server hasn't let the
   app load after 2000ms.
4. **The initiative's docblocks cleaned.**
5. **The docs that close step 38.**

No wire, schema, route, Settings or token change.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean, except a
`test:` RED commit, which the commit gate lets through by design (it checks
only the shipping projects). Each commit is
`<type>: [intro-animation] issue #509 …`.

### Group 1: the wordmark is no button

1. **`docs: … the prototype's wordmark is no button`.**
   - `page.LibraryPage.dc.html`: the header wordmark `div` loses
     `onClick="{{ lib.onLogo }}"` and `cursor: pointer`; it keeps its flex,
     baseline, 2px gap, `user-select: none` and `flex: 0 0 auto`.
   - `FamilyFlix.dc.html`: the library model drops `onLogo`.
   - `COMPONENT-SPEC.md`: wherever `page.LibraryPage` or the header names the
     logo as a control, it reads as the **Wordmark**, not pressable.
   - No code changes; every suite passes.
2. **`test: … the wordmark is no button, RED`.**
   - `MainLayout.test`: the header draws the wordmark first and the gear
     last, with no button named _FamilyFlix_; pressing the wordmark leaves
     the route where it was. _Navigates home when the logo is clicked_ goes:
     the behaviour is withdrawn. The slot-order and outside-a-welcome cases
     find the wordmark inside the banner, not by a button role.
   - `LibraryPage.test`: its `logo()` finds the wordmark in the banner.
   - `App.test`: _lands the logo on the Movies tab, with no wait_ goes, and
     the Start tab block's docblock stops listing the logo among the ways
     onto `/`; the Settings comment that mentions pressing the logo is
     reworded.
   - The four `WelcomeProvider` suites (`test`, `handoff`, `holdAndSkip`,
     `reducedMotion`): their `logoButton()` and wordmark helpers become one
     `headerWordmark()`, the banner's first element; every _focus on the
     logo_ assertion becomes **focus left on the document body** at `done`,
     after a skip and under reduced motion alike.
3. **`fix: … the wordmark is no button`.**
   - `MainLayout`: `Logo` goes; `LogoMark` sits in the header with the
     wrapper's `flex: 0 0 auto` and `user-select: none`, its ref and
     `$hidden` unchanged. `useNavigate` stays for the gear. The docblock's
     "the logo and the gear are app-wide navigation" becomes the gear alone,
     and the welcome paragraph names the wordmark, not a logo button.
   - `WelcomeProvider`: the focus `useLayoutEffect` goes (and its import);
     the docblock's "focus lands on the header's logo button" sentence goes.
   - The landing is unchanged: the measured element was always `LogoMark`,
     and the button had no padding, so the header lays it out where it was.

### Group 2: the sweep paints only its band

4. **`docs: … the welcome's sweep copies don't repeat their band`.**
   `COMPONENT-SPEC.md` section 5b gains an _Amendments_ list (the frozen
   folder stays as `e9c9d09c` left it, as `App.welcomeSplashSpec` pins): the
   letter sweep copies paint their band once (`background-repeat:
no-repeat`), since a repeating 300% band rests on each glyph's right edge
   before its run and its left edge after; and, from Group 1, focus stays
   where it is at the end, the header wordmark being no control.
5. **`test: … the sweep copies paint their band once, RED`.** The intro
   suite, where it already reads each glyph's sweep copy (its band, 300%
   width, its delay), asserts `background-repeat: no-repeat` on all ten.
6. **`fix: … the sweep copies paint their band once`.** `LetterSweep` sets
   `background-repeat: no-repeat`; its docblock says why in a clause.

### Group 3: the Start-up splash gives way to the welcome

7. **`test: … the Start-up splash waits for a slow start, RED`.**
   `splashPage.test`, in its existing string-reading style:
   - it exports `SLOW_START_MS`, 2000;
   - the tile and _Opening your library_ stand in one group drawn at
     opacity 0, faded in over 300ms from `SLOW_START_MS`, fill `both`;
   - the body is still `bg` and still loads nothing; the F paths, the beat
     and its reduced-motion fade stay as tested.
8. **`fix: … the Start-up splash waits for a slow start`.**
   - `splashPage.ts` exports `SLOW_START_MS = 2000` (as `serverHandle`
     exports `READY_TIMEOUT_MS`), wraps the tile and the line in one group
     and gives it an `appear` keyframe, 300ms ease-out, delayed by it. The
     beat runs underneath from the start, so it is mid-beat when it shows.
   - Its docblock: the window's first paint is bare `bg`, the **Welcome
     splash**'s first frame; on a **Slow start** the loader fades in.
   - `main.ts` is untouched: `ready-to-show` still fires on the splash's
     first paint, now an empty `bg`.

### Group 4: the initiative's docblocks

9. **`refactor: … the welcome's docblocks read clean`.** `WelcomeSplash`'s
   docblock rewrapped to 80 columns; `WelcomeSplash.styles.ts`'s `i�40`,
   `i�45` and `100�` read `i·40`, `i·45` and `100°`, saved as UTF-8. No code
   changes; every suite passes.

### Group 5: the docs

10. **`docs: … the docs know the welcome as shipped`.** After walking it in
    the shell (a cold start on Movies and on Series, a skip by click and by
    key, a reload, reduced motion on, a slow start forced by a delayed
    server):
    - **Glossary**: **Start-up splash** (updated): bare `bg`, its loader
      only on a **Slow start**; **Slow start** (new): a server not ready
      2000ms after the window opened, `SLOW_START_MS`; **Wordmark** (updated):
      never pressable, the header's included; **Wordmark handoff**
      (updated): at its end the header wordmark is shown, focus left where
      it is. The invariants: a window session plays the **Welcome splash**
      on its **Cold start** in the place of the **Start-up splash**'s loader
      (unless the start is slow); the logo leaves the list of ways onto `/`.
      A short dialogue in the section's voice. The older dialogues are
      snapshots and stay.
    - **Docblocks**: `MainLayout`, `WelcomeProvider`, `useWelcome` (if it
      names the logo), `splashPage`, `LogoLoader` (if it names the
      **Start-up splash**'s beat as every start's).
    - **Feature checklist**: the row becomes _Intro animation: the FF mark
      opens FamilyFlix_, ✅; step 38's entry in step 37's shape, naming the
      three fixes of this round.
    - **Release checklist**: a cold-start smoke: no tile before the welcome,
      the wordmark lands unfocused and inert, _Flix_ plain accent until the
      sweep; a slow start shows the tile after 2s.
11. **`docs: … the journal`.** A newest-first entry in `docs/dev-journal.md`
    in the last entry's shape: what the walk found, what each group changed,
    what was deliberately not changed, the follow-ups. The commit closes 502
    in words, not with a keyword, and this issue with one.

## Decision Document

- **The Wordmark is brand, not navigation.** No surface makes it pressable.
  The home already offers its tabs; the logo's one destination (`/`, the
  Movies tab, filters reset) is reached by the Movies tab and every **Fresh
  home**. Withdrawn behaviour, so its tests go rather than turn.
- **The header wordmark is `LogoMark` itself**, no wrapper: one element
  carries the ref, the hiding, the measurement and the layout. A wrapper
  with nothing to do would be the "inline styled `<div>`" the rules refuse.
- **No focus move at `done`.** Log 55 Q18 followed the README to the first
  focusable element; without the button that is the search bar, and
  focusing a text field on every start would raise a caret, and on a touch
  screen a keyboard. Focus stays where a page load leaves it, the document
  body, as on every non-cold start. Recorded as an amendment, since the
  handoff is frozen.
- **A frozen handoff is amended in `COMPONENT-SPEC.md`**, not edited:
  `handoff-welcome-splash/` stays pinned to `e9c9d09c` by
  `App.welcomeSplashSpec`, as `handoff-loading-states/` is. The live
  prototypes (`page.LibraryPage`, `FamilyFlix.dc.html`) are edited in place.
- **`no-repeat`, not a wider band or new keyframes.** The prototype's
  gradient, size and positions are kept verbatim; only the tiling, which it
  never meant, goes. Nothing shows outside the run at either end.
- **The Start-up splash keeps its job and its unit.** It is still the
  window's first paint and still covers the server; it changes what it
  draws. A `data:` page can't hand off to the renderer (log 53 Q21), and the
  welcome needs the home under it (log 55 Q4), so the welcome itself stays
  in the renderer.
- **A Slow start, at 2000ms.** Twice the slowest start in the **Shell log**
  (1.05s), so a normal open shows the welcome alone, while a cold disk or a
  long migration still sees something live before the 15s **startupFailed**
  dialog. A CSS delay inside the static page: no script, no timer, no bridge.
  It is not the **Loader timing** rule (300ms), which is for actions the
  family started and would show the tile on every open.
- **"Only when opening the app" needs no new condition**: the **Start-up
  splash** is drawn only at `whenReady`. The **Logo loader** primitive, the
  **Welcome hold** and the **Dialog loader** are untouched.
- **Copy unchanged**: _Opening your library_ stays the shell's line and
  _Opening FamilyFlix_ the welcome's status.
- **Nothing on the schema, the wire, routes, Settings, tokens or the shell's
  wiring changes.**

## Testing Decisions

- **A good test asserts what the family or a caller sees**: no button named
  _FamilyFlix_, a press on the wordmark going nowhere, where focus rests at
  the end, the copies' painted background, what the splash page draws and
  when. Never which hook ran or how a styled component is named.
- **Modules tested**: `MainLayout`, `LibraryPage`, `App` (the launch block),
  the four `WelcomeProvider` suites, the intro suite's sweep copies, and
  `splashPage`.
- **Prior art**: `MainLayout.test`'s slot-order and outside-a-welcome
  cases; `WelcomeProvider.holdAndSkip.test`'s `expectHome` for the end
  state; the intro suite's reading of the sweep copies' styles;
  `splashPage.test`'s string checks; `serverHandle.test` for an exported
  timing constant.
- **The rest of the initiative's suites carry every commit unchanged**:
  `welcomeStep`, `useWelcome`, `isLaunchEntry`, `brand`, `GlobalStyle`,
  `App.welcome`, `App.welcomeSplashSpec`, `LogoLoader`.
- **Characterization before change**: a suite that has to change anywhere
  else than named here is reading an implementation detail, and is fixed in
  the same commit with the reason in the body.
- **The gate**: the full suite at the end of each GREEN commit;
  `tsc -b --force` and `eslint src server electron` at the end of each
  group. The round ends with no more lint errors or warnings than it began.
- **The walk** (commit 10) is the only check of the real timings and the
  real paint: jsdom can't see a background tile or a window's first frame.

## Out of Scope

- **Folding the welcome into the shell**, or the shell's page into the
  renderer (log 53 Q21, log 55 Q4).
- **Measuring the start at runtime** to pick the delay; the constant is
  tuned from the log, and the walk confirms it.
- **The frozen `handoff-welcome-splash/`** itself, and every option but 2a.
- **Replaying the welcome from Settings, sound**, and everything log 55 put
  out of scope.
- **Any other pressable brand**: there is none today; the rule is written
  into the glossary so none is added.

## Further Notes

- Order: Group 1 before Group 2's commit 4 (its amendment names Group 1's
  focus rule). Commit 2 before 3, 5 before 6, 7 before 8. Groups are
  otherwise independent; Group 5 last.
- Follow-ups this plan already sees, for the journal: none required. If the
  walk shows the renderer's own load pushing an ordinary open past 2000ms,
  the constant is raised in commit 8, with the measurement in its body.
