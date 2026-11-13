import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';
import { StartTabGate } from '@/features/library/StartTabGate/StartTabGate';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';
import {
  stubAudioContext,
  type FakeAudioContext,
} from '@/test-support/stubAudioContext/stubAudioContext';

import { INTRO_CUE } from '@/App/welcomeScore/welcomeScore';

import { WelcomeProvider } from './WelcomeProvider';

/**
 * 62, Welcome tune, Phase 1 (issue #594): the **Closing chord** in the
 * welcome.
 *
 * A **Cold start**'s **Wordmark handoff** strikes the chord at its start,
 * whether it follows the intro straight away or a **Welcome hold**. At `done`
 * the tune finishes: the context closes once the chord has died away, its
 * 1800ms after the handoff's start, and not before. An unmount closes it at
 * once. A reload and a deep link play no welcome and make no context at all.
 *
 * The chord is told by what starts at the handoff's moment on the context's
 * clock: F2 C3 F3 A3 C4 F4, each with its octave partial.
 */

stubScrollMetrics(6390);
const audio = stubAudioContext();

const INTRO = 1950;
const HANDOFF = 500;
/** The chord rings 1800ms from the handoff's start. */
const CHORD_MS = 1800;

const WELCOMED_KEY = 'familyflix.welcomed';

const hz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

/** Every frequency the chord sounds: each pitch and its octave, ascending. */
const CHORD_HZ = [41, 48, 53, 57, 60, 65]
  .flatMap((pitch) => [hz(pitch), 2 * hz(pitch)])
  .sort((a, b) => a - b);

let releaseSettings: () => void = () => undefined;

function serveReadyHome() {
  vi.stubGlobal(
    'fetch',
    vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(okResponse(makeSettings({ startTab: 'movies' })))
    )
  );
}

/** Holds the settings read until `ready()`: the home isn't ready till then. */
function serveSlowHome() {
  const waiting: Array<() => void> = [];
  releaseSettings = () => {
    for (const resolve of waiting.splice(0)) {
      resolve();
    }
  };
  vi.stubGlobal(
    'fetch',
    vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      () =>
        new Promise<Response>((resolve) => {
          waiting.push(() =>
            resolve(okResponse(makeSettings({ startTab: 'movies' })))
          );
        })
    )
  );
}

async function ready() {
  await act(async () => {
    releaseSettings();
  });
  await advanceClock(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  vi.stubGlobal('innerWidth', 960);
  vi.stubGlobal('innerHeight', 540);
  serveReadyHome();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function Home() {
  return (
    <StartTabGate>
      <MainLayout>
        <p>the browse home</p>
      </MainLayout>
    </StartTabGate>
  );
}

function renderWelcome(entry = '/'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider theme={theme}>
        <WelcomeProvider>
          <Home />
        </WelcomeProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function onlyContext(): FakeAudioContext {
  const made = audio.contexts();
  expect(made).toHaveLength(1);
  return made[0];
}

/** The frequencies of every oscillator started at `time`, ascending. */
function startedAt(context: FakeAudioContext, time: number): number[] {
  return context.oscillators
    .filter(
      (oscillator) =>
        oscillator.startedAt !== null &&
        Math.abs(oscillator.startedAt - time) < 1e-6
    )
    .map((oscillator) => oscillator.frequency.valueAt(time))
    .sort((a, b) => a - b);
}

function expectChord(frequencies: number[]) {
  expect(frequencies).toHaveLength(CHORD_HZ.length);
  frequencies.forEach((frequency, i) =>
    expect(frequency).toBeCloseTo(CHORD_HZ[i], 3)
  );
}

describe('WelcomeProvider: the handoff strikes the Closing chord', () => {
  it('straight after the intro, at the handoff’s start', async () => {
    renderWelcome();
    await advanceClock(INTRO);

    const context = onlyContext();
    expectChord(startedAt(context, context.currentTime));
  });

  it('after a Welcome hold, at the handoff’s start once the home is ready', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO + 1000);

    await ready();

    const context = onlyContext();
    expectChord(startedAt(context, context.currentTime));
  });
});

describe('WelcomeProvider: the tune ends', () => {
  it('at done it finishes: the context closes once the chord has died away, not before', async () => {
    renderWelcome();
    await advanceClock(100);
    await advanceClock(INTRO - 100 + HANDOFF);
    const context = onlyContext();
    expect(context.state).not.toBe('closed');

    await advanceClock(CHORD_MS - HANDOFF - 1);
    expect(context.state).not.toBe('closed');

    await advanceClock(101);
    expect(context.state).toBe('closed');
  });

  it('an unmount closes the context at once', async () => {
    const view = renderWelcome();
    await advanceClock(INTRO + 100);
    const context = onlyContext();
    expect(context.state).not.toBe('closed');

    view.unmount();

    expect(context.state).toBe('closed');
  });
});

describe('WelcomeProvider: no welcome, no tune', () => {
  it('a reload, the session already welcomed, makes no context', async () => {
    sessionStorage.setItem(WELCOMED_KEY, 'true');
    renderWelcome();
    await advanceClock(INTRO + HANDOFF + CHORD_MS);

    expect(audio.contexts()).toHaveLength(0);
  });

  it('a deep link makes no context', async () => {
    renderWelcome('/movie/a1');
    await advanceClock(INTRO + HANDOFF + CHORD_MS);

    expect(audio.contexts()).toHaveLength(0);
  });
});

/**
 * 62, Welcome tune, Phase 3 (issue #596): a **Cold start** plays the
 * **Intro cue** from the welcome's start, each note at its `at` on the
 * context's clock from the moment the welcome mounts, then the **Closing
 * chord** at the handoff.
 */
describe('WelcomeProvider: a Cold start plays the Intro cue, then the chord', () => {
  /** Every Intro cue note's start and frequency, ascending. */
  const introNotes = (from: number) =>
    INTRO_CUE.map(({ at, pitch }) => ({
      start: from + at / 1000,
      frequency: hz(pitch),
    })).sort((a, b) => a.start - b.start || a.frequency - b.frequency);

  it('starts the Intro cue’s notes from the welcome’s start', async () => {
    renderWelcome();
    await advanceClock(0);

    const context = onlyContext();
    const heard = context.oscillators
      .map((oscillator) => ({
        start: oscillator.startedAt ?? -1,
        frequency: oscillator.frequency.valueAt(oscillator.startedAt ?? 0),
      }))
      .sort((a, b) => a.start - b.start || a.frequency - b.frequency);
    const expected = introNotes(0);

    expect(heard).toHaveLength(expected.length);
    heard.forEach(({ start, frequency }, i) => {
      expect(start).toBeCloseTo(expected[i].start, 6);
      expect(frequency).toBeCloseTo(expected[i].frequency, 3);
    });
  });

  it('then strikes the chord at the handoff, after every Intro cue note', async () => {
    renderWelcome();
    await advanceClock(INTRO);

    const context = onlyContext();
    const handoff = context.currentTime;
    expect(handoff).toBeCloseTo(INTRO / 1000, 6);
    expectChord(startedAt(context, handoff));

    const intro = context.oscillators.filter(
      (oscillator) =>
        oscillator.startedAt !== null && oscillator.startedAt < handoff - 1e-6
    );
    expect(intro).toHaveLength(INTRO_CUE.length);
  });
});
