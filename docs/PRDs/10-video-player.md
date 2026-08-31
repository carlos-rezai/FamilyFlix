## Problem Statement

My parents can find any film in the library — browse it, search it, filter it,
sort it, favorite it, rate it, and see a progress bar on the poster telling them
they're partway through. Then they press Play and land on a page that says
"Playback for movie a1 lands here."

Nothing in FamilyFlix can deliver a single byte of a movie file. `/api/images`
serves posters; video has no equivalent. `server/src/media/` is an empty
`.gitkeep`.

Worse, the entire watch-tracking surface is a display of data nothing produces.
`setResumePosition`, `markWatched` and `markUnwatched` exist in
`server/src/library/watch/` and are covered by tests, but **no route exposes the
resume write and nothing calls it**. The Continue Watching row, the resume
labels (`Resume · 1:13 of 1:55`), the in-progress badges, the progress bars —
every one of them renders a `resume_position_seconds` that today can only arrive
from the dev seed. Turn the seed off and the resume shelf is empty forever,
because there is no way for the family to watch anything.

And even with a player, the format problem is real. The family folder holds MKV
files carrying H.264 video and AC-3 audio. Electron's Chromium **does not demux
MKV or AVI at all**, and does not decode AC-3 or DTS. A `<video>` element
pointed at the family's actual films plays nothing. A player that only handles
the MP4s is a player that plays almost none of the library.

## Solution

A built-in player at `/movie/:id/play` — one self-contained screen, a 1:1
translation of `docs/handoff/feat.PlayerControls.dc.html`: back pill, serif
title, big-play circle, scrubber with knob, play/pause, ±10s, volume slider, CC
pill, fullscreen, all fading together after 3 seconds of stillness over a
blurred backdrop, with a styled subtitle box that is ours rather than `::cue`.

Behind that surface, three things the prototype could only fake:

**Video actually arrives.** `GET /api/movies/:id/stream` probes the file and
picks one of three playback paths — **direct play** (`sendFile` + HTTP Range) for
what Chromium already reads, **remux** (`-c copy` into fragmented MP4) when only
the container is wrong, **transcode** (H.264/AAC) when a codec is unreadable. The
choice is made per request by a pure function from an ffprobe read, so the same
MKV that fails on a bare element plays.

**Seeking works on all three.** The scrubber is ours and takes duration from a
playback read rather than from `video.duration`, which is a lie on a live
transcode. A drag re-points the source at `?t=<seconds>`, ffmpeg restarts at
`-ss t`, and the hook re-anchors: absolute position = stream offset + element
time.

**Watching writes.** Every 10 seconds of playback, plus on pause, seek-settle and
exit, the absolute position posts to `POST /api/movies/:id/resume` — coalesced so
nothing is written unless the position moved ≥5s, and nothing at all is written
before the first tick. Opening a film and backing out three seconds later must
not reorder the Continue Watching shelf. At `ended`, or ≥95% of duration on exit,
the movie marks itself watched and leaves the shelf on its own.

Subtitles are normalised server-side: `.srt`, `.vtt`, `.ass` and `.sub` all parse
into one `{ start, end, text }[]` cue list stamped in absolute position, so a
transcode seek cannot desync them by the seek distance the way a native `<track>`
would.

## User Stories

**Watching a film**

1. As a parent, I want pressing Play on the movie detail page to open a real
   player, so that the button does what it says.
2. As a parent, I want the film to start playing immediately when the screen
   opens, so that I don't have to press play twice.
3. As a parent, I want an in-progress film to resume silently where I left it,
   so that I don't have to find my place again.
4. As a parent, I want an unwatched film to start at the beginning, so that
   nothing is skipped.
5. As a parent, I want a film I already finished to start from the beginning
   when I play it again, so that a watched film is not stuck at the credits.
6. As a parent, I want the film's title shown at the top, so that I know I opened
   the right one.
