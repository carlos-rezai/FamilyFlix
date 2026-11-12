# Plan: Welcome tune, a tune in sync with the Welcome splash

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/593

The **Welcome splash** plays the **Welcome tune**, synthesised with Web Audio
from a score in the code: the **Intro cue** from the welcome's start, the
**Closing chord** when the **Wordmark handoff** starts, silence on the
**Welcome hold**, a 150ms fade on a skip, the chord alone under reduced
motion, and silence wherever there is no sound to be had. Every note's time
is computed from one timeline the splash's styles and the provider's clocks
read too. The score is `docs/handoff/handoff-welcome-tune/README.md`.

## Running the phases

**Phases 1 to 6 and 8 are AFK and run under `issue-loop`, in order. Phase 7
is HITL:** it is a walk by ear in the shell, which no test can do. No phase
changes what is drawn, no phase amends a prototype, and no decision is left
open (the maintainer approved every recommendation of log 62 in advance;
this plan adds none). Every note, voice, level and rule a phase needs is in
the handoff's score.

- The phases are log 62's _Implementation Plan_ slices, three of them
  thinned: slice 2 into the timeline's lift (phase 2) and the Intro cue
  (phase 3); slice 3 into a skip (phase 4), reduced motion (phase 5) and a
  refused context (phase 6); slice 4 into the walk (phase 7) and the
  documents (phase 8).
- **One move ahead of the log:** phase 1 already gives a silent tune where
  there is no `AudioContext` at all (story 29). jsdom has none, and every
  existing `WelcomeProvider` test would break the moment the hook is wired
  in without it. Phase 6 keeps the throwing constructor and the suspended
  context.
- **Each phase starts from its own RED test**, except phase 2 (a lift
  proved by the splash's and provider's tests staying green, plus the
  timeline's rule test), phase 7 (the ear) and phase 8 (its checklist and a
  green suite).
- No test makes a sound: the player is proved against
  `src/test-support/stubAudioContext/`, the provider with `advanceClock`.
- **The splash's and provider's existing tests stay green after every
  phase**, `App.welcomeSplashSpec.test.ts` among them.
- The glossary already holds log 62's terms. The feature checklist's step
  45 row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes, schema, server**: none. No migration, no route, no server
  change, no CSP change, no dependency, no audio asset, no Settings row.
  The tune touches no network and no file.
- **Where it lives**: three new units beside the welcome in `src/App/`,
  plus `welcomeTimeline` there too. Test support in
  `src/test-support/stubAudioContext/`, never imported by shipping code.
