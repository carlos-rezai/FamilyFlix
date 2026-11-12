> **Initiative:** `welcome-tune`
> **Issue:** #593 (the PRD, step 45)
> **Design log:** `docs/design-logs/62-welcome-tune.md`
> **Handoff:** `docs/handoff/handoff-welcome-tune/` (its README is the score)
> **Build order:** step 45, **Welcome tune**. It ships as thin slices (log 62, _Implementation Plan_). No migration, no route, no server change, no CSP change and no change drawn; the splash prototype of `handoff-welcome-splash/` stays frozen.

## Problem Statement

A **Cold start** opens on the **Welcome splash**: the two Fs drop and land, _FamilyFlix_ rises letter by letter, the light sweeps the mark and the letters, and the wordmark glides into the header as the home arrives. It is the family's first sight of the app every time it is opened, and it is silent. Step 45 asks for a short, catchy tune with it, its notes falling on what the animation draws.

Three facts make that harder than playing a file. The welcome's clock is the provider's timers and the splash's CSS delays, spread as literals over two files, so a tune timed by hand drifts at the first retune. The welcome can hold on its **Welcome hold** for as long as the home needs, so the closing moment is not a fixed time after the start. And the welcome has paths a recording can't follow: a skip, reduced motion, and a window that may give no sound at all (a browser tab before any gesture, a Linux box with no audio device, jsdom).

## Solution

The **Welcome splash** plays the **Welcome tune**, synthesised with Web Audio from a score in the code, its times computed from the same timeline the animation reads.

- **The Intro cue** plays from the welcome's start: a pluck on each F's landing frame (F3, then F4), a pluck on each letter's rise running up the F major pentatonic so the run ends on F as the wordmark completes, and a swell with the light's sweep, all died away by the **Welcome intro**'s end (1950ms).
- **The Closing chord**, F major as bells, is struck when the **Wordmark handoff** starts, whenever that is, and rings on under the arriving home. The **Welcome hold** is silent between the two.
- **A skip** fades whatever is sounding to silence over the skip's own 150ms; a skip never plays the chord.
- **Reduced motion** plays the Closing chord alone, at the reduced handoff's start: the Intro cue marks motion that isn't drawn.
- **No sound to be had** gives silence, the welcome unchanged.
- **Only with the Welcome splash**: a reload, a deep link, the **Start-up splash** and a **Slow start**'s tile are silent.
- **No mute control** for now; the system's volume rules.

The welcome's every number moves into one timeline module that the splash's styles, the provider's clocks and the score all read, so a change to the animation moves the notes with it.

## User Stories

### The tune

1. As a parent, I want a short tune to play with the Welcome splash when I open FamilyFlix, so that opening it feels like sitting down to a show.
2. As a parent, I want a note as each F lands, so that the mark's arrival is heard as well as seen.
3. As a parent, I want the two landing notes an octave apart, F3 then F4, so that the two Fs sound like the pair they are.
4. As a parent, I want a quick rising run as the letters of _FamilyFlix_ rise, one note per letter, so that the name sounds as it appears.
5. As a parent, I want that run to end on F as the last letter of _Flix_ rises, so that the name finishes on the note it started from.
6. As a parent, I want a soft swell as the light sweeps the mark, at its fullest at the sweep's middle, so that the shine is heard too.
7. As a parent, I want every note of the opening to have died away by the time the intro ends, so that the opening never blurs into what follows.
8. As a parent, I want a warm chord as the wordmark glides into the header, so that the welcome closes on an arrival.
9. As a parent, I want that chord to ring on under the home as it appears, so that the home arrives inside the tune, not after it.
10. As a parent, I want the whole tune in F major, as the mark is, so that it sounds of a piece with the name.
11. As a parent, I want the tune at a gentle level that follows my system volume, so that it never blares from the TV.
12. As a parent, I want the chord never to distort, however many notes sound together, so that the TV speakers don't crackle.

### When it plays

13. As a parent, I want the tune only when the Welcome splash plays, on a Cold start, so that it greets me once, not on every page.
14. As a parent, I want a reload to be silent, so that refreshing doesn't greet me again.
15. As a parent, I want a deep link to be silent, so that opening a film directly goes straight to the film.
16. As a parent, I want the Start-up splash silent, so that the wait for the server makes no sound of its own.
17. As a parent, I want a Slow start's tile silent, so that the tune never plays over a loader.
18. As a parent, I want the welcome silent while it holds for the home, so that a slow start doesn't fill the wait with a drone.
19. As a parent, I want the closing chord to wait for the wordmark's glide however long the hold lasts, so that the chord always meets the glide.
20. As a parent, I want the chord to come with the glide whether or not the welcome held, so that a fast start and a slow one end alike.

