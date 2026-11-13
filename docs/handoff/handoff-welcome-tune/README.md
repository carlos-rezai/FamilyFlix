# Welcome tune: handoff

Step 45, design log `docs/design-logs/62-welcome-tune.md`. A tune has no
picture, so this README is its prototype: the score the **Welcome tune** is
built to, note for note. It plays with the **Welcome splash** of
`docs/handoff/handoff-welcome-splash/` (option 2a), which stays frozen as
received; the times below are ours (`src/App/welcomeTimeline/`), not that
prototype's 1750ms intro. Where this README and the log differ, the log rules.
A retune by ear amends this score first.

## When it plays

- **With the Welcome splash, and only then**: a **Cold start** on the
  **Launch entry**. A reload, a deep link, the **Start-up splash** and a
  **Slow start**'s tile are silent.
- **Two cues.** The **Intro cue** from the welcome's start; the **Closing
  chord** when the **Wordmark handoff** starts, whenever that is. The
  **Welcome hold** is silent between them.
- **A skip** fades whatever is sounding to silence over 150ms; a skip never
  plays the chord.
- **Reduced motion**: the Closing chord alone, at the reduced handoff's start
  (900ms). No Intro cue: the motion it marks isn't drawn.
- **No sound to be had** (no Web Audio, no device, a browser tab before any
  gesture): silence, the welcome unchanged.
- **No mute control** for now; the system's volume rules.

## Voices

Every note is one oscillator through its own envelope into one master gain at
**0.3**, and the master through one lowpass filter at **4700Hz** (Q 0.5) that
softens the tune's top.

| Voice | Wave                                        | Rise          | Fall                               |
| ----- | ------------------------------------------- | ------------- | ---------------------------------- |
| pluck | sine                                        | 12ms          | exponential, to silence by its end |
| bell  | sine, plus a sine an octave up at 0.1 level | 80ms          | exponential, to silence by its end |
| swell | sine                                        | linear, 350ms | linear, to silence by its end      |

Retuned by ear in the live walk (issue 600), from a triangle pluck at 5ms, a
bell at 10ms with its octave at a quarter, no filter, and the chord below
from F2.

## The Intro cue (ms from the welcome's start)

| What it marks           | At         | Notes (pitch, MIDI)                                                               | Length | Voice | Level |
| ----------------------- | ---------- | --------------------------------------------------------------------------------- | ------ | ----- | ----- |
| F1 lands (`drop` 55%)   | 286        | F3 (53)                                                                           | 400    | pluck | 0.8   |
| F2 lands                | 436        | F4 (65)                                                                           | 400    | pluck | 0.8   |
| Letter i rises (0 to 9) | 520 + i·40 | _Family_ F4 G4 A4 B♭4 C5 D5 (65 67 69 70 72 74), _Flix_ E5 F5 G5 A5 (76 77 79 81) | 200    | pluck | 0.3   |
| The light sweeps        | 1000       | C6 and F6 (84, 89), at their height at 1350, the mark sweep's middle              | 950    | swell | 0.13  |

Every Intro cue note has died away by 1950ms, the **Welcome intro**'s end.

## The Closing chord (ms from the Wordmark handoff's start)

| What it marks            | At  | Notes (pitch, MIDI)                   | Length | Voice | Level |
| ------------------------ | --- | ------------------------------------- | ------ | ----- | ----- |
| The wordmark glides home | 0   | C3 F3 A3 C4 F4 A4 (48 53 57 60 65 69) | 2600   | bell  | 0.3   |

The chord outlives the 500ms handoff and rings on under the home; the tune's
context closes once it has died away.

## Rules the score keeps

- Each time above is computed from the welcome's timeline (`DROP_DELAYS`,
  `DROP_LANDING`, `LETTER_START`, `LETTER_STEP`, `MARK_SWEEP_START`,
  `INTRO_MS`), never typed as a number of its own.
- At no instant do the levels sounding, a bell counting its octave, times the
  master level, reach full scale.
- Everything is in F major, as the mark: the two Fs land on F, the run climbs
  the F major scale, the chord is F.
