> **Initiative:** `audio-tracks`
> **Design log:** `docs/design-logs/46-audio-tracks.md`
> **Issue:** #397 (the PRD, step 29)
> **Build order:** step 29, the first after Add and sync. It ships as thin slices (log 46, _Implementation Plan_), the prototype revision first, then the Language pool's rename as a mechanical `refactor:`.

## Problem Statement

Some of our films carry more than one audio language: an English track and a Spanish one, a French original and an English dub, a director's commentary. FamilyFlix plays whichever one ffmpeg or Chromium happens to pick. On a converted film that is ffmpeg's own choice (the track with the most channels). On a direct-played MP4 it is the first track. Nobody in the house chose it.

I cannot tell the app which language the household wants. Nothing in the player lets a viewer change language halfway through a film either. When the wrong language starts, the only fix is to remux the file by hand outside the app.

Chromium will not switch audio tracks for us. Its `audioTracks` API sits behind a flag that is off in a stock build. So any switch has to come from the server, and it must not break seeking, resume, subtitles, the watch tick or _Up next_.

## Solution

**A household preference.** Settings → Playback gets an **Audio** block under _Subtitles_. It has one row, _Preferred audio language_, over the same dropdown and the same **Language pool** the subtitle language uses. It is **English** until someone changes it. The subtitle row's label becomes _Preferred subtitle language_, so the page never shows two controls with the same name.

**A film opens in that language.** When the player opens a film or an episode, it reads which **Audio tracks** the file offers and the household's settings, both before the video starts. It plays the first track in the preferred language. If no track is in that language, it plays the track the file marks as its default, and failing that the first track. The video starts once, already on the right track. It never starts in English and then jumps a second later.

**A picker switches mid-film.** When a file offers two or more tracks, the player's controls draw an _Audio_ button just before CC. Pressing it opens a menu above the bottom bar with one item per track, for example _English_, _Spanish_ or _English · Commentary_. The track that is playing is marked. Choosing another track keeps the position and the play or pause state. The buffering circle shows while it switches, and the film carries on from where it was in the new language. Subtitles, resume and _Up next_ notice nothing. The `a` key moves to the next track, as `c` toggles CC. With one track or none, there is no button.

**The choice lasts the sitting.** A track picked by hand becomes the **Audio choice**. It carries into the next episode through _Up next_, so a Spanish evening stays Spanish. Leaving the player forgets it. It is never stored per title and never written back to the household's preference.

**The server does the switching.** The stream URL gains `?a=<index>`, and both converting paths map exactly that audio stream. Only the first track of a file Chromium can play natively is still **Direct play**. Any other track of the same file is a **Remux** (nothing re-encoded) when its codec is native, and a **Transcode** when it is not. Nothing new is stored: the tracks are read off the file on every request, as the Playback path already is.

## User Stories

### The preference

1. As the maintainer, I want an _Audio_ block on the Playback card, so that I can say which language the household watches in.
2. As the maintainer, I want the block under _Subtitles_ and behind a divider, so that the two language settings sit together.
3. As the maintainer, I want the block's lede to say it is about films with more than one language, so that I know it changes nothing for most films.
4. As the maintainer, I want _Preferred audio language_ chosen from the same seven languages as subtitles, so that both choices read the same.
5. As the maintainer, I want it to be English until I change it, so that a fresh install behaves as it does today for an English library.
6. As the maintainer, I want my choice shown at once and saved in the background, so that the dropdown feels instant.
7. As the maintainer, I want a refused save to put the dropdown back, so that it never shows a language that was not saved.
8. As the maintainer, I want the dropdown left undrawn until the settings read has landed, so that it never shows a guess.
9. As the maintainer, I want the subtitle dropdown relabelled _Preferred subtitle language_, so that no two controls on the page share a name.
10. As the maintainer, I want the preference kept in the library's database with the other household settings, so that it survives a restart and an update.
11. As the maintainer, I want a **Factory reset** to erase it with every other setting, so that a reset really starts over.
12. As the maintainer, I want no on/off toggle for audio, so that the page does not suggest audio can be switched off.

### Opening a film