### A skip

21. As a parent, I want a skip by click or key to fade the tune out with the welcome, so that pressing a key gets me in without a sound cut short.
22. As a parent, I want that fade to take the skip's own 150ms, so that sound and picture leave together.
23. As a parent, I want a skip never to play the closing chord, so that I'm not given a flourish I chose to skip.
24. As a parent, I want a skip during the hold to play no chord either, so that every skip behaves alike.
25. As a parent, I want a skip during the glide to fade the ringing chord, so that the skip still means silence.

### Reduced motion

26. As a parent with reduced motion on, I want only the closing chord, as the fades hand over, so that I hear the arrival without notes for motion I'm not shown.
27. As a parent with reduced motion on, I want that chord at the reduced handoff's start (900ms), so that it lands with what I am shown.

### Where there is no sound

28. As a parent, I want the welcome unchanged when the computer has no sound to give, so that a missing audio device never breaks opening the app.
29. As the maintainer, I want a window with no Web Audio at all to stay silent, so that an old engine or a test environment just runs.
30. As the maintainer, I want an audio context that throws on construction (no device on Linux) to give a silent tune, so that the Deck without a sink opens normally.
31. As the maintainer, I want a context the browser keeps suspended (a tab before any gesture) never resumed, so that a browser tab simply stays silent.
32. As the maintainer, I want the shell's window to state `autoplayPolicy: 'no-user-gesture-required'` with a line saying the Welcome tune and the player rely on it, so that an Electron changing its default can't silence the tune unnoticed.

### In sync by construction

33. As the maintainer, I want the welcome's every number (the drop, the letters, the sweeps and the clock) in one timeline module, so that there is one copy of the welcome's timing.
34. As the maintainer, I want the splash's styles to read their delays and durations from that timeline, the drop's landing step included, so that the animation and the tune read the same numbers.
35. As the maintainer, I want the provider's clocks built from that timeline, so that the phases change on the same numbers too.
36. As the maintainer, I want every note's time computed from the timeline, never typed as a number of its own, so that retiming the animation retimes the tune.
37. As the maintainer, I want the timeline's test to hold the rule that the intro outlasts the last letter's sweep, so that the rule the provider's docblock states today stays enforced.
38. As the maintainer, I want lifting the timeline to change nothing drawn, so that the splash's own tests stay green across the move.
39. As the maintainer, I want each cue anchored on the audio clock at the moment it is played, so that the tune is never early and never squeezed.

### The code

40. As the maintainer, I want the score as pure data (notes with a time, pitch, length, voice and level), so that a retune is a table edit.
41. As the maintainer, I want one unit the only code that touches Web Audio, so that the rest is testable without a sound card.
42. As the maintainer, I want the React wiring in its own hook called once by the welcome's provider, so that the provider doesn't grow by a tune's worth of effects.
43. As the maintainer, I want the tune's context closed once the chord has died away, so that it holds no audio resources for the rest of the session.
44. As the maintainer, I want an unmount to close the context at once, so that tests and teardown leave nothing running.
45. As the maintainer, I want the three units beside the welcome in `src/App/`, so that the tune lives with the furniture it scores.
46. As the maintainer, I want no dependency, no audio asset and no CSP change, so that the tune costs nothing to ship or license.
47. As the maintainer, I want the tune to touch no network and no file, so that it sits inside every boundary CLAUDE.md draws.

### Proof and documents

48. As the maintainer, I want the score's sync proved by unit tests against the timeline, so that a note off its frame fails a test.
49. As the maintainer, I want the player proved against a recording fake audio context, so that every note, the fade and the close are asserted without sound.
50. As the maintainer, I want the provider's tune behaviour tested in its own split test file, as its other concerns are, so that each path of the welcome is proved to play what it should.
51. As the maintainer, I want to walk it live by ear in the shell on Windows and the Deck, so that what the tests can't hear is heard.
52. As the maintainer, I want a retune by ear to amend the handoff's score first, so that the score stays the spec.
53. As the maintainer, I want `COMPONENT-SPEC.md`'s Welcome splash section to point at the new handoff, so that the spec's map is complete.
54. As the maintainer, I want the glossary to hold **Welcome tune**, **Intro cue** and **Closing chord**, and the updated **Welcome splash**, **Welcome hold** and **Wordmark handoff** (done in the grill-me commit; kept true by the build).
55. As the maintainer, I want the checklist's step 45 and a dev-journal entry, so that the record is complete.
56. As the maintainer, I want the docblocks of `WelcomeProvider`, `WelcomeSplash.styles` and `main.ts`'s `openWindow` to say what they now do.
57. As the maintainer, I want CLAUDE.md untouched, since no domain, wire or rule changes and the tune is no network client.

