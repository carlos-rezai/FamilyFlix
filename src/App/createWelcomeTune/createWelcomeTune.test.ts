import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  levelAt,
  stubAudioContext,
  type FakeAudioContext,
  type FakeOscillatorNode,
} from '@/test-support/stubAudioContext/stubAudioContext';
import {
  CLOSING_CHORD,
  INTRO_CUE,
  type WelcomeNote,
} from '@/App/welcomeScore/welcomeScore';
import { INTRO_MS } from '@/App/welcomeTimeline/welcomeTimeline';

import { createWelcomeTune } from './createWelcomeTune';

/**
 * 62, Welcome tune, Phase 1 (issue #594): the player, with the bell voice.
 *
 * `play(CLOSING_CHORD)` strikes every note from the context's `currentTime`:
 * a sine at its pitch's frequency and one an octave up at a quarter of its
 * level, rising in 10ms and falling exponentially to its end, every one into
 * one master gain at 0.3. `finish()` closes the context once the last note
 * has died away, never before. With no `AudioContext` in the window the tune
 * is silent: every call does nothing, and none throws.
 *
 * Asserted as a listener would hear it: what reaches the destination, from
 * which oscillator, how loud and when (`levelAt`), never which calls ran.
 */

/** Where the stubbed context's clock stands when the tune is made, in s. */
const NOW = 12.5;

/** The master level and a bell's octave partial (log 62 Q6, Q7). */
const MASTER = 0.3;
const OCTAVE_LEVEL = 0.25;

/** The bell's rise, and the chord's length, in s. */
const RISE = 0.01;
const LENGTH = 1.8;

const hz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

describe('createWelcomeTune: the Closing chord', () => {
  const audio = stubAudioContext({ startTime: NOW });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function onlyContext(): FakeAudioContext {
    const made = audio.contexts();
    expect(made).toHaveLength(1);
    return made[0];
  }

  function playChord() {
    const tune = createWelcomeTune();
    tune.play(CLOSING_CHORD);
    const context = onlyContext();
    return { tune, context, oscillators: context.oscillators };
  }

  const peakOf = (oscillator: FakeOscillatorNode) =>
    levelAt(oscillator, NOW + RISE);

  it('sounds every note as a sine at its pitch and a sine an octave up', () => {
    const { oscillators } = playChord();

    expect(oscillators).toHaveLength(CLOSING_CHORD.length * 2);
    for (const oscillator of oscillators) {
      expect(oscillator.type).toBe('sine');
    }

    const heard = oscillators
      .map((oscillator) => oscillator.frequency.valueAt(NOW))
      .sort((a, b) => a - b);
    const expected = CLOSING_CHORD.flatMap(({ pitch }) => [
      hz(pitch),
      2 * hz(pitch),
    ]).sort((a, b) => a - b);
    heard.forEach((frequency, i) =>
      expect(frequency).toBeCloseTo(expected[i], 3)
    );
  });

  it('starts every oscillator at the context’s currentTime and sounds it to the note’s end', () => {
    const { oscillators } = playChord();

    for (const oscillator of oscillators) {
      expect(oscillator.startedAt).toBeCloseTo(NOW, 6);
      expect(levelAt(oscillator, NOW + LENGTH - 0.001)).toBeGreaterThan(0);
    }
  });

  it('peaks each note at its level and its octave at a quarter of it, through the master', () => {
    const { oscillators } = playChord();

    const heard = oscillators
      .map((oscillator) => ({
        frequency: oscillator.frequency.valueAt(NOW),
        peak: peakOf(oscillator),
      }))
      .sort((a, b) => a.frequency - b.frequency || a.peak - b.peak);
    const expected = CLOSING_CHORD.flatMap(({ pitch, level }) => [
      { frequency: hz(pitch), peak: level * MASTER },
      { frequency: 2 * hz(pitch), peak: level * OCTAVE_LEVEL * MASTER },
    ]).sort((a, b) => a.frequency - b.frequency || a.peak - b.peak);

    heard.forEach(({ frequency, peak }, i) => {
      expect(frequency).toBeCloseTo(expected[i].frequency, 3);
      expect(peak).toBeCloseTo(expected[i].peak, 6);
    });
  });

  it('feeds everything to the destination through one master gain at 0.3', () => {
    const { context } = playChord();

    const masters = context.inputsOf(context.destination);
    expect(masters).toHaveLength(1);
    const master = context.gains.find((gain) => gain === masters[0]);
    expect(master).toBeDefined();
    expect(master?.gain.valueAt(NOW)).toBeCloseTo(MASTER, 6);

    for (const oscillator of context.oscillators) {
      expect(oscillator.outputs).not.toContain(context.destination);
    }
  });

  it('rises from silence to its peak in 10ms', () => {
    const { oscillators } = playChord();

    for (const oscillator of oscillators) {
      const peak = peakOf(oscillator);
      expect(levelAt(oscillator, NOW)).toBeCloseTo(0, 6);
      expect(levelAt(oscillator, NOW + RISE / 2)).toBeGreaterThan(0);
      expect(levelAt(oscillator, NOW + RISE / 2)).toBeLessThan(peak);
      expect(levelAt(oscillator, NOW + RISE + 0.001)).toBeLessThan(peak);
    }
  });

  it('falls exponentially from its peak to nothing at its end', () => {
    const { oscillators } = playChord();
    const fall = LENGTH - RISE;
    const at = (k: number) => NOW + RISE + (fall * k) / 4;

    for (const oscillator of oscillators) {
      const peak = peakOf(oscillator);
      const [l1, l2, l3] = [1, 2, 3].map((k) => levelAt(oscillator, at(k)));
      expect(l1 / l2).toBeCloseTo(l2 / l3, 3);
      expect(l1).toBeLessThan(peak);
      expect(levelAt(oscillator, NOW + LENGTH - 1e-6)).toBeLessThan(peak / 100);
      expect(levelAt(oscillator, NOW + LENGTH + 0.01)).toBeLessThan(peak / 100);
    }
  });

  it('never resumes the context', () => {
    const { context } = playChord();

    expect(context.resumed).toBe(false);
  });
});