13. As a parent, I want a film with English and Spanish tracks to open in our preferred language, so that I don't have to change anything before it starts.
14. As a parent, I want a film with no track in our language to open on the track the file marks as its default, so that it plays what its makers intended.
15. As a parent, I want a file with no default marked to open on its first track, so that something always plays.
16. As a parent, I want a film with one audio track to play exactly as it does today, so that nothing changes for most of the library.
17. As a parent, I want a film with no audio at all to still play its picture, so that a silent file is not an error.
18. As a parent, I want the film to start once, already on the right track, so that it never begins in one language and jumps to another.
19. As a parent, I want a film to still open if the settings could not be read, on its default or first track, so that a failed read never blocks playing.
20. As a parent, I want a language matched whatever its case or regional variant (`pt-BR` is Portuguese), so that a track is not missed over a tag's spelling.
21. As a parent, I want resuming a film to land at the saved position on the preferred track, so that resume and language work together.
22. As the maintainer, I want an English-first MP4 opened in English to stay Direct play, so that the common case keeps its instant seeking.
23. As the maintainer, I want the player to read settings once per open and share that read with the subtitles, so that one open costs one settings request.

### The Audio picker

24. As a parent, I want an _Audio_ button in the player's controls when a film has two or more tracks, so that I can change language mid-film.
25. As a parent, I want no Audio button on a film with one track, so that the controls don't offer a choice that isn't there.
26. As a parent, I want the button just before CC, so that the language controls sit together.
27. As a parent, I want the button to open a menu upward over the bottom bar, so that it never runs off the bottom of the screen.
28. As a parent, I want each track named by its language in plain English (_English_, _Japanese_), so that I never see a code like `jpn`.
29. As a parent, I want a track's title shown beside its language (_English · Commentary_), so that I can tell a commentary from the film.
30. As a parent, I want a title that already names the language shown alone (_English 5.1_), so that the menu doesn't say English twice.
31. As a parent, I want a track with only a title shown by its title (_Commentary_), so that an untagged commentary is still recognisable.
32. As a parent, I want a track with neither language nor title called _Track 2_ by its place, so that every track has a name.
33. As a parent, I want two tracks that would read the same told apart (_English · Track 1_, _English · Track 2_), so that I can pick between them.
34. As a parent, I want the playing track marked in the menu, so that I know which one I am hearing.
35. As a parent, I want choosing a track to keep my position, so that I don't lose my place in the film.
36. As a parent, I want choosing a track while paused to leave it paused, so that a switch doesn't start the film behind my back.
37. As a parent, I want the buffering circle while the switch loads, so that I know something is happening.
38. As a parent, I want subtitles to stay on, in step, across a switch, so that switching audio doesn't disturb them.
39. As a parent, I want seeking after a switch to work as before, so that the new track behaves like any other.
40. As a parent, I want the controls to stay up while the menu is open, so that the menu doesn't fade from under my pointer.
41. As a parent, I want the menu to close with Escape or a click elsewhere, so that I can change my mind.
42. As a keyboard user, I want `a` to move to the next track and wrap at the end, so that I can switch without the mouse.
43. As a keyboard user, I want `a` to do nothing on a film with one track, so that a stray key press has no effect.
44. As a keyboard user, I want the button and the menu reachable and operable from the keyboard, with names a screen reader reads, so that the picker works like every other control.
45. As a parent, I want a track the machine cannot play left out of the menu, so that I can never pick something that fails.

### The sitting

46. As a parent, I want a track I picked to carry into the next episode through _Up next_, so that a Spanish evening stays Spanish.
47. As a parent, I want the carried choice matched by language, so that the next episode opens on its own Spanish track wherever that track sits in its file.
48. As a parent, I want an episode with no track in the carried language to open by the usual rule, so that a missing dub never blocks playing.
49. As a parent, I want leaving the player to forget my pick, so that the next film opens in the household's language again.
50. As the maintainer, I want a viewer's pick never written to the household preference, so that one evening's choice never changes the setting.
51. As the maintainer, I want episodes to follow exactly the same rules as films, so that a show behaves like a film.

### Edge cases and errors

52. As the maintainer, I want a stream URL with an `a` that is not a whole number from 0 refused with `400` in one sentence, so that a malformed request is caught before anything is spawned.
53. As the maintainer, I want a stream URL naming a track the file does not have answered `404` in one sentence, with nothing spawned, so that a stale URL fails cleanly.
54. As the maintainer, I want a machine with no Playback component to offer at most the first track, so that the picker never offers what cannot be converted.
55. As the maintainer, I want an uploaded component in the Component slot to decide which tracks are offered from the next open on, so that a codec pack widens the choice without a restart.
56. As the maintainer, I want a file whose cover art is stored as a video stream to play its real picture, so that a mapped stream is never the poster image.
57. As the maintainer, I want subtitle and data streams an MP4 cannot hold dropped from a remux, so that mapping a track never breaks a conversion that worked before.
58. As the maintainer, I want a **Linked video** to offer and switch tracks exactly as a copied one does, so that link or copy never changes playback.

