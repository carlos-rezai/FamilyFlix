/**
 * The **Welcome tune**'s score, pure data: what the player sounds, note for
 * note (`docs/handoff/handoff-welcome-tune/README.md`).
 */

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
