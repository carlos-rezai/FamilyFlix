# Plan: Ultrawide margins — every screen but the player in a centred Content frame

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/248

On a 3440px ultrawide, every FamilyFlix screen stretches edge to edge. Log 27
adds one household preference, **Ultrawide margins**. While it is on, every
route except the player renders inside a centred **Content frame** capped at
the **Content measure** (1920px), and on any narrower window the cap does
nothing. The toggle lives in a new sixth Settings group, **Display**.

The slicing puts the whole visible effect first, then the one floating surface
that has to follow it, then the close:

**the toggle and the frame** (Phase 1) → **the Snackbar stack at the frame's
corner** (Phase 2) → **the close** (Phase 3).

## Running the phases

Phases 1 and 2 run AFK under `issue-loop`, on the Codecs page plan's
precedent:

- **No prototype-only slice.** The amendment is spelled out in the PRD:
  `page.SettingsPage` gains the Display group and its row, and
  `COMPONENT-SPEC.md` gains a Content frame note. It goes into Phase 1's
  **build** step. The GREEN subagent amends `docs/handoff/` first and then
  builds to the amended files, and both land in the slice's `feat:` commit.
- **No furniture left for later.** The log allowed the `Row` / `RowTitle` /
  `RowDesc` extraction to wait for the refactor if Phase 1 wrote the row
  twice. This plan settles that in advance: Phase 1's Display row is the
  second caller, so it moves the three up into the shared section styles
  rather than copying them.
- **No HITL marks in 1 or 2.** Every acceptance criterion is a Vitest
  assertion, a typecheck or a file diff. Seeing the frame on the real
  ultrawide is the maintainer's own check after Phase 1, and nothing waits on
  it.

Phase 3 is docs-only, so the loop stops there by design. Per the standing rule
that a feature is Done only after its refactor, the close is the refactor's
last commit, made after `request-refactor-plan` and `refactor`.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **HTTP routes.**
  - `GET /api/settings` → `Settings`, widened with
    `ultrawideMargins: boolean`. When the row is absent it answers `false`,
    and reading never writes that default down.
  - `POST /api/settings/ultrawide-margins` takes `{ value: boolean }` and
    answers `200 { value }`. Any missing, absent-body or non-boolean value
    (`"true"`, `1` and `null` included) gets `400` with a sentence, and the
    stored value is left as it was. This is a **Single-signal write** on the
    subtitle language's precedent.
- **Client routes.** No URL changes. The route table gains a shape: every
  route except `/movie/:id/play` and `/episode/:id/play` becomes a child of a
  layout route whose element is the **Content frame** around an outlet. The
  two player routes stay outside it as siblings. Framed is the default for any
  future screen.
- **Schema.** No migration. The key `ultrawide-margins` sits in the existing
  `settings` key/value table beside `subtitle-language`, stored as `'1'` /
  `'0'`. The repository gains `setUltrawideMargins(on: boolean)`, and
  `settings()` reads the key.
- **Key models.**
  - `Settings.ultrawideMargins: boolean` and `DEFAULT_ULTRAWIDE_MARGINS =
false`, in the shared settings types (both build targets).
  - `layout.contentMeasure = '1920px'`, a new flat `as const` token module
    re-exported from the tokens barrel and mounted on the theme as
    `theme.layout`. It is not a breakpoint, and no media query reads it.
- **The seam.** Exactly one app-level provider holds the preference:
  `DisplayPreferenceProvider` / `useDisplayPreference()` →
  `{ ultrawideMargins: boolean | null, setUltrawideMargins(on): Promise<void> }`.
  - It sits inside the theme and outside the Snackbar stack.
  - It reads the shared `fetchSettings` once on mount. The value is `null`
    until that read lands, and stays `null` if the read fails.
  - The setter shows the new value at once, posts, keeps the echo, and puts the
    previous value back on refusal. It never rejects.
  - The hook throws outside the provider and names itself.
  - The wire call `saveUltrawideMargins` has one caller, so it lives beside the
    provider.
  - No `localStorage`. `useSettings` keeps the subtitle language and nothing
    else.