## Implementation Decisions

### Server: `playback/`

- **`probe`** learns every audio stream. `MediaProbe.audioCodec` becomes `audioStreams: ProbedAudio[]` in file order, each `{ codec, language, title, isDefault }`, read from `codec_name`, the raw `tags.language` (`null` when absent), `tags.title` (trimmed, `null` when empty) and `disposition.default === 1`. `videoCodec` skips `attached_pic` streams, so the policy reads the stream the map sends. It stays a server-side type.
- **`choosePlaybackPath`** takes an `audioTrack` (an **Audio track index**, default 0) and decides over that stream's codec.
  - Both converting paths always map, even at index 0: `-map 0:V:0? -map 0:a:<index>?`. The capital `V` skips cover pictures, and the `?` lets a file with no audio still play.
  - **Direct play** applies only at index 0 of a native file. Any other index of that file is a Remux when its codec is native and a Transcode when it is not.
  - An index the probe does not hold is a new outcome, `no-track`.
- **`trackLanguage`**, new and pure: a language tag → its base language named in English, through `Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })` over `new Intl.Locale(tag).language`. It answers `null` for no tag, for `und`, `mul`, `zxx` and `mis`, for a tag `Intl` refuses, and for one it cannot name. It does not reuse `detectSubtitleLanguage`'s seven-language table.
- **`audioTracks`**, new and pure: a probe plus a per-index path decision → `AudioTrack[]`, the **offered** tracks in index order. A track whose path would be `cannot-play` is dropped. It answers `[]` for a file nothing could probe and for one with no audio. It owns `audioTrackLabel`:
  - language and title → `English · Commentary`;
  - a title that already contains the language name → the title alone (`English 5.1`);
  - language only → `English`;
  - title only → `Commentary`;
  - neither → `Track N` (the index, from 1);
  - two labels that would collide → each gets ` · Track N` appended.

  The server labels, so the client never sees a raw tag.

- **`createPlayback`**:
  - `read` answers `audioTracks` beside `path` and `durationSeconds`, from the one probe. `path` stays index 0's, the path the plain URL plays.
  - `stream(file, offsetSeconds, audioTrack)` takes the index, and answers the new `StreamPlan` `{ path: 'no-track' }` for an index the file lacks, spawning nothing.
  - The slot is still read per request, so an uploaded component changes what is offered on the next open.
- Untouched: `capabilities`, `frame`, `derivedRuntime`, `mediaDuration`, the importer and the Export.

### Server: routes and settings

- **Stream route** (`GET /api/{movies,episodes}/:id/stream`): the new `audioTrackQuery` sits beside `streamOffset` and reads `?a=` before the path is chosen, as `t` is. Absent means 0.
  - Anything but a non-negative integer → `400` _Query a must be an audio track number, from 0_.
  - `no-track` → `404` _No audio track N: <id>_, the unknown subtitle's precedent.
- **Playback read** (`GET /api/{movies,episodes}/:id/playback`): answers `audioTracks`.
- **`library/settings/`** gains the key `audio-language`, read through `valueOf` with `DEFAULT_AUDIO_LANGUAGE` applied when the row is absent, and `setAudioLanguage()` as an upsert. `GET /api/settings` answers four fields: `subtitleLanguage`, `audioLanguage`, `ultrawideMargins` and `tmdbRatings`.
- **`POST /api/settings/audio-language { value }`** → `{ value }`, a **Single-signal write**. It answers `400` for a missing, empty or non-string value. Membership in the pool is not checked: the pool is a vocabulary, not a constraint.
- **Factory reset** erases the key with the rest of the `settings` table. Nothing to add.
- **No migration.** Nothing about a track is stored.

### Shared types

- **The Language pool is renamed first**, in a mechanical `refactor:` commit: `SUBTITLE_LANGUAGES` → `LANGUAGE_POOL` and `SubtitleLanguage` → `PoolLanguage`, for every reader on both sides. `DEFAULT_SUBTITLE_LANGUAGE` is kept, and `DEFAULT_AUDIO_LANGUAGE = 'English'` is added beside it. `Settings` gains `audioLanguage: string`.
- **`AudioTrack`** in the shared playback types: `{ index: number; language: string | null; label: string; fileDefault: boolean; path: Exclude<PlaybackPath, 'cannot-play'> }`. `PlaybackRead` gains `audioTracks: AudioTrack[]`. Each track carries its own path, so one read tells a switch whether it is a seek by byte range or a stream restart. There is no read per switch.