## Implementation Decisions

- **One initiative** (log 62 Q1), step 45, `welcome-tune`: the tune and nothing else. It reopens log 55's _Sound: the handoff has none_ for the Welcome splash alone. Log 55 rules wherever log 62 doesn't say otherwise.
- **The spec** (Q2): `docs/handoff/handoff-welcome-tune/README.md` is the score: every note's time, pitch, length, voice and level, and the rules it keeps. `handoff-welcome-splash/` stays frozen.
- **Synthesised with Web Audio** (Q4): each note one `OscillatorNode` through its own `GainNode` envelope into one master `GainNode`, scheduled on the `AudioContext`'s clock. No audio file, no library.
- **The notes** (Q5), as the handoff's tables: landing plucks `F3` and `F4` on each F's `DROP_LANDING` frame (286ms, 436ms); ten letter plucks at `LETTER_START + i·LETTER_STEP` up `F4 G4 A4 C5 D5 F5 A5 C6 D6 F6`; a swell of `C6` and `F6` from `MARK_SWEEP_START` (1000ms), at its height at the mark sweep's middle (1350ms), silent by `INTRO_MS` (1950ms); the Closing chord `F2 C3 F3 A3 C4 F4` as bells at 0 for 1800ms.
- **Three voices** (Q6): _pluck_ (triangle, 5ms rise, exponential fall over its length); _bell_ (sine plus a sine an octave up at a quarter level, 10ms rise, exponential fall); _swell_ (sine, linear rise over 350ms, linear fall to silence at its end). No filters, reverb or noise. The voices live in the player; the notes name them.
- **Level** (Q7): one fixed master level, 0.3; the notes' levels relative to it; the summed peak under full scale. Not the player's `volumePreference`; no volume setting.
- **`welcomeTimeline`** (Q8), new, `src/App/`: the drop (`DROP_MS`, `DROP_DELAYS`, `DROP_LANDING = 0.55`), the letters (`LETTER_START`, `LETTER_STEP`, `LETTER_MS`), the sweeps (`MARK_SWEEP_START`, `MARK_SWEEP_MS`, `LETTER_SWEEP_START`, `LETTER_SWEEP_STEP`, `LETTER_SWEEP_MS`) and the clock (`INTRO_MS`, `HANDOFF_MS`, `STILL_INTRO_MS`, `STILL_HANDOFF_MS`, `SKIP_MS`). `WelcomeSplash.styles` interpolates them (the `drop` keyframe's landing step included) and `WelcomeProvider` builds its clocks from them. Nothing drawn changes.
- **`welcomeScore`** (Q9), new, pure data: `WelcomeVoice = 'pluck' | 'bell' | 'swell'`; `WelcomeNote { at, pitch, length, voice, level }` (`at` in ms from its cue's start, `pitch` a MIDI number, `level` 0 to 1 under the master); `INTRO_CUE` and `CLOSING_CHORD`, each `readonly WelcomeNote[]`, every time computed from the timeline.
- **`createWelcomeTune`** (Q9, Q15), new, the only code that touches Web Audio, a `create*` factory as `createImporter` and `createUpdates` are: `createWelcomeTune(): WelcomeTune` with `play(cue)` (schedule a cue's notes from now), `fadeOut(ms)` (ramp the master to 0 over `ms`, then close) and `finish()` (close once the last note played has died away). No `AudioContext`, or one that throws on construction, gives a silent tune whose every call does nothing. A suspended context is never resumed.
- **`useWelcomeTune`** (Q9 to Q14, Q17), new: `useWelcomeTune(phase, { played, reducedMotion })`, called once by `WelcomeProvider`, which already owns all three. Nothing unless `played`. On mount, the Intro cue unless `reducedMotion`; on `handoff`, the Closing chord; on `skipping`, `fadeOut(SKIP_MS)`; on `done`, `finish()`; on unmount, close at once. A skip from the hold reaches `skipping`, never `handoff`, so it plays no chord.
- **Anchoring** (Q11): each note at the context's `currentTime + at / 1000` when its cue is played. No output-latency compensation.
- **`WelcomeProvider`** (Q8, Q9): clocks from the timeline; calls `useWelcomeTune`. Its phases and `welcomeStep` are unchanged.
- **The shell** (Q16): `electron/main.ts`'s `webPreferences` spells `autoplayPolicy: 'no-user-gesture-required'`, with a line saying the Welcome tune and the player rely on it. Electron's default today, so behaviour is unchanged. Wiring, not a pure `electron/` unit.
- **No new domain, no route, no server change, no migration, no CSP change, no dependency, no asset, no Settings row** (Q1, Q4, Q20).
- **Names** (Q19): new **Welcome tune**, **Intro cue**, **Closing chord**; updated **Welcome splash**, **Welcome hold**, **Wordmark handoff**. Already in the glossary as of the grill-me commit.
- **Slices** (log 62, _Implementation Plan_):
  1. a chord that lands (`createWelcomeTune` with the bell voice, `stubAudioContext`, `useWelcomeTune` playing `CLOSING_CHORD` on `handoff` and finishing at `done`, the shell's `autoplayPolicy`, the `COMPONENT-SPEC.md` paragraph);
  2. the Intro cue (`welcomeTimeline` lifted with nothing drawn changed, the splash and provider on it; `INTRO_CUE` with the pluck and swell voices, played at the start);
  3. every path (a skip's fade, the silent hold, reduced motion's chord alone, silence where Web Audio is missing or refused);
  4. walk it live by ear, then the documents (Q20).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or a listener would get: the notes a cue holds and when, the oscillators started at which frequency and time, the gain ramps, when the context closes. It never asserts which helper ran or the order of internal calls, and it never asserts by ear; the live walk is the ear.
- **`welcomeTimeline`**: the intro outlasts the last letter's sweep (`LETTER_SWEEP_START + 9·LETTER_SWEEP_STEP + LETTER_SWEEP_MS <= INTRO_MS`), the rule `INTRO_MS`'s docblock states today. Prior art: the pure units' tests beside it in `src/App/` (`welcomeStep`).
- **`welcomeScore`**: each landing pluck on its F's `DROP_DELAYS[i] + DROP_LANDING·DROP_MS`; each of the ten letter plucks on its letter's start; the swell from `MARK_SWEEP_START`, peaking at the mark sweep's middle, ending by `INTRO_MS`; every Intro cue note ended by `INTRO_MS`; the chord at 0; the summed peak (a bell counting its octave) times the master level under full scale; every pitch in F major. Prior art: other pure data/table tests.
- **`createWelcomeTune`**, against a new `src/test-support/stubAudioContext/`, a recording fake `AudioContext` in the `stubMediaElement` pattern: each note an oscillator of its voice's wave at its pitch's frequency, started at `currentTime + at/1000`; the bell's octave partial; `fadeOut` ramping the master to 0 over its ms and closing after; `finish` closing after the last note's end; a missing constructor and a throwing one each giving a silent tune whose calls don't throw. Prior art: `stubMediaElement` and the player hook tests that use it.
- **`WelcomeProvider.tune.test.tsx`**, the provider's tests split by concern as today: a Cold start plays the Intro cue; the handoff plays the chord, held or not; a skip fades with no chord, from the intro and from the hold; reduced motion plays the chord alone at the reduced handoff; no welcome (reload, deep link) makes no context. Prior art: `WelcomeProvider.intro`, `.holdAndSkip`, `.handoff` and `.reducedMotion` tests with `advanceClock`.
- **The splash and provider's existing tests stay green** across the timeline's lift, proving nothing drawn changed. `App.welcomeSplashSpec.test.ts` included.
- **`useWelcomeTune`** gets its own test only for what the provider test can't reach; the provider test is the main proof of the wiring.
- **The shell**: the `autoplayPolicy` option is wiring in `main.ts` and is proved by the live walk, not a unit test (Q16).
- **Live walk** (slice 4): in the shell, on Windows and the Deck: a cold start on Movies and on Series, a skip by click and by key, a held start, a reload (silent), reduced motion.

## Out of Scope

- A mute control or volume setting (Q1); the checklist puts it later.
- Sound anywhere else: the Start-up splash, a reload, snackbars, the player's chrome (Q1, Q17).
- Following the player's `volumePreference` (Q7).
- A recorded, licensed or library-made tune (Q4).
- Resuming a suspended context on a skip's gesture (Q15).
- Compensating for output latency (Q11).
- Amending the frozen splash prototype (Q2).

## Further Notes

- The trade-off is accepted: every cold start makes a sound, with no way to turn it off short of the system's volume, until a mute control is its own step; a browser tab is silent, so a developer hears the tune only in the shell; the welcome's numbers now live in a module of their own rather than beside the rules that use them.
- The maintainer approved every recommendation of log 62 in advance; this PRD adds no decision the log doesn't hold.
