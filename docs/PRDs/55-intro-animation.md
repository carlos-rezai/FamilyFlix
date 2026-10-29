> **Initiative:** `intro-animation`
> **Design log:** `docs/design-logs/55-intro-animation.md`
> **Issue:** #502 (the PRD, step 38)
> **Build order:** step 38, **Intro animation**, option **2a** (_Bounce, sweep, handoff_) of `docs/handoff/handoff-welcome-splash/`. It ships as thin slices (log 55, _Implementation Plan_), the prototype first. No migration, no route, no wire call: it is renderer furniture alone.

## Problem Statement

My parents open FamilyFlix. The shell's **Start-up splash** beats while the server starts, then the home simply appears: the header, the rows' **Skeletons**, then the posters. Nothing says _FamilyFlix_ the way the brand does; the first thing the family meets is a page loading. The handoff draws a welcome for this moment, about 2.25s that end with the wordmark sitting in the home header, but the app has nowhere to play it, no sense of which start is a cold one, no shared home for the F paths outside `LogoLoader`, and no motion tokens for its curves.

## Solution

On a **Cold start** (the window's first **Launch entry** of its session) the renderer draws the **Welcome splash** over the home. Through the **Welcome intro** the two Fs drop in with a bounce, the ten letters of _FamilyFlix_ rise one by one, and a light sweeps across both in the inverse colour. Then the **Wordmark handoff**: the mark fades, the wordmark glides onto the header's own wordmark, the splash fades out and the home fades in under it, and focus lands on the header's logo button.

If the home's frame isn't ready when the intro ends, the splash holds its last frame with the mark beating as a `LogoLoader` (the **Welcome hold**) and runs the handoff when it is. A home that is ready early never cuts the sequence short. Any click or key skips straight to the home in 150ms, without pressing what lies beneath. Under reduced motion the welcome is a 1.3s fade, never an instant cut. A reload, a deep link or a crashed renderer's reload never replays it.

## User Stories

### Seeing the welcome

1. As a parent, I want a short brand welcome when I open FamilyFlix, so that the app greets me before the library does.
2. As a parent, I want the two Fs to drop in with a bounce, F1 then F2 150ms later, so that the mark arrives the way the prototype draws it.
3. As a parent, I want the ten letters of _FamilyFlix_ to rise and unblur one by one, so that the name builds under the mark.
4. As a parent, I want a light to sweep across the mark and then across each letter, orange over the white shapes and white over the orange ones, so that the welcome has its one moment of shine.
5. As a parent, I want the mark and wordmark sized to my window (a 528px mark and a 120px wordmark on a maximised 1080p screen), so that the welcome fills the TV-sized screen it plays on.
6. As a parent, I want the splash drawn on the same background as the **Start-up splash**, so that the shell's beat and the welcome read as one start.
7. As a parent, I want _Family_ in the text colour and _Flix_ in the accent, as the header draws them, so that the splash wordmark is the header's own.

### Landing on the home

8. As a parent, I want the wordmark to glide from the centre onto the header's wordmark and shrink to its size, so that the welcome ends where the app begins.
9. As a parent, I want the glide to land exactly on the header's wordmark, in its typography, so that nothing jumps when the splash leaves.
10. As a parent, I want the mark to fade and shrink as the wordmark leaves, so that only the name travels.
11. As a parent, I want the home to fade in under the departing splash, so that the welcome hands over rather than cuts away.
12. As a parent, I want the header's wordmark hidden while the splash's own travels onto it, so that I never see two.
13. As a parent, I want the header's wordmark shown and the splash gone in the same frame, so that the swap is invisible.
14. As a parent using the keyboard or a remote, I want focus on the header's logo button once the welcome ends, so that my first key press acts on the home.

### A home that isn't ready yet

15. As a parent, I want the welcome to wait on the home's frame if it isn't drawn when the intro ends, holding the centred wordmark with the mark beating, so that I'm never dropped onto a blank page.
16. As a parent, I want the beating mark to sit exactly where the static mark stood, so that the hold reads as the same frame, alive.
17. As a parent, I want the handoff to run from the hold the moment the home's frame is drawn, so that the wait is never longer than it must be.
18. As a parent, I want the welcome to wait only for the home's frame and not for every row to load, so that a slow library shows its own **Skeletons** rather than keeping me on a splash.
19. As a parent, I want a home that is ready early to still see the whole welcome, so that the sequence is never cut mid-way.

### Skipping

20. As a parent, I want any click or key to skip the welcome, so that I can get to my films at once.
21. As a parent, I want a skip to fade the home in over 150ms, so that even a skip doesn't flash.
22. As a parent, I want the click or key that skips not to also press what lies beneath, so that skipping never opens a film by accident.
23. As a parent, I want a skip that comes before the home is ready to hold on the beating mark and then go straight to the home, so that a skip never shows a blank page.
24. As a parent, I want a skip during the handoff to finish it at once, so that a skip is honoured in every stretch.
25. As a parent, I want focus on the header's logo button after a skip too, so that a skip ends like the full welcome.

### When it plays

26. As a parent, I want the welcome only when I open the app, so that it never stands between me and a film again that session.
27. As the maintainer, I want a reload of `/` not to replay it, so that a reload is a reload.
28. As a parent, I want a crashed renderer's reload or a **Factory reset**'s reload not to replay it, so that recovering feels like recovering.
29. As the maintainer, I want a deep link never to play it, so that a link opens what it names.
30. As the maintainer, I want a browser tab to play it once, so that the dev build shows what the shell shows.
31. As a parent, I want the welcome to play whether my **Start tab** is Movies or Series, so that the welcome doesn't depend on the tab.
32. As a parent, I want it to play even if the browser refuses to read its session storage, so that a storage fault only ever costs a replay, never the welcome.
33. As the maintainer, I want a refused write to session storage ignored, so that a storage fault never throws.
34. As the maintainer, I want the shell's **Start-up splash** unchanged, so that the server's start is still covered before the renderer can draw anything.

### Reduced motion

35. As a parent who has reduced motion on, I want no drop, blur, sweep or glide, so that the welcome doesn't move things across my screen.
36. As a parent who has reduced motion on, I want the mark and wordmark to fade in over 300ms, hold, and the splash to fade out at 900ms while the home fades in, so that I still get a gentle welcome instead of a snap.
37. As a parent who has reduced motion on, I want the header's wordmark simply to fade in with the home, so that there's no glide to watch.
38. As a parent who has reduced motion on, I want the hold and the skip to behave as they do with full motion, so that only the movement changes.

### Assistive tech

39. As a screen-reader user, I want the welcome announced as _Opening FamilyFlix_, so that I know what the pause is.
40. As a screen-reader user, I want the drawn layers hidden from my reader, so that I don't hear letters and paths.
41. As a screen-reader user, I want the home never hidden from my reader nor focus trapped in the splash, so that I'm never locked out.

### The maintainer's code

42. As the maintainer, I want every ordering question of the welcome (hold, skip, never cut) answered by one pure step, so that each is a unit test.
43. As the maintainer, I want the **Launch entry** test lifted into one util, so that the start-tab gate and the welcome ask the same question.
44. As the maintainer, I want the F paths in one renderer home, so that the loader and the splash draw the same mark.
45. As the maintainer, I want the handoff's curves as motion tokens, so that the structural guard refusing a `cubic-bezier(` outside `motion.ts` still holds.
46. As the maintainer, I want the header to take part through a typed context, so that no DOM query or global rule couples the splash to the layout.
47. As the maintainer, I want a layout mounted alone in a test to behave as it does today, so that the welcome adds nothing to unrelated tests.
48. As the maintainer, I want the glossary, `COMPONENT-SPEC.md` and the docblocks to name the new terms, so that the next change reads them.

## Implementation Decisions

- **One initiative** (log 55 Q1), step 38, option 2a alone. Options 1a to 1f are reference only; no sound.
- **The handoff is committed as received** (Q2) and frozen. Phase 1 adds a `COMPONENT-SPEC.md` section for the **Welcome splash** (option 2a, its target under the App folder) and the three motion tokens. No code.
- **Names** (Q3): the **Welcome splash**, its stretches the **Welcome intro** (0 to 1750ms), the **Welcome hold** and the **Wordmark handoff** (the last 500ms). Rejected: _Splash_ alone (the shell's **Start-up splash** owns it), _Intro animation_ (the initiative's name, not the thing on screen).
- **In the renderer** (Q4): it needs the home underneath and the header as its landing place. The **Start-up splash** is unchanged and still covers the server's start.
- **Cold start** (Q5): the renderer's first entry is a **Launch entry** (bare `/`, no query, history key `default`) and the session has no `familyflix.welcomed` flag in `sessionStorage`. The flag is set when the welcome starts. Every storage access is in a `try`; a refused read plays the welcome, a refused write is ignored. Rejected: a preload flag from main.
- **`isLaunchEntry`** (Q6), a new util: `(location: Pick<Location, 'pathname' | 'search' | 'key'>) => boolean`, read by `useStartTabSettled` and the welcome.
- **The units, in the App folder beside the Snackbar stack** (Q7). Rejected: a `features/welcome/` (no domain, no wire).
  - **`WelcomeProvider`**: decides whether the welcome plays, owns the phase and its timers, wraps the routes in the **Home layer**, listens for a skip, moves focus at the end, and draws `WelcomeSplash` over it all. Mounted in `App` inside `SnackbarProvider`, around `<Routes>`.
  - **`WelcomeSplash`**: the drawn layers (background, mark, sweep, letters), given its phase, its geometry and whether motion is reduced. Logic-free.
  - **`useWelcome`**: the context, owned by the hook as `useSnackbar` owns its own, answering `{ wordmarkRef, wordmarkHidden }`. Its default outside a provider is a no-op ref and `false`.
- **The header** (Q8): `MainLayout`'s `LogoMark` takes `wordmarkRef` and is `visibility: hidden` while `wordmarkHidden`. Rejected: a DOM query and a global hiding rule.
- **The F paths** (Q9): lifted from `LogoLoader` into a new `brand` token file (`MARK_F1`, `MARK_F2`, `MARK_VIEWBOX = '160 300 704 424'`), exported from the `tokens` barrel, read by `LogoLoader` and `WelcomeSplash`. The shell's splash page keeps its own copy (the shell imports only types), its docblock naming the token file as source.
- **`welcomeStep`** (Q10), a pure step over a **Welcome phase** `'intro' | 'holding' | 'handoff' | 'skipping' | 'done'`, with state `{ phase, ready, skipped }` and events `'introEnded' | 'ready' | 'skip' | 'handoffEnded' | 'skipEnded'`:
  - `intro` at `introEnded`: `handoff` when ready, else `holding`;
  - `holding` at `ready`: `handoff`, or `skipping` if `skipped`;
  - a `skip` in `intro`, `holding` or `handoff`: `skipping` when ready, else `holding` with `skipped`;
  - `handoff` at `handoffEnded` and `skipping` at `skipEnded`: `done`;
  - a `ready` during `intro` is only recorded: the sequence is never cut.
    The provider's timers send the time events: 1750ms intro, 500ms handoff, 150ms skip; 900ms and 400ms under reduced motion. Rejected: `animationend` as the clock (per element, collapsed by `GlobalStyle`, untestable with fake timers).
- **Ready** (Q11): the header wordmark is mounted, i.e. `wordmarkRef` receives its element, which happens once `StartTabGate` has settled. Rejected: waiting for the rows.
- **The Home layer** (Q12): the routes are mounted from the start inside it, at opacity 0 through `intro` and `holding`, so the header lays out and can be measured. It fades 0 to 1 over 400ms ease-out from 100ms into the handoff. At `done` it is a plain wrapper with no style.
- **Geometry** (Q13): `scale = min(innerWidth / 480, innerHeight / 270)`, read once when the welcome starts; a resize during it is ignored. Mark `132·scale × 80·scale`, centred `26·scale` above the window's centre; wordmark at `30·scale` px, centred `42·scale` below. Rejected: sizing from the header.
- **Curves** (Q14): new motion tokens `easeDrop: cubic-bezier(0.3, 0.6, 0.4, 1)`, `easeSweep: cubic-bezier(0.4, 0, 0.2, 1)`, `easeGlide: cubic-bezier(0.3, 0.7, 0.2, 1)`; the letters use the existing `easeOut`. Durations and delays are the welcome's own constants. Keyframes are the prototype's verbatim (`ffDrop`, `ffLetter`, `ffSweep`, `ffTextSweep`, `ffMarkOut`, `ffIn`, `ffOut`) as `styled-components` keyframes; the glide `ffToHeader` has its end computed.
- **The timeline** (log 55, _Design_): F1 and F2 from 0 and 150ms for 520ms `easeDrop`; letter i from `520 + i·40` for 420ms `easeOut`; mark sweep from 1000ms for 700ms `easeSweep`; letter sweep i from `1150 + i·45` for 380ms linear; then, from the handoff's start, mark out 300ms ease-out, wordmark glide 500ms `easeGlide`, background out from 50ms for 400ms, Home layer in from 100ms for 400ms.
- **Reduced motion** (Q15): read once with `matchMedia` at start. No drop, blur, sweep or glide; mark and wordmark fade in over 300ms, the intro ends at 900ms, the splash fades out over 300ms while the home fades in from 100ms; the handoff is 400ms, total 1300ms. The header wordmark is shown at the handoff's start and fades in with the home. Its rules carry the specificity and `!important` to beat `GlobalStyle`'s collapse, as `LogoLoader`'s do. Rejected: letting the collapse stand.
- **The sweep** (Q16): over the mark, a 220-unit gradient band translating −260 to +760 viewBox units, clipped to each F by an SVG `clipPath` (orange `rgb(255,150,90)` at 0.95 over F1, white at 0.7 over F2), ids from `useId` stripped as `LogoLoader`'s are. Over the letters, a transparent copy of each glyph on top with `background-clip: text`, a 100° band 300% wide (orange at 1 over _Family_, white at 0.9 over _Flix_), `background-position` 160% to −60%.
- **The landing** (Q17): at the handoff's start the header `LogoMark` is measured (`getBoundingClientRect()` and its computed `font-size`). The glide moves the splash wordmark to that rect's top-left, `transform-origin: 0 0`, scaling by `headerSize / (30·scale)`. The splash wordmark is the header's typography at splash size: the theme's serif 700, the header's 0.3px tracking and 2px word gap scaled by the same ratio, `line-height: normal`. Rejected: the prototype's −0.01em tracking and 1.25 line height; reusing `Wordmark` (its words can't rise letter by letter).
- **The end** (Q18): in one frame the header wordmark is shown, `WelcomeSplash` unmounts and the Home layer loses its style; then focus moves to the Home layer's first focusable element (the header's logo button). Rejected: an `inert` home.
- **The Welcome hold** (Q19): the intro's last frame, with a `LogoLoader` at the mark's width (`132·scale`) in the mark's place, beating, no label, `aria-hidden`. On ready the handoff runs from there, the loader fading out as the mark would.
- **The skip** (Q20): any `pointerdown` or `keydown` on `window`, in the capture phase, while the welcome is up, swallowed with `preventDefault` and `stopPropagation`. Ready: the splash goes at once, the Home layer fades in over 150ms (`ffIn`), the header wordmark is shown, then `done` and the focus move. Not ready: the **Welcome hold**, ending the same way on ready.
- **Semantics** (Q21): the splash root is `role="status"`, `aria-label="Opening FamilyFlix"`; every drawn layer is `aria-hidden`. The Home layer is never hidden from assistive tech.
- **Documents** (Q22): `COMPONENT-SPEC.md`; the glossary's new **Intro animation** section (**Welcome splash**, **Welcome intro**, **Welcome hold**, **Wordmark handoff**, **Welcome phase**, **Cold start**, **Home layer**) and updated **Start-up splash**, **Launch entry** and **Wordmark**; the docblocks of `MainLayout`, `LogoLoader`, `useStartTabSettled`, the shell's splash page and `App`. The checklist row stays 🔜 until the refactor.
- **Slices** (log 55, _Implementation Plan_):
  1. the prototype and tokens: the `COMPONENT-SPEC.md` section, the `brand` tokens with `LogoLoader` on them, the three curves;
  2. a welcome that lands: `isLaunchEntry`, `welcomeStep`, `useWelcome`, `WelcomeProvider` and `WelcomeSplash` with the background, the static mark and wordmark, and the **Wordmark handoff** onto the measured header, ending with focus on the logo;
  3. the intro: the drop, the letters and both sweeps, to the timeline;
  4. hold and skip: the **Welcome hold** with its loader; a skip in every phase, swallowed;
  5. reduced motion: the fade timeline, opted out of the collapse;
  6. walk it live and the documents.

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or a parent sees: the phase answered, the splash drawn or gone, the header wordmark hidden or shown, the element focused, the click that didn't land. It never asserts which timer was set or which helper ran.
- **`welcomeStep`**, pure, every transition: `intro` to `handoff` or `holding` at `introEnded`; an early `ready` recorded without leaving `intro`; `holding` to `handoff` or `skipping` at `ready`; `skip` in each live phase, ready and not; `handoffEnded` and `skipEnded` to `done`; events with no transition leave the state unchanged. Prior art: the repo's pure step and reducer tests.
- **`isLaunchEntry`**: bare `/` with key `default` is a Launch entry; a query, another path or another key isn't. Prior art: `src/utils/` tests; `useStartTabSettled`'s existing Launch entry cases keep passing on it.
- **`WelcomeProvider`**, with fake timers, in a router at `/`: a cold start draws the splash with `role="status"` and hides the header wordmark; at 1750ms plus 500ms the splash is gone, the header wordmark shown and focus on the logo button; a home not ready at 1750ms holds with the loader, then hands off on ready; a `pointerdown` or `keydown` skips in 150ms and the click doesn't reach the element beneath; a second mount in the same session, a deep link, or a non-`default` key draws nothing; a throwing `sessionStorage` still plays and a throwing write doesn't throw; under a reduced-motion `matchMedia` the timeline is 900 plus 400ms. Prior art: `SnackbarProvider`'s and `StartTabGate`'s tests.
- **`WelcomeSplash`**: given each phase, draws its layers (static mark or loader, ten letters, sweep), the drawn layers `aria-hidden`, the clip-path ids free of `useId`'s colons. Prior art: `LogoLoader.test.tsx`.
- **Reduced motion opt-out**: the splash's rules inside `prefers-reduced-motion: reduce` carry `!important` with the specificity to beat `GlobalStyle`. Prior art: `LogoLoader.test.tsx`'s and `Button.test.tsx`'s reduced-motion block readers.
- **Motion guard**: `interactionStates.test.tsx` keeps passing with the three new curves in `motion.ts` and none spelled elsewhere.
- **`MainLayout`**: `LogoMark` receives the context's ref and is hidden while `wordmarkHidden`; mounted alone it is visible. Prior art: its existing tests.
- **`LogoLoader`**: unchanged output after reading the paths from the tokens. Prior art: its existing tests.
- **`App`**: the routes render inside the provider. Prior art: `App.test.tsx`.

## Out of Scope

- Replaying the welcome from Settings.
- A welcome on any entry but the **Launch entry**.
- Sound.
- Merging the **Start-up splash** into the welcome, or changing it.
- Every handoff option but 2a.
- Re-laying the welcome on a resize during its 2 seconds.

## Further Notes

- The trade-off is accepted: a cold start shows two brand moments back to back (the shell's beating tile, then the welcome's drop), since the shell's covers a wait the renderer can't.
- `MainLayout` now reads an App-level context, as `ContentFrame` reads the display preference.
- The welcome adds about 2.25s before the family can act; any key or click shortens it.
- The maintainer approved every recommendation of log 55 in advance; this PRD adds no decision the log doesn't hold.