7. As a parent, I want the blurred backdrop behind the player, so that the screen
   is not a flat black rectangle before the picture arrives.
8. As a parent, I want to click anywhere on the picture to pause, so that I don't
   have to aim at a small button.
9. As a parent, I want a large play circle over the picture when paused, so that
   it is obvious the film is stopped and obvious how to restart it.
10. As a parent, I want the controls to fade away three seconds after I stop
    moving the mouse, so that nothing sits on top of the film while I watch.
11. As a parent, I want the cursor to disappear with the controls, so that an
    arrow is not parked in the middle of the picture.
12. As a parent, I want any mouse movement to bring the controls straight back,
    so that they are never more than a twitch away.
13. As a parent, I want the controls to stay on screen while the film is paused,
    so that they don't vanish while I'm deciding what to do.
14. As a parent, I want the elapsed time and total runtime either side of the
    scrubber, so that I know how much is left.
15. As a parent, I want to click anywhere on the scrubber to jump there, so that
    I can skip a slow stretch.
16. As a parent, I want to drag the scrubber knob, so that finding a spot in a
    two-hour film is not a series of guesses.
17. As a parent, I want the picture to follow when I let go of the knob rather
    than fighting me during the drag, so that scrubbing feels settled.
18. As a parent, I want ±10s buttons, so that I can replay a line of dialogue I
    missed.
19. As a parent, I want the volume slider to change the volume, so that I can
    turn a loud film down.
20. As a parent, I want a mute button, so that I can silence it instantly for the
    phone.
21. As a parent, I want the volume icon to show when sound is muted or near
    silent, so that I can see why I can't hear anything.
22. As a parent, I want my volume and mute setting remembered next time, so that
    I don't reset it every film.
23. As a parent, I want a fullscreen button that works, so that the film fills
    the television.
24. As a parent, I want to leave fullscreen and find the player exactly as it
    was, so that nothing restarts.
25. As a parent, I want a Back pill that returns me to the film's page, so that I
    can get out without hunting.
26. As a parent, I want Escape to leave the player too, so that the keyboard way
    out is the one I already expect.

**Keyboard**

27. As a parent, I want Space or K to play and pause, so that I don't need the
    mouse at all.
28. As a parent, I want the left and right arrows to skip ±10s, so that the
    keyboard matches the buttons.
29. As a parent, I want the up and down arrows to change volume, so that I can
    adjust without looking.
30. As a parent, I want M to mute, C to toggle captions and F for fullscreen, so
    that every control has a key.
31. As a maintainer, I want the keyboard map to move controls the same way the
    buttons do rather than by a second code path, so that the two can't drift.

**Subtitles**

32. As a parent, I want the CC button to turn subtitles on, so that I can follow
    a quiet film.
33. As a parent, I want subtitles off when a film starts, so that they are never
    on the screen uninvited.
34. As a parent, I want the CC button to look switched on while subtitles are
    showing, so that I can tell the state at a glance.
35. As a parent, I want the subtitle box drawn in FamilyFlix's own styling rather
    than the browser's default captions, so that it matches the rest of the app.
36. As a parent, I want subtitles to sit above the controls and lift out of their
    way when the chrome appears, so that the last line is never covered.
37. As a parent, I want the right subtitle line for wherever I am in the film,
    including immediately after I scrub, so that they never run an hour behind.
38. As a maintainer, I want subtitles in `.srt`, `.vtt`, `.ass` or `.sub` to all
    work, so that the family folder doesn't need tidying first.
39. As a maintainer, I want a film with no subtitle files to simply not draw the
    CC button, so that there is no dead control.
40. As a maintainer, I want the subtitle track chosen by preferred language and
    then track order, so that the choice is deterministic without a picker.
41. As a parent, I want a stretch with no dialogue to show no subtitle box at
    all, so that an empty box is not hovering over the picture.
42. As a maintainer, I want a subtitle file that fails to parse to leave the film
    playing without subtitles, so that a malformed `.ass` can't kill playback.

