> **Initiative:** `codecs-page`
> **Design log:** `docs/design-logs/26-codecs-page.md`
> **Build order:** step 10

## Problem Statement

I am the maintainer. The Settings hub is supposed to be a hub: five short
**Settings groups** I can scan at a glance. Since the **Codec report** became
true, it isn't. The Playback card opens with _Codecs_ and its lede, and under
them sits the whole report. That means the **Codec summary**, one **Codec row**
for every **Format catalogue** entry the component decodes (up to nineteen with
the **Default component**), the **Component row**, and the **Component drop
zone**. Each row is 66px with an 8px gap. That puts about 1,400px of codec rows
between the Playback heading and _Subtitles_, and Network, Storage and About
sit under all of it.

The prototype drew six sample rows, so the problem never showed there. It
appeared once the report started telling the truth.

The one action on that report, swapping the **Playback component**, sits at
the very bottom, under every row. My parents never visit the codecs. I visit
rarely. Even so, everyone who opens Settings for subtitles, the TMDB key or the
storage line has to scroll past the report.

## Solution

The **Codec report** moves off the Settings hub to a Settings sub-page of its
own, the **Codecs page**, at `/settings/codecs`.

- **On Settings**, the Playback card's _Codecs_ header and the report are
  replaced by one **Codecs row**. It has the same shape as the Network group's
  _Sync metadata & posters_ row: the microchip tile, the label **Codecs**, the
  **Codec summary** as its line (e.g. _19 formats enabled · 13 from the
  playback component_), and a chevron. The whole row is one button that opens
  the Codecs page. Under it come the divider and _Subtitles_, as now. Settings
  is short again.
- **On the Codecs page**, the maintainer header (the Back pill, the heading
  **Codecs**, and the lede moved verbatim from the card) sits over two Settings
  groups, drawn with Settings' own furniture:
  1. **Playback component**: the **Component row** over the **Component drop
     zone**. The two inverses come first, because they are the only things on
     the screen that change anything.
  2. **Formats**: the **Codec summary** over the codec rows, in catalogue
     order, unchanged.
- **Back** follows the app's one **Back rule**, with Settings as the
  **Landing**. An upload made on the page shows in the Codecs row's line as
  soon as Back returns to Settings, because Settings reads the report again on
  mount.

Nothing on the server changes and no type changes. Every row, the drop zone,
the ✕ rule and the refusal faces behave exactly as they do today. They are
moved, not rebuilt.

## User Stories

### Settings

1. As the maintainer, I want the Playback card to show one Codecs row instead of the whole Codec report, so that Settings reads as a hub of five short groups.
2. As the maintainer, I want the Codecs row to carry the microchip glyph in its tile, so that I recognise it as the codecs entry at a glance.
3. As the maintainer, I want the Codecs row's line to be the Codec summary, so that I can see whether our films will play without opening the page.
4. As the maintainer, I want the line to read _… · no playback component_ when there is none, so that the one state worth worrying about is visible straight from Settings.
5. As the maintainer, I want the Codecs row's line to stay blank until the report has been read, so that the row never shows a number the server didn't give.
6. As the maintainer, I want the line to stay blank if the read is refused, so that a failure draws no made-up summary and no error face, the way every other Settings read behaves.
7. As the maintainer, I want the whole Codecs row to be one button with a chevron, so that it reads and acts like the _Sync metadata & posters_ row I already know.
8. As the maintainer, I want pressing the Codecs row to open the Codecs page, so that the full report is one click away.
9. As a keyboard user, I want to reach the Codecs row with Tab and open it with Enter or Space, so that the page is reachable without a mouse.
10. As the maintainer, I want the divider, _Subtitles_, the Coming soon toggle and _Preferred language_ to stay where they are under the Codecs row, so that nothing else in the Playback card moves.
11. As the maintainer, I want the Codecs lede to leave the Settings card, so that the card holds one line per item and the explanation lives on the page it explains.

### The Codecs page