### Client: the player

- **`useOpeningReads`** gains the settings read as its third opening read. The element is pointed only once that read has **settled**, landed or refused. A refusal means no preference. **`useSubtitles`** takes `subtitleLanguage` from the same read and stops fetching for itself, so an open makes one `GET /api/settings`.
- **`preferredAudio(tracks, language)`**, new and pure, `preferredSubtitle`'s twin: the first track whose `language` matches case-insensitively, else the `fileDefault` track, else the first, and `null` for `[]`. The language is the Audio choice when one is held, else the Preferred audio language.
- **`useAudioTracks`**, new: the offered tracks, the playing one, `choose(track)` and `next()` (wrapping). Its opening pick comes from `preferredAudio`. A choice made by hand is reported up as the Audio choice.
- **`usePlayback`** takes `audioTrack: AudioTrack | null`. Its path is the track's, or `read.path` when there is none. It writes `?a=` only when non-zero, beside `?t=`, so a fresh open's URL is unchanged.
  - A switch onto a streaming path is `anchorStream(absolute())` with the new `a`.
  - A switch onto `direct` resets the offset to nought and winds `currentTime` to the position once the element has metadata.
  - Either way it keeps the **Absolute position** and the play or pause state. Subtitles, the **Watch tick** and _Up next_ read the Absolute position and notice nothing. The buffering circle is the only feedback: no snackbar.
- **`AudioMenu`**, new, the **Audio picker**: a round 44px chrome button named _Audio_, carrying a new **`SpeechBubbleIcon`** primitive, in the transport row's right group as `[Audio] [CC] [Fullscreen]`. It opens a `Menu` upward with one `MenuItem` per offered track, marking the playing one as `FilterDropdown` marks its value. It is drawn only with two or more offered tracks (CC's rule: absent rather than disabled). It unmounts with the rest of the chrome while the chrome is faded, and an open menu holds the chrome up as a hovered control does.
- **`PlayerControls`** gains the picker's props beside `hasSubs`.
- **`usePlayerKeys`**: `a` / `A` calls the picker's own `next` handler, only while the picker is drawn, as `c` calls CC's.
- **`PlayerScreen`** holds the **Audio choice** (the language of the track last picked by hand, `null` for a track with none) and hands it to each `Player` it keys, so it survives _Play now_. It is never persisted and never posted.

### Client: Settings

- **`saveAudioLanguage`** in the settings feature's `api/`, one caller.
- **`useSettings`** gains `audioLanguage` and `chooseAudioLanguage`, the same bargain as the subtitle language: shown at once, put back on refusal, never rejecting.
- **`PlaybackSection`** draws, under _Subtitles_, a divider, then **Audio** with the lede _Which language a movie plays in when it has more than one._, then one `$last` row: _Preferred audio language_, _Which track to play when a movie has several._, over `FilterDropdown` with the pool's seven names. The row is not drawn while the read is `null`. The subtitle row's label becomes _Preferred subtitle language_.

### Routes summary

| Route                                         | Change                                                        |
| --------------------------------------------- | ------------------------------------------------------------- |
| `GET /api/{movies,episodes}/:id/playback`     | answers `audioTracks`                                         |
| `GET /api/{movies,episodes}/:id/stream?t=&a=` | `a` maps the track; `400` for a malformed `a`, `404` for none |
| `GET /api/settings`                           | answers `audioLanguage`                                       |
| `POST /api/settings/audio-language`           | new, `{ value }` → `{ value }`, a Single-signal write         |

### Prototype

