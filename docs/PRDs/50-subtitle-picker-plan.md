# Plan: Subtitle picker, choose which subtitles in the player

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/434

Some films and episodes carry more than one subtitle file, and FamilyFlix
always shows the one `preferredSubtitle` picks. This initiative turns the CC
pill into the **Subtitle picker** when a film has two or more **Subtitles**: a
menu upward, _Off_ first, then each file by its **Subtitle label**, switching
mid-film. With one file the pill stays the toggle it is today. The viewer's
last hand action is the **Subtitle choice**, held by the player screen for the
sitting, so _Play now_ and _Up next_ open the next episode with subtitles on in
the chosen language, or off. Client only.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** None needs a
person in the loop:

- The prototype already lives in `docs/handoff/`, so amending it needs no
  Claude Design round. Its revision is phases 1 and 2, and lands before any
  build phase (log 50 Q16). The amendment is fully specified by the PRD and
  log 50 (copy, order, marking, placement); a phase never stops to ask.
- **Each phase stays well under a 100k-token context.** The prototype files
  are large (`FamilyFlix.dc.html` is about 135 KB, `COMPONENT-SPEC.md` about
  90 KB): a phase greps for the section it amends and reads only that range,
  never the whole file. That is why the two prototype files are two phases.
  The player's suites are large too (`Player.test.tsx` is about 2,200 lines):
  a phase adds its own focused suite (as `Player.audioPicker.test.tsx` and
  `PlayerScreen.audioChoice.test.tsx` did) and reads the big ones only by
  grep.
- No test runs Electron or FFmpeg. The wire is faked at `fetch` with
  `fakeResponse`; a Cue list is faked at the subtitle route.
- The docs (the checklist's step 33 row and entry, README's player paragraph,
  CLAUDE.md where the player and its folder tree are described, per log 50
  Q17) are not a phase: they are ticked ✅ only after the refactor. The
  glossary already carries **Subtitle picker**, **Subtitle choice**,
  **Subtitle label** and **Subtitle track**.

The phases are log 50's _Implementation Plan_ slices 1 to 3, each split in two
or more so no issue outgrows one context.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none new, none changed. The Cue list still comes off the
  existing subtitle route through `fetchSubtitleCues`, one track at a time.
- **Client routes**: none new.
- **Schema**: no migration, no new **Setting**. Nothing about a choice is
  stored or posted.
- **Key models**:
  - `Subtitle` (`{ id, path, language, position }`) is unchanged. **Track
    order** is ascending `position`, never arrival order.
  - The **Subtitle choice** is `string | null`: a language, or `null` for both
    "no choice yet" and "chose off", since both open off.
  - `preferredSubtitle(subtitles, language, choice)`: the first row in track
    order in the choice's language, else in the **Preferred subtitle
    language**, else the first in track order; case-insensitive.
  - `subtitleLabel(subtitle, subtitles)`: the language; when another row
    shares it (case-insensitive), ` · Track N` after it, N its place in track
    order from 1. A filename is never shown.
  - `useSubtitles` options gain `choice?: string | null` and
    `onChoice?: (language: string | null) => void` (the names
    `useAudioTracks` uses); its answer gains `subtitles` (track order),
    `hasSubtitlePicker` (two or more rows) and
    `choose(subtitle: Subtitle | null)`, where `null` is _Off_.
  - The Cue lists are held in a map keyed by Subtitle id: each track fetched
    at most once per open, only while on and only for the showing track.
- **The pill's two faces**: with one Subtitle, a toggle with `aria-pressed`;
  with two or more, `SubtitleMenu`'s trigger with `Menu`'s
  `aria-haspopup`/`aria-expanded` and no `aria-pressed`; with none, not drawn.
  Either face is named _Subtitles_ and lit (`$on`) while showing.
- **The sitting**: `PlayerScreen` holds `subtitleChoice` beside `audioChoice`
  and hands it to each keyed `Player`. Leaving the player forgets it; a fresh
  open starts off.
- **Unchanged throughout**: the server, the wire, Settings, `usePlayerKeys`'
  behaviour (`c` is still `toggleSubtitles`; `isInMenu` already covers any
  `role="menu"`).

---

## Phase 1: Prototype, the CC pill as a picker

**User stories**: 1 to 9, 13 to 16, 18 to 22 (as spec)

### What to build

Amend `docs/handoff/feat.PlayerControls.dc.html`: a `hasSubtitlePicker` prop
beside `hasSubs`. With it, pressing the CC pill opens a menu upward, the same
panel as the Audio picker's (`bottom: 54px`, `min-width: 220px`): _Off_ first,
then one item per subtitle file in track order, each named by its language,
with ` · Track N` on a shared language (e.g. _English · Track 1_, _English ·
Track 2_, _Spanish_). The showing track is marked, or _Off_ while off. A pick
switches and shuts the menu; Escape or a press outside shuts it unchanged;
while open it holds the chrome up, as the Audio picker's note says. Without
`hasSubtitlePicker` the pill stays the plain toggle; without `hasSubs` it is
not drawn. The pill is lit while subtitles show, in both faces.

