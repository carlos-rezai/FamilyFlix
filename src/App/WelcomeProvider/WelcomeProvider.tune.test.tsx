import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  type RenderResult,
} from '@testing-library/react';
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
  levelAt,
  stubAudioContext,
  type FakeAudioContext,
  type FakeAudioNode,
} from '@/test-support/stubAudioContext/stubAudioContext';

import { INTRO_CUE } from '@/App/welcomeScore/welcomeScore';
import { REDUCED_MOTION_QUERY } from '@/App/WelcomeSplash/WelcomeSplash';

import { WelcomeProvider } from './WelcomeProvider';

/**
 * 62, Welcome tune, Phase 1 (issue #594): the **Closing chord** in the
 * welcome.
 *
 * A **Cold start**'s **Wordmark handoff** strikes the chord at its start,
 * whether it follows the intro straight away or a **Welcome hold**. At `done`
 * the tune finishes: the context closes once the chord has died away, its
 * 2600ms after the handoff's start, and not before. An unmount closes it at
 * once. A reload and a deep link play no welcome and make no context at all.
 *
 * The chord is told by what starts at the handoff's moment on the context's
 * clock: C3 F3 A3 C4 F4 A4, each with its octave partial.
 */

stubScrollMetrics(6390);
const audio = stubAudioContext();

const INTRO = 1950;
const HANDOFF = 500;
/** The chord rings 2600ms from the handoff's start. */
const CHORD_MS = 2600;

const WELCOMED_KEY = 'familyflix.welcomed';

const hz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

/** Every frequency the chord sounds: each pitch and its octave, ascending. */
const CHORD_HZ = [48, 53, 57, 60, 65, 69]
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

/**
 * 62, Welcome tune, Phase 4 (issue #597): a skip fades, and the hold is
 * silent.
 *
 * A skip ramps the master from its level to silence over the skip's 150ms and
 * closes the context after. A skip from the intro or the hold never reaches
 * the handoff, so it plays no chord; a skip during the handoff fades the
 * chord already ringing. A **Welcome hold** sounds nothing between the
 * **Intro cue** and the **Closing chord**.
 */
const SKIP = 150;
const MASTER = 0.3;

type Skip = (target: Element) => void;

const skips: Array<[string, Skip]> = [
  ['a click', (target) => fireEvent.pointerDown(target)],
  ['a key', (target) => fireEvent.keyDown(target, { key: 'Enter' })],
];

function masterOf(context: FakeAudioContext): FakeAudioNode {
  const [filter] = context.inputsOf(context.destination);
  const masters = context.inputsOf(filter);
  expect(masters).toHaveLength(1);
  return masters[0];
}

/** The master falls from its level to silence over 150ms from `from`. */
function expectFadeFrom(context: FakeAudioContext, from: number) {
  const master = masterOf(context);
  expect(levelAt(master, from)).toBeCloseTo(MASTER, 6);
  expect(levelAt(master, from + SKIP / 2000)).toBeCloseTo(MASTER / 2, 6);
  expect(levelAt(master, from + SKIP / 1000)).toBeCloseTo(0, 6);
}

/** Closed after the fade, not before. */
async function expectClosedAfterFade(context: FakeAudioContext) {
  await advanceClock(SKIP - 1);
  expect(context.state).not.toBe('closed');
  await advanceClock(101);
  expect(context.state).toBe('closed');
}

describe('WelcomeProvider: a skip fades the tune', () => {
  describe.each(skips)('%s', (_, skip) => {
    it('during the intro fades the master over 150ms, closes after, and plays no chord', async () => {
      renderWelcome();
      await advanceClock(100);
      const context = onlyContext();

      act(() => {
        skip(document.body);
      });
      const from = context.currentTime;

      expectFadeFrom(context, from);
      await expectClosedAfterFade(context);
      await advanceClock(INTRO + HANDOFF + CHORD_MS);
      expect(context.oscillators).toHaveLength(INTRO_CUE.length);
    });

    it('during the hold fades once the home is ready, and plays no chord', async () => {
      serveSlowHome();
      renderWelcome();
      await advanceClock(INTRO + 200);
      const context = onlyContext();

      act(() => {
        skip(document.body);
      });
      await ready();
      const from = context.currentTime;

      expectFadeFrom(context, from);
      await expectClosedAfterFade(context);
      expect(context.oscillators).toHaveLength(INTRO_CUE.length);
    });

    it('during the handoff fades the ringing chord to silence', async () => {
      renderWelcome();
      await advanceClock(100);
      await advanceClock(INTRO - 100 + 200);
      const context = onlyContext();
      const chord = context.oscillators.slice(INTRO_CUE.length);
      expect(chord).toHaveLength(CHORD_HZ.length);

      act(() => {
        skip(document.body);
      });
      const from = context.currentTime;

      expectFadeFrom(context, from);
      for (const oscillator of chord) {
        expect(levelAt(oscillator, from)).toBeGreaterThan(0);
        expect(levelAt(oscillator, from + SKIP / 1000)).toBeCloseTo(0, 6);
      }
      await expectClosedAfterFade(context);
    });
  });
});

describe('WelcomeProvider: the Welcome hold is silent', () => {
  it('schedules nothing between the Intro cue and the chord', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO + 1000);
    const context = onlyContext();
    expect(context.oscillators).toHaveLength(INTRO_CUE.length);

    await ready();
    const chordAt = context.currentTime;

    const between = context.oscillators.filter(
      (oscillator) =>
        oscillator.startedAt !== null &&
        oscillator.startedAt > INTRO / 1000 + 1e-6 &&
        oscillator.startedAt < chordAt - 1e-6
    );
    expect(between).toHaveLength(0);
    expectChord(startedAt(context, chordAt));
    expect(context.oscillators).toHaveLength(
      INTRO_CUE.length + CHORD_HZ.length
    );
  });
});