**Formats**

43. As a maintainer, I want an MP4 with H.264 and AAC sent straight from disk
    untouched, so that the common case costs nothing.
44. As a parent, I want an MKV to play, so that most of our library is watchable.
45. As a parent, I want a film with AC-3 or DTS audio to have sound, so that I
    don't get a silent picture.
46. As a parent, I want an HEVC or XviD film to play, so that the odd one out
    isn't excluded.
47. As a parent, I want a brief "Preparing…" message while a converted film spins
    up, so that a black screen doesn't read as a crash.
48. As a maintainer, I want the playback path decided fresh from the file each
    request rather than stored, so that installing a better component makes old
    films play without re-importing anything.
49. As a maintainer, I want conversion to stop when I leave the player, so that
    movie night doesn't leave transcodes running on the machine.
50. As a maintainer, I want hardware encoding used when the machine has it, so
    that a 1080p transcode isn't unwatchable on my parents' computer.

**Watch tracking**

51. As a parent, I want the film I'm watching to appear at the top of Continue
    Watching, so that I can pick it straight back up tomorrow.
52. As a parent, I want my position saved during playback rather than only when I
    close the player, so that a crash or a power cut doesn't lose the evening.
53. As a parent, I want to open a film, decide against it and back out without it
    appearing in Continue Watching, so that the shelf is what I'm actually
    watching.
54. As a parent, I want a film left paused for an hour not to keep reshuffling the
    shelf, so that the order means something.
55. As a parent, I want a film I watch to the end to leave Continue Watching by
    itself, so that finished films don't sit there at `Resume · 2:04:00` forever.
56. As a parent, I want a film I stop during the credits to count as finished, so
    that I don't have to mark it by hand.
57. As a parent, I want the position saved even when I close the player abruptly,
    so that the last minutes aren't lost.
58. As a maintainer, I want the resume position written through the same route
    shape as favorite, watched and rating, so that it inherits the same
    404-before-write and echo behaviour.
59. As a maintainer, I want a save that fails to leave playback undisturbed, so
    that a backend hiccup never interrupts the film.

**Empty, error and edge states**

60. As a parent, I want a clear message when the film's file is missing, so that
    I'm not staring at a black screen wondering.
61. As a parent, I want a clear message when a film genuinely cannot be played,
    so that I know to tell the maintainer rather than keep trying.
62. As a parent, I want a Back way out of both of those, so that a broken film
    doesn't trap me on its screen.
63. As a maintainer, I want the app still to direct-play MP4s when no playback
    component is installed at all, so that a partial setup is not a dead app.
64. As a parent, I want a film whose runtime the library doesn't know to still
    show a real scrubber, so that seeking isn't lost because of a blank metadata
    field.
65. As a maintainer, I want the player URL for an unknown movie id to say so
    rather than hang, so that a stale bookmark has an answer.
66. As a maintainer, I want a hand-edited `?t=` beyond the end of the film to be
    handled rather than spawn something that never produces output.
67. As a maintainer, I want video and subtitle paths resolved from the database
    and verified to sit under the managed media directory, so that a crafted URL
    can never read an arbitrary file off my disk.
68. As a maintainer, I want a film I can play to appear in the seed with a real
    file behind it, so that I can check the player by looking at it.

**Truthful codec reporting**

69. As a maintainer, I want the app to report what it can actually decode, probed
    from Chromium's native set and the installed component, so that the codec
    screen stops being decorative.
70. As a maintainer, I want the "codec pack" drop zone to name the thing that
    genuinely changes what plays, so that the screen isn't promising something a
    `.dll` cannot do.

## Implementation Decisions

### Scope

Ticks two roadmap items: **Built-in video player** and **Watch tracking**. The
read side of watch tracking (badges, `ContinueCard`, the resume shelf) already
ships; the player is the only thing that can write a position, so they land
together.

