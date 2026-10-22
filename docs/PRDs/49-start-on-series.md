> **Initiative:** `start-on-series`
> **Design log:** `docs/design-logs/49-start-on-series.md`
> **Issue:** #425 (the PRD, step 32)
> **Build order:** step 32, **Start on Series**. It ships as thin slices (log 49, _Implementation Plan_), the prototype revision first.

## Problem Statement

FamilyFlix always opens on the Movies tab. A household that mostly watches series has to press _Series_ at the top of the library every time it starts the app. For my parents that is one more step before they can pick up the show they were watching, every single evening.

## Solution

**A Start tab in Settings.** The Display group gains a third row, _Start on_, under _Fill in ratings from TMDB_. It draws the same **Pill tabs** a parent presses at the top of the library, `Movies` and `Series`, with the line: _Which shelf FamilyFlix opens on. You can still switch between Movies and Series at the top of the library._ Pressing a pill saves the choice at once; the pressed pill is the confirmation, and no snackbar appears.

**Applied at launch only.** When FamilyFlix opens (the **Launch entry**: the first screen on bare `/`, whether a window load, a reload of `/` or a Factory reset's reload), the library reads the **Start tab** before drawing anything. With Series chosen, the first thing drawn is the Series tab; Movies is never drawn first and swapped. Every other way onto the library keeps its own destination: the logo, _Back to library_ and the movie page's Landing still mean the Movies tab, and the series page's Landing still means the Series tab.

**Safe by default.** Until the household chooses, FamilyFlix opens on Movies, as it does today. If the setting can't be read, it opens on Movies and the page draws its usual failures. A Factory reset puts it back to Movies.

## User Stories

### Choosing the Start tab

1. As a parent, I want a _Start on_ row in Settings' Display group, so that I can choose which shelf FamilyFlix opens on.
2. As a parent, I want the row drawn as the same Movies / Series switch I press at the top of the library, so that the choice reads as the thing it chooses.
3. As a parent, I want a short explanation under the row, so that I know I can still switch tabs at the top of the library.
4. As a parent, I want the row drawn third in the Display group, under _Fill in ratings from TMDB_, so that it sits with the other preferences about what FamilyFlix shows.
5. As a parent, I want the pill I press to show as pressed straight away, so that I know my choice was taken.
6. As a parent, I want no snackbar after pressing a pill, so that the screen doesn't chatter about a choice it already shows.
7. As a parent, I want my choice kept after I close and reopen FamilyFlix, so that I choose once.
8. As a parent, I want Movies chosen until I change it, so that FamilyFlix behaves as it always has until I ask otherwise.
9. As a parent, I want the pills not drawn until my saved choice has been read, so that I never see the wrong pill pressed for a moment.
10. As a parent, I want a refused save to put the pill back where it was, so that the screen never claims a choice that wasn't kept.
11. As a parent, I want the row drawn whether or not the library holds any series, so that I can set it up before adding my first show.
12. As the maintainer, I want the choice held beside the other two Display preferences, so that the Display card reads from one source.

### Opening FamilyFlix

13. As a parent who chose Series, I want FamilyFlix to open on the Series tab, so that I land on the shows I watch.
14. As a parent who chose Series, I want nothing of the Movies tab drawn before the Series tab appears, so that the shelf doesn't jump under me.
15. As a parent who chose Series, I want the header drawn only together with the Series tab, so that the Movies pill is never shown pressed first.
16. As a parent who chose Movies, or who never chose, I want FamilyFlix to open on the Movies tab, so that nothing changes for me.
17. As a parent who chose Series, I want a reload of the library's bare address to open on the Series tab too, so that a reload behaves like a fresh start.
18. As a parent who chose Series, I want pressing Back from a series to bring me back to the Series tab, so that the opening tab behaves like any tab I switched to.
19. As a parent who chose Series, I want switching to Movies after opening to work as always, so that the start choice never locks me in.
20. As a parent who chose Series and has no series yet, I want the Series tab's own empty face (_All series_ over _0 series · 0 episodes_), so that FamilyFlix is honest about what it holds.
21. As a parent, I want FamilyFlix to open on Movies when the setting can't be read, so that a fault never leaves me looking at a blank window.
22. As a parent, I want a library that fails to load after such a fault to show its usual retryable failure, so that I can try again the way I always do.
23. As the maintainer, I want a Factory reset to put the Start tab back to Movies, so that a reset really starts over.
24. As the maintainer, I want the choice applied by the library on the client, so that the desktop app and a browser behave the same.

### Every other way onto the library

25. As a parent who chose Series, I want the logo to still take me to the Movies tab, so that the logo keeps one meaning.
26. As a parent who chose Series, I want _Back to library_ on a movie page to still land on the Movies tab, so that I return near the film I just left.
27. As a parent who chose Series, I want a deleted series, the series add and the series page's no-history Back to still land on the Series tab, so that those screens keep the destinations they had.
28. As the maintainer, I want any address other than bare `/` with no query (a deep link, a `/?tab=...`, a search) to draw exactly what it names, so that the Start tab never overrides a link.
29. As the maintainer, I want no wait for the setting on any entry but the Launch entry, so that every in-app visit to the library draws at once.

### Data and wire

30. As the maintainer, I want `GET /api/settings` to answer `startTab`, with Movies applied when nothing is stored, so that no client has to know the default.
31. As the maintainer, I want `POST /api/settings/start-tab { value }` to store a Library tab and echo it, so that it is a Single-signal write like its siblings.
32. As the maintainer, I want that route to refuse any value that isn't a Library tab with a `400`, so that the database never holds a tab that doesn't exist.
33. As the maintainer, I want a stored value outside the two tabs read as Movies, so that a hand-edited database never yields a broken launch.
34. As the maintainer, I want the two tabs spelled once as a list the type is derived from, so that the Library tabs, the route and the Settings row can't drift.
35. As the maintainer, I want the save to accept only an echo that is a Library tab, so that a nonsense answer keeps what the screen showed.

## Implementation Decisions

- **Names** (log 49 Q4, Q5): the preference is the **Start tab**, key `start-tab`, field `Settings.startTab`, default `DEFAULT_START_TAB = 'movies'`; the row reads _Start on_. The entry it acts on is the **Launch entry**: the router's first entry on bare `/` with no query, `location.key === 'default'`. The glossary already carries **Start tab**, **Launch entry** and **Library tab**.
- **The value is a choice of two, not a flag** (Q6): `LIBRARY_TABS = ['movies', 'series'] as const` in the shared browse types beside `MOVIE_SORTS`, `LibraryTab` derived from it. The **Library tabs** take their values from it; the route validates against it; an `isLibraryTab` guard serves the route, the read and the save's echo.
- **Server, the `library/settings` module** (Q7): gains `setStartTab(tab: LibraryTab)` over the existing `upsertValue`, and `settings()` answers `startTab`, reading a stored value outside `LIBRARY_TABS`, or none, as the default.
- **Wire** (Q8): `GET /api/settings` gains `startTab`. `POST /api/settings/start-tab { value }` answers `200 { value }`, a **Single-signal write**, `400` unless `value` is a Library tab. A **Factory reset** empties the table, so Movies returns with no extra code.
- **The Settings row** (Q15 to Q18): the Display group's third row draws `PillTabs` on the right where the other rows draw their `Toggle`, not drawn while `startTab` is `null` (**Blank until it lands**). No snackbar.
- **Held by `DisplayPreferenceProvider`** (Q18): `useDisplayPreference()` gains `startTab: LibraryTab | null` and `setStartTab(tab)`. The provider's `useHeldFlag` becomes `useHeldValue<T>`, the one bargain over any value (shown at once, posted, the echo kept, put back on refusal, never rejecting), and all three Display preferences use it. A new `saveStartTab`, the twin of `saveTmdbRatings`, posts through `postValue` with the `isLibraryTab` echo guard. `useSettings` is untouched.
- **The launch is decided by the library, on the client** (Q9 to Q13): a new hook in the library feature, `useStartTab(): boolean`, answers whether the browse home may draw. Off the Launch entry it answers `true` at once. On it, it reads `fetchSettings()` once; on `'series'` it replaces onto `seriesTabPath()` and then answers `true`; on `'movies'` or a refused read it answers `true` with the URL untouched. A new organism, `StartTabGate`, renders its children only once the hook answers `true`, and nothing before (header included). The library page composes `StartTabGate` around its `MainLayout`; the page stays composition only.
- **Replace, not push** (Q10): the Launch entry becomes `/?tab=series` with nothing behind it, so Back from a series still steps onto the Series tab and a later switch is the tabs' own `replace`.
- **Its own read, not the provider's** (Q13): the gate must tell a refusal from a value still on its way, which the provider's `null` cannot; this follows the player's `useOpeningReads`, which reads `fetchSettings` itself for the same reason. Launch reads the settings route twice; both are local.
- **Rejected** (log 49, _Chosen and rejected_): bare `/` following the choice; the shell loading `/?tab=series`; a server redirect; drawing Movies then switching; a skeleton; a `startOnSeries` boolean; a `Toggle` or a dropdown; a `refused` status on the provider; holding the row in `useSettings`.
- **Prototype first** (Q19): `page.SettingsPage.dc.html` and `FamilyFlix.dc.html` gain the _Start on_ row with `mol.PillTabs`, the full prototype opens on the chosen tab, and COMPONENT-SPEC's settings page lists the row. This revision lands before any build slice.
- **Slices** (log 49, _Implementation Plan_): 1. the prototype; 2. the preference end to end (a press on _Series_ survives a reload of Settings); 3. the launch (FamilyFlix opened with Series chosen draws the Series tab first, with no Movies before it).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a parent or a caller sees: the rows drawn, the URL landed on, the body posted, the status and echo answered. It never asserts on internal state, call order inside a hook, or which helper ran.
- **`library/settings` module**: `startTab` defaults to `movies`, round-trips `series` through `setStartTab`, and reads a hand-stored nonsense value as `movies`. Prior art: the module's existing `settings.test.ts`.
- **Routes**: `GET /api/settings` answers `startTab`; `POST /api/settings/start-tab` stores and echoes a Library tab, answers `400` for a missing, non-string or unknown value, and leaves the stored value unchanged on a refusal; a Factory reset returns it to `movies`. Prior art: the `tmdb-ratings` block in `routes.settings.test.ts`.
- **`saveStartTab`**: posts `{ value }` to the route, keeps a Library-tab echo, falls back to the sent value on a missing echo, and rejects on a refusal. Prior art: `saveTmdbRatings.test.ts`.
- **`DisplayPreferenceProvider`**: `startTab` is `null` until the read lands, then the stored tab; `setStartTab` shows the new tab at once, keeps the echo, and puts the old tab back on refusal; the two existing flags behave as before over `useHeldValue`. Prior art: `DisplayPreferenceProvider.test.tsx`.
- **`DisplaySection`**: the _Start on_ row and its copy are drawn third; no pills while the read is pending; the stored tab's pill is pressed; pressing the other posts it and presses it; no snackbar. Prior art: `DisplaySection.test.tsx`.
- **`useStartTab`** (the deep module): off the Launch entry (a deep link, `/?tab=movies`, a search query, a non-default key) it answers `true` at once with no read; on the Launch entry it answers `false` until the read settles, then `true`, having replaced onto `/?tab=series` for Series, staying on `/` for Movies, and staying on `/` for a refused read. Prior art: `useOpeningReads.test.ts`, a hook reading `fetchSettings` once at one moment.
- **`StartTabGate`**: renders nothing while the hook is pending and its children once it allows; with Series stored, the Series tab is the first body drawn and no Movies row appears at any point. Prior art: the library feature's `LibraryBody` and `LibraryTabs` tests over a memory router.
- **Library page and App tests** that mount `/` must now answer or refuse `/api/settings`; they are updated to do so, not weakened.

## Out of Scope

- The logo, _Back to library_ or any Landing following the choice (log 49 Q2).
- A third choice such as a genre or Continue Watching (Q3).
- Remembering the last tab used, or keeping the choice in `localStorage` (Q3).
- A per-person choice; FamilyFlix has no profiles (Q3).
- Any change to the shell, the server's static serving, or the handshake (Q9).

## Further Notes

- The checklist's step 32 entry and CLAUDE.md (only if its folder tree names a new unit) are ticked ✅ only after the refactor.
- The browse home now waits for one local settings read on launch, while the shell's window is still waiting for `ready-to-show`; no parent should see the pause.
