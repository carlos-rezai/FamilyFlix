## Problem Statement

I am the maintainer, and my family are the people who use this app. Every
screen has a Back, and most of them do what a parent expects: they return to
the screen behind, as it was left — the shelf still filtered, the row still
scrolled to where they were. That is the **Back rule** the app has had since
the movie page was built: a **History step**, with the library as the
fallback for a screen that has nothing behind it.

Four screens never got that rule. The player's Back pill and its Escape, the
form's _Save changes_, Import's Back, and Resolve's _Save & continue_, _Skip
this one_ and Back all go to a URL instead of stepping back to it. On screen
the two look identical — the right page appears — but the router now holds a
duplicate entry, and the next Back walks into it. Reproduced in the browser on
2026-09-21:

- A parent opens a film, presses Play, presses Back, presses Back again — and
  is in the player, not the library.
- I open Settings, open Import, press Back, press Back again — and I am on
  Import.
- I visit a film's player, come back, and delete the film — and land in the
  player of a movie that no longer exists.
- A parent comes back from the player to the film's page and finds it
  scrolled to the top, though they left it further down — scroll restoration
  remembers by history entry, and the push made a new one.

None of it is visible until the second press, which is why it survived three
initiatives. The prototype cannot show it either: a stateless screen switcher
has no history, so it can only say _where_ each leaving lands, never whether
it pushes or steps. The build order names this step 3 of the seven that are
left, ahead of the Electron shell, because the shell would ship the bug as
its own.

## Solution

**Arriving pushes, leaving steps.** One rule on every screen, and the rule is
the hook that already exists. `useGoBack` grows one parameter — the screen's
own **Landing** for the no-history case — and the four pushes become four
more callers of it. Every way _off_ a screen that means "I am done here" —
Back, Escape, a save, a Skip, a Delete — is a **History step**, so no
**Leaving** ever leaves a duplicate entry behind. Every way _onto_ a screen
stays a push, as today.

Each screen keeps its own landing, read off nothing but what the screen
already knows: the player lands on its movie, Import lands on Settings, the
**Movie form** lands where its **Form context** came from — the **Review
step** for a resolve, the movie for an edit, Settings for an add. The landing
fires only on a deep link or a reload, which the packaged app almost never
sees, and it stays a push so the screen it lands on has a Back of its own.

Two leavings stay pushes on purpose: the form's _Add to library_ and Import's
_Finish_. Those are the prototype's two `goBrowse()` calls that survive — a
**Fresh home**, at the top, nothing filtered, the film just added on its
shelf — and they mean a new home rather than the one behind.

No second hook, no second rule, no prototype amendment. Scroll restoration on
the detail page starts working after the player without being touched,
because the entry stepped onto is the entry it remembered.

## User Stories

### The family

1. As a family member, I want Back from the player to return me to the film's
   page, so that I am where I was before I pressed Play.
2. As a family member, I want the film's page to be scrolled to where I left
   it when I come back from the player, so that the screen I return to is the
   screen I left.
3. As a family member, I want Back from the film's page, after watching, to
   return me to the library — not the player — so that two presses of Back
   never take me somewhere I have already left.
4. As a family member, I want the library I return to after a film to still
   be filtered and scrolled as I left it, so that finding the next film does
   not start over.
5. As a family member, I want Escape in the player to do exactly what the
   Back pill does, so that there is one way out and it does not matter which
   I reach for.
6. As a family member, I want to press Back as many times as I opened
   screens and end on the library, so that Back always counts down and never
   loops.
7. As a family member, I want a player opened by a bookmark or a reload to
   have a working Back that shows the film's page, so that I am never on a
   screen with a dead button.
8. As a family member, I want that film's page to have a Back of its own, so
   that a deep link never strands me on the second screen either.

### The maintainer, on the Settings screens

9. As the maintainer, I want Back from Import to return me to Settings and
   the next Back to return me to the library, so that the two screens I
   opened are the two Back closes.
10. As the maintainer, I want Back from Import during a run to leave the run
    where it is, so that stepping away never cancels anything.
11. As the maintainer, I want Import opened by a reload to have a Back that
    shows Settings, so that a dev reload still has a way out.
12. As the maintainer, I want _Finish_ on the Review step to take me to a
    fresh library, at the top and unfiltered, so that the films the run added
    are visible on their shelves.
13. As the maintainer, I want Back from an edit to return me to the film's
    page, so that a change I decided against leaves me where I started.