**Not in scope:** the Settings shell, the CodecManager UI, Electron packaging, a
subtitle track picker, hover-preview time on the scrubber, HLS, embedded
(in-container) subtitle tracks, image-based subtitles (PGS/VOBSUB), auto-on
subtitles.

### Playback engine — a plain `<video>` element

Neither video.js nor react-player. **CLAUDE.md's tech-stack line is amended** to
say so. The chrome is 100% ours, so a vendor skin is only something to defeat;
the subtitle box is ours, so video.js's native-cue rendering is the one thing the
prototype specifically does not do; and jsdom can drive a bare element while it
cannot drive video.js. Zero new runtime dependencies.

### The three playback paths

| Path            | When                                           | Cost                         |
| --------------- | ---------------------------------------------- | ---------------------------- |
| **Direct play** | MP4/WebM, Chromium-supported codecs            | `sendFile` + Range           |
| **Remux**       | Only the container is wrong (MKV, H.264 + AAC) | `-c copy`, I/O-bound         |
| **Transcode**   | Codec unsupported (HEVC, XviD, AC-3, DTS)      | re-encode, HW when available |

`choosePlaybackPath` is **pure** — probe in, decision + argv out — so the whole
policy is unit-testable without spawning anything. The decision is made per
request, never stored: replacing the playback component makes old films play
without re-importing.

Rejected: swapping Electron's `libffmpeg` (Chromium still refuses to demux MKV
whatever the ffmpeg build); embedding libmpv (renders to a native surface the
styled chrome cannot sit over); ffmpeg.wasm / WebCodecs (far too slow for 1080p
in software on the target machine).

### Seeking

One endpoint with a server-side restart. Direct play seeks natively via Range. On
the stream paths the response is a live stream — `video.duration` is unknown and
byte ranges do not exist — so a scrubber drag re-points `video.src` at a new `t`,
ffmpeg starts at `-ss t`, and the hook re-anchors:

> **absolute position = stream offset + element time**

This works precisely _because_ the scrubber is ours and never reads duration from
the element. HLS + hls.js is the escape hatch if restart-seeking proves janky.

### FFmpeg resolution — **new decision**

The design log settled that the installer bundles a default build and the
prototype's drop zone replaces that binary. Electron is out of scope here, so
nothing bundles anything yet. `ffmpegBinary` resolves in three steps:

1. `FAMILYFLIX_FFMPEG_PATH` (a new environment variable) — the slot the installer
   will later fill, and the one a maintainer's uploaded component will occupy.
2. `ffmpeg` / `ffprobe` on `PATH`.
3. **Absent** — a first-class state, not an error.

Absent means direct play still works and the app is usable; remux and transcode
answer with the `cannot-play` notice; and `capabilities` reports Chromium's
native set alone, which is the truth. Nothing hard-fails on a machine with no
FFmpeg.

### The playback read — **new decision, supersedes design log Q13**

The design log named two reads and one write. There are **three reads**:

```
GET  /api/movies/:id/playback                -> { path, durationSeconds }
GET  /api/movies/:id/stream?t=<seconds>
GET  /api/movies/:id/subtitles/:subtitleId   -> Cue[]
POST /api/movies/:id/resume  { value }         (via writeSignal)
```

`runtimeMinutes` is nullable, and the design log's "the scrubber reads duration
from the movie record" has no answer for a film that arrived without one. ffprobe
already knows the true duration, so the player fetches it once on open. This is
strictly better than the movie record even when the record has a runtime —
`runtimeMinutes` is rounded metadata, `durationSeconds` is the file. It also
hands the client the chosen path, which is what tells the hook whether to
re-anchor at all.

**Documentation follow-up:** this amends `docs/design-logs/10-video-player.md`
Q4/Q13 and the **Scrubber** entry in `docs/ubiquitous-language.md`, plus a new
**Playback read** term. Both are updated as part of this initiative.

### Backend — `server/src/playback/`, a new domain