describe('createWelcomeTune: finish()', () => {
  const audio = stubAudioContext({ startTime: NOW });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes the context after the last note’s end, not before', async () => {
    const tune = createWelcomeTune();
    tune.play(CLOSING_CHORD);
    tune.finish();
    const [context] = audio.contexts();

    await vi.advanceTimersByTimeAsync(LENGTH * 1000 - 1);
    expect(context.state).not.toBe('closed');

    await vi.advanceTimersByTimeAsync(101);
    expect(context.state).toBe('closed');
    expect(context.closedAt).toBeGreaterThanOrEqual(NOW + LENGTH);
  });

  it('a close() closes the context at once, mid-chord', () => {
    const tune = createWelcomeTune();
    tune.play(CLOSING_CHORD);
    const [context] = audio.contexts();

    tune.close();

    expect(context.state).toBe('closed');
  });
});

describe('createWelcomeTune: no AudioContext in the window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives a silent tune whose every call does nothing and none throws', () => {
    expect('AudioContext' in window).toBe(false);

    const tune = createWelcomeTune();
    expect(() => tune.play(CLOSING_CHORD)).not.toThrow();
    expect(() => tune.fadeOut(150)).not.toThrow();
    expect(() => tune.finish()).not.toThrow();
    expect(() => tune.close()).not.toThrow();

    expect(vi.getTimerCount()).toBe(0);
  });
});

/**
 * 62, Welcome tune, Phase 3 (issue #596): the pluck and swell voices, and the
 * **Intro cue** played.
 *
 * A pluck is one triangle at its pitch, rising from silence in 5ms and falling
 * exponentially to nothing at its end; a swell is one sine, rising linearly
 * for 350ms and falling linearly to silence at its end. Each is started at the
 * context's `currentTime + at / 1000`. Played whole, the Intro cue is silent
 * by `INTRO_MS`, and every note it sounds at once, summed through the master,
 * stays under full scale.
 */

/** The pluck's rise and the swell's, in s (log 62 Q6). */
const PLUCK_RISE = 0.005;
const SWELL_RISE = 0.35;

const PLUCK: WelcomeNote = {
  at: 300,
  pitch: 69,
  length: 200,
  voice: 'pluck',
  level: 0.5,
};

