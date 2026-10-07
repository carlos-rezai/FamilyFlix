> **Initiative:** `ultrawide-margins`
> **Design log:** `docs/design-logs/27-ultrawide-margins.md`
> **Build order:** step 11

## Problem Statement

I am the maintainer, and I watch FamilyFlix on an ultrawide monitor. Every
screen fills the window edge to edge. On a 3440px-wide screen the home
screen's genre rows, the logo and the gear stretch across the whole monitor.
The first card of a row is at my far left and the last at my far right, so I
have to turn my head to read a shelf. The movie and series pages already cap
their text, but their backdrops and Back pills still run to the window's
edges.

On my laptop the app is fine as it is. Whatever fixes the ultrawide must not
change the laptop. The same install is sometimes used on both, with a laptop
docked to the ultrawide.

## Solution

A household preference, **Ultrawide margins**, is a single toggle in a new
sixth Settings group, **Display**, between Playback and Network.

With it on, every screen except the player is drawn inside a centred **Content
frame** no wider than the **Content measure** (1920px). The window's leftover
width becomes plain margins in the page's own background. On any window
narrower than 1920px the cap does nothing, so the laptop looks the same with
the toggle on or off, and one stored value is right on both screens.

- The whole screen goes inside the frame, header included, so the logo and the
  gear come in from the far edges too. The movie and series backdrops are
  clipped to the frame.
- The player stays full-window, because a 2.39:1 film filling the ultrawide is
  what the monitor is for.
- A flip of the toggle applies everywhere at once, with no reload and no
  animation.
- The **Snackbar stack** moves to the frame's bottom-right corner, so a notice
  lands beside the content rather than 760px away from it.
- The preference lives in the library's database beside the **Preferred
  subtitle language**, so it survives a cleared browser profile and travels
  with a backup. A fresh install has it off.

## User Stories

1. As the maintainer on an ultrawide monitor, I want to turn on Ultrawide
   margins, so that the library sits in the middle of the screen and I can
   read a whole genre row without turning my head.
2. As the maintainer, I want the toggle in Settings under its own Display
   group, so that I find it where display preferences belong rather than under
   Playback, which is about the player.
3. As the maintainer, I want the Display group between Playback and Network, so
   that the hub's order puts the household's preferences together.
4. As the maintainer, I want the row titled _Ultrawide margins_ with the line
   _Keep everything in the middle of a very wide screen, so the rows fit
   without turning your head. Smaller screens look the same either way._, so
   that I know what it does and that it is safe to leave on.
5. As the maintainer, I want the row drawn with the same title, line and
   control layout as _Preferred language_, so that the hub reads as one design.
6. As the maintainer, I want the toggle to show its new state the moment I
   press it, so that the control feels immediate.
7. As the maintainer, I want the screen to change width the moment I flip the
   toggle, so that I can see the effect without leaving Settings or reloading.
8. As the maintainer, I want the toggle and the frame to put themselves back
   if the save is refused, so that what I see always matches what is stored.
9. As the maintainer, I want the setting kept in the library's database, so
   that it survives a cleared browser profile, a reinstall over the same data
   folder, and a backup restore.
10. As the maintainer with a laptop docked to the ultrawide, I want one stored
    value to be right on both screens, so that I never have to flip it when I
    undock.
11. As a parent on the laptop, I want the app to look exactly as it does today
    whether or not the maintainer turned the margins on, so that nothing I know
    moves.
12. As a household on a fresh install, I want the margins off, so that the app
    looks as it always has until someone chooses otherwise.
13. As the maintainer, I want the header (logo, tabs, gear) inside the frame as
    well, so that I don't still have to look at the far edges for it.
14. As the maintainer, I want the movie and series backdrops clipped to the
    frame, so that the page reads as one centred column.
15. As the maintainer, I want the margins filled with the page's own
    background, with no border or black letterbox, so that the content seems
    to stay in the middle rather than sit in a window inside a window.
16. As the maintainer, I want every screen framed (the library, the genre
    page, the movie, series and season pages, Settings, the Codecs page, the
    Movie form, Import and the Enrichment flow), so that the app is consistent
    wherever I go.
17. As the maintainer, I want the player left full-window on both a movie and
    an episode, so that a wide film still fills the wide screen.
18. As the maintainer, I want fullscreen playback to be unaffected, so that
    the setting never touches watching.
19. As the maintainer, I want the snackbar notices to appear at the frame's
    bottom-right corner while the margins are on, so that a notice lands beside
    what I am looking at.
20. As the maintainer, I want the snackbar notices back at the window's
    corner when the margins are off or the window is narrower than the
    measure, so that nothing changes on the laptop.
21. As the maintainer, I want a dialog's scrim to still cover the whole window
    and its card to stay centred, so that a dialog still reads as a dialog.
22. As the maintainer, I want the Back-to-top button to ride the frame's corner,
    so that it stays beside the shelf it scrolls.
23. As the maintainer, I want each screen's scrollbar at the frame's right edge,
    so that the scrollbar sits beside the content it scrolls.