14. As the maintainer, I want _Save changes_ on an edit to return me to the
    film's page, and the next Back to return me to where I opened it from, so
    that a save does not add a screen I have to press through.
15. As the maintainer, I want _Cancel_ on an edit to behave exactly as Back
    does, so that two controls that mean "leave without saving" are one
    leaving.
16. As the maintainer, I want _Save & continue_ on a Resolve to return me to
    the Review step with the row I fixed gone from the list, so that the list
    counts down as I work through it.
17. As the maintainer, I want _Skip this one_ on a Resolve to dismiss the row
    and return me to the Review step, so that a row I cannot fix is off the
    list without a second press.
18. As the maintainer, I want Back from a Resolve to return me to the Review
    step with the row still listed, so that stepping back never loses a
    problem I have not settled.
19. As the maintainer, I want Back from the Review step, after a Resolve, to
    return me to Settings, so that the Resolve I completed is not a screen
    Back walks back into.
20. As the maintainer, I want an edit opened by a reload to land on the film's
    page, a Resolve opened by a reload to land on the Review step, and an add
    opened by a reload to land on Settings, so that each job's Back goes
    where that job came from.
21. As the maintainer, I want the landing decided the moment the form opens
    — before the movie's record or the problem's detail has been read — so
    that a Back pressed early on a deep-linked edit does not go to Settings.
22. As the maintainer, I want _Add to library_ to take me to a fresh library,
    so that the film I just added is on its shelf and the page is at the top.
23. As the maintainer, I want Back from Settings, from a genre page and from
    a movie page to keep going to the library, so that the screens that
    already had the rule right are untouched.
24. As the maintainer, I want deleting a film after visiting its player to
    land me on the library, so that the delete's own Back never steps into
    the player of a film that is gone.

### The maintainer, on the code

25. As the maintainer, I want the rule to be one hook in `hooks/` with one
    parameter, so that a screen gets Back right by calling it with a landing
    and nothing else.
26. As the maintainer, I want the default landing to stay the library, so that
    the four callers that mean the library keep calling the hook with no
    argument.
27. As the maintainer, I want the landing to stay a push rather than a
    replace, so that the screen it lands on has a Back of its own.
28. As the maintainer, I want the two Fresh homes to stay pushes rather than
    replaces, so that the rule has two shapes — a step and a push — and never
    a third.
29. As the maintainer, I want the form's landing read off its query
    parameters and never off fetched state, so that it is right from the
    first render.
30. As the maintainer, I want the player's Back pill and Escape to share one
    handler, so that changing the leaving changes both.
31. As the maintainer, I want no route state carrying a `from`, so that the
    router's own stack stays the only record of where a screen came from.
32. As the maintainer, I want a test-support way to tell a step from a push,
    so that a suite can assert "a `POP`, not a `PUSH`" rather than only
    "landed on the right URL" — the assertion that would have caught this.
33. As the maintainer, I want the three reproduced journeys to be tests in
    the screens' own suites, so that a regression is caught on the second
    press, where the bug lives.
34. As the maintainer, I want the deep-link fallbacks tested for each of the
    three new callers, so that a landing typed wrong is caught by a test
    rather than by a reload nobody does.
35. As the maintainer, I want Series and Enrichment to inherit the rule when
    they are built, so that their Backs are steps with a landing each, from
    day one.

### What is deliberately absent

36. As the maintainer, I want no second hook beside `useGoBack`, so that two
    hooks never become two rules.
37. As the maintainer, I want no screen calling `navigate(-1)` itself, so
    that the no-history check exists once.
38. As the maintainer, I want no handling of browser-chrome Back, so that a
    control the app does not draw is not designed for; the shell is step 7.
39. As the maintainer, I want no prototype amendment, so that `exitPlayer`,
    `backFromAdd`, `saveMovie`, `goSettings` and `goBrowse` are translated as
    written.
40. As the maintainer, I want `useDeleteMovie` and `useRestoredScroll` left
    untouched, so that the fix is where the bug is and nowhere else.

## Implementation Decisions

### The rule

**Arriving pushes, leaving steps.** Every way onto a screen — a card, Play,
_Edit details_, _Resolve_, the gear, the Library rows, the logo — is a push,
unchanged. Every leaving — Back, Escape, a save, a Skip, a Delete — is a
**History step**, `navigate(-1)`. The two exceptions are the prototype's two
`goBrowse()` calls: the form's _Add to library_ and Import's _Finish_, which
stay `navigate('/')` and mean a **Fresh home**.

