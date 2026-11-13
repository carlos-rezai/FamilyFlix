import { describe, expect, it } from 'vitest';

import { CLOSING_CHORD, type WelcomeNote } from './welcomeScore';

/**
 * 62, Welcome tune, Phase 1 (issue #594): the **Closing chord** in the score.
 * F2 C3 F3 A3 C4 F4 as bells, struck together at the cue's start and rung for
 * 1800ms, each at 0.3 under the master; every pitch in F major, and the chord
 * at its loudest, a bell counting its octave partial at a quarter, still under
 * full scale once the master's 0.3 is applied.
 */

/** The fixed master level every note sounds under (log 62 Q7). */
const MASTER_LEVEL = 0.3;

/** A bell's octave partial sounds at a quarter of its note's level. */
const BELL_OCTAVE = 0.25;

/** MIDI numbers: F2 C3 F3 A3 C4 F4. */
const CHORD_PITCHES = [41, 48, 53, 57, 60, 65];

/** F major's pitch classes: F G A B♭ C D E. */
const F_MAJOR = new Set([5, 7, 9, 10, 0, 2, 4]);

const peakOf = (note: WelcomeNote) =>
  note.level * (note.voice === 'bell' ? 1 + BELL_OCTAVE : 1);

describe('welcomeScore: CLOSING_CHORD', () => {
  it('holds F2 C3 F3 A3 C4 F4', () => {
    expect(
      CLOSING_CHORD.map((note) => note.pitch).sort((a, b) => a - b)
    ).toEqual(CHORD_PITCHES);
  });

  it('strikes every note at 0, rings it 1800ms, as a bell at 0.3', () => {
    for (const note of CLOSING_CHORD) {
      expect(note).toEqual({
        at: 0,
        pitch: note.pitch,
        length: 1800,
        voice: 'bell',
        level: 0.3,
      });
    }
  });

  it('keeps every pitch in F major', () => {
    for (const { pitch } of CLOSING_CHORD) {
      expect(F_MAJOR.has(pitch % 12)).toBe(true);
    }
  });

  it('peaks under full scale, octaves counted, through the master', () => {
    const summed = CLOSING_CHORD.reduce((sum, note) => sum + peakOf(note), 0);

    expect(summed * MASTER_LEVEL).toBeLessThan(1);
  });
});
