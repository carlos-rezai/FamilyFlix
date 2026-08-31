# Plan: Built-in video player + watch tracking

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/82

This is the first initiative that has to make bytes move. Everything shipped so
far reads and writes rows; this one opens a file, decides how it can be
delivered, streams it, and writes back what the family watched. It also closes
the loop the last three initiatives left open: `setResumePosition`,
`markWatched` and `lastWatchedAt` are all built, tested and stamped by nothing,
because the only thing that can write a resume position is a player.

The slicing follows the direction a byte travels, and then the direction the
position travels back: **a file arrives** (Phase 2) → **it is driven by our own
chrome** (Phases 3–4) → **watching writes** (Phase 5) → **it can be read**
(Phase 6) → **every format arrives, not just MP4** (Phase 7) → **every control
has a key** (Phase 8) → **the docs say why** (Phase 9). The prototype amendments
land first (Phase 1), per CLAUDE.md's "amend the prototype first, then build to
the amended prototype".

Each phase is demoable by opening a seeded movie and pressing Play. That is the
point of the seed's MP4 fixture landing in Phase 2 rather than with the FFmpeg
work: from the second phase onward, every phase can be checked by looking at it.

**Three ordering calls worth naming up front:**

- **The seed's MP4 fixture rides in Phase 2**, the phase that first needs a byte
  on disk. The seed's own doc comment currently says "nothing plays a seed
  movie" — a sentence this initiative makes false, and the comment is corrected
  in the same phase that falsifies it. Without the fixture every seeded movie
  renders `missing-file` and the player becomes the one feature that cannot be
  checked by looking at it.
- **`PlayerNotice` lands in Phase 3, not with the FFmpeg work.** The PRD's build
  order puts it in the FFmpeg slice because that is where `cannot-play` comes
  from, but _buffering_ is observable the moment `usePlayback` exists and
  _missing-file_ is observable the moment the stream route can 404. Shipping the
  chrome with a black rectangle for both, for four phases, is shipping a known
  wrong state. Phase 7 adds the third notice to a component that already exists.
- **`saveWatched`'s promotion to `src/api/` rides in Phase 5**, the phase that
  gives it its second caller. Moving it earlier would promote a call on the
  strength of a caller that does not exist yet, which is the opposite of the rule
  that put `saveFavorite` there and left `saveWatched` behind.

**Two intermediate states worth naming.** After Phase 3 the player cannot seek:
our chrome has replaced the browser's, and the scrubber lands in Phase 4. That is
one phase long, and it is the cost of reviewing `usePlayback`'s binding of
element state separately from the drag arithmetic. And through Phases 2–6 the
stream route has exactly one path — `sendFile` + Range — so `usePlayback`'s
offset is always zero and its re-anchoring is arithmetic waiting for a caller.
Phase 7 is where the single most breakable thing in the feature becomes
load-bearing, and it is planned as the thickest phase for that reason.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes.** Three reads and one write, all under the existing `/api` router:

  ```
  GET  /api/movies/:id/playback              -> { path, durationSeconds }
  GET  /api/movies/:id/stream?t=<seconds>    -> the bytes
  GET  /api/movies/:id/subtitles/:subtitleId -> Cue[]
  POST /api/movies/:id/resume  { value }     -> { value }
  ```

  The write goes through `writeSignal` like `favorite`, `watched` and `rating`,
  so it inherits the 404-before-write rule and the `{ value }` echo without
  re-deciding either. The reads answer a JSON 404 with `Unknown movie: <id>` on
  an unknown id, the shape `/api/movies/:id` already uses — never Express's HTML
  page, because the client reads that body to tell "gone" from "went wrong".

- **Schema: unchanged. No migration in this initiative.** Everything the player
  writes already has a column — `resume_position_seconds`, `watched`,
  `last_watched_at` — and the playback path is decided per request and
  deliberately never stored, so installing a better component makes old films
  play without re-importing. If a phase finds itself reaching for `ALTER TABLE`,
  something has been mis-sliced.