A leaving is never `navigate(to, { replace: true })`: a replace is still a
fresh entry under a new key, so the shelf's filters and the remembered scroll
are both lost — it removes the duplicate and keeps the bug.

### The hook

`useGoBack` gains one optional parameter, the **Landing**, a route string
defaulting to `'/'`. The hook steps back when there is history behind the
screen and pushes the landing when `location.key === 'default'` — the key
React Router gives the first entry of a session, a deep link or a reload.
Nothing else changes: same folder, same test file, one more case.

The landing **stays a push**, as today. A replace would give the landing a
fresh key, so its own Back would step into nothing — a dead button, the one
thing the fallback exists to prevent. The cost is a two-step loop on a
deep-linked player (player → Back → movie → Back → player again), accepted:
the parent is never stranded, and the case is a dev reload.

### The callers

| Screen                                                 | Landing                              | Steps on                                                   | Push kept            |
| ------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------- | -------------------- |
| Player                                                 | the movie's page                     | Back pill, Escape                                          | —                    |
| Import                                                 | Settings                             | Back                                                       | Finish → `/`         |
| Movie form                                             | by Form context (below)              | Back, Cancel, Skip this one, Save changes, Save & continue | Add to library → `/` |
| GenreLayout, MoviePage, SettingsHeader, useDeleteMovie | the library (the default, unchanged) | unchanged                                                  | —                    |

**The player.** Its Back pill and Escape already share one `leave` handler;
it changes from a push to the hook's callback, with the movie's page as the
landing — the prototype's `exitPlayer()` → detail. The detail page's scroll
comes back for free: the entry stepped onto is the one `useRestoredScroll`
remembered.

**Import.** Back becomes the hook's callback with Settings as the landing —
the prototype's `goSettings()`. Back during a run leaves the run where it is,
as today: it is the server's **Current run**, re-attachable on the next
visit. Finish stays a push to `/`.

