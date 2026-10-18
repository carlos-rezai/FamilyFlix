# Plan: Audio tracks — a household audio language and a picker mid-film

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/397

Some films carry several audio languages, and the player plays whichever one
ffmpeg or Chromium happens to pick. This initiative gives the household a
**Preferred audio language** (English by default) on the Playback card, opens
every film and episode on the track in that language, and draws an **Audio
picker** in the player's controls to switch track mid-film, keeping the
position. Chromium will not switch tracks for us, so the server does: the
stream URL gains `?a=<index>` and both converting paths map exactly that
stream.

## Running the phases

**Phase 0 is HITL**: the prototype revision (log 46 Q22), made in Claude Design
before anything is built. `issue-loop` stops at it.

**Phases 1–6 run AFK under `issue-loop`**, in order. They are log 46's
_Implementation Plan_ slices 2–7. Phase 1 is a mechanical `refactor:` with no
behaviour of its own. Phase 2 has no client caller: it is proven by typing
`…/stream?a=1` by hand, and Phase 4 is its first caller.

The docs (README, CLAUDE.md, the folder tree, per log 46 Q23) are log 46's
slice 8. They are not a phase: they are ticked ✅ only after the refactor. The
glossary already carries **Audio track**, **Audio track index**, **Preferred
audio language**, **Audio picker** and **Audio choice** since log 46.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `GET /api/{movies,episodes}/:id/playback` answers `audioTracks` beside
    `path` and `durationSeconds`. `path` stays index 0's, the path the plain
    URL plays.
  - `GET /api/{movies,episodes}/:id/stream?t=&a=`: `a` is the **Audio track
    index**, absent meaning 0, read before the path is chosen as `t` is.
    Anything but a non-negative integer → `400` _Query a must be an audio
    track number, from 0_. A track the file lacks → `404` _No audio track N:
    <id>_, with nothing spawned.
  - `GET /api/settings` answers four fields: `subtitleLanguage`,
    `audioLanguage`, `ultrawideMargins`, `tmdbRatings`.
  - `POST /api/settings/audio-language { value }` → `{ value }`, a
    **Single-signal write**; `400` for a missing, empty or non-string value.
    Pool membership is not checked.
- **Client routes**: none new.
- **Schema**: no migration. One new `settings` key, `audio-language`, with
  `DEFAULT_AUDIO_LANGUAGE` applied when the row is absent. Factory reset
  already erases it. Nothing about a track is stored.
- **Key models**:
  - The **Language pool**: `LANGUAGE_POOL` / `PoolLanguage` (renamed from
    `SUBTITLE_LANGUAGES` / `SubtitleLanguage`). `DEFAULT_SUBTITLE_LANGUAGE`
    kept, and `DEFAULT_AUDIO_LANGUAGE = 'English'` beside it.
  - `Settings` gains `audioLanguage: string`.
  - Server-side `ProbedAudio`: `{ codec, language, title, isDefault }`.
    `MediaProbe.audioCodec` becomes `audioStreams: ProbedAudio[]` in file
    order, and `videoCodec` skips `attached_pic` streams.
  - Shared `AudioTrack`: `{ index: number; language: string | null; label:
string; fileDefault: boolean; path: Exclude<PlaybackPath, 'cannot-play'> }`.
    `PlaybackRead` gains `audioTracks: AudioTrack[]`, the **offered** tracks
    only, in index order. Each carries its own path, so one read tells a
    switch whether it is a byte-range seek or a stream restart.
  - `StreamPlan` gains `{ path: 'no-track' }`.
  - The **Audio choice**: the language of the track last picked by hand
    (`null` for a track with none), held by the player's fullscreen surface
    for the sitting. Never persisted, never posted.
- **Boundaries**:
  - Both converting paths always map, even at index 0:
    `-map 0:V:0? -map 0:a:<index>?`. The capital `V` skips cover pictures, and
    the `?` lets a silent file still play. Subtitle and data streams an MP4
    cannot hold are dropped.
  - **Direct play** is only index 0 of a native file. Any other index of that
    file is a **Remux** when its codec is native and a **Transcode** when it is
    not. A track whose path would be `cannot-play` is never offered.
  - The server labels every track, so the client never sees a raw language
    tag. Languages are named in English through `Intl.DisplayNames` over the
    tag's base language, not through `detectSubtitleLanguage`'s table.
  - The Component slot is still read per request, so an uploaded component
    changes what is offered from the next open on.
  - The player makes one `GET /api/settings` per open, shared by the audio
    pick and the subtitles. The element is pointed only once that read has
    settled, and a refusal means no preference.
- **Unchanged throughout**: `capabilities`, `frame`, `derivedRuntime`,
  `mediaDuration`, the importer, the Export, the Movie form, CC as a toggle,
  the **Watch tick**, resume and _Up next_'s rules.

---

## Phase 0: The prototype revision (HITL)