CLAUDE.md sanctions this explicitly: backend logic fitting none of `library/`,
`media/`, `import-export/` "is a sign a new domain folder is needed". Subtitle
_detection_ stays in `media/`; subtitle _parsing_ exists to feed the player and
belongs here.

Modules, one folder per unit with its test, no per-unit barrel:

- **`ffmpegBinary`** — resolve the component: env var, then PATH, then absent.
- **`probe`** — ffprobe wrapper → `MediaProbe` (container, video codec, audio
  codec, duration).
- **`choosePlaybackPath`** — _pure_: `MediaProbe` → path + argv. The deep module
  of the backend: all of the format policy behind one function with no I/O.
- **`streamMovie`** — `sendFile` or spawn; **kills the child on client
  disconnect**.
- **`capabilities`** — Chromium's native set ∪ `ffmpeg -decoders`, the read the
  CodecManager initiative will consume.
- **`parseSrt` / `parseVtt` / `parseAss` / `parseSub`** — _pure_, each with its
  own test.
- **`parseSubtitle`** — dispatch on extension. Nothing downstream knows which
  format the file was.

`createApiRouter(storage, mediaPath, playback)` — the domain is injected the way
`storage` already is.

### Path safety

Paths are resolved **from the database, never from the URL** — the URL carries a
movie id and a subtitle id — and every resolved path is verified to stay under
`FAMILYFLIX_MEDIA_PATH` before anything is opened.

### Frontend — `src/features/player/`

- **`Player`** — the organism: owns the hooks, renders the rest.
- **`PlayerControls`** — top + bottom chrome (the COMPONENT-SPEC name).
- **`PlayerScrubber`**, **`VolumeSlider`** — they share _logic, not pixels_: one
  `useDragScalar` hook, two styled surfaces. Not a shared `Slider` primitive; the
  two differ in height, knob and colour, and forcing them together means a
  primitive with a prop per difference.
- **`SubtitleOverlay`** — the styled cue box.
- **`PlayerNotice`** — buffering + unavailable, both reusing the big-play circle's
  96px geometry rather than inventing an element.
- **`usePlayback`** — element state ↔ React state, offset re-anchoring. The deep
  module of the frontend: every media-element edge case behind one hook.
- **`useWatchReporter`** — tick, coalesce, finish.
- **`useControlsVisibility`** — 3s idle, hidden cursor.
- **`usePlayerKeys`**, **`useDragScalar`**.
- **`cueAt`**, **`preferredSubtitle`** — pure, tested.
- **`api/`** — `fetchPlayback`, `fetchSubtitleCues`, `saveResume`.

`pages/PlayerPage` stays composition-only: read `:id`, render `<Player />`.

### `saveWatched` moves up to `src/api/`

CLAUDE.md's `api/` rule says a wire call moves to that rung "when a second
feature asks for it", and names `saveWatched` as having one caller and staying
put "if and when that changes". The player is that change. `saveResume` has one
caller and therefore **stays in `features/player/api/`** — the same rule read the
other way. Both CLAUDE.md's `api/` paragraph and the Layer Responsibilities table
are updated to match.

### Watch reporting

- **Tick:** every 10s of playback, plus on pause, seek-settle and exit.
- **Tick threshold:** coalesced — nothing is written unless the position moved
  ≥5s since the last write, so a paused player writes nothing and cannot reshuffle
  the shelf.
- **Exit** uses `fetch` with `keepalive`.
- **Opening writes nothing** before the first tick. `setResumePosition` stamps
  `last_watched_at`, so an immediate write would let opening a movie and backing
  out three seconds later reorder Continue Watching. Three seconds is not
  watching.
- **Finish threshold:** `ended`, or position ≥95% of duration on exit →
  `POST /api/movies/:id/watched` (the route that already exists), whose
  `markWatched` zeroes the resume position by documented convention.

### Behaviour added around an unchanged surface