24. As the maintainer, I accept that the mouse wheel over an empty margin
    scrolls nothing, so that the frame stays one simple rule.
25. As the maintainer, I want the toggle not drawn until the stored value has
    loaded, so that it never shows a state that is not true (the hub's _blank
    until it lands_ rule).
26. As the maintainer, I accept that on launch the frame may snap into place a
    few milliseconds after the first paint, because the library is loading its
    own rows in the same moment.
27. As the maintainer, I want the app to stay usable and uncapped if the
    settings read fails, so that a broken read never hides content.
28. As the maintainer, I want the toggle reachable and operable by keyboard and
    announced as a switch named _Ultrawide margins_, so that it is as
    accessible as the rest of the hub.
29. As a developer, I want the server to refuse a value that is missing or not
    a boolean (the string `"true"` included) with a `400`, so that the stored
    value is always one of two.
30. As a developer, I want `GET /api/settings` to answer the preference with
    the default applied when the row is absent, so that no client has to know
    the default.
31. As a developer, I want the frame applied once, at the app root, so that a
    new screen is framed by default and no layout or page learns the
    preference exists.
32. As a developer, I want the measure spelled once as a token, so that if
    1920px is ever wrong it is one value to change.
33. As a developer, I want the preference kept out of the Export file, so that
    the export stays a movie list.

## Implementation Decisions

**Shape.** The feature is a width cap, not a margin: `max-width` at the
**Content measure** plus `margin: 0 auto`, with no media query, because below
the measure the cap is already inert. There is one toggle and one measure, with
no width picker. The measure is 1920px.

**Token.** A new flat token module, `layout`, holds `contentMeasure: '1920px'`
as `as const` data, re-exported from the tokens barrel and mounted on the
theme beside `breakpoints` and `motion`. It is not a breakpoint.

**Shared type.** `Settings` gains `ultrawideMargins: boolean`, and a
`DEFAULT_ULTRAWIDE_MARGINS = false` sits beside `DEFAULT_SUBTITLE_LANGUAGE`.
Both build targets read it.

**Settings repository (server, `library/settings`).** It adds the key
`ultrawide-margins`, stored as `'1'` / `'0'`. `settings()` answers
`ultrawideMargins` with the default applied when the row is absent, and it does
not write that default down. `setUltrawideMargins(on: boolean)` is an upsert
through the existing `valueOf` / upsert pair. No migration is needed, because
the `settings` table is a key/value store.

**Route.** `POST /api/settings/ultrawide-margins` takes `{ value: boolean }` and
answers `200 { value }`, a **Single-signal write** on the subtitle language's
precedent. It answers `400` with a sentence for a missing body or value, or any
non-boolean (the string `"true"`, `1` and `null` included). `GET /api/settings`
is widened by the repository and nothing else.

**Client wire.**

- `fetchSettings` (already shared in the `api/` layer) carries the new field
  without changing shape. The provider becomes its third caller.
- `saveUltrawideMargins(on)` has one caller, the provider, so it lives beside
  the provider in `App/` rather than in the `api/` layer. It posts the value
  and resolves to the echo, and it rejects on a non-OK answer or a network
  failure.

**`DisplayPreferenceProvider` / `useDisplayPreference` (App).** An app-level
provider, following `SnackbarProvider`. It is mounted inside the theme and
outside the Snackbar stack, so the stack can read it.

- It reads `fetchSettings` once on mount and holds `ultrawideMargins: boolean |
null`, which is `null` until the read lands and stays `null` if the read fails.
- `setUltrawideMargins(on)` shows the new value at once, posts, keeps the
  echo, and puts the previous value back on refusal. It never rejects.
- `useDisplayPreference()` throws when it is used outside the provider, and the
  error names the hook, as `useSnackbar` does.
- No `localStorage` mirror. `useSettings` keeps the subtitle language and
  nothing else.

**`ContentFrame` (App).** A wrapper that reads the context:

- With the preference on, `max-width: theme.layout.contentMeasure; margin: 0
auto`, full height, so each screen's own `100vh` scroller fits inside it.
- Off or `null`, it is a full-width box that changes nothing.
- No transition.
- The page's `bg` shows through the margins, with no border or shade.

**Route table.** Every route except `/movie/:id/play` and `/episode/:id/play`
becomes a child of a layout route whose element is `ContentFrame` around an
`<Outlet />`. The two player routes stay siblings outside it. The URLs do not
change.

**Snackbar stack.** `SnackbarProvider`'s stack reads the same context. While
the preference is on, its `right` is `max(s5, (100vw − contentMeasure) / 2 +
s5)`, which is the frame's bottom-right corner on a wide window and the
window's corner on a narrow one. Off or `null`, it stays `s5`, and `bottom` is
unchanged either way.

