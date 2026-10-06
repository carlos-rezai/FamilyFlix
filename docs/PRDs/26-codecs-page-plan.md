# Plan: Codecs page — the Codec report on a Settings sub-page, reached by one Codecs row

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/243

The Playback card on `/settings` carries the whole **Codec report**, about
1,400px of rows between the Playback heading and _Subtitles_, with Network,
Storage and About under all of it. Log 26 moves the report to a **Codecs page**
at `/settings/codecs` and leaves one **Codecs row** on the card in its place.
Nothing on the server changes and no type changes. The work is a move, not a
rebuild.

The slicing puts the new screen first, then the card that leads to it, then
the close:

**the page** (Phase 1) → **the card** (Phase 2) → **the graduation and the
close** (Phase 3).

## Every phase runs AFK

The maintainer asked for an initiative that `issue-loop` can drive start to
finish with nobody watching. The loop stops on a slice that is marked HITL,
binds nothing under `src/` or `server/`, or waits on an open blocker. This plan
removes each of those stops in advance:

- **No prototype-only slice.** The PRD puts the five prototype amendments in
  phase 1's first commit, by hand. They are a rearrangement of markup the
  prototype already draws, spelled out item by item in the PRD and log 26's
  _Design_, so no judgement is left in them. They move into Phase 1's **build**
  step: the GREEN subagent amends `docs/handoff/` first, then builds to the
  amended files, and both land in the slice's `feat:` commit. That departs
  from the PRD's "first commit", and it is the only departure: the amendments
  still come before any code that reads them.
- **No refactor left to a human.** The PRD lets the refactor decide whether the
  Sync row and the Codecs row graduate into one molecule "if they match
  character for character" (log 26 Q14). This plan settles the condition
  rather than waiting on it. Phase 2 builds the Codecs row as a character-for-
  character copy of the Sync row's styles and markup, differing only in glyph,
  label, line and destination. Phase 3 therefore always extracts. The
  graduation is a slice that binds `src/`, with its own RED test, so the loop
  runs it like any other.
- **No docs-only slice.** The docs that close the initiative (CLAUDE.md,
  README, the dev journal, the ✅) ride in Phase 3 with the extraction. The
  standing rule that the ✅ waits for the refactor still holds, because Phase 3
  _is_ the refactor.
- **No HITL marks.** Nothing in any phase needs an Electron smoke, a
  credential or a decision. Every acceptance criterion is a Vitest assertion,
  a typecheck or a file diff.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** One new client route, `/settings/codecs` → the Codecs page, the
  first nested Settings route. The path is a literal in the route table and in
  the Codecs row, the way `/settings` and `/import` are. There is no path util:
  the route carries no parameter and has one caller (log 26 Q3). `/settings`
  is unchanged. **No HTTP route changes.** Both screens read
  `GET /api/playback/capabilities`. The page also writes
  `POST /api/playback/component` and `DELETE /api/playback/component`, exactly
  as the card does today.

- **Schema and types.** None. No migration, no `src/types/` entry, no change
  to `PlaybackCapabilities`.

- **The ladder.**

  ```
  pages/CodecsPage              ← MaintainerLayout width={780} around CodecManager
  └── features/settings/CodecManager   ← now the screen: header + two Settings groups
      ├── CodecRow, ComponentDropZone   ← unchanged
      └── useCapabilities               ← unchanged; the one owner on this screen
  features/settings/PlaybackSection    ← the Codecs row in place of the header + report
      └── useCapabilities               ← the read only
  ```

- **Key models.**
  - **The Codecs page, top to bottom:** the maintainer header (Back pill,
    heading **Codecs**, the lede verbatim: _These decide which video files
    FamilyFlix can play. Common formats work out of the box — add a pack only
    if a movie won't play._), then the **Playback component** group (the
    Component row when the report has one, then the drop zone), then the
    **Formats** group (the Codec summary, then the codec rows in Format
    catalogue order). The header is drawn on `maintainer.styles.ts`, and the
    groups on `section.styles.ts`'s group heading and card.
  - **The Codecs row:** one button holding the microchip tile, the label
    **Codecs**, the line `codecSummary(capabilities)` (empty while the read is
    `null`, and still empty if it is refused), and a chevron. It pushes
    `/settings/codecs`.
  - **Two reads, no cache.** Each screen reads the report on mount. Back
    re-mounts Settings, which reads again, and that is how an upload reaches
    the row's line (log 26 Q13).
  - **Back** on the page is `useGoBack('/settings')`: a **History step** when
    there is one, the **Landing** otherwise.
  - **Blank until it lands.** While the report is `null` the page draws its
    header and nothing under it, and the row draws an empty line. No skeleton,
    no error face.

