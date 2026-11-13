import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  levelAt,
  stubAudioContext,
  type FakeAudioContext,
} from './stubAudioContext';

/**
 * 62, Welcome tune, the closing round (issue #605).
 *
 * jsdom has no Web Audio, so every **Welcome tune** suite hears the tune
 * through this fake: a param's value over time (`valueAt`) and how loud a
 * node reaches the destination (`levelAt`). The claims below are the ones
 * those suites lean on: set, linear and exponential automation, held after
 * the last event; gains multiplied along a path and paths summed; a filter
 * passing its level through; an oscillator silent outside its start and stop;
 * a context's clock, state and close; a constructor that refuses; and a
 * window left with no `AudioContext` once the installing block is over.
 */

/** A context made through the window, as the player makes one. */
function makeContext(): FakeAudioContext {
  return new window.AudioContext() as unknown as FakeAudioContext;
}

describe('stubAudioContext: a param over time', () => {
  stubAudioContext();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads its default before any event, and a value written straight', () => {
    const gain = makeContext().createGain().gain;
    expect(gain.valueAt(0)).toBe(1);

    gain.value = 0.3;
    expect(gain.valueAt(5)).toBe(0.3);
  });

  it('steps to a set value at its time', () => {
    const { gain } = makeContext().createGain();
    gain.setValueAtTime(0.5, 2);

    expect(gain.valueAt(1)).toBe(1);
    expect(gain.valueAt(2)).toBe(0.5);
  });

  it('ramps linearly to a value, then holds it', () => {
    const { gain } = makeContext().createGain();
    gain.setValueAtTime(0, 1);
    gain.linearRampToValueAtTime(1, 3);

    expect(gain.valueAt(1)).toBe(0);
    expect(gain.valueAt(1.5)).toBeCloseTo(0.25, 6);
    expect(gain.valueAt(2)).toBeCloseTo(0.5, 6);
    expect(gain.valueAt(3)).toBe(1);
    expect(gain.valueAt(10)).toBe(1);
  });

  it('ramps exponentially to a value, then holds it', () => {
    const { gain } = makeContext().createGain();
    gain.setValueAtTime(1, 0);
    gain.exponentialRampToValueAtTime(0.01, 2);

    expect(gain.valueAt(1)).toBeCloseTo(0.1, 6);
    expect(gain.valueAt(0.5) / gain.valueAt(1)).toBeCloseTo(
      gain.valueAt(1) / gain.valueAt(1.5),
      6
    );
    expect(gain.valueAt(2)).toBeCloseTo(0.01, 6);
    expect(gain.valueAt(10)).toBeCloseTo(0.01, 6);
  });

  it('refuses an exponential ramp to 0, as Web Audio does', () => {
    const { gain } = makeContext().createGain();

    expect(() => gain.exponentialRampToValueAtTime(0, 1)).toThrow(RangeError);
  });

  it('reads its value now on the context’s clock', async () => {
    const { gain } = makeContext().createGain();
    gain.setValueAtTime(0, 0);
    gain.linearRampToValueAtTime(1, 1);

    await vi.advanceTimersByTimeAsync(500);

    expect(gain.value).toBeCloseTo(0.5, 6);
  });
});

describe('stubAudioContext: how loud a node reaches the destination', () => {
  stubAudioContext();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function started() {
    const context = makeContext();
    const oscillator = context.createOscillator();
    oscillator.start(0);
    return { context, oscillator };
  }

  it('is the gain of one gain on its way', () => {
    const { context, oscillator } = started();
    const gain = context.createGain();
    gain.gain.value = 0.4;
    oscillator.connect(gain).connect(context.destination);

    expect(levelAt(oscillator, 1)).toBeCloseTo(0.4, 6);
  });

  it('multiplies two gains in series', () => {
    const { context, oscillator } = started();
    const first = context.createGain();
    first.gain.value = 0.5;
    const second = context.createGain();
    second.gain.value = 0.3;
    oscillator.connect(first).connect(second).connect(context.destination);

    expect(levelAt(oscillator, 1)).toBeCloseTo(0.15, 6);
  });

  it('sums two paths', () => {
    const { context, oscillator } = started();
    const left = context.createGain();
    left.gain.value = 0.2;
    const right = context.createGain();
    right.gain.value = 0.3;
    oscillator.connect(left).connect(context.destination);
    oscillator.connect(right).connect(context.destination);

    expect(levelAt(oscillator, 1)).toBeCloseTo(0.5, 6);
  });

  it('passes a level through a filter unchanged', () => {
    const { context, oscillator } = started();
    const gain = context.createGain();
    gain.gain.value = 0.6;
    const filter = context.createBiquadFilter();
    oscillator.connect(gain).connect(filter).connect(context.destination);

    expect(levelAt(oscillator, 1)).toBeCloseTo(0.6, 6);
  });

  it('is silent for an oscillator before its start and from its stop', () => {
    const context = makeContext();
    const oscillator = context.createOscillator();
    oscillator.connect(context.destination);

    expect(levelAt(oscillator, 1)).toBe(0);

    oscillator.start(2);
    oscillator.stop(3);

    expect(levelAt(oscillator, 1.999)).toBe(0);
    expect(levelAt(oscillator, 2)).toBe(1);
    expect(levelAt(oscillator, 2.999)).toBe(1);
    expect(levelAt(oscillator, 3)).toBe(0);
  });
});

describe('stubAudioContext: a context', () => {
  const audio = stubAudioContext();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs its clock from 0 with the faked one', async () => {
    const context = makeContext();
    expect(context.currentTime).toBe(0);

    await vi.advanceTimersByTimeAsync(1500);

    expect(context.currentTime).toBeCloseTo(1.5, 6);
  });

  it('starts running and closes on close(), remembering when', async () => {
    const context = makeContext();
    expect(context.state).toBe('running');
    expect(context.closedAt).toBeNull();

    await vi.advanceTimersByTimeAsync(250);
    await context.close();

    expect(context.state).toBe('closed');
    expect(context.closedAt).toBeCloseTo(0.25, 6);
  });

  it('remembers every context made and every attempt, in order', () => {
    const first = makeContext();
    const second = makeContext();

    expect(audio.contexts()).toEqual([first, second]);
    expect(audio.attempts()).toBe(2);
  });
});

describe('stubAudioContext: a startTime', () => {
  stubAudioContext({ startTime: 12.5 });

  it('is what a new context’s clock reads', () => {
    vi.useFakeTimers();
    expect(makeContext().currentTime).toBe(12.5);
    vi.useRealTimers();
  });
});

describe('stubAudioContext: a context the browser keeps suspended', () => {
  stubAudioContext({ state: 'suspended' });

  it('starts suspended and remembers a resume', async () => {
    const context = makeContext();
    expect(context.state).toBe('suspended');
    expect(context.resumed).toBe(false);

    await context.resume();

    expect(context.resumed).toBe(true);
  });
});

describe('stubAudioContext: a constructor that refuses', () => {
  const audio = stubAudioContext({ refuse: true });

  it('throws, counts the attempt and makes no context', () => {
    expect(() => makeContext()).toThrow(DOMException);

    expect(audio.attempts()).toBe(1);
    expect(audio.contexts()).toHaveLength(0);
  });
});

describe('stubAudioContext: after those blocks have finished', () => {
  it('leaves the window with no AudioContext, as jsdom’s own has none', () => {
    expect('AudioContext' in window).toBe(false);
  });
});
