# 46 — Audio tracks

> **Initiative:** `audio-tracks`
> **Issue:** to be filed by `write-a-prd` (build order step 29)
> **PRD:** `docs/PRDs/46-audio-tracks.md` (to be written)

This log is the `grill-me` session for build order step 29, 🔜 **Audio
tracks**. It was held before the PRD and the prototype revision, against the
code as it stood on 2026-10-18 (`7fcbaf8`), and it is an immutable snapshot of
that moment. The session ran alone, and the maintainer approved every
recommendation in advance, asking that the codebase stay consistent with its
naming, code conventions, patterns and architecture. Its input was step 29's
roadmap entry (`219ed19`): some films carry several audio languages, and the
player plays whichever is first.

## Background

What exists, read off the code:

- **The probe knows one audio stream.** `playback/probe/` reads ffprobe's
  JSON into `MediaProbe { container, videoCodec, audioCodec,
durationSeconds }` — `codecOf(streams, 'audio')`, the **first** audio
  stream's codec. Nothing reads a stream's language, title or disposition.
- **The policy maps nothing.** `choosePlaybackPath` builds `remuxArgs`
  (`-c copy`) and `transcodeArgs` with **no `-map`**, so ffmpeg's own stream
  selection decides: one video (highest resolution) and one audio (most
  channels, first on a tie) — not necessarily the first, and not a choice
  anyone made. **Direct play** sends the file as it is, and Chromium plays
  the MP4's first audio track.
- **Chromium's `audioTracks` is off.** `HTMLMediaElement.audioTracks` sits
  behind the `AudioVideoTracks` Blink feature: undefined in a stock Chromium,
  absent in jsdom, and no help to a fragmented MP4 that carries one track.
- **The Playback read** — `GET /api/{movies|episodes}/:id/playback` →
  `PlaybackRead { path, durationSeconds }` — is fetched once per open by
  `useOpeningReads`; `usePlayback` takes it whole and decides from `path`
  whether a seek writes `currentTime` (**Direct play**) or re-points the
  element at a new **Stream offset** (`?t=`, `anchorStream`).
- **The stream route** reads `?t=` through `streamOffset` (400 for a `t` that
  is not a position), then `playback.stream(file, offsetSeconds)` →
  `StreamPlan` (`direct` / `converted` / `cannot-play` / `past-end`).
- **Subtitles are the precedent.** `useSubtitles` reads `fetchSettings` once
  per open, never waited for, and hands `subtitleLanguage` to the pure
  `preferredSubtitle(subtitles, language)` — the preferred language, then
  track order. No picker ships: the CC pill toggles, nothing chooses.
- **The preference precedent.** `settings` table keys (`subtitle-language`,
  `ultrawide-margins`, `tmdb-ratings`) read through `valueOf` / `flagOf`;
  `GET /api/settings` → `Settings`; one **Single-signal write** per key
  (`POST /api/settings/subtitle-language { value }`, `400` for a missing,
  empty or non-string value). The Playback card's _Subtitles_ block draws
  _Preferred language_ over `FilterDropdown`, held by `useSettings`
  (`chooseSubtitleLanguage`: shown at once, put back on refusal).
- **The Language pool** is `SUBTITLE_LANGUAGES` / `SubtitleLanguage` in
  `src/types/settings.ts`, seven English names, read by the form,
  `detectSubtitleLanguage` and the Settings hub.
- **The sitting.** `PlayerScreen` is the unkeyed **Fullscreen surface** around
  a `Player` keyed on its **Playable**, so _Play now_ plays the next episode
  on in fullscreen; state held there survives an episode change.
- `Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })` over
  `new Intl.Locale(tag).language` names every ISO 639-1/-2 tag ffprobe
  reports — `eng`, `fre`/`fra`, `ger`/`deu`, `dut`, `jpn`, `pt-BR` → English,
  French, German, Dutch, Japanese, Portuguese — and answers `undefined` for an
  unknown one (`qaa`); `und` throws.

## Problem

1. A film with several audio languages plays whichever ffmpeg or Chromium
   happens to pick, and the household cannot say which it wants.
2. Nothing in the player lets a viewer change language mid-film.
3. Chromium will not switch tracks for us, so a switch has to be the
   server's — without breaking seeking, resume, subtitles or the watch tick.

## Questions and Answers

### Scope