Amend `docs/handoff/COMPONENT-SPEC.md`'s **PlayerControls** row (the spec
has no separate Audio menu entry, so none is added for the Subtitle menu):
its props gain `hasSubtitlePicker`, and its description names the CC pill's
two faces and the menu's items (_Off_, then the tracks by label, the showing
one marked).

Read only the CC pill's and the Audio picker's ranges of the prototype (grep
for `hasSubs` and `Audio picker`) and the spec's PlayerControls row (grep for
`PlayerControls`).

### Acceptance criteria

- [ ] With `hasSubtitlePicker`, the prototype's CC pill opens a menu upward
      listing _Off_ then the tracks, the showing one (or _Off_) marked.
- [ ] Two files in one language read _Language · Track N_; a lone language
      reads bare.
- [ ] A pick switches and shuts; Escape and a press outside shut with no
      change; the chrome stays up while open.
- [ ] Without `hasSubtitlePicker` the pill is the toggle as before; without
      `hasSubs` it is absent.
- [ ] COMPONENT-SPEC's PlayerControls row lists the prop and the menu.
- [ ] Nothing else in the controls prototype changes.

---

## Phase 2: Prototype, two files and the sitting

**User stories**: 10 to 12, 27, 28, 30 (as spec)

### What to build

Amend `docs/handoff/FamilyFlix.dc.html`: a film, and a series episode, with
two subtitle files (English and Spanish); the full prototype's player draws the
picker on them per phase 1, and picking a language switches the drawn line
mid-film. The prototype holds the choice for the sitting: after picking
Spanish, _Play now_ opens the next episode with Spanish subtitles on; after
picking _Off_, off. Leaving the player and opening something fresh starts off.

Read only the ranges that hold the sample library's subtitle data, the
player's `subsOn` state and _Play now_ (grep for them); never the whole file.

### Acceptance criteria

- [ ] The full prototype has a film and an episode with two subtitle files,
      and its player draws the Subtitle picker on them.
- [ ] Picking Spanish shows Spanish lines; _Off_ hides the box.
- [ ] _Play now_ after a Spanish pick opens the next episode on, in Spanish;
      after _Off_, off.
- [ ] A fresh open from the library starts with subtitles off.

---

## Phase 3: The Subtitle label and the Subtitle menu

**User stories**: 2 to 9, 13, 14, 16, 18, 19

### What to build

`subtitleLabel(subtitle, subtitles)`, a pure unit in the player feature: the
language, with ` · Track N` when another row shares it case-insensitively, N
by track order from 1.

`SubtitleMenu`, a new organism in the player feature, `AudioMenu`'s sibling on
`Menu`, a 1:1 translation of phase 1: the trigger is the existing CC pill face
(icon, _CC_, lit while on), named _Subtitles_; the panel is `AudioMenu`'s.
Items: _Off_, then one `MenuItem` per Subtitle in track order labelled by
`subtitleLabel`, `selected` on the showing row, or on _Off_ while off. Props:
the rows, the showing track (or `null` while off), `onChoose(subtitle |
null)`, `onOpenChange(open)`. Nothing composes it yet.

### Acceptance criteria

- [ ] A lone language labels bare; two sharing one get ` · Track N` by track
      order, not arrival order; a third distinct language beside a tie stays
      bare; ties are case-insensitive.
- [ ] The trigger is named _Subtitles_, has `aria-haspopup` and no
      `aria-pressed`, and is lit while on.
- [ ] Opening lists _Off_ then the labels in track order; the showing row,
      or _Off_ when `null`, is marked.
- [ ] A pick calls `onChoose` with the row, or `null` for _Off_, and shuts.
- [ ] `onOpenChange` reports open and shut; Escape shuts with no choice.

---

## Phase 4: `useSubtitles` chooses

**User stories**: 10 to 12, 23 to 26, 39 to 44

### What to build

`useSubtitles` gains the choosing within one open. It answers `subtitles` in
track order, `hasSubtitlePicker` (two or more rows) and `choose(row | null)`:
a row shows that row and turns subtitles on; `null` turns them off.
`toggleSubtitles` flips on and off over the current track, which is the last
hand pick when there is one, else `preferredSubtitle`'s. The single held Cue
list becomes a map keyed by Subtitle id: switching back to a track already
read asks nothing; a list arriving for a track no longer showing is kept but
never drawn; a failed fetch is still no box. Lines are still fetched only
while on and only for the showing track. Subtitles still open off; no
`choice` yet. The docblock's "no picker ships" is rewritten.