**The form.** One landing per **Form context**, read off the URL the way the
prototype sets `addContext` at entry: the Review step when `?problem=` is
present (Import context), the movie's page when `?movie=` is (edit), Settings
otherwise (add — the prototype's `goAdd()` sets `addContext: 'settings'`).
The mapping is a small local function in the form's hook over the two query
parameters it already reads. Every leaving goes through the one `goBack`
this gives: Back, Cancel, _Skip this one_ after its dismiss, _Save changes_
after its `PATCH`, _Save & continue_ after its resolve. _Add to library_ is
the only push left. The landing is **never** read off the settled
`editing` / `resolving` state: both are `null` until a fetch lands, so a Back
pressed early on a deep-linked edit would fall back to Settings.

**_Save & continue_ landing by a step survives.** The Review step is the
Current run's state, not the entry's: Import re-attaches on mount through the
current-run read, so a step onto the `/import` entry draws the review one row
shorter, exactly as the push did. The form's existing comment — _the list is
where they go, whatever the history says was behind the form_ — is
superseded: _Resolve_ is a link from the review, so the entry behind the form
is always Import, and a deep link gets the same through the landing.

**The Delete-after-Play case is fixed by the player alone.** With the
player's leave a step, the stack after Play → Back is `[/, /movie/1]`, and
the delete's `useGoBack` steps onto `/`. `useDeleteMovie` is untouched. The
deleted movie's page still sits in the forward stack and answers not-found,
as the Delete initiative decided.

### The probe

`LocationProbe` in `test-support/` gains a fourth spelling beside `pathname`,
`search` and `url`: `navigationType`, rendered from the router's
`useNavigationType()` — `POP` after a step, `PUSH` after a push. A
test-support change, never imported by shipping code. The probe's `withBack`
is not used by the new tests: its button is named _Back_, which the player,
Import and the form already have.

### What the shell changes

Nothing. `navigate(-1)` and `location.key === 'default'` behave the same
under `BrowserRouter`, `HashRouter` and `MemoryRouter`. Series and Enrichment
inherit the rule when built — their `backFromSeries`, `backFromSeason` and
`backFromEnrich` are steps with a landing each — which is why this is step 3
and they are 5 and 6.

### The vocabulary

**Back rule** — the one rule; **History step** — what a leaving is;
**Landing** — a screen's own destination for the no-history case; **Fresh
home** — the two `goBrowse()` that are not steps; **Leaving** — any control
that takes someone off the screen they are on. Say _leaving_, not _exit_ or
_navigate away_. In code the hook's parameter keeps the name `fallback`,
because that is what the hook has always called it.

### What is not built

No second hook, no per-screen `navigate(-1)`, no `from` in location state, no
replace anywhere, no browser-chrome Back handling, no change to
`useDeleteMovie` or `useRestoredScroll`, and no prototype amendment.

## Testing Decisions

**A good test here drives the router and reads where it ended up.** Every
suite renders its screen inside a `MemoryRouter` whose `initialEntries` are
the history the real routes create, presses the control a parent would press,
and reads the probe — never a `navigate` spy, never a hook's return value.
The new spelling, `navigationType`, is what lets a suite say _a step, not a
push_: a `POP` after a leaving, a `PUSH` after a Fresh home. And the three
journeys the bug was reproduced on become tests that press Back **twice**,
because the first press was always right.

Prior art is the suites' own: `useGoBack.test.tsx` already renders a screen
at a given `initialEntries` / `initialIndex` and reads `pathname` after Back;
`Player.test.tsx` renders the player at `['/movie/m1', '/movie/m1/play']`
with the probe beside it; `ImportFlow.test.tsx` opens Import from a Settings
stub over `['/', '/settings', '/import']`; `MovieForm.test.tsx` renders each
Form context at its own URL over the probe.

### `useGoBack.test.tsx` — extended

- A deep-linked screen lands on the landing it was given, not `/`.
- The default is still `/`.
- The landing is a push: the screen it lands on is not the first entry.

### `LocationProbe.test.tsx` — extended

- `navigationType` reads `POP` after a step and `PUSH` after a push.

### `Player.test.tsx` — extended

- Back is a `POP` onto the movie's page.
- Play → Back → Back lands on `/`.
- A deep-linked player's Back lands on its movie's page.
- Escape still shares the handler: the same `POP`.

### `ImportFlow.test.tsx` — extended

- Back is a `POP` onto Settings.
- Settings → Import → Back → Back lands on `/`.
- A deep-linked Import's Back lands on Settings.
- Finish is still a `PUSH` to `/`.

### `MovieForm.test.tsx` — extended

- _Save changes_ is a `POP` onto the movie's page; movie → _Edit details_ →
  _Save changes_ → Back lands on `/`.
- _Save & continue_, _Skip this one_ and Back in Import context are `POP`s
  onto the Review step.
- Back and Cancel on an edit are `POP`s onto the movie's page.
- The three deep-link landings: an edit lands on its movie, a Resolve on the
  Review step, an add on Settings — each pressed before any fetch has landed.
- _Add to library_ is still a `PUSH` to `/`.

No new test for `useDeleteMovie`: it is untouched, and the Delete-after-Play
case is the player's journey read one step further.

## Out of Scope

- **A second hook** (`useLeave` or similar) beside `useGoBack`.
- **Each screen calling `navigate(-1)`** itself.
- **Location state carrying a `from`** — the router's stack already holds it.
- **A replace** on the landing or on the two Fresh homes.
- **Browser-chrome Back** — the app draws none, Electron will draw none, and
  the shell is step 7.
- **Any change to `useDeleteMovie` or `useRestoredScroll`** — both are
  correct once the player steps.
- **A prototype amendment** — push versus step is a distinction a stateless
  prototype cannot draw, and its landings are already right.
- **Series and Enrichment** — they inherit the rule when built.

## Further Notes

**Why a step and not the prototype's `goBrowse()`, once more.** A step
returns the shelf the parent had filtered and scrolled, exactly as they left
it; `navigate('/')` is a fresh entry. The movie-detail initiative already
read the prototype's `detailReturn` flag as a hand-rolled history stack and
translated it to the router's real one; this initiative finishes that reading
on the four screens that never got it.

**The bug is only visible on the second press.** Every one of the four pushes
shows the right screen. That is why it survived the player, the form and the
import initiatives, and why the new tests press Back twice — and why the
probe learns `navigationType`: "landed on the right URL" was the assertion
every suite already made, and it was passing.

**A landing is a string the screen types.** A wrong one is only visible on a
deep link, which the packaged app almost never sees, so the deep-link tests
are the only thing keeping the three landings honest.

**What gets ticked, and when.** **Back navigation** ✅ in README and
`CLAUDE.md`'s feature lists, and the build-order chain losing step 3 with the
remaining six keeping their numbers and their gates — **after this
initiative's refactor**, not when the build issues close.

---

Design log: `docs/design-logs/20-back-navigation.md`
Glossary: the **Back rule**, **History step**, **Leaving**, **Landing** and
**Fresh home** entries of `docs/ubiquitous-language.md`