1. **One initiative?** ✅ **One**, `audio-tracks`, step 29: a household
   preference, the player opening on it, and a picker that switches
   mid-film. No migration — nothing about a track is stored (Q16). ❌ Not
   built: a subtitle picker (CC stays a toggle), a choice remembered per
   title, an audio language in the **Movie form** or the importer, an audio
   column in an **Export**, and adding names to the **Language pool**.

### Names

2. **What are the new things called?** ✅
   - **Audio track** — one audio stream of a video, as the **Playback read**
     offers it: its **Audio track index**, its language, its label, whether
     the file marks it default, and its own **Playback path**. `AudioTrack`.
   - **Audio track index** — a track's place among the file's **audio**
     streams, from 0 — ffmpeg's `0:a:N`, and the stream URL's `?a=`. Never
     the stream's absolute index in the container.
   - **Preferred audio language** — the household's language for a film's
     opening track, `settings.audio-language`, `Settings.audioLanguage`,
     `English` until set. The **Preferred subtitle language**'s sibling.
   - **Audio picker** — the player's control that lists the offered Audio
     tracks and switches between them. `AudioMenu` in `features/player/`.
   - **Audio choice** — the language of the track a viewer picked by hand,
     held by `PlayerScreen` for the rest of the sitting (Q14).

   ❌ "dub", "language track", "audio stream" (in prose), "sound track",
   "audio selector" — aliases to avoid.

### The mechanism

3. **Who switches the track — Chromium or the server?** ✅ **The server**:
   the stream route's `?a=<index>` maps the chosen stream, `-map 0:V:0? -map