- **The frontend route is unchanged**: `/movie/:id/play`, already in the router,
  already the detail page's Play destination. `PlayerPage` stays
  composition-only — read `:id`, render `<Player />` — and stays outside
  `MainLayout`, per COMPONENT-SPEC §6.

- **Backend: a new domain, `server/src/playback/`.** Sanctioned by CLAUDE.md —
  backend logic fitting none of `library/`, `media/`, `import-export/` "is a sign
  a new domain folder is needed". One folder per unit with its test, no per-unit
  barrel and no category barrel, following `test-support/`'s precedent. Subtitle
  _detection_ stays in `media/`; subtitle _parsing_ exists to feed the player and
  lives here.

- **The domain is injected, the way `storage` already is.**
  `createApiRouter(storage, mediaPath, playback)`. `main.ts` composes it. This is
  what lets the route tests exercise the FFmpeg-dependent arms through a fake
  component instead of spawning a real binary in CI.

- **`choosePlaybackPath` is pure.** Probe in, decision + argv out. All of the
  format policy behind one function with no I/O, so the riskiest logic in the
  backend is also the cheapest to test. Nothing else in `playback/` decides a
  path.

- **FFmpeg resolves in three steps, and absent is a first-class state:**
  `FAMILYFLIX_FFMPEG_PATH`, then `ffmpeg` / `ffprobe` on `PATH`, then **absent**.
  Absent means direct play still works, remux and transcode answer `cannot-play`,
  and `capabilities` reports Chromium's native set alone. Nothing hard-fails on a
  machine with no FFmpeg — including CI, which is the machine every phase's test
  run happens on.

- **Path safety, from Phase 2 onward.** Paths are resolved **from the database,
  never from the URL** — the URL carries a movie id and a subtitle id — and every
  resolved path is verified to sit under `FAMILYFLIX_MEDIA_PATH` before anything
  is opened. This is a correctness rule, not a phase's feature: the check lands
  with the first route that opens a file, and every later route that opens one
  goes through it.

- **Key models, in `src/types/`.** `PlaybackPath = 'direct' | 'remux' |
'transcode'`; `Cue = { start, end, text }` with `start` / `end` in **absolute
  position seconds**; and the playback read's payload. `MediaProbe` (container,
  video codec, audio codec, duration) is a server-side type and stays in
  `playback/` — nothing on the wire carries it.

- **The scrubber never reads `video.duration`.** Duration comes from the playback
  read, which is a probe of the file rather than the movie record's rounded
  `runtimeMinutes`, and which has an answer for a film whose runtime is `null`.
  This one rule is what makes stream seeking possible at all, and it holds from
  Phase 3 — before there is any stream path that would break the alternative.

- **Absolute position = stream offset + element time.** The single invariant
  `usePlayback` exists to keep. On direct play the offset is always 0; on a
  stream path it is the `?t=` the current source was requested at. Every consumer
  — the scrubber, the cue lookup, the watch reporter — reads absolute position,
  and none of them knows which path is playing.

- **Volume and mute live in `localStorage`.** A per-machine UI preference, not
  library data: the database is the wrong home for it, and it must not travel
  with a backup of the library.

- **`saveResume` stays in `features/player/api/`; `saveWatched` moves up to
  `src/api/`.** The same CLAUDE.md rule read both ways — a call moves up when a
  second feature asks for it. The player is `saveWatched`'s second caller and
  `saveResume`'s only one.