None of these move a pixel: the keyboard map; fullscreen wired to the button the
prototype draws but leaves inert; volume and muted persisted in `localStorage` (a
per-machine UI preference, not library data, so the DB is the wrong home);
drag-to-seek on a scrubber the prototype only lets you click.

### Prototype amendments — made first, then built against

Per CLAUDE.md's "amend the prototype first" rule:

1. `feat.CodecManager.dc.html` — drop-zone copy `.dll · .so · .pak` → the
   playback component. Geometry unchanged.
2. `feat.PlayerControls.dc.html` — a **buffering** state and an **unavailable**
   state (`missing-file` / `cannot-play`), both inside the existing 96px circle.

### Dev fixture — **new decision**

The seed writes `__seed__/<slug>/<slug>.mkv` paths that nothing on disk backs,
and its own doc comment says "nothing plays a seed movie" — which the player
makes false. A small silent H.264/AAC MP4 is checked in as a seed asset, and the
seed copies it under the reserved prefix for every fixture, so every seeded movie
direct-plays and the player is checkable by looking at it. Idempotent and
prefix-scoped like the rest of the seed, and deleted with it when bulk import
ships. Pointing `FAMILYFLIX_MEDIA_PATH` at a real folder of the family's films
stays the way to exercise remux and transcode against actual MKVs.

### Types — `src/types/`

`Cue` (`{ start, end, text }` in absolute-position seconds), `PlaybackPath`
(`'direct' | 'remux' | 'transcode'`), and the playback read's payload.

### Environment variables

`FAMILYFLIX_FFMPEG_PATH` is new; CLAUDE.md's Environment Variables section is
updated.

## Testing Decisions

A good test here asserts **external behaviour** — what a URL answers, what the
screen shows, what got written — and never how it was reached. The precedent is
`server/src/routes/routes.test.ts`, whose header states the rule outright: the
seam is the endpoint rather than the handler function, over a real listener on an
ephemeral port and a real fully-migrated `:memory:` database, because what the
slice promises a caller is a URL, a status and a body shape.

All four groups get tests.

**Pure policy and parsers** — `choosePlaybackPath`, the four subtitle parsers,
`parseSubtitle`, `cueAt`, `preferredSubtitle`. The risky logic is also the cheap
logic: no spawning, no DOM, probe in / decision out. `src/utils/`'s tests are the
prior art, and CLAUDE.md already requires one per helper. `choosePlaybackPath`
carries the format matrix: MP4+H.264+AAC → direct, MKV+H.264+AAC → remux,
MKV+HEVC → transcode, MP4+H.264+AC-3 → transcode, no component → direct or
unavailable.

**Routes** — through `createApiRouter` the way `routes.test.ts` already does:
Range requests answering 206 with the right bytes, the under-media-root path check
rejecting a crafted subtitle id, a missing file answering rather than throwing,
the cue payload's shape, and `resume`'s 404-before-write and `{ value }` echo
inherited from `writeSignal`. The FFmpeg-dependent arms are exercised through an
injected fake component rather than by spawning a real binary in CI.

**Player hooks** — `usePlayback`'s offset re-anchoring (the arithmetic that makes
stream seeking correct, and the single most breakable thing in the feature),
`useWatchReporter`'s coalescing and finish threshold, `useControlsVisibility`'s
3s idle, `useDragScalar`. These need **`stubMediaElement`**, a new
`src/test-support/` unit: jsdom's `HTMLMediaElement` has no working `play()`,
`pause()`, `currentTime` or `duration`, so a hook driving it can't be observed at
all. It follows `stubScrollMetrics`'s precedent exactly — defines the properties
on the prototype, registers its own cleanup so a leaked stub can't follow the
next file — and, like every `test-support/` unit, is never imported by shipping
code. `vi.useFakeTimers` drives the 10s tick and the 3s idle.

