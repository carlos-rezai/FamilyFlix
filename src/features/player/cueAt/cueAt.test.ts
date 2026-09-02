import { describe, expect, it } from 'vitest';

import type { Cue } from '@/types';

import { cueAt } from './cueAt';

/**
 * 10 — Video player, Phase 6: "subtitles" (issue #88).
 *
 * The line on screen right now. `cueAt` is handed a **Cue list** and an
 * **Absolute position** and answers the one **Cue** that covers it, or `null` —
 * which is what the **Subtitle overlay** draws as no box at all.
 *
 * It is a pure function of a position, and that is the whole design: cues are
 * stamped in absolute position and looked up by absolute position, so there is
 * no cursor to advance, nothing to reset, and **a scrub cannot desync them**.
 * A native `<track>` is timed against **Element time**, which on a stream path
 * is short by the **Stream offset**; every test below that jumps around the
 * film is asserting the property that makes ours immune to that.
 */
const CUES: Cue[] = [
  { start: 1, end: 4, text: '— You can see the whole coast from up here.' },
  { start: 5.5, end: 8.25, text: 'It was worth the walk.' },
  { start: 3600, end: 3604, text: 'An hour later.' },
];

describe('cueAt', () => {
  it('answers the cue covering the position', () => {
    expect(cueAt(CUES, 2)).toEqual(CUES[0]);
    expect(cueAt(CUES, 6)).toEqual(CUES[1]);
  });

  it('answers the cue that has just begun, at its own start', () => {
    // The boundary a line appears on. Excluded, a cue would be a frame late
    // every single time.
    expect(cueAt(CUES, 1)).toEqual(CUES[0]);
  });

  it('lets a cue go at its end rather than holding it a moment longer', () => {
    // `start <= t < end`. Inclusive at both ends, two adjacent cues would both
    // be true on the instant they meet, and the box would flicker between them.
    expect(cueAt(CUES, 4)).toBeNull();
  });

  it('answers nothing during a stretch with no dialogue', () => {
    // The state the player is in for most of a film, and the one that must draw
    // no box rather than an empty one hovering over the picture.
    expect(cueAt(CUES, 4.5)).toBeNull();
  });

  it('answers nothing before the first line and after the last', () => {
    expect(cueAt(CUES, 0)).toBeNull();
    expect(cueAt(CUES, 7200)).toBeNull();
  });

  it('answers nothing for a film with no cues at all', () => {
    expect(cueAt([], 12)).toBeNull();
  });

  it('answers the right line for a position anywhere in the film, in any order', () => {
    // What a scrub is: the position jumps, and the answer is a function of the
    // new position alone. No cursor, nothing to rewind, nothing that has to
    // have been asked in order first.
    expect(cueAt(CUES, 3601)).toEqual(CUES[2]);
    expect(cueAt(CUES, 2)).toEqual(CUES[0]);
    expect(cueAt(CUES, 3601)).toEqual(CUES[2]);
  });

  it('answers the same line for the same position however it was reached', () => {
    // Stated as an equality because it is the property the whole subtitle
    // design rests on: absolute position in, cue out, and no memory in between.
    const jumpedTo = cueAt(CUES, 6);
    const arrivedAt = [0, 1, 2, 3, 4, 5, 6].reduce<Cue | null>(
      (_, second) => cueAt(CUES, second),
      null
    );

    expect(jumpedTo).toEqual(arrivedAt);
  });

  it('answers the first cue covering a position when two overlap', () => {
    // Hand-authored files do overlap. One box draws one line, and taking the
    // earlier one keeps the answer deterministic rather than whichever the
    // scan happened to reach last.
    const overlapping: Cue[] = [
      { start: 1, end: 6, text: 'The first speaker.' },
      { start: 4, end: 8, text: 'The second, interrupting.' },
    ];

    expect(cueAt(overlapping, 5)).toEqual(overlapping[0]);
  });
});