- Before the build: `page.SettingsPage.dc.html` (the Audio block and both dropdowns' labels), `feat.PlayerControls.dc.html` (the Audio button and its open menu, with a `hasAudioTracks` prop beside `hasSubs`), and `FamilyFlix.dc.html` (a film with two tracks, the switch keeping its position).

## Testing Decisions

- A good test drives a unit through its public surface: returned values for pure units, argv and `StreamPlan` for the policy and `createPlayback`, status and body for routes, rendered output and user events for components, returned state for hooks. It never reads internals. The wire is faked at `fetch` with `fakeResponse`. ffprobe is faked at the `ProbeOutput` seam with canned JSON, never on the machine's own FFmpeg.
- **`probe`**: several audio streams in file order with codec, language, trimmed title and default flag; absent and empty tags → `null`; a file with no audio → `[]`; an `attached_pic` stream skipped for `videoCodec`. Prior art is its current suite.
- **`choosePlaybackPath`**: index 0 of a native file is `direct`; index 1 of the same file is a remux with `-map 0:V:0? -map 0:a:1?`; a non-native codec at the index is a transcode with the same maps; index 0 of a converted file maps `0:a:0?`; an index past the streams is `no-track`. Prior art is its current suite.
- **`trackLanguage`**: `eng`, `fre` / `fra`, `ger` / `deu`, `dut`, `jpn` and `pt-BR` → their English names; `null`, `und`, `mul`, `zxx`, `mis`, `qaa` and a malformed tag → `null`.
- **`audioTracks`**: every label rule (language and title, title containing the language, language only, title only, neither, collisions); `cannot-play` tracks dropped; `[]` for no probe and for no audio; each track's own path.
- **`createPlayback`**: `read` answers `audioTracks`, with `path` still index 0's; `stream` with an index passes the maps through; an unknown index is `no-track` with nothing spawned; with no component, at most index 0 is offered. Prior art is its current suite with `fixedSlot`.
- **Routes**: `?a=` malformed → `400` with the sentence; unknown track → `404` with the sentence; absent `a` behaves exactly as today; the playback read carries `audioTracks` for a movie and for an episode, and for a **Linked video**. The settings suite covers the new key's default, the write, its `400`s, and `GET /api/settings`' four fields. Prior art: `routes.test.ts`, `routes.episodes.test.ts`, `routes.linkedVideo.test.ts`, `routes.settings.test.ts`.
- **`preferredAudio`**: match by language (case-insensitive), else file default, else first, `null` for `[]`, a `null` language. Prior art is `preferredSubtitle`'s suite.
- **`useOpeningReads`**: nothing pointed before the settings read settles; a refused settings read still opens. **`useSubtitles`**: takes its language from the read and makes no `GET /api/settings` of its own.
- **`usePlayback`**: `?a=` written only when non-zero; a switch onto a streaming path re-anchors at the Absolute position with the new `a`; a switch onto `direct` drops the offset and winds `currentTime` after metadata; the play or pause state is kept. Prior art is its current stream-seek cases.
- **`useAudioTracks`**: the opening pick, `choose`, `next` wrapping, and the Audio choice reported up.
- **`AudioMenu` / `PlayerControls`**: absent with fewer than two tracks; placed before CC; opens upward with one item per track and the playing one marked; a press chooses; the chrome is held up while open. **`usePlayerKeys`**: `a` and `A` call `next` only while the picker is drawn. Prior art is CC's cases in both suites, and `Menu`'s suite.
- **`PlayerScreen`**: a hand pick carries to the next episode through _Play now_ by language; no pick, no carry.
- **`useSettings` / `PlaybackSection`**: the Audio block drawn under Subtitles with its labels; not drawn while `null`; a choice shown at once and put back on refusal. Prior art is the subtitle language's cases.
- **Package smoke**: which track Chromium plays on a multi-track MP4 under Direct play is checked by hand, `docs/release-checklist.md`.

## Out of Scope

- A subtitle picker: CC stays a toggle.
- A track choice remembered per title, or any stored track state (no migration).
- Writing a viewer's pick back to the Preferred audio language.
- An audio language in the Movie form or the importer.
- An audio column in an Export.
- New names in the Language pool.
- Chromium's `audioTracks` behind a Blink flag, and an HLS / MSE pipeline carrying every track.
- Remuxing every multi-track file so that any track could seek by byte range.

## Further Notes

- Glossary terms (log 46 Q2): **Audio track**, **Audio track index**, **Preferred audio language**, **Audio picker**, **Audio choice**. Avoid "dub", "language track", "audio stream" (in prose), "sound track" and "audio selector".
- The trade-off accepted: a non-first track of a native MP4 is a remux, so it loses byte-range seeking and costs a process. The opening now waits for the settings read. `usePlayback` gains a second reason to re-point the element.
- Docs per log 46 Q23: README's and CLAUDE.md's step 29 and the _Audio tracks_ / _Audio preferences_ entries; CLAUDE.md's Settings Hub (four fields and the new route); the folder tree (`trackLanguage/`, `audioTracks/`, `preferredAudio/`, `useAudioTracks/`, `AudioMenu/`, `useOpeningReads`' third read, the renamed pool). Ticked ✅ only after the refactor.