- **Test seams, unchanged from what the codebase already does.** Routes through
  `createApiRouter` over a real listener on an ephemeral port and a real migrated
  `:memory:` database (`routes.test.ts`'s stated rule). Pure functions directly.
  Components and hooks through `@testing-library/react`. The one new seam is
  `src/test-support/stubMediaElement`, following `stubScrollMetrics` exactly:
  defines the properties on `HTMLMediaElement.prototype`, registers its own
  cleanup so a leaked stub cannot follow the next file, never imported by
  shipping code.

- **Zero new runtime dependencies.** A plain `<video>` element driven by our own
  hook — not video.js, not react-player. FFmpeg is a native binary resolved at
  runtime, not an npm package.

---

## Phase 1: Amend the prototype

**User stories**: 47, 60, 61, 70 — their _surface_ only. The behaviour behind
each lands in Phases 3 and 7.

### What to build

No code. Two prototype files, so that every later phase has something to be a 1:1
translation _of_.

`feat.PlayerControls.dc.html` gains the two states it does not draw: a
**buffering** state and an **unavailable** state with its two messages
(`missing-file`, `cannot-play`). Both are drawn inside the existing 96px big-play
circle's geometry rather than as a new element — the circle is already the thing
that sits in the middle of the picture when the film is not running, and
inventing a second centred element would give the screen two vocabularies for one
idea.

`feat.CodecManager.dc.html`'s drop-zone copy stops saying `.dll · .so · .pak` and
names the playback component, which is the thing that genuinely changes what
plays. Geometry unchanged; this is a copy edit to stop the screen promising
something a `.dll` cannot do.

### Acceptance criteria

- [ ] `feat.PlayerControls.dc.html` draws a buffering state and an unavailable
      state, both within the existing 96px circle, with no change to any other
      geometry, token or state already in the file
- [ ] The unavailable state distinguishes the missing-file message from the
      cannot-play message, and both are reachable from a Back control
- [ ] `feat.CodecManager.dc.html`'s drop zone names the playback component; no
      geometry, spacing or token changes
- [ ] `COMPONENT-SPEC.md` still describes both files accurately
- [ ] No file outside `docs/handoff/` changes

---

## Phase 2: Direct play — a seeded movie plays

**User stories**: 1, 43, 65, 67, 68

### What to build

The thinnest possible path from a movie id to a moving picture.

`GET /api/movies/:id/stream` resolves the movie's `videoPath` **from the
database**, verifies the resolved absolute path sits under
`FAMILYFLIX_MEDIA_PATH`, and sends the file with HTTP Range support so the
browser's own transport can seek. An unknown id is the JSON 404 the other movie
routes answer; a row whose file is not on disk answers rather than throwing.
There is no probe and no path _choice_ yet — this route direct-plays, which is
exactly what an MP4 with H.264 and AAC needs, and what the no-component state
falls back to anyway.

`server/src/playback/` is created for it, and `createApiRouter` grows its third
parameter now rather than in the phase that fills it, so the router's shape is
settled before four phases are written against it. `main.ts` composes the domain.

The seed gains its fixture: a small silent H.264/AAC MP4, checked in as a seed
asset and copied under the reserved `__seed__/` prefix for every fixture movie,
so every seeded movie has a real file behind a real path. The copy is
prefix-scoped and idempotent like everything else the seed writes — it can never
touch a movie that arrived any other way — and the doc comment saying "nothing
plays a seed movie" is corrected in the same commit that makes it false.

The frontend is deliberately almost nothing: `Player/` renders a bare `<video>`
with the browser's own `controls`, pointed at the stream URL; `PlayerPage` reads
`:id` and renders it. No chrome, no hook, no state.

**Demoable**: `npm run db:seed`, open any movie, press Play, and watch the
fixture play with browser-default controls and a working browser scrubber.

### Acceptance criteria

- [ ] `GET /api/movies/:id/stream` answers 200 with the file's bytes and the
      right content type for a movie whose file exists
- [ ] A `Range` request answers **206** with the requested bytes, a correct
      `Content-Range`, and a `Content-Length` matching the slice — not the whole
      file
- [ ] An unknown movie id answers a JSON 404 with `Unknown movie: <id>`, not
      Express's HTML page and not a hang
- [ ] A movie whose `videoPath` is not on disk answers rather than throwing, and
      the process stays up
- [ ] A movie whose stored path escapes the managed media directory (`../`, an
      absolute path, a link pointing outside it) is **refused** — asserted
      against the resolved path, not the raw string
- [ ] The seed copies the fixture MP4 for every fixture movie, and running the
      seed twice leaves the same library and the same files
- [ ] The seed still deletes only rows under `SEED_VIDEO_PREFIX`, files included
- [ ] `createApiRouter(storage, mediaPath, playback)` is the signature, `main.ts`
      composes the domain, and every existing route test still passes
- [ ] Opening `/movie/:id/play` for a seeded movie renders a `<video>` whose
      source is the stream URL; `PlayerPage` contains no logic beyond reading
      `:id`
- [ ] The seed's "nothing plays a seed movie" comment is gone

---

## Phase 3: The playback read and the transport chrome

**User stories**: 2, 6, 7, 8, 9, 10, 11, 12, 13, 25, 26, 47, 60, 62

### What to build

The prototype's surface, minus the two sliders, driven by real element state.

`GET /api/movies/:id/playback` answers `{ path, durationSeconds }`. In this phase
`path` is always `'direct'` and the duration comes from the file; the field
exists now because it is what tells `usePlayback` whether to re-anchor, and
adding it in Phase 7 would mean changing a payload four phases of client code
already read.

`usePlayback` binds the media element to React state — playing, position,
buffering, ended, autoplay rejection — and exposes the absolute position every
later consumer reads. It is the deep module of the frontend: every media-element
edge case behind one hook. On open the film plays immediately; when the browser
refuses autoplay, the big-play circle is the answer rather than a silent failure.

`PlayerControls` renders the prototype's top and bottom chrome — Back pill, serif
title, and the transport row minus the scrubber and volume slider, which are
Phase 4's. The blurred backdrop sits behind everything, so the screen is never a
flat black rectangle. Clicking anywhere on the picture toggles play; the big-play
circle appears over the picture when paused.

`useControlsVisibility` fades the whole chrome after 3 seconds of stillness and
takes the cursor with it, brings both back on any movement, and **holds them on
screen while paused** — a paused player is someone deciding, not someone
watching.

`PlayerNotice` renders buffering and missing-file inside the amended circle, each
with the Back way out. Escape leaves the player exactly as the Back pill does,
through the same handler rather than a second one.

`stubMediaElement` lands in `src/test-support/`, because none of the above is
observable in jsdom without it.

**Demoable**: press Play, the film starts on its own, the chrome fades after
three seconds and comes back on a twitch, clicking the picture pauses it, and
Escape and the Back pill both return to the movie's page.

### Acceptance criteria

- [ ] `GET /api/movies/:id/playback` answers `{ path, durationSeconds }`, with a
      duration read from the file rather than from `runtimeMinutes`, and answers
      it for a movie whose `runtimeMinutes` is `null`
- [ ] The playback read 404s on an unknown id in the same shape as the other
      movie routes
- [ ] The film begins playing when the screen opens, without a second press
- [ ] When autoplay is refused, the big-play circle is showing and one press
      starts the film
- [ ] The movie's title is on screen, and the blurred backdrop is behind the
      picture from the first frame
- [ ] A click anywhere on the picture pauses a playing film and resumes a paused
      one
- [ ] The big-play circle is present exactly when the film is paused
- [ ] The chrome and the cursor both hide after 3s of stillness while playing,
      and any mouse movement brings both back
- [ ] The chrome does **not** hide while the film is paused, however long the
      mouse is still
- [ ] The Back pill returns to the movie's detail page, and Escape does the same
      thing through the same path
- [ ] A movie whose file is missing shows the missing-file notice with a working
      way back, and never a black rectangle
- [ ] The buffering notice appears while the element is waiting and clears when
      it plays
- [ ] `stubMediaElement` defines `play`, `pause`, `currentTime`, `duration`,
      `paused` and `readyState` on the prototype, registers its own cleanup, and
      is imported by no shipping file
- [ ] Nothing in `features/player/` reads `video.duration`

---

## Phase 4: The scrubber and the volume slider

**User stories**: 14, 15, 16, 17, 18, 19, 20, 21, 64

### What to build

The two sliders, sharing logic and not pixels.

`useDragScalar` is the shared half: pointer down, move, up over a track, yielding
a 0–1 scalar, with the drag surviving a pointer that leaves the element. Two
styled surfaces sit on it — `PlayerScrubber` and `VolumeSlider` differ in height,
knob and colour, and a single `Slider` primitive with a prop per difference is
the thing being avoided.

`PlayerScrubber` takes its duration from the playback read, draws elapsed and
total either side of the track, jumps on a click anywhere along it, and follows a
drag by moving the knob and the labels **without seeking the picture until the
knob is released**. A film whose `runtimeMinutes` is `null` gets a real scrubber
like any other, because the duration never came from the record.

`VolumeSlider` changes the volume, the mute button silences instantly, and the
icon reflects muted and near-silent states so a family member can see why they
cannot hear anything. ±10s buttons skip in both directions and clamp at both
ends.

**Demoable**: scrub a two-hour film to the middle by dragging, replay a line with
−10s, turn it down, mute it.

### Acceptance criteria

- [ ] Elapsed and total runtime are shown either side of the track, formatted the
      way the rest of the app formats a clock
- [ ] A click anywhere on the track seeks to that position
- [ ] A drag moves the knob and the elapsed label continuously, and the picture
      seeks **once, on release**
- [ ] A drag that leaves the track and returns still tracks the pointer, and a
      pointer released outside the track still commits the seek
- [ ] A movie with `runtimeMinutes: null` renders a full, seekable scrubber
- [ ] ±10s move the position by exactly ten seconds and clamp at 0 and at the end
- [ ] The volume slider changes the element's volume across its full range
- [ ] Mute silences immediately, and unmute restores the previous level rather
      than jumping to full
- [ ] The volume icon distinguishes muted, near-silent and audible
- [ ] `PlayerScrubber` and `VolumeSlider` share `useDragScalar` and no styled
      component; neither imports the other
- [ ] The rendered chrome matches `feat.PlayerControls.dc.html` — spacing, sizes,
      tokens and states

---

## Phase 5: Watching writes

**User stories**: 3, 4, 5, 51, 52, 53, 54, 55, 56, 57, 58, 59

### What to build

The loop closes. `POST /api/movies/:id/resume` joins the three writes that
already go through `writeSignal`, validating a body of `{ value: number }` on its
own terms and dispatching to `setResumePosition` — which stamps `last_watched_at`
and therefore reorders Continue Watching.

`useWatchReporter` decides _when_: every 10 seconds of playback, plus on pause,
on seek-settle and on exit, **coalesced** so nothing is written unless the
absolute position moved ≥5s since the last write, and **nothing at all before the
first tick**. Opening a film, thinking better of it and backing out three seconds
later must leave the shelf exactly as it was — three seconds is not watching, and
`setResumePosition`'s stamp means an eager write would reorder the queue on a
glance. The exit write uses `fetch` with `keepalive`, so closing the player
abruptly does not lose the last minutes.

Finishing is the same reporter's job: at `ended`, or at ≥95% of duration on exit,
the film posts to the existing `/watched` route, whose `markWatched` zeroes the
resume position by documented convention and drops the film off the shelf.

Resume-on-open lands here too, because it is the read side of the same value: an
in-progress film starts silently where it was left, an unwatched one at the
beginning, and a **watched** one at the beginning too — a finished film is not
stuck at the credits.

`saveResume` lives in `features/player/api/`. `saveWatched` moves from
`features/movie-detail/api/api.ts` up to `src/api/saveWatched/saveWatched.ts`
with its test, the shape `saveFavorite` established, and the detail page imports
it from there. Both CLAUDE.md's `api/` paragraph and its Layer Responsibilities
table are corrected in this phase — the sentence naming `saveWatched` as a
one-caller call stops being true the moment this phase lands.

A save that fails leaves playback undisturbed. No notice, no pause, no thrown
error reaching the element — a backend hiccup must never interrupt the film.

**Demoable**: watch three minutes of a seeded film, back out, and find it at the
top of Continue Watching with a truthful `Resume ·` label. Watch it to the end
and find it gone from the shelf.

### Acceptance criteria

- [ ] `POST /api/movies/:id/resume` stores the position and echoes `{ value }`
- [ ] It 404s before writing on an unknown id, and rejects a non-numeric,
      negative or missing `value` with a 400 — through `writeSignal`, not a
      fourth hand-rolled copy of the lookup
- [ ] Playing writes the position every 10s
- [ ] **Opening the player and leaving before the first tick writes nothing** —
      asserted as an absence, with `last_watched_at` unchanged, so the shelf does
      not reorder
- [ ] **A paused player writes nothing**, however long it is left — asserted as
      an absence
- [ ] A tick whose position moved less than 5s since the last write is skipped
- [ ] Pause, seek-settle and exit each write, subject to the same 5s rule
- [ ] The exit write uses `keepalive`
- [ ] `ended` marks the film watched; so does exiting at ≥95% of duration
- [ ] A film marked watched leaves Continue Watching and its resume position is 0
- [ ] Opening an in-progress film starts at its stored position; an unwatched one
      at 0; a watched one at 0
- [ ] A rejected save leaves the film playing — position unchanged, no notice, no
      unhandled rejection
- [ ] `saveWatched` lives in `src/api/saveWatched/` with its test, the movie
      detail page imports it from there, and `features/movie-detail/api/api.ts`
      no longer defines it
- [ ] `saveResume` is in `features/player/api/` and has exactly one caller
- [ ] CLAUDE.md's `api/` paragraph and Layer Responsibilities table no longer
      describe `saveWatched` as a one-caller call

---

## Phase 6: Subtitles

**User stories**: 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42

### What to build

Four formats become one cue list, and the app draws it itself.

`parseSrt`, `parseVtt`, `parseAss` and `parseSub` are each pure, each with their
own test, each yielding `Cue[]` in absolute-position seconds. `parseSubtitle`
dispatches on extension, and **nothing downstream knows which format the file
was** — that is the whole reason the parsers exist separately.

`GET /api/movies/:id/subtitles/:subtitleId` resolves the subtitle's path from the
database, checks it under the media root the same way the stream route does, and
answers the cue list. A file that fails to parse is not a 500 that kills the
film: the film plays on without subtitles.

`preferredSubtitle` picks the track — preferred language first, then track order
— deterministically, with no picker anywhere. `cueAt` finds the line for an
absolute position; both are pure and tested.

`SubtitleOverlay` draws the styled box from the prototype rather than `::cue`,
sits above the controls, lifts out of their way when the chrome appears, and
renders **nothing at all** during a stretch with no dialogue. The CC button turns
it on, shows its on state, starts **off** on every film, and is **not drawn at
all** for a film with no subtitle files.

Because cues are stamped in absolute position and the overlay reads absolute
position, a scrub cannot desync them — the property that matters in Phase 7, and
worth asserting here, where it is cheap.

**Demoable**: press CC on a seeded film with a subtitle file and read the line;
press it again and it is gone; open a film without subtitles and there is no
button to press.

### Acceptance criteria

- [ ] Each of `.srt`, `.vtt`, `.ass` and `.sub` parses to the same `Cue[]` shape,
      each parser with its own test covering its own format's quirks
- [ ] `parseSubtitle` dispatches on extension, and no consumer branches on format
- [ ] The cue route answers the cue list for a valid subtitle id, and 404s on an
      unknown movie or subtitle id
- [ ] A subtitle id whose stored path escapes the media root is refused, the same
      way the stream route refuses one
- [ ] A malformed subtitle file leaves the film playing with no subtitles and no
      error state on screen
- [ ] Subtitles are off when a film opens
- [ ] The CC button turns them on and reads as switched on while they show
- [ ] The CC button is absent for a film with no subtitle files
- [ ] With several tracks, the one chosen is by preferred language then track
      order — deterministic across repeat opens
- [ ] The right cue is on screen for a given absolute position, including
      immediately after a seek
- [ ] A position between cues renders no box at all
- [ ] The overlay lifts when the chrome appears and never sits under it
- [ ] The box is our styling, not `::cue` and not a native `<track>`

---

## Phase 7: The FFmpeg pipeline — an MKV plays

**User stories**: 44, 45, 46, 48, 49, 50, 61, 63, 66

### What to build

The thickest phase, and the one that makes most of the family's library
watchable.

`ffmpegBinary` resolves the component in three steps and treats absent as a state
rather than an error. `probe` wraps ffprobe into a `MediaProbe`.
`choosePlaybackPath` — pure — turns that probe into a decision and an argv:
direct play when Chromium already reads it, remux (`-c copy` into fragmented MP4)
when only the container is wrong, transcode (H.264/AAC, hardware encoder when the
machine has one) when a codec is unreadable, and `cannot-play` when the file
needs a component that is not installed. With no component at all, an MP4 still
direct-plays: a partial setup is not a dead app.

`streamMovie` sends the file or spawns the child, and **kills the child on client
disconnect** — a family movie night must not leave transcodes running.

The decision is made per request from the file, never stored, so installing a
better component makes old films play with no re-import.

`?t=<seconds>` is where the phase earns its risk. Direct play seeks natively by
Range and ignores it. On a stream path there are no byte ranges and no known
duration, so a settled scrub re-points the source at a new `t`, ffmpeg restarts
at `-ss t`, and `usePlayback` re-anchors: **absolute position = stream offset +
element time**. Every consumer built in Phases 3–6 keeps reading absolute
position, and none of them changes. A hand-edited `t` beyond the end of the film
is handled rather than spawning something that never produces output.

`PlayerNotice` gains its third message: a film that genuinely cannot be played
says so, with the Back way out the missing-file notice already has.

**Demoable**: point `FAMILYFLIX_MEDIA_PATH` at a real folder of the family's
films. An MKV with AC-3 audio plays with sound, scrubs to the middle, and the
ffmpeg process is gone within moments of leaving the player.

### Acceptance criteria

- [ ] `choosePlaybackPath` covers the matrix: MP4+H.264+AAC → direct;
      MKV+H.264+AAC → remux; MKV+HEVC → transcode; MP4+H.264+AC-3 → transcode;
      AVI+XviD → transcode; DTS audio → transcode
- [ ] With no component resolved, an MP4 still chooses direct and everything else
      chooses `cannot-play` — asserted through the pure function, no spawning
- [ ] `ffmpegBinary` prefers `FAMILYFLIX_FFMPEG_PATH`, falls back to `PATH`, and
      answers absent without throwing
- [ ] The stream route's FFmpeg-dependent arms are exercised through an injected
      fake component; **no test spawns a real binary**
- [ ] The playback read reports the path that was actually chosen, and the same
      film reports a different path when the component's availability changes —
      no stored value anywhere
- [ ] A spawned child is killed when the client disconnects, asserted rather than
      assumed
- [ ] A settled scrub on a stream path re-points the source at the new `t`, and
      the reported absolute position equals stream offset + element time
- [ ] After such a seek the elapsed label, the cue on screen and the next resume
      write all agree on the absolute position
- [ ] A `?t=` beyond the end of the film answers rather than spawning a process
      that produces nothing
- [ ] A film that cannot be played shows the cannot-play notice, distinct from
      the missing-file one, with a working way back
- [ ] Hardware encoding is used when the machine reports one, with software
      encoding as the fallback — the selection is in the pure function's argv,
      which is where it can be asserted
- [ ] Nothing in Phases 3–6 changed to accommodate the offset: the scrubber, the
      overlay and the reporter still read one absolute position

---

## Phase 8: Keyboard, fullscreen, persistence, capabilities

**User stories**: 22, 23, 24, 27, 28, 29, 30, 31, 69

### What to build

Behaviour added around a surface that does not move.

`usePlayerKeys` maps Space and K to play/pause, ←/→ to ±10s, ↑/↓ to volume, M to
mute, C to captions and F to fullscreen — **by calling the same handlers the
buttons call**, not by a second code path. That is story 31, and it is the
difference between a keyboard map and a second player that drifts from the first
one.

Fullscreen wires the button the prototype draws but leaves inert. Leaving
fullscreen finds the player exactly as it was — same position, still playing,
nothing remounted.

Volume and mute persist in `localStorage` and are restored on the next film.

`capabilities` reports what the machine can actually decode: Chromium's native
set ∪ `ffmpeg -decoders` when a component is resolved, Chromium's alone when it
is not. It is the read the CodecManager initiative will consume; **no screen
renders it in this initiative**, and nothing else is built that has no caller.

**Demoable**: play a film with the mouse untouched — space, arrows, F, M, C —
then leave fullscreen and find it still running where it was.

### Acceptance criteria

- [ ] Space and K toggle play/pause; ←/→ skip ±10s; ↑/↓ change volume; M mutes;
      C toggles captions; F toggles fullscreen
- [ ] Each key calls the same handler as its button — asserted, not assumed
- [ ] Keys do not fire while focus is in a text input, and the player's shortcuts
      do not leak to other screens
- [ ] Fullscreen fills the screen and exits back to the player with the same
      position, the same playing state and no remount
- [ ] Volume and mute survive a reload and apply to the next film opened
- [ ] A `localStorage` that is unavailable or holds nonsense leaves the player
      working at a sane default
- [ ] `capabilities` reports Chromium's native set alone when no component is
      resolved, and the union when one is
- [ ] Nothing renders `capabilities` yet, and no Settings or CodecManager UI is
      added

---

## Phase 9: Docs, glossary and the filing

**User stories**: none directly — the documentation obligations the PRD records,
plus whatever the build defers.

### What to build

No behaviour change. The documents that would otherwise leave the next reader
believing something the code stopped doing.

CLAUDE.md's tech-stack line already names the plain `<video>` element and the
FFmpeg component; the Environment Variables section gains
`FAMILYFLIX_FFMPEG_PATH`, and the Folder Structure gains `server/src/playback/`
and the player feature's shape. `docs/design-logs/10-video-player.md` records
that Q4 and Q13 were superseded by the settled Q19 and Q20, in place rather than
in a footnote. `docs/ubiquitous-language.md`'s **Scrubber** entry is corrected to
say where its duration comes from, and gains **Playback read**, **Playback
path**, **Direct play**, **Remux**, **Transcode**, **Cue**, **Absolute
position**, **Stream offset** and **Watch reporter** under §Playback delivery,
§The player screen and §Watch reporting.

Whatever the build turns up that wants cleaning — and a feature this size will
turn up something — is filed as its own refactor issue rather than done here.

### Acceptance criteria

- [ ] CLAUDE.md lists `FAMILYFLIX_FFMPEG_PATH` with its three-step resolution and
      its absent state
- [ ] CLAUDE.md's Folder Structure shows `server/src/playback/` and the player
      feature's units
- [ ] The design log marks Q4 and Q13 superseded, naming what superseded them
- [ ] The glossary's **Scrubber** entry says its duration comes from the playback
      read and never from the element
- [ ] The glossary carries the new playback, cue and watch-reporting terms, each
      with the aliases to avoid
- [ ] `docs/dev-journal.md` records the initiative
- [ ] A refactor issue exists for whatever the build deferred
- [ ] The two features are **not** ticked ✅ in `README.md` / `CLAUDE.md` — per
      project convention that waits for the refactor round