**Chrome components** — `Player`, `PlayerControls`, `PlayerScrubber`,
`SubtitleOverlay`, `PlayerNotice`: what the CC toggle does, what the notice says,
which cue is on screen at a given position, what a drag seeks to, that the CC
button is absent for a film with no subtitles, that the controls come back on
mouse move. Rendered behaviour through `@testing-library/react`, the way the
existing feature tests are written.

The two states that must be asserted as _absences_, because they are the ones a
regression makes silently wrong: opening the player writes nothing, and a paused
player writes nothing.

## Out of Scope

- **The Settings shell and the CodecManager UI** — their own initiative. The
  codec _mechanism_ is designed and built here (`capabilities`, the component
  resolution) because the stream route depends on it; the screen that renders it
  is not.
- **Electron** — the player is built against HTTP and behaves identically under
  `npm run dev` and in the packaged shell. Bundling FFmpeg with the installer is
  the packaging initiative's job; this one leaves it a resolvable slot.
- **A subtitle track picker** — the prototype draws a plain CC toggle.
  `preferredSubtitle` picks; nobody chooses.
- **Auto-on subtitles** — roadmap. The Settings toggle ships disabled, and
  shipping subtitles on by default would implement the roadmap item by accident.
- **Hover-preview time on the scrubber** — new UI, so a prototype amendment
  rather than something to smuggle in.
- **HLS + hls.js** — the escape hatch if restart-seeking proves janky.
- **Embedded (in-container) subtitle tracks** — the data model stores external
  subtitle files.
- **Image-based subtitles (PGS/VOBSUB)** — cannot become text cues at all.
- **Converting subtitles at import time** — worth revisiting later as a cache;
  helps only after the importer ships, which is after this.
- **Per-person watch history** — permanently out of scope; single shared
  household profile.

## Further Notes

**What gets easier.** Custom chrome is free rather than fought for, because there
is no vendor skin. The transcode-seek design falls out of a decision already
made — the scrubber not trusting the element — instead of needing a manifest
format. The two hardest pieces of policy are pure functions, so the risky logic is
the cheap logic to test. The CodecManager stops being a fiction and becomes a live
report of what the machine can actually do.

**What gets harder.** We own the media element's edge cases — buffering, stalls,
`readyState`, autoplay policy — that a library would have absorbed. FFmpeg is a
real native dependency with a real installer size. A spawned child must be killed
on client disconnect or a family movie night leaves transcodes running.
Transcoding 1080p HEVC in software is CPU-hungry; hardware encoders are used when
available, but "available" varies by machine and is not something tests can pin.

**Build order** (six slices, each end-to-end):

1. **Direct play, thinnest slice.** The stream route with `sendFile` + Range and
   the under-media-root check; the seed's MP4 fixture; a bare `<video>` in
   `Player/`; `PlayerPage` renders it. A seeded movie plays with browser-default
   controls. No chrome yet.
2. **The chrome, 1:1.** `PlayerControls`, `PlayerScrubber`, `VolumeSlider`,
   `useDragScalar`, `useControlsVisibility`, `usePlayback`, the playback read.
   `stubMediaElement` lands here.
3. **Watch writes.** `POST /api/movies/:id/resume`, `useWatchReporter`,
   `saveResume`, `saveWatched` promoted. Continue Watching orders itself from
   real playback for the first time.
4. **Subtitles.** Four parsers + `parseSubtitle`, the cue route, `cueAt`,
   `preferredSubtitle`, `SubtitleOverlay`, the CC toggle.
5. **FFmpeg pipeline.** `ffmpegBinary`, `probe`, `choosePlaybackPath`,
   `streamMovie` remux + transcode, `?t=` restart and re-anchoring,
   `PlayerNotice`. An MKV plays.
6. **Polish.** `usePlayerKeys`, fullscreen, volume persistence, `capabilities`.

The prototype amendments land **before** slice 1.

Design log: `docs/design-logs/10-video-player.md`. Vocabulary:
`docs/ubiquitous-language.md` §Playback delivery, §The player screen, §Watch
reporting.