- **Unchanged in every phase:** `CodecRow`, `ComponentDropZone`, `zoneFace`,
  `codecView` (`codecSummary` included), `useCapabilities` and its two writes,
  the `features/settings/api/` calls, every server route, every type. Their
  suites keep passing untouched.

- **Not built in any phase:** an accordion, a _Show all_ or any collapse; a
  Video/Audio split; search, filter or a per-codec page; a shared cache or
  context for the report; an action in the page header; _Change…_.

---

## Phase 1: The page, end to end

**User stories**: 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
27, 28, 30, 32

### What to build

The tracer bullet. When this phase is done, `/settings/codecs` is a complete
screen: the report in its new order with the upload and the ✕ working, and
Back that leaves it. Settings still draws the old report, so for one slice the
report shows on both. That is expected, and Phase 2 removes it.

**The prototype first, in the build step.** The five amendments from the PRD,
by hand, before any code:

1. `page.SettingsPage.dc.html`: the Playback card's _Codecs_ header and the
   `feat.CodecManager` mount are replaced by a Codecs row, a copy of the
   _Sync metadata & posters_ row with the microchip glyph, bound to
   `settings.codecRow.summary` and `settings.codecRow.onOpen`.
2. `feat.CodecManager.dc.html`: it becomes the screen, with the maintainer
   header over the _Playback component_ and _Formats_ groups, and it gains
   `onBack`. Row and zone markup is unchanged.
3. `page.CodecsPage.dc.html` (new): the maintainer sheet at 780 around
   `feat.CodecManager`.
4. `FamilyFlix.dc.html`: `screen==='codecs'`, `goCodecs()` from the Settings
   row, and Back to `settings`. Settings receives only the summary line.
5. `COMPONENT-SPEC.md`: the SettingsPage and CodecManager entries are updated,
   and a CodecsPage entry is added.

**Then the code.** The Codecs page as a composition-only page with a default
export, the Settings hub's maintainer surface at 780 around the Codec manager.
The route. The Codec manager restructured into its own header and two groups,
in the order Component row → drop zone → summary → codec rows, with Back on
the one Back rule. The page draws no header of its own and holds no logic.

### Acceptance criteria

- [ ] The five prototype amendments are in `docs/handoff/` in the slice's
      commit, and the built screen matches the amended `feat.CodecManager` and
      `page.CodecsPage`
- [ ] `/settings/codecs` renders the Codecs screen inside the maintainer
      surface, at the Settings hub's 780 column (page composition test, on the
      `ImportPage` / `EnrichmentPage` precedent)
- [ ] The header draws a Back button, a heading named **Codecs**, and the
      lede verbatim
- [ ] The group headings **Playback component** and **Formats** come in that
      order
- [ ] The Component row comes before the drop zone, the drop zone before the
      Codec summary, and the summary before the first codec row, asserted as
      document order with `comesBefore`
- [ ] With no component in the report, the Playback component group holds the
      drop zone alone, and no Component row is drawn
- [ ] While the report is `null`, and after a refused read, the header draws
      and nothing under it does
- [ ] Back steps through history when there is an entry behind the page, and
      lands on `/settings` when there is none (`LocationProbe`)
- [ ] The existing upload (busy face, echoed redraw), refusal (drawn in the
      zone only, rows unchanged) and ✕ cases (shown only for an uploaded
      component, falling back and redrawing from the echo) pass against the
      new layout
- [ ] There is no accordion, no _Show all_ and no header action
- [ ] `CodecRow`, `ComponentDropZone`, `zoneFace`, `codecView`,
      `useCapabilities`, the `api/` calls, the server and `src/types/` are
      untouched
- [ ] `/settings` and every existing way into it still work

---

## Phase 2: The Settings card

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 29, 31

**Blocked by:** Phase 1

### What to build

Settings becomes short again. In the Playback card, the _Codecs_ title, its
lede and the Codec manager mount are replaced by one Codecs row. The section
calls `useCapabilities` for the read only, and the row's line is the Codec
summary of that read. Pressing the row pushes `/settings/codecs`. The divider,
_Subtitles_, the Coming soon toggle and _Preferred language_ stay under it,
unchanged.