12. As the maintainer, I want the Codecs page at `/settings/codecs`, so that its address says it belongs to Settings.
13. As the maintainer, I want the Codecs page in the same centred 780px column as the Settings hub, so that it reads as part of Settings and not as a separate flow.
14. As the maintainer, I want a Back pill and the heading **Codecs** at the top of the page, so that I know where I am and how to leave.
15. As the maintainer, I want the lede _These decide which video files FamilyFlix can play. Common formats work out of the box — add a pack only if a movie won't play._ under the heading, so that the page explains itself.
16. As the maintainer, I want the **Playback component** group first, with the Component row over the drop zone, so that the one action on the page is at the top instead of under nineteen rows.
17. As the maintainer, I want the **Formats** group second, with the Codec summary heading the rows it counts, so that the count sits beside what it counts.
18. As the maintainer, I want the codec rows in Format catalogue order, video before audio, exactly as today, so that nothing I'm used to moves inside the list.
19. As the maintainer with no playback component at all, I want the Playback component group to show only the drop zone, so that I see what to do and no empty row.
20. As the maintainer, I want to drop or pick the two component binaries on the drop zone and see the busy face while the swap runs, so that I know it's working.
21. As the maintainer, I want the rows, the summary and the Component row's pill to redraw from the echoed report after a successful upload, so that the new formats appear with no reload.
22. As the maintainer, I want a refused upload drawn in the zone and nowhere else, with the rows unchanged, so that a bad pair can't make the report look wrong.
23. As the maintainer, I want the ✕ on the Component row only when the component is uploaded, so that I can never remove the installer's Default component.
24. As the maintainer, I want pressing the ✕ to fall back to the Default component and redraw from the echo, so that removing an upload is immediate and reversible.
25. As the maintainer, I want nothing drawn under the header while the report is loading or if the read is refused, so that the page follows the same blank-until-it-lands rule as Settings.
26. As the maintainer, I want no accordion or _Show all_ on the page, so that the drop zone's busy and refused faces can never be collapsed out of sight mid-upload.

### Navigation

27. As the maintainer, I want Back on the Codecs page to step back to Settings when I came from there, so that leaving is a History step and Settings' own Back still steps to wherever Settings came from.
28. As the maintainer who opened `/settings/codecs` directly or reloaded it, I want Back to land on Settings, so that the page always has somewhere sensible to go.
29. As the maintainer, I want the Codecs row's line to reflect an upload I just made on the page when I come back to Settings, so that the two screens never disagree.
30. As the maintainer, I want the Codecs page to keep the Settings route unchanged, so that every existing way into Settings still works.

### The family

31. As a parent, I want the codecs moved off the main Settings page, so that the things I might actually touch, like subtitle language, aren't buried under a technical list.
32. As a parent, I want films to play exactly as they did before, so that moving a list between screens changes nothing about what plays.

## Implementation Decisions

### Modules

