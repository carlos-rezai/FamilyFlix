# 50: Subtitle picker

> **Initiative:** `subtitle-picker`
> **PRD:** `docs/PRDs/50-subtitle-picker.md` (to be written)
> **Plan:** `docs/PRDs/50-subtitle-picker-plan.md` (to be written)

This log is the `grill-me` session for step 33 of the build order, **Subtitle
picker**, held before the prototype revision and the PRD. It ran against the
code as it stood on 2026-10-22 (`043b557`). It is an immutable snapshot of that
moment. The session ran alone, and the maintainer approved every
recommendation in advance, asking that the codebase stay consistent with its
naming, code conventions, patterns and architecture. Their brief:
_subtitle-picker. the way we did it for audio language, lets do it for
subtitles. if a movie/series has subtitles, the player should have an option
to turn on/off and select (if multiple subtitles are present)._ The
checklist's row: _Subtitle picker: choose a track in the player_.

## Background

What exists, read off the code:

- **A Subtitle is a file beside the video.** `Subtitle { id, path, language,
position }` (`src/types/movie.ts`) on a **Movie** and an **Episode** alike:
  a copied `.srt`/`.vtt`/`.ass`/`.sub`, its language the chosen text from the
  **Language pool**, its `position` the track order. Two rows may share a
  language (an English and an English SDH file).
- **Nobody chooses.** `preferredSubtitle(subtitles, language)` picks the
  **Subtitle track**: the first row in the **Preferred subtitle language**,
  else the first in track order. Its docblock records why: no picker shipped,
  so determinism mattered most.