**The row is a character-for-character copy of the Sync row.** Its styles in
`PlaybackSection.styles.ts` repeat the Network section's Sync row rule for
rule (the button, tile, text, label, line and chevron) and differ only in
names. Its markup repeats the Sync row's shape. The only differences are the
glyph (microchip), the label, the line and the destination. This is what lets
Phase 3 extract without a judgement call. If the Sync row's styles turn out to
need anything this row can't share, the builder copies them anyway and records
the difference in the commit body, and Phase 3 extracts with that difference as
a prop.

**The round trip.** One test drives an upload on the Codecs page, presses
Back, and reads the new summary in the Codecs row's line. That proves the
two-reads contract end to end.

### Acceptance criteria

- [ ] Settings draws no codec rows, no drop zone and no Codecs lede
- [ ] The Playback card holds one button named for **Codecs** with the
      microchip glyph in its tile and a chevron
- [ ] Its line is the Codec summary of the fetched report, e.g. _19 formats
      enabled · 13 from the playback component_, and reads _… · no playback
      component_ when the report has none
- [ ] The line is blank while the read is pending and stays blank after a
      refused read, with no error face
- [ ] Pressing the row, by click or by Enter or Space after Tab, pushes
      `/settings/codecs`
- [ ] The subtitle half (divider, _Subtitles_, the Coming soon toggle,
      _Preferred language_) is unchanged and comes after the row
- [ ] `PlaybackSection` uses only the read from `useCapabilities`, never
      `upload`, `installComponent` or `removeComponent`
- [ ] The Codecs row's styles match the Sync row's rule for rule (only the
      names differ), and any difference is named in the commit body
- [ ] Round trip: an upload on the Codecs page, then Back, shows the echoed
      report's summary in the Codecs row's line
- [ ] The Network, Storage, Library and About groups are untouched

---

## Phase 3: The graduation and the close

**User stories**: the initiative's close. It is the refactor log 26 Q14 and
Q17 wait for, done as a slice.

**Blocked by:** Phase 2

### What to build

**The extraction.** The Sync row and the Codecs row, now written twice, are
extracted once into one `features/settings/` molecule. It is a navigation row:
a button with a tile holding a glyph, a label, a line and a chevron, which
pushes its destination. It stays in `features/settings/` because both callers
are Settings groups, on `maintainer.styles.ts`'s written-twice-extracted-once
precedent. It does not move to `components/`. It has its own test and its own
styles. `NetworkSection` and `PlaybackSection` both draw through it, and their
duplicated row styles are deleted. Every existing assertion on both rows keeps
passing unchanged. That is the refactor's proof.

**The docs**, in the same commit:

- CLAUDE.md's folder tree: `pages/CodecsPage`, the `CodecManager` line (now
  the screen: header, Playback component, Formats), the `PlaybackSection` line
  (the Codecs row, not the report), the new molecule's line, and the
  `pages/` note naming CodecsPage on the ImportPage / EnrichmentPage precedent.
- CLAUDE.md's Settings Hub section: the Codec report lives on the Codecs page
  at `/settings/codecs`, and the card carries its summary.
- README's tree, the same.
- The dev journal gets one paragraph: the first nested Settings route and the
  shape a future sub-page follows, the two reads accepted, and the prototype
  amendments having ridden in Phase 1's commit.
- **The ✅.** The Codecs page is ticked in README and CLAUDE.md, and the build
  order's step 10 line is rewritten to name the sub-page, not the choice. The
  chain's next step becomes step 11.

The glossary already carries **Codecs page**, **Codecs row** and **Formats
group** (`ffbd059`). This phase only checks those entries against what
shipped and corrects any drift.

### Acceptance criteria

- [ ] One navigation-row molecule in `features/settings/`, with a test that
      drives it by role and name: a button named for its label, its glyph
      decorative, its line drawn (blank when empty), and pressing it asks for
      its destination
- [ ] The Network section's _Sync metadata & posters_ row and the Playback
      section's Codecs row both draw through it, and neither section keeps its
      own copy of the row's styles
- [ ] `NetworkSection.sync.test.tsx`, `PlaybackSection.test.tsx`, the
      `CodecManager` suite and the round-trip test pass unchanged
- [ ] CLAUDE.md's folder tree and Settings Hub section, and README's tree,
      match what shipped
- [ ] The dev journal carries the round's paragraph
- [ ] The **Codecs page** is ✅ in README and CLAUDE.md, the step 10 line
      names the sub-page, and the build order's next step is 11
- [ ] The glossary's three terms and the Codec report invariant match the code
- [ ] `npm run typecheck`, the full Vitest run and ESLint are green