**User stories**: 1–4, 9, 24–34 (the drawn surface)

### What to build

The prototype amended first, per _The prototype is the spec_.
`page.SettingsPage.dc.html` draws the Audio block under _Subtitles_, behind a
divider, with its lede and the _Preferred audio language_ row, and relabels
the subtitle row _Preferred subtitle language_. `feat.PlayerControls.dc.html`
draws the Audio button before CC, with a `hasAudioTracks` prop beside
`hasSubs`, and its menu open upward with the playing track marked.
`FamilyFlix.dc.html` walks a two-track film switching language and keeping its
position.

### Acceptance criteria

- [ ] `page.SettingsPage` draws the Audio block under Subtitles with its
      divider, lede, row label, row line and dropdown, and the subtitle row
      reads _Preferred subtitle language_.
- [ ] `feat.PlayerControls` draws `[Audio] [CC] [Fullscreen]` in the right
      group, with the Audio button absent when `hasAudioTracks` is false.
- [ ] The open menu is drawn upward over the bottom bar, with one item per
      track and the playing one marked as `FilterDropdown` marks its value.
- [ ] The speech-bubble glyph is drawn.
- [ ] `FamilyFlix.dc.html` switches a two-track film's language and keeps its
      position.

---

## Phase 1: The pool renamed

**User stories**: none (groundwork for 4, 10)

### What to build

A mechanical `refactor:`. `SUBTITLE_LANGUAGES` becomes `LANGUAGE_POOL` and
`SubtitleLanguage` becomes `PoolLanguage`, for every reader on the client and
the server. `DEFAULT_SUBTITLE_LANGUAGE` is kept, and `DEFAULT_AUDIO_LANGUAGE =
'English'` is added beside it. Nothing reads the new constant yet.

### Acceptance criteria

- [ ] No reference to `SUBTITLE_LANGUAGES` or `SubtitleLanguage` remains in
      shipping code or tests.
- [ ] `DEFAULT_AUDIO_LANGUAGE` is exported from the settings types.
- [ ] Every suite passes unchanged, and the whole solution typechecks.

---

## Phase 2: The track on the wire

**User stories**: 16, 17, 20, 28–33, 45, 51, 52–58

### What to build

The thinnest end-to-end path. The probe learns every audio stream in file
order, with its codec, language tag, trimmed title and default flag, and
skips cover pictures for the video codec. The path policy takes an Audio
track index and decides over that stream's codec. It always maps the video
and the chosen audio, keeps Direct play to index 0 of a native file, and
answers `no-track` for an index the file lacks. A pure `trackLanguage` names
a tag's base language in English. A pure `audioTracks` turns a probe and a
per-index path into the offered, labelled tracks. The playback read answers
`audioTracks`, the stream route reads `?a=`, and both answer for movies,
episodes and **Linked videos** alike. Demo: `…/stream?a=1` in the address bar
plays a two-language MKV in its second language.

### Acceptance criteria

- [ ] The probe answers every audio stream in file order. Absent and empty
      tags read as `null`, a file with no audio as `[]`, and an
      `attached_pic` stream is not the video codec.
- [ ] Index 0 of a native file is Direct play. Index 1 of the same file is a
      remux with `-map 0:V:0? -map 0:a:1?`. A non-native codec at the index is
      a transcode with the same maps. Index 0 of a converted file maps
      `0:a:0?`. An index past the streams is `no-track`.
- [ ] A remux drops subtitle and data streams an MP4 cannot hold.
- [ ] `trackLanguage` names `eng`, `fre`/`fra`, `ger`/`deu`, `dut`, `jpn` and
      `pt-BR` in English. It answers `null` for no tag, `und`, `mul`, `zxx`,
      `mis`, `qaa` and a malformed tag.
- [ ] Each label rule holds: language · title, a title already naming the
      language shown alone, language only, title only, _Track N_ from 1, and
      colliding labels each suffixed ` · Track N`.
- [ ] A track whose path would be `cannot-play` is not offered. With no
      Playback component, at most index 0 is offered.
- [ ] The playback read answers `audioTracks` for a movie, an episode and a
      Linked video, each track carrying its own path, with `path` still index
      0's.
- [ ] `?a=` that is not a non-negative integer → `400` with its sentence. An
      unknown track → `404` with its sentence, and nothing is spawned.
- [ ] A stream URL with no `a` behaves exactly as today.
- [ ] An uploaded component changes the offered tracks on the next read, with
      no restart.

---

## Phase 3: The preference

**User stories**: 1–12

### What to build

The household setting, end to end. The library's settings gain the
`audio-language` key, read with `DEFAULT_AUDIO_LANGUAGE` when absent and
written by an upsert. `GET /api/settings` answers `audioLanguage`, and
`POST /api/settings/audio-language` is a Single-signal write. On the client,
`Settings` carries `audioLanguage`. The settings feature's `useSettings` gains
`chooseAudioLanguage`, the subtitle language's bargain: shown at once, put
back on refusal, never rejecting. The Playback card draws the Audio block as
the prototype has it, and the subtitle row is relabelled.