0:a:<index>?`, on both converting paths. A switch is a re-point of the
   element, exactly as a stream seek is. ❌ `app.commandLine.appendSwitch(
'enable-blink-features', 'AudioVideoTracks')` — experimental, absent from
   `npm run dev` in a browser and from jsdom, and it does nothing for a
   fragmented MP4 holding one track; the player would have two switching
   mechanisms. ❌ An HLS/MSE pipeline with every track — a new player.

4. **Do the converting paths always map?** ✅ **Yes**, even at index 0:
   `-map 0:V:0?` (capital `V` — the first video that is not an attached
   cover picture) and `-map 0:a:N?` (`?` — a film with no audio still
   plays). A remux and a transcode then play the track asked for, never
   ffmpeg's "most channels" pick, and drop subtitle and data streams an MP4
   cannot take. `probe`'s `videoCodec` skips `attached_pic` streams too, so
   the policy reads the stream the map sends.

5. **When is a multi-track file still Direct play?** ✅ **Only on its first
   Audio track.** Direct play sends the file untouched and Chromium plays the
   first audio track, so index 0 of a native file is `direct`; any other
   index of the same file is a **Remux** (`-c copy`, nothing re-encoded) when
   its codec is native, a **Transcode** when it is not. Which track Chromium
   plays on a multi-track MP4 is a **Package smoke** check. ❌ Always
   remuxing a multi-track file — it would cost every English viewing its
   byte-range seeking.

6. **What does the probe learn?** ✅ `MediaProbe.audioCodec` becomes
   `audioStreams: ProbedAudio[]`, in file order — `{ codec, language,
title, isDefault }`: `codec_name`, `tags.language` (the raw tag, `null`
   when absent), `tags.title` (trimmed, `null` when empty) and
   `disposition.default === 1`. Server side, `playback/` only, as
   `MediaProbe` is. The policy reads the **chosen** stream's codec.

### The wire

7. **What does the Playback read carry?** ✅ `PlaybackRead` gains
   `audioTracks: AudioTrack[]` — the **offered** tracks, in index order:

   ```ts
   // src/types/playback.ts
   export interface AudioTrack {
     /** Its **Audio track index** — the stream URL's `a`. */
     index: number;
     /** Its language named in English (`English`, `Japanese`), or `null`. */
     language: string | null;
     /** What the **Audio picker** draws for it. */
     label: string;
     /** Whether the file marks it as its default. */
     fileDefault: boolean;
     /** The **Playback path** this track takes — never `cannot-play`. */
     path: Exclude<PlaybackPath, 'cannot-play'>;
   }
   ```

   Each track carries **its own path**, so one read tells a switch whether it
   is a seek by range or a restart — no read per switch. `path` stays the
   path a URL with no `a` plays (index 0's). A track that cannot play is not
   offered, so a machine with no component offers at most index 0. `[]` for
   a file nothing could probe and for one with no audio. ❌ A second read
   with `?a=` per switch — a round trip before every switch.

8. **How does the stream URL carry it?** ✅ `?a=<index>` beside `?t=`,
   absent meaning 0, both written only when non-zero — the plain URL stays
   the fresh open's. Read by `audioTrackQuery` beside `streamOffset`: a
   non-negative integer, else `400` _Query a must be an audio track number,
   from 0_ — before the path is chosen, as `t` is. `playback.stream(file,
offsetSeconds, audioTrack)`; an index the file does not have is the new
   `StreamPlan` `{ path: 'no-track' }` → `404` _No audio track N: <id>_, the
   unknown subtitle's precedent, nothing spawned.

### Naming a track

9. **What is a track's language?** ✅ The base language of its tag, named in
   English: `trackLanguage(tag)` in `playback/trackLanguage/`, pure —
   `Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })` over
   `new Intl.Locale(tag).language`. `null` for no tag, `und`, `mul`, `zxx`,
   `mis`, a tag `Intl` refuses or one it cannot name. So `pt-BR` is
   `Portuguese` and matches the pool's name. ❌ Reusing
   `detectSubtitleLanguage`'s seven-language table — it would name a
   Japanese track `English`, the subtitle default.

10. **What does the picker draw for a track?** ✅ `audioTrackLabel`, inside
    `playback/audioTracks/`:
    - language and a title: `English · Commentary`; the title alone when it
      already holds the language name (`English 5.1`);
    - language only: `English`;
    - a title only: `Commentary`;
    - neither: `Track 2` (the index, from 1);
    - two tracks that would read the same: ` · Track N` after each.

    The server labels, so the client never sees a raw tag.

### Which track a film opens on

11. **The opening rule?** ✅ `preferredAudio(tracks, language)` in
    `features/player/preferredAudio/`, pure, `preferredSubtitle`'s twin: the
    first track whose `language` matches (case-insensitive), else the
    `fileDefault` one, else the first; `null` for `[]`. The language is the
    **Audio choice** when one is held (Q14), else the **Preferred audio
    language**.

12. **Is the preference waited for?** ✅ **Yes, unlike the subtitles'.** A
    subtitle late is a box that appears late; an audio track late is a
    restart a second into the film. `useOpeningReads` gains the settings
    read as its third opening read — the element is pointed once it has
    **settled**, landed or refused; refused is no preference (the file's
    default, else the first). `useSubtitles` takes `subtitleLanguage` from
    the same read and stops fetching for itself: one `GET /api/settings`
    per open. ❌ Pointing the element at index 0 and switching when the
    settings land.

### Switching mid-film

13. **What does a switch do?** ✅ It keeps the **Absolute position** and the
    play/pause state, and is `usePlayback`'s, the deep module that owns the
    element: the hook takes `audioTrack: AudioTrack | null` and its path is
    the track's (`read.path` with none). A switch onto a streaming path is
    `anchorStream(absolute())` with the new `a`; onto `direct` the offset is
    nought and `currentTime` is wound to the position once the element has
    metadata. Subtitles, the **Watch tick** and _Up next_ read the Absolute
    position and notice nothing. The buffering circle is the only feedback —
    no snackbar.

14. **Is a choice remembered?** ✅ **For the sitting, as a language.**
    `PlayerScreen` holds the **Audio choice** — the language of the track
    last picked by hand, `null` for a track with none — and hands it to the
    next episode's `Player`, so _Play now_ keeps a Spanish evening Spanish.
    Leaving the player forgets it. ❌ Per title in the database — a column
    and a migration for a choice the preference already covers. ❌ Writing
    the choice back to the preference — a viewer's press would change the
    household's setting.

15. **Episodes?** ✅ **Exactly as films**: the same read, the same rule, the
    Audio choice carried across _Up next_.

### The server

16. **What changes on the server?** ✅ `probe` (Q6), `choosePlaybackPath`
    (`audioTrack`, default 0; Q4–5), `trackLanguage` and `audioTracks` (new,
    pure), `createPlayback`'s `read` (each track's path off the one probe)
    and `stream` (Q8), the stream route's `a`, and the settings key and
    route (Q17). Nothing is stored: the tracks are read off the file per
    request, as the path is. `capabilities`, `frame`, `derivedRuntime`, the
    importer and the Export are untouched.

### Settings

17. **The preference's shape?** ✅ The subtitle language's sibling, line for
    line: key `audio-language`; `Settings.audioLanguage: string`;
    `DEFAULT_AUDIO_LANGUAGE = 'English'` applied when the row is absent;
    `setAudioLanguage()`; `POST /api/settings/audio-language { value }` →
    `{ value }`, `400` for a missing, empty or non-string value, pool
    membership unchecked. `saveAudioLanguage` in `features/settings/api/`;
    `useSettings` gains `audioLanguage` and `chooseAudioLanguage`, the same
    bargain. A **Factory reset** erases it with the rest.

18. **The Language pool's name?** ✅ Renamed for both readers:
    `SUBTITLE_LANGUAGES` → `LANGUAGE_POOL`, `SubtitleLanguage` →
    `PoolLanguage`, `DEFAULT_SUBTITLE_LANGUAGE` kept beside the new
    `DEFAULT_AUDIO_LANGUAGE`. A mechanical `refactor:` commit first. ❌
    `SUBTITLE_LANGUAGES` read by the audio row — a name that lies.

19. **Where is it drawn?** ✅ The Playback card, under _Subtitles_: the
    divider, **Audio** with its lede _Which language a movie plays in when it
    has more than one._, then one `$last` row — _Preferred language_, _Which
    track to play when a movie has several._ — over `FilterDropdown` with
    the seven pool names, not drawn while `null`. The two dropdowns' labels
    become _Preferred subtitle language_ and _Preferred audio language_, so
    the page has no two controls with one name. ❌ A Toggle-style auto-on
    beside it — audio is never off.

### The player

20. **What is the Audio picker?** ✅ A round 44px chrome button in the
    transport row's right group, **before CC** — `[Audio] [CC] [Fullscreen]`
    — a new `SpeechBubbleIcon` primitive (named for what it draws), named
    _Audio_. Pressed, a `Menu` opens **upward** over the bottom bar: one
    `MenuItem` per offered track, its label, the playing one marked as
    `FilterDropdown` marks its value. Drawn only with **two or more**
    offered tracks — CC's rule, absent rather than disabled. Unmounted with
    the rest of the chrome while faded; an open menu holds the chrome up as
    a hovered control does.

21. **A key?** ✅ `a` / `A` — the next offered track, wrapping, only while
    the picker is drawn — `usePlayerKeys` onto the picker's own handler, as
    `c` is onto CC's. ❌ VLC's `b` — nobody in this house knows it.

### Prototype and docs

22. **Prototype first?** ✅ **Yes**, per _The prototype is the spec_:
    `page.SettingsPage.dc.html` (the Audio block, both dropdowns' labels),
    `feat.PlayerControls.dc.html` (the Audio button and its open menu, a
    `hasAudioTracks` prop beside `hasSubs`) and `FamilyFlix.dc.html` (a film
    with two tracks, the switch keeping the position).

23. **Which documents change?** ✅ README's and CLAUDE.md's step 29 and the
    _Audio tracks_ / _Audio preferences_ entries, CLAUDE.md's Settings Hub
    (`GET /api/settings`' three fields become four, the new route), the
    folder tree (`trackLanguage/`, `audioTracks/`, `preferredAudio/`,
    `AudioMenu/`, `useOpeningReads`' third read, `settings.ts`' renamed
    pool) and the glossary — ticked ✅ only after the refactor.

## Design

### Chosen and rejected

- ✅ The server maps the track (`?a=`, `-map 0:a:N?`); ❌ Chromium's
  `audioTracks` behind a Blink flag; ❌ an HLS pipeline.
- ✅ Every converting path maps explicitly; ❌ ffmpeg's own pick.
- ✅ Direct play on index 0 only; ❌ remuxing every multi-track file.
- ✅ One read, each track's own path; ❌ a read per switch.
- ✅ Tracks named by `Intl.DisplayNames`; ❌ the subtitle tag table.
- ✅ Preference → file default → first; the preference **waited for**.
- ✅ The Audio choice held for the sitting; ❌ stored per title; ❌ written
  to the preference.
- ✅ A `Menu` picker before CC, two or more tracks only, `a` to cycle.
- ✅ `LANGUAGE_POOL` renamed first.

### The opening and a switch

```mermaid
sequenceDiagram
  participant P as Player
  participant S as Server
  P->>S: GET /api/movies/:id · …/playback · /api/settings
  S-->>P: PlaybackRead { path, durationSeconds, audioTracks }
  S-->>P: Settings { audioLanguage: 'Spanish', … }
  Note over P: preferredAudio → index 1 (Spanish), path remux
  P->>S: GET …/stream?a=1  (-map 0:V:0? -map 0:a:1? -c copy)
  Note over P: viewer picks English (index 0, direct) at 41:10
  P->>S: GET …/stream  (sendFile; currentTime = 2470)
