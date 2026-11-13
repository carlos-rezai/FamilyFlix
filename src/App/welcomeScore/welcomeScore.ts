/**
 * The **Welcome tune**'s score, pure data: what the player sounds, note for
 * note (`docs/handoff/handoff-welcome-tune/README.md`).
 */

import {
  DROP_DELAYS,
  DROP_LANDING,
  DROP_MS,
  LETTER_START,
  LETTER_STEP,
  MARK_SWEEP_MS,
  MARK_SWEEP_START,
} from '@/App/welcomeTimeline/welcomeTimeline';

/** How a note sounds; the voices live in the player (log 62 Q6). */
export type WelcomeVoice = 'pluck' | 'bell' | 'swell';

export interface WelcomeNote {
  /** When it is struck, in ms from its cue's start. */
  at: number;
  /** A MIDI number. */
  pitch: number;
  /** How long it sounds, in ms. */
  length: number;
  voice: WelcomeVoice;
  /** 0 to 1, under the master. */
  level: number;
}

/** The chord's notes: F2 C3 F3 A3 C4 F4. */
const CHORD_PITCHES = [41, 48, 53, 57, 60, 65];

/** The chord rings on under the home, past the 500ms handoff. */
const CHORD_MS = 1800;

/**
 * The **Closing chord**: F major as bells, struck together at the
 * **Wordmark handoff**'s start.
 */
export const CLOSING_CHORD: readonly WelcomeNote[] = CHORD_PITCHES.map(
  (pitch) => ({ at: 0, pitch, length: CHORD_MS, voice: 'bell', level: 0.3 })
);

/** F3 on the first F's landing, F4 on the accent one's. */
const LANDING_PITCHES = [53, 65];

/** F4 G4 A4 C5 D5 F5 A5 C6 D6 F6, one per letter of _FamilyFlix_. */
const LETTER_PITCHES = [65, 67, 69, 72, 74, 77, 81, 84, 86, 89];

/** C6 and F6. */
const SWELL_PITCHES = [84, 89];

/** A swell's rise, in ms: it peaks at the mark sweep's middle (log 62 Q6). */
const SWELL_RISE_MS = 350;

/** The swell dies away 900ms after it starts, before the intro's end. */
const SWELL_MS = 900;

/**
 * The **Intro cue**: a pluck on each F's landing, one per letter as it
 * rises, and a swell under the mark sweep, every time read off the
 * welcome's timeline.
 */
export const INTRO_CUE: readonly WelcomeNote[] = [
  ...LANDING_PITCHES.map(
    (pitch, i): WelcomeNote => ({
      at: DROP_DELAYS[i] + Math.round(DROP_LANDING * DROP_MS),
      pitch,
      length: 400,
      voice: 'pluck',
      level: 0.8,
    })
  ),
  ...LETTER_PITCHES.map(
    (pitch, i): WelcomeNote => ({
      at: LETTER_START + i * LETTER_STEP,
      pitch,
      length: 200,
      voice: 'pluck',
      level: 0.35,
    })
  ),
  ...SWELL_PITCHES.map(
    (pitch): WelcomeNote => ({
      at: MARK_SWEEP_START + MARK_SWEEP_MS / 2 - SWELL_RISE_MS,
      pitch,
      length: SWELL_MS,
      voice: 'swell',
      level: 0.25,
    })
  ),
];