- **Key models**:
  - `welcomeTimeline`: the drop (`DROP_MS` 520, `DROP_DELAYS`,
    `DROP_LANDING = 0.55`), the letters (`LETTER_START` 520, `LETTER_STEP`
    40, `LETTER_MS` 420), the sweeps (`MARK_SWEEP_START` 1000,
    `MARK_SWEEP_MS` 700, `LETTER_SWEEP_START` 1150, `LETTER_SWEEP_STEP` 45,
    `LETTER_SWEEP_MS` 380) and the clock (`INTRO_MS` 1950, `HANDOFF_MS`
    500, `STILL_INTRO_MS` 900, `STILL_HANDOFF_MS` 400, `SKIP_MS` 150).
    `WelcomeSplash.styles` and `WelcomeProvider` read it; nothing drawn
    changes.
  - `welcomeScore`, pure data: `WelcomeVoice = 'pluck' | 'bell' | 'swell'`;
    `WelcomeNote { at, pitch, length, voice, level }` (`at` in ms from its
    cue's start, `pitch` a MIDI number, `level` 0 to 1 under the master);
    `INTRO_CUE` and `CLOSING_CHORD`, each `readonly WelcomeNote[]`, every
    time computed from the timeline.
  - `createWelcomeTune(): WelcomeTune`, the only code that touches Web
    Audio: `play(cue)` schedules a cue's notes from now, `fadeOut(ms)` ramps
    the master to 0 over `ms` then closes, `finish()` closes once the last
    note played has died away; plus an immediate close for unmount. No
    `AudioContext`, or one that throws, gives a silent tune whose every call
    does nothing. A suspended context is never resumed.
  - `useWelcomeTune(phase, { played, reducedMotion })`, called once by
    `WelcomeProvider`: nothing unless `played`; on mount the Intro cue unless
    `reducedMotion`; on `handoff` the Closing chord; on `skipping`
    `fadeOut(SKIP_MS)`; on `done` `finish()`; on unmount close at once.
    `WelcomeProvider`'s phases and `welcomeStep` are unchanged.
- **The rules**:
  - Each note at the context's `currentTime + at / 1000` when its cue is
    played. No output-latency compensation.
  - Each note one `OscillatorNode` through its own `GainNode` envelope into
    one master `GainNode` at 0.3. Pluck: triangle, 5ms rise, exponential
    fall. Bell: sine plus a sine an octave up at ¼ level, 10ms rise,
    exponential fall. Swell: sine, linear 350ms rise, linear fall to silence
    at its end. No filters, reverb or noise.
  - The summed levels sounding at any instant (a bell counting its octave)
    times the master stay under full scale. Every pitch is in F major.
  - Not the player's `volumePreference`; no mute control.
  - The shell's `webPreferences` spells `autoplayPolicy:
'no-user-gesture-required'` with a line saying the Welcome tune and the
    player rely on it (Electron's default today; behaviour unchanged).

---

## Phase 1: A chord that lands

**User stories**: 1, 8 to 17, 19, 20, 29, 32, 39 to 47, 49, 50 (the chord's
paths), 53

### What to build

`createWelcomeTune` with the bell voice and the master gain, against a new
recording fake `stubAudioContext` in the `stubMediaElement` pattern.
`welcomeScore` starts with `CLOSING_CHORD` (F2 C3 F3 A3 C4 F4 as bells at 0
for 1800ms, level 0.3). `useWelcomeTune` plays the chord on `handoff`,
finishes at `done` (the context closing once the chord has died away) and
closes at once on unmount; it does nothing unless the welcome was `played`.
No `AudioContext` in the window gives a silent tune, so jsdom and every
existing provider test run as before. `WelcomeProvider` calls the hook once.
The shell's `openWindow` spells `autoplayPolicy`. `COMPONENT-SPEC.md`'s
Welcome splash section points at `handoff-welcome-tune/`. Demo: a cold
start in the shell ends on an F major chord as the wordmark glides home,
ringing on under the home.

### Acceptance criteria

- [ ] `CLOSING_CHORD` holds the six pitches at 0, 1800ms, bell, 0.3; every
      pitch in F major; its summed peak (octaves counted) times 0.3 under
      full scale.
- [ ] `play(CLOSING_CHORD)`: each note a sine at its pitch's frequency plus
      a sine an octave up at ¼ level, started at `currentTime`, with a
      10ms rise and an exponential fall to its end, into a master at 0.3.
- [ ] `finish()` closes the context after the last note's end, not before.
- [ ] No `AudioContext` constructor gives a tune whose `play`, `fadeOut`,
      `finish` and close do nothing and don't throw.
- [ ] `WelcomeProvider.tune.test.tsx`: a Cold start's handoff plays the
      chord, straight after the intro and after a hold alike; `done`
      finishes; an unmount closes at once.
- [ ] A reload and a deep link (no welcome played) make no context.
- [ ] `openWindow`'s `webPreferences` holds `autoplayPolicy:
'no-user-gesture-required'` with its line.
- [ ] `COMPONENT-SPEC.md`'s Welcome splash section names the new handoff.
- [ ] Every existing splash and provider test stays green.

---

## Phase 2: The welcome's timeline lifted

**User stories**: 33 to 35, 37, 38

### What to build

`welcomeTimeline` gathers every number of the welcome: the drop (its
landing step included), the letters, the sweeps and the clock.
`WelcomeSplash.styles` interpolates them in place of its literals, the
`drop` keyframe's 55% step among them; `WelcomeProvider` builds `CLOCK`
and `STILL_CLOCK` from them and drops its own constants. `INTRO_MS`'s
docblock rule moves to the timeline and gains a test. Nothing drawn
changes. Demo: the welcome looks exactly as before.

### Acceptance criteria

- [ ] The timeline's test holds `LETTER_SWEEP_START + 9·LETTER_SWEEP_STEP +
LETTER_SWEEP_MS <= INTRO_MS`.
- [ ] No timing literal of the welcome remains in `WelcomeSplash.styles`
      or `WelcomeProvider`; the drop keyframe's landing step reads
      `DROP_LANDING`.
- [ ] The splash's, the provider's and `App.welcomeSplashSpec` tests stay
      green unchanged.

---

## Phase 3: The Intro cue

**User stories**: 2 to 7, 10, 36, 40, 48, 50 (the intro's path)

### What to build

`INTRO_CUE` joins the score, every time computed from the timeline: F3 and
F4 plucks on each F's `DROP_DELAYS[i] + DROP_LANDING·DROP_MS` (286, 436ms,
400ms, 0.8); ten letter plucks at `LETTER_START + i·LETTER_STEP` up F4 G4
A4 C5 D5 F5 A5 C6 D6 F6 (200ms, 0.35); a swell of C6 and F6 from
`MARK_SWEEP_START`, at its height at the mark sweep's middle, silent by
`INTRO_MS` (0.25). The player gains the pluck and swell voices.
`useWelcomeTune` plays the Intro cue on mount. Demo: in the shell, the Fs'
landings, the rising run and the shine are heard on their frames, then the
chord.

### Acceptance criteria

- [ ] Each landing pluck sits on its F's landing frame from the timeline.
- [ ] Each of the ten letter plucks sits on its letter's start; the run
      ends on F6 with the last letter of _Flix_.
- [ ] The swell starts at `MARK_SWEEP_START`, peaks at `MARK_SWEEP_START +
MARK_SWEEP_MS / 2` and ends by `INTRO_MS`.
- [ ] Every Intro cue note ends by `INTRO_MS`; every pitch is in F major;
      the summed peak times the master stays under full scale.
- [ ] Pluck: a triangle with a 5ms rise and an exponential fall; swell: a
      sine with a linear 350ms rise and a linear fall to silence at its end;
      each started at `currentTime + at / 1000`.
- [ ] A Cold start plays the Intro cue from the welcome's start, then the
      chord at the handoff.

---

## Phase 4: A skip fades, and the hold is silent

**User stories**: 18, 21 to 25

### What to build

`fadeOut(ms)` ramps the master to 0 over `ms` and closes the context after.
`useWelcomeTune` calls `fadeOut(SKIP_MS)` on `skipping`. A skip from the
intro or the hold reaches `skipping`, never `handoff`, so it plays no
chord; a skip during the glide fades the ringing chord. The hold plays
nothing. Demo: a key pressed mid-run cuts the tune to silence with the
picture.

### Acceptance criteria

- [ ] `fadeOut(150)` ramps the master from its level to 0 over 150ms and
      closes after.
- [ ] A skip by click and by key during the intro fades, and no chord is
      played.
- [ ] A skip during the hold fades and plays no chord.
- [ ] A skip during the handoff fades the chord.
- [ ] A welcome holding for the home schedules nothing between the Intro
      cue and the chord.

---

## Phase 5: Reduced motion plays the chord alone

**User stories**: 26, 27

### What to build

Under reduced motion `useWelcomeTune` plays no Intro cue, and the Closing
chord comes at the reduced handoff's start (`STILL_INTRO_MS`, 900ms). A
skip still fades.

### Acceptance criteria

- [ ] Reduced motion schedules no Intro cue note.
- [ ] The chord is played when the reduced handoff starts, at 900ms.
- [ ] A skip under reduced motion fades and plays no chord.

---

## Phase 6: A refused context stays silent

**User stories**: 28, 30, 31

### What to build

An `AudioContext` constructor that throws (no audio device on Linux) gives
the same silent tune as a missing one. A context the browser keeps
suspended is never resumed: the tune schedules into it and stays silent.
The welcome runs unchanged in both.

### Acceptance criteria

- [ ] A throwing constructor gives a tune whose calls do nothing and don't
      throw.
- [ ] A Cold start whose context throws plays the welcome through to
      `done` unchanged.
- [ ] A suspended context is never `resume()`d, on a skip or otherwise.

---

## Phase 7: Walk it live, by ear (HITL)

**User stories**: 51, 52

### What to build

The maintainer walks the tune in the shell on Windows and on the Deck: a
cold start on Movies and on Series, a skip by click and by key, a held
start, a reload (silent) and reduced motion. A retune by ear amends the
handoff's score first, then the score data to match, its tests still green.

### Acceptance criteria

- [ ] Each walked path sounds as the score says, on Windows and the Deck.
- [ ] Any retune is in `handoff-welcome-tune/README.md` before the code.
- [ ] No crackle at the chord on the TV's speakers.

---

## Phase 8: The documents

**User stories**: 54 to 57

### What to build

The docblocks of `WelcomeProvider`, `WelcomeSplash.styles` and `main.ts`'s
`openWindow` say what they now do, naming the **Welcome tune**, the
**Intro cue** and the **Closing chord**. The feature checklist's step 45
row is written to what was built and stays 🔜 until the refactor. The dev
journal gains this step's entry. The glossary is checked against what was
built. CLAUDE.md is untouched. No em dash in any prose.

### Acceptance criteria

- [ ] Every listed docblock describes its unit's current behaviour.
- [ ] Step 45's row in `docs/feature-checklist.md` describes the build and
      stays 🔜.
- [ ] `docs/dev-journal.md` has a step 45 entry.
- [ ] `docs/ubiquitous-language.md` holds **Welcome tune**, **Intro cue**
      and **Closing chord**, and its **Welcome splash**, **Welcome hold**
      and **Wordmark handoff** match the build.
- [ ] CLAUDE.md is unchanged.
- [ ] The full suite is green.