/**
 * 62, Welcome tune, Phase 5 (issue #598): reduced motion plays the chord
 * alone.
 *
 * Under reduced motion, read once at the start, the welcome plays no **Intro
 * cue**: the **Closing chord** is the whole tune, struck when the reduced
 * handoff starts, at 900ms. A skip still fades, and a skip from the intro
 * never reaches the handoff, so it plays no chord.
 */
const STILL_INTRO = 900;

/** A `matchMedia` that answers yes to reduced motion and no to all else. */
function stubReducedMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === REDUCED_MOTION_QUERY,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }))
  );
}

describe('WelcomeProvider: reduced motion plays the chord alone', () => {
  beforeEach(() => {
    stubReducedMotion();
  });

  it('schedules no Intro cue note', async () => {
    renderWelcome();
    await advanceClock(100);
    await advanceClock(STILL_INTRO - 100 - 1);

    const context = onlyContext();
    expect(context.oscillators).toHaveLength(0);
  });

  it('strikes the chord when the reduced handoff starts, at 900ms', async () => {
    renderWelcome();
    await advanceClock(100);
    await advanceClock(STILL_INTRO - 100);

    const context = onlyContext();
    const handoff = context.currentTime;
    expect(handoff).toBeCloseTo(STILL_INTRO / 1000, 6);
    expectChord(startedAt(context, handoff));
    expect(context.oscillators).toHaveLength(CHORD_HZ.length);
  });

  describe.each(skips)('%s', (_, skip) => {
    it('during the intro fades the master over 150ms, closes after, and plays no chord', async () => {
      renderWelcome();
      await advanceClock(100);
      const context = onlyContext();

      act(() => {
        skip(document.body);
      });
      const from = context.currentTime;

      expectFadeFrom(context, from);
      await expectClosedAfterFade(context);
      await advanceClock(STILL_INTRO + CHORD_MS);
      expect(context.oscillators).toHaveLength(0);
    });
  });
});

/**
 * 62, Welcome tune, Phase 6 (issue #599): a refused context stays silent.
 *
 * An `AudioContext` constructor that throws (no audio device on Linux) gives
 * the silent tune, and the welcome plays through to `done` unchanged. A
 * context the browser keeps suspended is scheduled into and never resumed,
 * whether the welcome runs to its end or is skipped.
 */
const splash = () =>
  screen.queryByRole('status', { name: 'Opening FamilyFlix' });

/** The header's **Wordmark**: the banner's first element. */
function headerWordmark(): Element {
  const mark = screen.getByRole('banner').firstElementChild;
  if (mark === null) {
    throw new Error('the header has no wordmark');
  }
  return mark;
}

const isHidden = (element: Element) =>
  getComputedStyle(element).visibility === 'hidden';

describe('WelcomeProvider: a context that throws', () => {
  const refused = stubAudioContext({ refuse: true });

  it('plays the welcome through to done unchanged', async () => {
    renderWelcome();
    await advanceClock(100);
    expect(splash()).not.toBeNull();
    expect(isHidden(headerWordmark())).toBe(true);

    await advanceClock(INTRO - 100 + HANDOFF - 1);
    expect(splash()).not.toBeNull();

    await advanceClock(1);
    expect(splash()).toBeNull();
    expect(isHidden(headerWordmark())).toBe(false);
    expect(document.activeElement).toBe(document.body);
    expect(refused.attempts()).toBeGreaterThan(0);
    expect(refused.contexts()).toHaveLength(0);
  });

  describe.each(skips)('%s', (_, skip) => {
    it('during the intro still shows the home in 150ms', async () => {
      renderWelcome();
      await advanceClock(100);
      expect(refused.attempts()).toBeGreaterThan(0);

      act(() => {
        skip(document.body);
      });
      await advanceClock(SKIP);

      expect(splash()).toBeNull();
      expect(isHidden(headerWordmark())).toBe(false);
    });
  });
});

describe('WelcomeProvider: a suspended context', () => {
  const suspended = stubAudioContext({ state: 'suspended' });

  function theContext(): FakeAudioContext {
    const made = suspended.contexts();
    expect(made).toHaveLength(1);
    return made[0];
  }

  it('is scheduled into and never resumed, through to done', async () => {
    renderWelcome();
    await advanceClock(100);
    await advanceClock(INTRO - 100 + HANDOFF + CHORD_MS + 100);

    const context = theContext();
    expect(context.oscillators.length).toBeGreaterThan(0);
    expect(context.resumed).toBe(false);
    expect(splash()).toBeNull();
  });

  describe.each(skips)('%s', (_, skip) => {
    it('during the intro never resumes it', async () => {
      renderWelcome();
      await advanceClock(100);

      act(() => {
        skip(document.body);
      });
      await advanceClock(SKIP + 100);

      expect(theContext().resumed).toBe(false);
    });

    it('during the handoff never resumes it', async () => {
      renderWelcome();
      await advanceClock(100);
      await advanceClock(INTRO - 100 + 100);

      act(() => {
        skip(document.body);
      });
      await advanceClock(SKIP + 100);

      expect(theContext().resumed).toBe(false);
    });
  });
});
