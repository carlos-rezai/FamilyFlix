import { describe, expect, it } from 'vitest';

import {
  DROP_DELAYS,
  DROP_LANDING,
  DROP_MS,
  INTRO_MS,
  LETTER_START,
  LETTER_STEP,
  MARK_SWEEP_MS,
  MARK_SWEEP_START,
} from '@/App/welcomeTimeline/welcomeTimeline';

import { CLOSING_CHORD, INTRO_CUE, type WelcomeNote } from './welcomeScore';

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

/**
 * 62, Welcome tune, Phase 3 (issue #596): the **Intro cue** in the score,
 * every time read off the welcome's timeline. F3 and F4 plucks on each F's
 * landing (400ms, 0.8); ten letter plucks on each letter's start up F4 G4 A4
 * C5 D5 F5 A5 C6 D6 F6 (200ms, 0.35); a swell of C6 and F6 from the mark
 * sweep's start, at its height at the sweep's middle, died away by the
 * intro's end (0.25). The summed peak is proved through the player, in
 * `createWelcomeTune.test.ts`, where the voices' shapes live.
 */

/** F3 on the first F's landing, F4 on the accent one's. */
const LANDING_PITCHES = [53, 65];

/** F4 G4 A4 C5 D5 F5 A5 C6 D6 F6, one per letter of _FamilyFlix_. */
const LETTER_PITCHES = [65, 67, 69, 72, 74, 77, 81, 84, 86, 89];

/** C6 and F6. */
const SWELL_PITCHES = [84, 89];

/** A swell rises linearly for 350ms, then falls to silence (log 62 Q6). */
const SWELL_RISE = 350;

const landingAt = (i: 0 | 1) => DROP_DELAYS[i] + DROP_LANDING * DROP_MS;

const plucks = () => INTRO_CUE.filter((note) => note.voice === 'pluck');
const landingPlucks = () =>
  plucks()
    .filter((note) => note.at < LETTER_START)
    .sort((a, b) => a.at - b.at);
const letterPlucks = () =>
  plucks()
    .filter((note) => note.at >= LETTER_START)
    .sort((a, b) => a.at - b.at);
const swells = () => INTRO_CUE.filter((note) => note.voice === 'swell');

describe('welcomeScore: INTRO_CUE', () => {
  it('holds two landing plucks, ten letter plucks and two swell notes, nothing else', () => {
    expect(landingPlucks()).toHaveLength(2);
    expect(letterPlucks()).toHaveLength(10);
    expect(swells()).toHaveLength(2);
    expect(INTRO_CUE).toHaveLength(14);
  });

  it('plucks F3 and F4 each on its F’s landing frame, 400ms at 0.8', () => {
    expect(landingPlucks()).toEqual([
      {
        at: landingAt(0),
        pitch: LANDING_PITCHES[0],
        length: 400,
        voice: 'pluck',
        level: 0.8,
      },
      {
        at: landingAt(1),
        pitch: LANDING_PITCHES[1],
        length: 400,
        voice: 'pluck',
        level: 0.8,
      },
    ]);
    expect(landingPlucks().map((note) => note.at)).toEqual([286, 436]);
  });

  it('plucks each of the ten letters on its start, up F4 to F6, 200ms at 0.35', () => {
    expect(letterPlucks()).toEqual(
      LETTER_PITCHES.map((pitch, i) => ({
        at: LETTER_START + i * LETTER_STEP,
        pitch,
        length: 200,
        voice: 'pluck',
        level: 0.35,
      }))
    );
  });

  it('ends the run on F6 with the last letter of Flix', () => {
    const last = letterPlucks()[9];

    expect(last.pitch).toBe(89);
    expect(last.at).toBe(LETTER_START + 9 * LETTER_STEP);
  });

  it('swells C6 and F6 from the mark sweep’s start, at its height mid-sweep, ended by the intro’s end', () => {
    expect(
      swells()
        .map((note) => note.pitch)
        .sort((a, b) => a - b)
    ).toEqual(SWELL_PITCHES);
    for (const note of swells()) {
      expect(note.at).toBe(MARK_SWEEP_START);
      expect(note.at + SWELL_RISE).toBe(MARK_SWEEP_START + MARK_SWEEP_MS / 2);
      expect(note.at + note.length).toBeGreaterThan(note.at + SWELL_RISE);
      expect(note.at + note.length).toBeLessThanOrEqual(INTRO_MS);
      expect(note.level).toBe(0.25);
    }
  });

  it('ends every note by the intro’s end', () => {
    for (const note of INTRO_CUE) {
      expect(note.at).toBeGreaterThanOrEqual(0);
      expect(note.at + note.length).toBeLessThanOrEqual(INTRO_MS);
    }
  });

  it('keeps every pitch in F major', () => {
    for (const { pitch } of INTRO_CUE) {
      expect(F_MAJOR.has(pitch % 12)).toBe(true);
    }
  });
});