- **`useSubtitles`** owns the track, `subtitlesOn` (off on every open, a
  recorded divergence from the prototype's `subsOn: true`), the **Cue list**
  (fetched once per track through `fetchSubtitleCues`, held as one
  `HeldCues { trackId, list }`) and the `line` the **Subtitle overlay**
  draws. The preference comes in from `useOpeningReads`' settings read.
- **The CC pill** (`SubtitleButton`, `$on` face, `aria-pressed`) toggles, is
  drawn only for a film with **Subtitles**, and sits after the **Audio
  picker** in the transport row's right group. `c` toggles it through
  `usePlayerKeys`, `null` when there is no track.
- **The Audio picker is the precedent** (log 46): `AudioMenu` on `Menu`,
  opening upward (`styled(Menu)` with `bottom: 54px`), drawn only with two or
  more tracks; `useAudioTracks` holds a hand pick over the opening rule;
  `PlayerScreen` holds the **Audio choice** (a language) for the sitting and
  hands it to each keyed `Player`; an open menu holds the chrome up
  (`audioMenuOpen` into `useControlsVisibility`); `usePlayerKeys`' `isInMenu`
  leaves keys inside `role="menu"` to the menu.
- **The settings side is done.** The _Subtitles_ block's _Preferred subtitle
  language_ row stays; its disabled auto-on row was dropped in `043b557`.

## Problem

1. A film with several subtitle files always shows the one the rule picks;
   the household cannot see the others.
2. The CC pill can only toggle; there is nowhere to say which.
3. An episode's choice is lost at _Up next_: the next episode opens with
   subtitles off even after a whole evening with them on.

## Questions and Answers

### Scope

1. **Which subtitles?** ✅ **The Subtitle rows only**: the files the form,
   the importer and the folder scan already attach. ❌ Subtitle streams
   embedded in an MKV: reading them means ffmpeg extracting a stream to a
   Cue list, a new server mechanism, the wire carrying stream tracks beside
   rows, and image formats (PGS, VobSub) we cannot draw at all. A later step
   if the house asks.

2. **One initiative?** ✅ **One**, `subtitle-picker`, step 33, client only:
   the picker, the choice for the sitting, the Cue lists held per track. No
   migration, no route, no wire change, no new **Setting**. ❌ Not built:
   auto-on subtitles (the dropped row stays dropped), a choice stored per
   title, a choice written to the **Preferred subtitle language**, a
   subtitle-style setting.

### Names

3. **What are the new things called?** ✅
   - **Subtitle picker**: the CC pill when the film has two or more
     **Subtitles**, with the `Menu` it opens upward. `SubtitleMenu` in
     `features/player/`, `AudioMenu`'s sibling.
   - **Subtitle choice**: what a viewer last did by hand to the subtitles,
     held by `PlayerScreen` for the sitting: the language of the track
     showing, or `null` for off. The **Audio choice**'s sibling.
   - **Subtitle label**: what the picker draws for one **Subtitle**.

   The **Subtitle track** keeps its name and loses "never by the viewer".
   ❌ "caption menu", "CC menu", "subtitle selector", "track menu".

### The control

4. **One control or two?** ✅ **One: the CC pill becomes the picker** when
   the film has two or more Subtitles. Pressed, it opens a `Menu` upward:
   _Off_ first, then one `MenuItem` per Subtitle in track order, the showing
   one marked (or _Off_ while off), as `AudioMenu` marks its track. With one
   Subtitle the pill stays the plain toggle it is today, CC's own "a menu of
   one choice is a question with one answer". ❌ A second button beside CC:
   two subtitle controls in a row a parent reads at a glance. ❌ A menu for
   one file: _Off_ and _English_ is a toggle drawn twice.

5. **The pill's face and semantics?** ✅ The same `SubtitleButton`: icon,
   _CC_, `$on` while showing. As a toggle it keeps `aria-pressed`; as the
   picker's trigger it takes `Menu`'s `aria-haspopup`/`aria-expanded` and
   drops `aria-pressed` (a control is a toggle or a menu button, not both).
   Named _Subtitles_ either way. The menu's panel is `AudioMenu`'s: upward,
   `bottom: 54px`, `min-width: 220px`.

6. **The `c` key?** ✅ **Still a toggle**, picker or not: on shows the
   **Subtitle track** (the last picked, else the rule's), off hides it. ❌ A
   cycling key (`a`'s twin): the household already knows `c` as on/off, and
   a key that walks through languages would read as broken. The menu's own
   keys are `Menu`'s.

7. **What does an open menu do to the chrome?** ✅ Holds it up, as the Audio
   picker's does: `Player` holds one `menuOpen` fed by both menus' `onOpenChange`
   instead of `audioMenuOpen`. `usePlayerKeys`' `isInMenu` already covers any
   `role="menu"`; only its docblock widens.

### Labels

8. **What does the picker draw for a track?** ✅ `subtitleLabel(subtitle,
subtitles)` in `features/player/subtitleLabel/`, pure: the language
   (`English`); when two rows share it, ` · Track N` after each, N its place
   in track order from 1, `audioTrackLabel`'s rule. Client side, because a
   Subtitle's language is already the human name (an audio tag is not). ❌
   The filename: the form already shows it, and `the-lantern-keeper.en.sdh.srt`
   is not something a parent reads.

### Which track, and on or off

9. **The rule?** ✅ `preferredSubtitle(subtitles, language, choice)` gains
   `preferredAudio`'s third argument: the first row in the **Subtitle
   choice**'s language, else in the **Preferred subtitle language**, else
   the first in track order. A choice no row speaks falls to the preference.

10. **What is the Subtitle choice's shape?** ✅ `string | null`: a language
    means on in that language, `null` means off. `null` is also the opening
    state, so "no choice yet" and "chose off" are one state, both today's
    behaviour (off). ❌ `{ on, language }` or a third `undefined` state: a
    distinction nothing would read.

11. **What counts as a choice?** ✅ **Every hand action on the subtitles**: a
    menu pick (a track or _Off_), the pill's toggle, `c`. Each tells
    `onChoice` the showing track's language, or `null`. The opening rule's
    answer is never reported, nobody picked it. ❌ Only menu picks: turning
    subtitles on with `c` would then be forgotten at _Up next_.

12. **Does a choice carry across the sitting?** ✅ **Yes, as the Audio choice
    does**: `PlayerScreen` holds `subtitleChoice` beside `audioChoice` and
    hands it to each keyed `Player`. A choice of a language opens the next
    episode **with subtitles on**, in that language where a row speaks it,
    else on the rule's track; `null` opens it off. An episode with no
    Subtitles draws no pill and leaves the choice as it was for the one
    after. Leaving the player forgets it; never stored, never posted. This
    narrows log 10's "off on every film" to "off on every **open**": the
    roadmap's auto-on is still not built.

### The Cue lists

13. **Does a switch refetch?** ✅ **Once per track per open**: `useSubtitles`
    holds the Cue lists in a map by Subtitle id, so switching back to a track
    already read asks nothing. A list arriving for a track no longer showing
    is kept, not drawn. Still fetched only while on, still a fetch failure is
    a film that plays on with no box. ❌ Prefetching every track at open:
    requests for files nobody may show.

### Units and wiring

14. **Who owns what?** ✅ `useSubtitles` stays the one hook for the feature,
    as its docblock argues, and gains the choosing: options `choice?` and
    `onChoice?` (`useAudioTracks`' names); answers `subtitles` (track
    order), `track`, `subtitlesOn`, `line`, `hasSubtitlePicker` (two or
    more), `toggleSubtitles` and `choose(subtitle: Subtitle | null)`, `null`
    being _Off_. ❌ `hasSubtitleTracks` as `hasAudioTracks`' twin: the
    **Subtitle track** is the one showing, so the name would misuse the
    glossary. `PlayerControls` gains `hasSubtitlePicker`, `subtitles`,
    `subtitleTrack`, `onChooseSubtitle` and `onSubtitleMenuChange`, and draws
    `SubtitleMenu` in the pill's place when `hasSubtitlePicker`.

15. **Episodes?** ✅ **Exactly as films**: an Episode's `subtitles` are the
    same rows, the same picker, the choice carried across _Up next_.

### Prototype and docs

16. **Prototype first?** ✅ **Yes**, per _The prototype is the spec_:
    `feat.PlayerControls.dc.html` (the pill opening the menu, _Off_ then the
    tracks, a `hasSubtitlePicker` prop beside `hasSubs`) and
    `FamilyFlix.dc.html` (a film with two subtitle files; the choice kept on
    _Play now_).

17. **Which documents change?** ✅ The checklist's step 33 row and a
    numbered entry, README's player paragraph, CLAUDE.md where the player
    is described, the folder tree (`subtitleLabel/`, `SubtitleMenu/`), the
    docblocks of `preferredSubtitle` and `useSubtitles` that say no picker
    ships, and the glossary: ticked ✅ only after the refactor.

## Design

### Chosen and rejected

- ✅ Subtitle rows only; ❌ embedded streams.
- ✅ The CC pill becomes a `Menu` with two or more; ❌ a second button; ❌ a
  menu of one.
- ✅ _Off_ first in the menu; `c` stays a toggle; ❌ a cycling key.
- ✅ Labels by language, ` · Track N` on a tie; ❌ filenames.
- ✅ Choice → preference → track order; the **Subtitle choice** carried for
  the sitting, on or off; ❌ stored per title; ❌ written to the preference.
- ✅ Cue lists held per track; ❌ prefetching all.
- ✅ No server, wire or settings change.

### Types

```ts
// src/features/player/useSubtitles/useSubtitles.ts
export interface SubtitlesOptions {
  playable: Playable;
  subtitles: Subtitle[];
  position: number;
  language?: string;
  /** The **Subtitle choice** carried from an earlier player in the sitting. */
  choice?: string | null;
  /** Told of every hand action: the showing track's language, `null` for off. */
  onChoice?: (language: string | null) => void;
}

export interface Subtitles {
  subtitles: Subtitle[]; // track order
  track: Subtitle | null;
  subtitlesOn: boolean;
  line: string | null;
  hasSubtitlePicker: boolean; // two or more
  toggleSubtitles: () => void;
  choose: (subtitle: Subtitle | null) => void; // null is Off
}
```

### The sitting

```mermaid
sequenceDiagram
  participant S as PlayerScreen
  participant P1 as Player (S1E4)
  participant P2 as Player (S1E5)
  S->>P1: subtitleChoice null
  Note over P1: opens off; viewer picks Spanish in the menu
  P1->>S: onSubtitleChoice('Spanish')
  Note over P1: Play now
  S->>P2: subtitleChoice 'Spanish'
  Note over P2: opens on, Spanish row (else the rule's track)
```

### The units

| Unit                       | Where                                    | What                                               |
| -------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `preferredSubtitle` (ch.)  | `src/features/player/preferredSubtitle/` | `choice` ahead of the preference                   |
| `subtitleLabel` (new)      | `src/features/player/subtitleLabel/`     | a Subtitle's label, ` · Track N` on a tie          |
| `useSubtitles` (changed)   | `src/features/player/useSubtitles/`      | the choice, `choose`, the picker flag, cues by id  |
| `SubtitleMenu` (new)       | `src/features/player/SubtitleMenu/`      | the **Subtitle picker** on `Menu`, _Off_ first     |
| `PlayerControls` (changed) | `src/features/player/PlayerControls/`    | the menu in the pill's place with two or more      |
| `Player` (changed)         | `src/features/player/Player/`            | one `menuOpen`; the choice in and out              |
| `PlayerScreen` (changed)   | `src/features/player/PlayerScreen/`      | holds the **Subtitle choice** beside the audio one |
| `usePlayerKeys` (docs)     | `src/features/player/usePlayerKeys/`     | `isInMenu` names both pickers                      |

## Implementation Plan

1. **Prototype.** The two files of Q16.
2. **The picker.** `subtitleLabel`, `SubtitleMenu`, `useSubtitles`' `choose`
   and `hasSubtitlePicker`, the Cue lists by id, `PlayerControls` and
   `Player` (`menuOpen`): a film with two files switches language mid-film,
   and _Off_ hides the box.
3. **The sitting.** `preferredSubtitle`'s `choice`, `onChoice` from every
   hand action, `PlayerScreen`'s `subtitleChoice`: _Play now_ keeps a
   Spanish evening's subtitles on and Spanish.
4. **Docs.** Per Q17.

## Trade-offs

- **Easier:** every subtitle file the family attached is reachable; one
  control and one key as before; nothing on the server moves, so nothing on
  the server can break.
- **Harder:** the CC pill has two faces (toggle and menu trigger), decided by
  a count; `useSubtitles` grows from four pieces of state to five plus a
  map; the sitting now carries "on", so a household that turns subtitles on
  for one episode sees them on the next.
- **Out of scope:** embedded subtitle streams, auto-on, a per-title memory,
  a subtitle-style setting, writing the choice to the preference.