### Acceptance criteria

- [ ] `hasSubtitlePicker` is false with zero or one row, true from two.
- [ ] `choose(row)` turns subtitles on and draws that row's line; while off,
      one call does both.
- [ ] `choose(null)` clears the line.
- [ ] After a pick, toggling off and on again shows the picked row, not the
      preference's.
- [ ] Switching English, Spanish, English makes one request per track.
- [ ] A late list for a track no longer showing is never drawn.
- [ ] A failed fetch draws no line and the hook keeps working.
- [ ] The line follows the position after a seek on whichever track shows.
- [ ] The existing `useSubtitles` suite passes.

---

## Phase 5: The picker in the player

**User stories**: 1, 15, 17, 20 to 22

### What to build

`PlayerControls` gains `hasSubtitlePicker`, `subtitles`, `subtitleTrack`,
`onChooseSubtitle` and `onSubtitleMenuChange`, and draws `SubtitleMenu` in
the CC pill's place (its slot after the Audio picker in the right group) when
`hasSubtitlePicker`; otherwise the pill as today, or nothing with no track.
`Player` wires them from `useSubtitles`, and one `menuOpen`, fed by both
menus' `onOpenChange`, replaces `audioMenuOpen` in holding the chrome up.
`usePlayerKeys`' `isInMenu` docblock names both pickers.

Demo: open a film with English and Spanish subtitle files, press CC, pick
_Spanish_, and Spanish lines draw mid-film; press CC, pick _Off_, and the box
is gone.

### Acceptance criteria

- [ ] With two or more files the controls draw the Subtitle picker in the
      pill's place; with one, the toggle with `aria-pressed`; with none, no
      pill.
- [ ] In the player, picking Spanish draws Spanish lines and _Off_ hides the
      box.
- [ ] An open Subtitle menu holds the chrome up, as the Audio menu does, and
      the Audio menu still does.
- [ ] Keys pressed inside the open menu do not seek or pause.
- [ ] `c` after a pick and two presses restores the picked track.
- [ ] The existing `PlayerControls`, `Player` and `usePlayerKeys` suites pass.

---

## Phase 6: The choice, decided in the hook

**User stories**: 29, 31, 34, 35, 37

### What to build

`preferredSubtitle` gains its third argument, `choice`, as `preferredAudio`
has: the first row in track order in the choice's language, else the
preference's, else the first; case-insensitive; `null` and absent behave as
today. Its docblock's "nobody chooses" is rewritten.

`useSubtitles` takes `choice` and `onChoice`. The opening state is on when
`choice` is a language and the film has rows, off when it is `null` or
absent; the opening track is `preferredSubtitle(subtitles, language,
choice)`. Every hand action (`choose`, the pill's toggle, `c`) reports
`onChoice` with the showing track's language, or `null` for off. Nothing is
reported at open. Nothing passes a `choice` yet.

### Acceptance criteria

- [ ] `preferredSubtitle`: a choice beats the preference; a choice no row
      speaks falls to the preference, then track order; the first of two
      same-language rows wins; case-insensitive; existing tests pass.
- [ ] `useSubtitles` opens off with no choice and with `null`; opens on, on
      the choice's row, with a language; opens on the rule's row when no row
      speaks the choice.
- [ ] `choose(row)` reports the row's language; `choose(null)` reports
      `null`; toggling reports on (the track's language) and off (`null`).
- [ ] Nothing is reported at open, with or without a choice.

---

## Phase 7: The sitting

**User stories**: 27, 28, 30, 32, 33, 36, 38

### What to build

`PlayerScreen` holds `subtitleChoice` beside `audioChoice`
(`useState<string | null>(null)`) and hands it to each keyed `Player` with
`onSubtitleChoice`; `Player` passes them to `useSubtitles` as `choice` and
`onChoice`. An episode with no Subtitles reports nothing, so the choice passes
through it. Leaving the player drops it; never stored, never posted. Films and
episodes behave the same. `PlayerScreen`'s docblock names the Subtitle choice
beside the Audio choice.

Demo: in an episode, pick Spanish subtitles; press _Play now_ (or let the
countdown run out) and the next episode opens with Spanish subtitles on.
Turn them off, and the episode after opens off. Go back to the library and
open anything: off.

### Acceptance criteria

- [ ] A language chosen in one episode opens the next on, in that language,
      by _Play now_ and by the countdown.
- [ ] A language the next episode lacks opens it on, on its rule's track.
- [ ] Off carries as off; on by the pill or `c` carries as on.
- [ ] An episode with no subtitle files passes the choice to the one after.
- [ ] A fresh open from the library starts off.
- [ ] No settings write and no new request is made for the choice.
- [ ] The existing `PlayerScreen` suites, the Audio choice's included, pass.