```

### The units

| Unit                       | Where                                           | What                                                     |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `probe` (changed)          | `server/src/playback/probe/`                    | `audioStreams: ProbedAudio[]`; video skips cover art     |
| `choosePlaybackPath` (ch.) | `server/src/playback/choosePlaybackPath/`       | `audioTrack`; the two maps; direct only at index 0       |
| `trackLanguage` (new)      | `server/src/playback/trackLanguage/`            | a tag → its English name, or `null`                      |
| `audioTracks` (new)        | `server/src/playback/audioTracks/`              | probe + per-track decision → `AudioTrack[]`, the labels  |
| `createPlayback` (changed) | `server/src/playback/createPlayback/`           | `read`'s `audioTracks`; `stream(file, t, a)`, `no-track` |
| `audioTrackQuery` (new)    | `server/src/routes/index.ts`, by `streamOffset` | `?a=` → an index, or `null` for a `400`                  |
| settings (changed)         | `server/src/library/settings/`                  | `audio-language`, `setAudioLanguage`                     |
| `LANGUAGE_POOL` (renamed)  | `src/types/settings.ts`                         | the pool; `DEFAULT_AUDIO_LANGUAGE`                       |
| `AudioTrack` (new)         | `src/types/playback.ts`                         | the wire track; `PlaybackRead.audioTracks`               |
| `preferredAudio` (new)     | `src/features/player/preferredAudio/`           | the opening rule                                         |
| `useAudioTracks` (new)     | `src/features/player/useAudioTracks/`           | the offered tracks, the playing one, choose, next        |
| `useOpeningReads` (ch.)    | `src/features/player/useOpeningReads/`          | the settings read, the third opening read                |
| `usePlayback` (changed)    | `src/features/player/usePlayback/`              | `audioTrack`; `?a=`; the switch's re-anchor              |
| `AudioMenu` (new)          | `src/features/player/AudioMenu/`                | the **Audio picker** on `Menu`                           |
| `SpeechBubbleIcon` (new)   | `src/primitives/Icon/`                          | the picker's glyph                                       |
| `PlayerScreen` (changed)   | `src/features/player/PlayerScreen/`             | holds the **Audio choice** across the sitting            |
| `PlaybackSection` (ch.)    | `src/features/settings/PlaybackSection/`        | the Audio block                                          |

### Routes

| Route                                         | Change                                                    |
| --------------------------------------------- | --------------------------------------------------------- |
| `GET /api/{movies,episodes}/:id/playback`     | answers `audioTracks`                                     |
| `GET /api/{movies,episodes}/:id/stream?t=&a=` | `a` maps the track; `400` not an index, `404` no such     |
| `GET /api/settings`                           | answers `audioLanguage`                                   |
| `POST /api/settings/audio-language`           | new, `{ value }` → `{ value }`, a **Single-signal write** |

## Implementation Plan

1. **Prototype.** The three files of Q22.
2. **The pool renamed.** `LANGUAGE_POOL` / `PoolLanguage`, mechanical.
3. **The track on the wire.** `probe`'s `audioStreams`, the maps,
   `trackLanguage`, `audioTracks`, `read`'s `audioTracks`, `?a=` and
   `no-track`. Thinnest end-to-end: `…/stream?a=1` in the address bar plays
   a two-language MKV in its second language.
4. **The preference.** The key, the route, `Settings.audioLanguage`,
   `useSettings`, the Audio block.
5. **The opening.** `useOpeningReads`' settings read (and `useSubtitles`
   reading it), `preferredAudio`, `usePlayback`'s `audioTrack` and `?a=`: a
   film opens in the household's language.
6. **The picker.** `SpeechBubbleIcon`, `AudioMenu`, `useAudioTracks`, the
   switch's re-anchor on both kinds of path, the `a` key.
7. **The sitting.** `PlayerScreen`'s Audio choice across _Up next_.
8. **Docs.** README, CLAUDE.md and the glossary per Q23.

## Trade-offs

- **Easier:** one switching mechanism for every path, testable in argv and in
  jsdom; remuxes and transcodes become deterministic about their streams;
  one settings read per open instead of one per hook.
- **Harder:** a non-first track of a native MP4 is a remux, so it loses
  byte-range seeking and costs a process; the opening now waits for the
  settings read; `usePlayback` gains a second reason to re-point the element.
- **Out of scope:** a subtitle picker, a per-title memory, audio metadata in
  the form or the importer, new pool languages, an Export column, Chromium's
  `audioTracks`.