### Acceptance criteria

- [ ] A fresh database answers `audioLanguage: 'English'`, and a written
      value survives a re-read.
- [ ] `POST /api/settings/audio-language` echoes `{ value }`. A missing,
      empty or non-string value is a `400`. A name outside the pool is
      accepted.
- [ ] `GET /api/settings` answers exactly the four fields.
- [ ] A Factory reset brings `audioLanguage` back to English.
- [ ] The Audio block is drawn under Subtitles, behind a divider, with the
      lede _Which language a movie plays in when it has more than one._ and
      the row _Preferred audio language_ / _Which track to play when a movie
      has several._ over the pool's seven names.
- [ ] The row is not drawn while the settings read is `null`.
- [ ] A choice is shown at once and posted. A refused save puts the dropdown
      back.
- [ ] The subtitle row reads _Preferred subtitle language_, and no audio
      on/off toggle is drawn.

---

## Phase 4: The opening

**User stories**: 13–23, 51

### What to build

The player's first caller of the wire. The settings read becomes the
player's third opening read, and the subtitles take their language from it
rather than fetching their own. A pure `preferredAudio` picks the first
offered track in the preferred language (matched case-insensitively), else
the file's default, else the first, and `null` for none. The playback hook
takes the chosen track. It plays on that track's path and writes `?a=` only
when non-zero, so a fresh open of a single-track film has the same URL as
today. The element is pointed once, after the settings read has settled, so a
film starts already on the right track.

### Acceptance criteria

- [ ] Nothing is pointed before the settings read settles. A refused
      settings read still opens, on the default or first track.
- [ ] One open makes one `GET /api/settings`, and the subtitles honour the
      Preferred subtitle language from it.
- [ ] `preferredAudio` matches by language case-insensitively, else the file
      default, else the first. It answers `null` for `[]`, and passes over a
      track with a `null` language.
- [ ] A Spanish-preferring household opens an English/Spanish film on the
      Spanish track's URL, `?a=1`, with no second load.
- [ ] An English-first MP4 opened in English stays Direct play with no `a`.
- [ ] A single-track film and a silent film open exactly as today.
- [ ] Resuming lands at the saved position on the preferred track.
- [ ] An episode opens by the same rule as a film.

---

## Phase 5: The picker

**User stories**: 24–45

### What to build

The switch mid-film. A new `SpeechBubbleIcon` primitive, and an `AudioMenu`
in the transport row's right group before CC. It is drawn only with two or
more offered tracks, opens a menu upward with the playing track marked, and
holds the chrome up while open. A `useAudioTracks` hook holds the offered
tracks and the playing one. It offers `choose(track)` and a wrapping `next()`,
and reports a hand pick up as the Audio choice. The playback hook switches
onto a streaming path by re-anchoring at the **Absolute position** with the
new `a`. It switches onto `direct` by dropping the offset and winding
`currentTime` once metadata lands. Either way it keeps the play or pause
state, and the buffering circle is the only feedback. The `a` / `A` key calls
the picker's `next` while it is drawn.

### Acceptance criteria

- [ ] The Audio button is absent with fewer than two offered tracks, and sits
      before CC with two or more.
- [ ] The menu opens upward with one item per offered track, named by its
      label, and the playing one marked.
- [ ] Choosing a track onto a streaming path re-points the stream at the
      Absolute position with the new `a`.
- [ ] Choosing the first track of a native file drops the offset and seeks
      the element to the position after metadata.
- [ ] A switch while paused stays paused, and a switch while playing keeps
      playing.
- [ ] Subtitles stay on and in step, the Watch tick keeps reporting the
      Absolute position, and seeking after a switch works.
- [ ] The buffering circle shows while the switch loads.
- [ ] The chrome stays up while the menu is open, and Escape or an outside
      click closes it.
- [ ] `a` and `A` move to the next track and wrap, and do nothing while the
      picker is not drawn.
- [ ] The button and the menu are keyboard-operable, and named for a screen
      reader.

---

## Phase 6: The sitting

**User stories**: 46–51

### What to build

The Audio choice across _Up next_. The fullscreen surface holds the language
of the track last picked by hand and hands it to each player it keys, so
_Play now_ and the end-of-file advance open the next episode with
`preferredAudio` reading the Audio choice ahead of the Preferred audio
language. Leaving the player forgets it. It is never posted.

### Acceptance criteria

- [ ] A Spanish pick on one episode opens the next on its own Spanish track,
      whatever index that track has in its file.
- [ ] An episode with no track in the carried language opens by the usual
      rule.
- [ ] With no hand pick, nothing is carried and the household preference
      decides.
- [ ] Leaving the player and opening another title opens in the household's
      language again.
- [ ] No pick ever reaches `POST /api/settings/audio-language`.