- **`CodecsPage` (new page).** Composition only: `MaintainerLayout` at width
  780 (the Settings hub's own column) around `CodecManager`. It follows
  `ImportPage` and `EnrichmentPage`, with a default export, no logic and no
  styling.
- **The route table (modified).** It gains `/settings/codecs` → `CodecsPage`,
  the first nested Settings route. The path is a literal in the route table and
  in the row, the way `/settings` and `/import` are. There is no `codecsPath`
  util: the path utils exist for routes that carry a parameter or have several
  callers, and this one has neither.
- **`CodecManager` (modified organism, now the screen).** It draws its own
  header, the way `ImportFlow` and `EnrichmentFlow` do: the Back pill, the
  heading _Codecs_ and the lede, on `maintainer.styles.ts`'s `HeaderRow`,
  `Heading` and `Lede`. Under the header it draws two Settings groups on
  `section.styles.ts`'s `GroupHeading` and `Card`:
  - _Playback component_: the Component row (when `componentRow` is not null),
    then `ComponentDropZone`.
  - _Formats_: `codecSummary`, then one `CodecRow` per `codecRows` entry.

  It stays the one owner of `useCapabilities` on this screen, and Back is
  `useGoBack('/settings')`. While the report is `null` the header still draws
  and nothing under it does.

- **`PlaybackSection` (modified).** The _Codecs_ `ItemTitle`/`ItemDesc` header
  and the `CodecManager` mount go, and the **Codecs row** takes their place: a
  `button` with a tile holding `MicrochipIcon`, the label _Codecs_, a line of
  `codecSummary(capabilities)` (empty while `null`), and `ChevronRightIcon`. It
  pushes `/settings/codecs`. The section calls `useCapabilities` and uses only
  the read, never `upload`, `installComponent` or `removeComponent`. Its styles
  are built in `PlaybackSection.styles.ts` on the Sync row's geometry.
- **Unchanged:** `CodecRow`, `ComponentDropZone`, `zoneFace`, `codecView`
  (`codecSummary` included), `useCapabilities` and its two writes, the
  `api/` calls, every server route, every type.

### Behaviour contracts

- **Two reads, no cache.** Settings reads `GET /api/playback/capabilities` on
  mount for the line. The Codecs page reads it on mount for the report. Back
  re-mounts Settings, which reads again, and that is how an upload shows in
  the line. No context and no shared cache: two mounts of one cheap `GET`
  don't justify one.
- **Arriving pushes, leaving steps.** The Codecs row is a push. Back on the
  page is a **History step**, with the **Landing** (`/settings`) taken only
  when there is no history behind it.
- **Order on the page:** Component row → drop zone → summary → codec rows. The
  summary still counts formats and never the component (log 16).

### Prototype amendments (phase 1's first commit, by hand)

1. `page.SettingsPage.dc.html`: in the Playback card, the _Codecs_ header and
   the `feat.CodecManager` mount are replaced by a Codecs row. It is a copy of
   the _Sync metadata & posters_ row with the microchip glyph, bound to
   `settings.codecRow.summary` and `settings.codecRow.onOpen`.
2. `feat.CodecManager.dc.html`: it becomes the screen, with the maintainer
   header over the _Playback component_ and _Formats_ groups, and it gains
   `onBack`. Row and zone markup is unchanged.
3. `page.CodecsPage.dc.html` (new): the maintainer sheet at 780 around
   `feat.CodecManager`.
4. `FamilyFlix.dc.html`: it gains `screen==='codecs'`, `goCodecs()` from the
   Settings row, and Back to `settings`. Settings receives only the summary
   line.
5. `COMPONENT-SPEC.md`: the SettingsPage and CodecManager entries are updated
   and a CodecsPage entry is added.

### Phases

1. **The page, end to end.** The prototype amendments, then `CodecsPage`, the
   route, and `CodecManager` restructured into the header and the two groups,
   with Back. The page is reachable by URL, and Settings still draws the old
   report.
2. **The Settings card.** The Codecs row replaces the header and the report in
   `PlaybackSection`.
3. **Docs and refactor.** CLAUDE.md's folder tree and the Settings Hub section.
   The refactor decides whether the Sync row and the Codecs row graduate into
   one `features/settings/` molecule, if they match character for character
   (log 26 Q14). The build doesn't pre-empt it. The ✅ is ticked only after
   the refactor closes.

## Testing Decisions

- **A good test here** drives the screen the way the maintainer does, through
  roles, names and visible text: press the Codecs row, read the heading, press
  Back, drop a pair. It asserts on what is drawn and where the router is,
  never on styled-component class names or hook internals. The order contract
  is asserted as document order, not pixels.
- **`CodecManager`**: the header (Back, the _Codecs_ heading, the lede verbatim)
  draws. The two group headings come in order. The Component row and the drop
  zone come before the summary, and the summary comes before the first codec
  row (`comesBefore`). With no component, the first group holds only the zone.
  Nothing under the header while the report is `null` or refused. Back steps
  when there is history and lands on `/settings` when there is none
  (`LocationProbe`). The existing upload, refusal and ✕ cases keep passing
  against the new layout.
- **`PlaybackSection`**: no codec rows, no drop zone and no lede on Settings.
  The Codecs row is a button named for _Codecs_ whose line is the Codec
  summary of the fetched report. The line is blank while the read is pending
  and after a refused read. Pressing the row pushes `/settings/codecs`. The
  subtitle half is unchanged and comes after the row.
- **`CodecsPage`**: renders the Codecs screen at `/settings/codecs` inside the
  maintainer surface. This is a composition test, following `ImportPage` and
  `EnrichmentPage`.
- **Round trip**: an upload on the Codecs page followed by Back shows the new
  summary in the Codecs row, proving the two-reads contract (log 26 Q13).
- **Prior art:** `NetworkSection.sync.test.tsx` (a navigation row pushing a
  route, its line blank until the summary lands), `CodecManager.test.tsx` (the
  report's faces, the upload and remove echoes), the `ImportFlow` Back tests
  (`useGoBack` with a Landing of `/settings`), and the `comesBefore` and
  `LocationProbe` test supports.
- **Not tested anew:** `CodecRow`, `ComponentDropZone`, `zoneFace`,
  `codecView` and `useCapabilities`, all unchanged, with suites that already
  pass.

## Out of Scope

- An accordion, a _Show all_, or any collapse on either screen (log 26 Q2).
- Splitting Formats into Video and Audio subheadings (Q9).
- Search or filter over the formats, and a per-codec details page.
- A shared cache or context for the report (Q13).
- An action in the Codecs page header (Q7).
- Any change to the molecules, the hook, the API calls, the server routes or
  the types (Q10).
- **Move the media folder** (_Change…_), which is still the Roadmap's.
- Steps 11–15 of the build order.

## Further Notes

- This is the first nested route under `/settings`. A future Settings sub-page
  should follow its shape: a page composing `MaintainerLayout` at 780 around
  an organism that owns its header, its Back and its `useGoBack('/settings')`.
- The glossary already carries **Codecs page**, **Codecs row** and **Formats
  group**, and the **Codec report** invariant is updated, all in commit
  `ffbd059`.
- The **Codecs page** ✅ in README and CLAUDE.md waits for the refactor, per
  the standing rule. The step 10 line is rewritten then, naming the sub-page
  and not the choice.