const SWELL: WelcomeNote = {
  at: 1000,
  pitch: 84,
  length: 900,
  voice: 'swell',
  level: 0.25,
};

describe('createWelcomeTune: the pluck voice', () => {
  const audio = stubAudioContext({ startTime: NOW });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const START = NOW + PLUCK.at / 1000;
  const END = START + PLUCK.length / 1000;
  const PEAK = PLUCK.level * MASTER;

  function playPluck(): FakeOscillatorNode {
    createWelcomeTune().play([PLUCK]);
    const [context] = audio.contexts();
    expect(context.oscillators).toHaveLength(1);
    return context.oscillators[0];
  }

  it('sounds one triangle at its pitch, started at currentTime + at / 1000', () => {
    const oscillator = playPluck();

    expect(oscillator.type).toBe('triangle');
    expect(oscillator.frequency.valueAt(START)).toBeCloseTo(hz(PLUCK.pitch), 3);
    expect(oscillator.startedAt).toBeCloseTo(START, 6);
    expect(levelAt(oscillator, START - 0.001)).toBe(0);
  });

  it('rises from silence to its level, through the master, in 5ms', () => {
    const oscillator = playPluck();

    expect(levelAt(oscillator, START)).toBeCloseTo(0, 6);
    expect(levelAt(oscillator, START + PLUCK_RISE / 2)).toBeGreaterThan(0);
    expect(levelAt(oscillator, START + PLUCK_RISE / 2)).toBeLessThan(PEAK);
    expect(levelAt(oscillator, START + PLUCK_RISE)).toBeCloseTo(PEAK, 6);
  });

  it('falls exponentially from its peak to nothing at its end', () => {
    const oscillator = playPluck();
    const fall = END - START - PLUCK_RISE;
    const at = (k: number) => START + PLUCK_RISE + (fall * k) / 4;

    const [l1, l2, l3] = [1, 2, 3].map((k) => levelAt(oscillator, at(k)));
    expect(l1 / l2).toBeCloseTo(l2 / l3, 3);
    expect(l1).toBeLessThan(PEAK);
    expect(levelAt(oscillator, END - 1e-6)).toBeLessThan(PEAK / 100);
    expect(levelAt(oscillator, END + 0.01)).toBe(0);
  });
});

describe('createWelcomeTune: the swell voice', () => {
  const audio = stubAudioContext({ startTime: NOW });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const START = NOW + SWELL.at / 1000;
  const END = START + SWELL.length / 1000;
  const PEAK = SWELL.level * MASTER;

  function playSwell(): FakeOscillatorNode {
    createWelcomeTune().play([SWELL]);
    const [context] = audio.contexts();
    expect(context.oscillators).toHaveLength(1);
    return context.oscillators[0];
  }

  it('sounds one sine at its pitch, started at currentTime + at / 1000', () => {
    const oscillator = playSwell();

    expect(oscillator.type).toBe('sine');
    expect(oscillator.frequency.valueAt(START)).toBeCloseTo(hz(SWELL.pitch), 3);
    expect(oscillator.startedAt).toBeCloseTo(START, 6);
    expect(levelAt(oscillator, START - 0.001)).toBe(0);
  });

  it('rises linearly from silence to its level, through the master, over 350ms', () => {
    const oscillator = playSwell();

    expect(levelAt(oscillator, START)).toBeCloseTo(0, 6);
    expect(levelAt(oscillator, START + SWELL_RISE / 4)).toBeCloseTo(
      PEAK / 4,
      6
    );
    expect(levelAt(oscillator, START + SWELL_RISE / 2)).toBeCloseTo(
      PEAK / 2,
      6
    );
    expect(levelAt(oscillator, START + SWELL_RISE)).toBeCloseTo(PEAK, 6);
  });

  it('falls linearly from its peak to silence at its end', () => {
    const oscillator = playSwell();
    const fall = END - START - SWELL_RISE;

    expect(levelAt(oscillator, START + SWELL_RISE + fall / 4)).toBeCloseTo(
      (PEAK * 3) / 4,
      6
    );
    expect(levelAt(oscillator, START + SWELL_RISE + fall / 2)).toBeCloseTo(
      PEAK / 2,
      6
    );
    expect(levelAt(oscillator, END - 1e-6)).toBeCloseTo(0, 4);
    expect(levelAt(oscillator, END + 0.01)).toBe(0);
  });
});