- **The frame's rule.** While on, the frame is `max-width:
theme.layout.contentMeasure; margin: 0 auto` at full height. While off or
  `null`, it is a full-width box that changes nothing. The page's `bg` shows
  in the margins, with no border or shade, and there is no transition.
- **Unchanged.** Modal, the FAB, `FilterDropdown` menus, every layout, every
  page except Settings, every feature except Settings, the player, fullscreen
  and the Export file.

---

## Phase 1: The toggle and the frame, end to end

**User stories**: 1–18, 21–33

### What to build

The thinnest path from a press in Settings to a centred library.

- **Prototype.** `docs/handoff/` is amended first: `page.SettingsPage` draws
  the **Display group** between Playback and Network, on a **Section card**
  with one row:
  - the title _Ultrawide margins_
  - the line _Keep everything in the middle of a very wide screen, so the rows
    fit without turning your head. Smaller screens look the same either way._
  - the Toggle on, bound to `settings.ultrawideMargins`

  `COMPONENT-SPEC.md` gains a note saying what the Content frame caps, that
  the player is outside it, and where the Snackbar stack sits under it.

- **Server.** The repository reads and writes the key, and `GET
/api/settings` carries it. The `POST` route validates and echoes.
- **Client.**
  - The type, the token and the theme mount.
  - The provider over `fetchSettings`, with its optimistic setter.
  - `ContentFrame` in `App/` around every route but the player's two.
  - `DisplaySection` in the Settings feature, composed by the Settings page
    between Playback and Network: the Group heading _Display_ and one Section
    card holding the row, with the `Toggle` (`label="Ultrawide margins"`)
    reading and writing through the provider. It is not drawn while the value
    is `null`.
  - The row's furniture (`Row`, `RowTitle`, `RowDesc`) moves out of the
    Playback section's styles into the shared section styles, with both
    callers on it.

When this phase is done, flipping the Toggle on Settings re-frames the page at
once. Going Back shows the library centred on the ultrawide, and the laptop is
unchanged.

### Acceptance criteria

- [ ] The prototype's Settings page draws the Display group and its row, and
      `COMPONENT-SPEC.md` carries the Content frame note, in the slice's
      `feat:` commit.
- [ ] Settings repository:
  - [ ] `ultrawideMargins` is `false` on a fresh database, and reading does
        not write it down.
  - [ ] `true` then `false` round-trip, and a repeated write upserts.
  - [ ] The subtitle language is untouched by either write.
- [ ] Route:
  - [ ] `GET /api/settings` carries `ultrawideMargins`, both with the row and
        without it.
  - [ ] `POST /api/settings/ultrawide-margins` echoes `true` and `false`, and
        the next `GET` shows the new value.
  - [ ] A missing body, a missing value, `"true"`, `1` and `null` each answer
        `400`, and the stored value is unchanged.
- [ ] Provider:
  - [ ] The value is `null` before the read lands, then the stored value.
  - [ ] It stays `null` after a failed read.
  - [ ] The setter flips at once, keeps the echo, and puts the previous value
        back on refusal without rejecting.
  - [ ] The hook throws outside the provider and names itself.
- [ ] Through `App` on a `MemoryRouter`:
  - [ ] With the preference on, a framed route's frame resolves `max-width:
    1920px` with auto side margins.
  - [ ] With it off, or `null`, there is no max-width.
  - [ ] At `/movie/:id/play` and `/episode/:id/play` the player renders
        outside the frame.
  - [ ] Pressing the Toggle on `/settings` changes the frame with no
        navigation.
- [ ] `DisplaySection`:
  - [ ] The heading and copy are verbatim.
  - [ ] The Toggle is absent while the value is `null`.
  - [ ] It is a `switch` named _Ultrawide margins_ that reflects the value.
  - [ ] A press writes through the provider.
- [ ] The Settings page's groups read Library, Playback, Display, Network,
      Storage, About.
- [ ] `Row`, `RowTitle` and `RowDesc` are exported once, from the shared
      section styles, and both the Playback and Display sections import them
      from there. The Playback section's suite still passes unchanged.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 2: The Snackbar stack at the frame's corner

**User stories**: 19, 20

### What to build

The **Snackbar stack** reads the same provider. While the preference is on,
its `right` becomes `max(s5, (100vw − contentMeasure) / 2 + s5)`. That is the
frame's bottom-right corner on a window wider than the measure, and the
window's own corner on a narrower one. While the preference is off or `null`,
`right` stays `s5`. `bottom`, the column, the z-index and the pointer-events
rule are unchanged.

When this phase is done, a notice raised on the ultrawide with the margins on
(for example _Connected to TMDB._ on Settings) lands beside the content
rather than at the window's far edge.

### Acceptance criteria

- [ ] With the preference off or `null`, the stack's computed `right` is `s5`.
- [ ] With it on, `right` is the `max(…)` expression over the Content
      measure.
- [ ] `bottom` and the stack's other computed styles are unchanged in every
      state.
- [ ] Flipping the preference while a notice is up moves the stack, with no
      remount of the notice.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 3: The close

**User stories**: none new. This phase is the initiative's paperwork.

### What to build

The docs that make the feature Done. Per the standing rule, this is the
refactor's last commit and not a build slice.

- In CLAUDE.md:
  - The _Settings Hub_ section becomes six **Settings groups**, Display among
    them.
  - The folder tree names `DisplayPreferenceProvider`,
    `useDisplayPreference`, `ContentFrame`, `DisplaySection` and
    `tokens/layout.ts`.
  - `Settings` in the types line gains `ultrawideMargins`.
  - Step 11 and the _Ultrawide margins_ feature line are ticked ✅, and
    _(next)_ moves to step 12.
- In the README, the same ✅ and the six groups.
- In the dev journal, an entry for the initiative.

### Acceptance criteria

- [ ] CLAUDE.md and the README describe six Settings groups and tick step
      11 ✅.
- [ ] CLAUDE.md's folder tree and types line name every new unit and field.
- [ ] The dev journal carries the initiative's entry.
- [ ] Prettier passes over the changed docs.