**Unchanged.** Modal (its scrim covers the window and its card is centred on
the window, which is the frame's centre), the FAB (already `absolute` inside
`MainLayout`'s root, so it rides the frame), `FilterDropdown` menus, every
layout, every page and every feature other than Settings.

**`DisplaySection` (features/settings).** A new **Settings group**: a
**Group heading** _Display_ over one **Section card** holding a single row:

- the title _Ultrawide margins_
- the line above
- the `Toggle` primitive on the right, `label="Ultrawide margins"`, reading and
  writing through `useDisplayPreference`

While the value is `null`, the Toggle is not drawn. The Settings page composes
the group between `PlaybackSection` and `NetworkSection`.

**Row furniture.** `Row`, `RowTitle` and `RowDesc` from the Playback section's
styles get a second caller, so they move up into the shared `section.styles`.
This is the "written twice, extracted once" rule. If phase 1 wrote them twice,
the move happens in the refactor.

**Prototype first.** Phase 1's first commit amends `page.SettingsPage` with the
Display group and its row (the Toggle on, bound to
`settings.ultrawideMargins`). It also adds a note to `COMPONENT-SPEC.md` on the
Content frame: what it caps, that the player is outside it, and where the
Snackbar stack sits under it. There is no new `prim.*` or `mol.*`. Whether the
chrome's radial glow shows an edge at the frame's top-right is for that
revision to judge.

**Phases** (from the log's plan):

1. **The thinnest path end to end.** The prototype amendment; the server key,
   field, setter and route; the type, the token, the provider, `ContentFrame`
   around every route but the player's, and `DisplaySection`'s Toggle.
2. **The Snackbar stack at the frame's corner.**
3. **The furniture extraction**, if phase 1 wrote it twice.

## Testing Decisions

Good tests here assert what a user or a client can observe: what the wire
answers, what is stored after a write, what a screen's box resolves to, and
where a notice lands. They do not assert which hook was called or how a
component is nested. Every suite below is written RED first.

- **Settings repository.**
  - `ultrawideMargins` is `false` on a fresh database, and reading does not
    write the default down.
  - `setUltrawideMargins(true)` then `(false)` round-trips.
  - Writing twice upserts rather than failing.
  - The subtitle language is untouched by either.
  - Prior art: the existing settings repository suite.
- **Route.**
  - `GET /api/settings` carries `ultrawideMargins` both with and without the
    row.
  - `POST` with `true` and with `false` answers the echo and is visible on the
    next `GET`.
  - `400` for a missing body, a missing value, `"true"`, `1` and `null`, and a
    refused write leaves the stored value as it was.
  - Prior art: `routes.settings.test`.
- **`DisplayPreferenceProvider` / `useDisplayPreference`.**
  - `null` before the read lands, then the stored value.
  - `null` still after a failed read.
  - The setter flips at once, keeps the echo, and on refusal puts the previous
    value back without rejecting.
  - The hook throws outside the provider and names itself.
  - Prior art: `useSettings`' suite (the optimistic `chooseSubtitleLanguage`)
    and `SnackbarProvider` / `useSnackbar`'s.
- **`ContentFrame` and the route table.**
  - Through `App` on a `MemoryRouter`: with the preference on, a framed route's
    frame resolves `max-width: 1920px` with auto side margins.
  - With it off, there is no max-width.
  - At `/movie/:id/play` and `/episode/:id/play` the player is not inside the
    frame.
  - Flipping the Toggle on `/settings` changes the frame with no navigation.
  - Prior art: `MaintainerLayout`'s `getComputedStyle(...).maxWidth` assertions
    and `App.test`'s direct-entry routing cases.
- **Snackbar stack.**
  - `right` is `s5` while the preference is off or `null`, and the `max(…)`
    expression while it is on.
  - `bottom` is unchanged.
  - Prior art: the computed-style block at the end of `SnackbarProvider.test`.
- **`DisplaySection`.**
  - The heading and copy are verbatim.
  - The Toggle is absent while the value is `null`.
  - It is a `switch` named _Ultrawide margins_ reflecting the value.
  - A press writes through the provider.
  - Prior art: `PlaybackSection`'s and `NetworkSection`'s suites.
- **Settings page.** The group order is Library, Playback, Display, Network,
  Storage, About.
- **Token.** It is not tested on its own, because it is a flat `as const` leaf.
  The frame's suite proves the value.

## Out of Scope

- A width picker, a slider, or a custom measure.
- Per-display or per-profile storage, and any `localStorage` mirror to avoid
  the launch snap.
- Forwarding wheel scrolling from the empty margins.
- Any change to the player, fullscreen, Modal, the FAB or dropdown menus.
- A top/bottom cap for tall screens.
- The preference in the **Export file**.
- Animating the frame.
- Steps 12–15 of the build order, and the Roadmap's **Move the media folder**.

## Further Notes

- The glossary already carries **Ultrawide margins**, **Content frame**,
  **Content measure** and **Display group**, with the updated **Settings
  group** and **Settings hub** invariants, in commit `512a47b`.
- The route table gains a shape: a new full-window screen has to choose
  between framed and unframed. Framed is the default, and the player is the
  one exception today.
- The Settings hub becomes six groups. CLAUDE.md's _Settings Hub_ section and
  the README still say five. Both, and the step 11 ✅, are updated in the
  refactor, per the standing rule that a feature is Done only after its
  refactor.