describe('createWelcomeTune: the Intro cue, played', () => {
  const audio = stubAudioContext({ startTime: NOW });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function playIntro(): FakeOscillatorNode[] {
    createWelcomeTune().play(INTRO_CUE);
    const [context] = audio.contexts();
    return context.oscillators;
  }

  it('starts one oscillator per note, each at currentTime + at / 1000 at its pitch', () => {
    const oscillators = playIntro();

    expect(oscillators).toHaveLength(INTRO_CUE.length);
    const heard = oscillators
      .map((oscillator) => ({
        start: oscillator.startedAt ?? -1,
        frequency: oscillator.frequency.valueAt(NOW),
      }))
      .sort((a, b) => a.start - b.start || a.frequency - b.frequency);
    const expected = INTRO_CUE.map(({ at, pitch }) => ({
      start: NOW + at / 1000,
      frequency: hz(pitch),
    })).sort((a, b) => a.start - b.start || a.frequency - b.frequency);

    heard.forEach(({ start, frequency }, i) => {
      expect(start).toBeCloseTo(expected[i].start, 6);
      expect(frequency).toBeCloseTo(expected[i].frequency, 3);
    });
  });

  it('is silent by INTRO_MS', () => {
    const oscillators = playIntro();
    const end = NOW + INTRO_MS / 1000;

    for (const oscillator of oscillators) {
      expect(levelAt(oscillator, end)).toBe(0);
    }
  });

  it('peaks under full scale, every note sounding at once summed through the master', () => {
    const oscillators = playIntro();

    let loudest = 0;
    for (let ms = 0; ms <= INTRO_MS; ms += 1) {
      const time = NOW + ms / 1000;
      const summed = oscillators.reduce(
        (sum, oscillator) => sum + levelAt(oscillator, time),
        0
      );
      loudest = Math.max(loudest, summed);
    }

    expect(loudest).toBeGreaterThan(0);
    expect(loudest).toBeLessThan(1);
  });
});

/**
 * 62, Welcome tune, Phase 4 (issue #597): `fadeOut(ms)` ramps the master from
 * its level to silence over `ms`, then closes the context, and not before.
 */
describe('createWelcomeTune: fadeOut()', () => {
  const audio = stubAudioContext({ startTime: NOW });

  /** The fade a skip asks for, in ms (`SKIP_MS`). */
  const FADE = 150;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function fadeMidChord() {
    const tune = createWelcomeTune();
    tune.play(CLOSING_CHORD);
    const [context] = audio.contexts();
    await vi.advanceTimersByTimeAsync(300);
    const from = context.currentTime;
    tune.fadeOut(FADE);
    const [master] = context.inputsOf(context.destination);
    return { context, master, from };
  }

  it('ramps the master from its level to 0 over 150ms', async () => {
    const { master, from } = await fadeMidChord();

    expect(levelAt(master, from)).toBeCloseTo(MASTER, 6);
    expect(levelAt(master, from + FADE / 2000)).toBeCloseTo(MASTER / 2, 6);
    expect(levelAt(master, from + FADE / 1000)).toBeCloseTo(0, 6);
    expect(levelAt(master, from + FADE / 1000 + 0.05)).toBeCloseTo(0, 6);
  });

  it('silences every ringing note by the fade’s end', async () => {
    const { context, from } = await fadeMidChord();

    for (const oscillator of context.oscillators) {
      expect(levelAt(oscillator, from)).toBeGreaterThan(0);
      expect(levelAt(oscillator, from + FADE / 1000)).toBeCloseTo(0, 6);
    }
  });

  it('closes the context after the fade, not before', async () => {
    const { context, from } = await fadeMidChord();

    await vi.advanceTimersByTimeAsync(FADE - 1);
    expect(context.state).not.toBe('closed');

    await vi.advanceTimersByTimeAsync(101);
    expect(context.state).toBe('closed');
    expect(context.closedAt).toBeGreaterThanOrEqual(from + FADE / 1000);
  });
});
