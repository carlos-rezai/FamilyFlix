import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';
import { StartTabGate } from '@/features/library/StartTabGate/StartTabGate';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';

import { WelcomeProvider } from './WelcomeProvider';

/**
 * 55, Intro animation, Phase 4 (issue #507): the **Welcome hold** and the
 * skip.
 *
 * A home not ready when the intro ends holds the intro's last frame, a
 * beating, unlabelled, `aria-hidden` `LogoLoader` at the mark's width
 * (`132·scale`) in the mark's place, and hands off the moment the header
 * wordmark mounts. A home ready early still sees the whole intro.
 *
 * Any `pointerdown` or `keydown` on `window` while the welcome is up is
 * swallowed and skips: ready, the splash goes at once and the home shows in
 * 150ms with focus on the logo button; not ready, the hold, then straight to
 * the home on ready. Once `done`, input reaches the home as usual.
 *
 * The home's readiness is held back by holding the settings read that
 * `StartTabGate` waits on: until it lands, the header wordmark isn't mounted.
 */

stubScrollMetrics(6390);

const INTRO = 1750;
const HANDOFF = 500;
const SKIP = 150;

/** 960 × 540 is scale 2: the mark is 264px wide. */
const SCALE = 2;

let releaseSettings: () => void = () => undefined;

/** Serves the settings at once: the home is ready long before 1750ms. */
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

/** Lets the held settings read land, and the home mount on it. */
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

const posterPointerDown = vi.fn<() => void>();
const posterKeyDown = vi.fn<() => void>();
const posterNativePointerDown = vi.fn<() => void>();

function Home() {
  return (
    <StartTabGate>
      <MainLayout>
        <button
          type="button"
          onPointerDown={posterPointerDown}
          onKeyDown={posterKeyDown}
          ref={(element) => {
            element?.addEventListener('pointerdown', posterNativePointerDown);
          }}
        >
          the poster
        </button>
      </MainLayout>
    </StartTabGate>
  );
}

beforeEach(() => {
  posterPointerDown.mockClear();
  posterKeyDown.mockClear();
  posterNativePointerDown.mockClear();
});

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <WelcomeProvider>
          <Home />
        </WelcomeProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * Renders a ready home and runs the clock to `at`. The first 100ms go on
 * their own, so the settings read lands and the home mounts inside the intro:
 * one long `act` would only render it at its end.
 */
async function renderReadyHomeTo(at: number) {
  renderWelcome();
  await advanceClock(100);
  await advanceClock(at - 100);
}

const splash = () =>
  screen.queryByRole('status', { name: 'Opening FamilyFlix' });

function splashRoot(): HTMLElement {
  const root = splash();
  if (root === null) {
    throw new Error('no splash is drawn');
  }
  return root;
}

/** The hold's `LogoLoader`, found past its `aria-hidden` layer. */
function holdLoader(): HTMLElement | null {
  const root = splash();
  if (root === null) {
    return null;
  }
  return within(root).queryByRole('status', { name: 'Loading', hidden: true });
}

/** The header's logo button: the first button in the banner. */
function logoButton(): HTMLButtonElement {
  const button = screen.getByRole('banner').querySelector('button');
  if (button === null) {
    throw new Error('the header has no logo button');
  }
  return button;
}

function headerWordmark(): Element {
  const mark = logoButton().firstElementChild;
  if (mark === null) {
    throw new Error('the logo button has no wordmark');
  }
  return mark;
}

const isHidden = (element: Element) =>
  getComputedStyle(element).visibility === 'hidden';

/** The home is up: no splash, the header wordmark shown, the logo focused. */
function expectHome() {
  expect(splash()).toBeNull();
  expect(isHidden(headerWordmark())).toBe(false);
  expect(document.activeElement).toBe(logoButton());
}

/** Whatever lies beneath the splash; with a slow home, the document body. */
function beneath(): Element {
  return screen.queryByRole('button', { name: 'the poster' }) ?? document.body;
}

describe('WelcomeProvider: the Welcome hold', () => {
  it('holds a home not ready at 1750ms on a beating, unlabelled, aria-hidden loader at the mark’s width', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO);

    const loader = holdLoader();
    expect(loader).not.toBeNull();
    expect(
      within(splashRoot()).queryByRole('status', { name: 'Loading' })
    ).toBeNull();
    expect(loader?.textContent).toBe('');
    expect(loader?.querySelector('svg')?.getAttribute('width')).toBe(
      String(132 * SCALE)
    );
    expect(loader?.querySelectorAll('[data-beat]')).toHaveLength(2);
  });

  it('keeps holding for as long as the home isn’t ready', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO);
    await advanceClock(10_000);

    expect(splash()).not.toBeNull();
    expect(holdLoader()).not.toBeNull();
  });

  it('hands off on ready: the splash stays the handoff’s 500ms, then the home', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO + 3000);

    await ready();
    await advanceClock(HANDOFF - 1);
    expect(splash()).not.toBeNull();
    expect(isHidden(headerWordmark())).toBe(true);

    await advanceClock(1);
    expectHome();
  });

  it('still plays a home ready early to 1750ms, never holding', async () => {
    renderWelcome();
    await advanceClock(100);
    expect(headerWordmark()).toBeDefined();

    await advanceClock(INTRO - 100 - 1);
    expect(splash()).not.toBeNull();
    expect(holdLoader()).toBeNull();

    await advanceClock(1);
    expect(holdLoader()).toBeNull();
    await advanceClock(HANDOFF - 1);
    expect(splash()).not.toBeNull();

    await advanceClock(1);
    expectHome();
  });
});

type Skip = (target: Element) => boolean;

const skips: Array<[string, Skip]> = [
  ['a pointerdown', (target) => fireEvent.pointerDown(target)],
  ['a keydown', (target) => fireEvent.keyDown(target, { key: 'Enter' })],
];

describe('WelcomeProvider: a skip with the home ready', () => {
  describe.each(skips)('%s', (_, skip) => {
    it.each([
      ['in intro', 100],
      ['in handoff', INTRO + 100],
    ])(
      '%s takes the splash at once and shows the home in 150ms',
      async (__, at) => {
        await renderReadyHomeTo(at);
        expect(splash()).not.toBeNull();
        expect(holdLoader()).toBeNull();

        act(() => {
          skip(beneath());
        });
        expect(splash()).toBeNull();

        await advanceClock(SKIP);
        expectHome();
      }
    );

    it('in holding goes straight to the home in 150ms on ready', async () => {
      serveSlowHome();
      renderWelcome();
      await advanceClock(INTRO + 200);
      expect(holdLoader()).not.toBeNull();

      act(() => {
        skip(beneath());
      });
      await ready();
      await advanceClock(SKIP);

      expectHome();
    });
  });
});

describe('WelcomeProvider: a skip before ready', () => {
  it.each(skips)(
    '%s in intro holds on the loader at once, and keeps holding',
    async (_, skip) => {
      serveSlowHome();
      renderWelcome();
      await advanceClock(100);

      act(() => {
        skip(beneath());
      });
      await advanceClock(0);
      expect(splash()).not.toBeNull();
      expect(holdLoader()).not.toBeNull();

      await advanceClock(10_000);
      expect(splash()).not.toBeNull();
      expect(holdLoader()).not.toBeNull();
    }
  );

  it.each(skips)(
    '%s then goes straight to the home in 150ms on ready, no handoff',
    async (_, skip) => {
      serveSlowHome();
      renderWelcome();
      await advanceClock(100);

      act(() => {
        skip(beneath());
      });
      await advanceClock(3000);

      await ready();
      await advanceClock(SKIP);
      expectHome();
    }
  );
});

describe('WelcomeProvider: the skipping input is swallowed', () => {
  it.each([
    ['in intro', 100],
    ['in handoff', INTRO + 100],
  ])(
    'a pointerdown %s is prevented and never reaches the element beneath',
    async (_, at) => {
      await renderReadyHomeTo(at);
      const poster = screen.getByRole('button', { name: 'the poster' });

      let notPrevented = true;
      act(() => {
        notPrevented = fireEvent.pointerDown(poster);
      });

      expect(notPrevented).toBe(false);
      expect(posterPointerDown).not.toHaveBeenCalled();
      expect(posterNativePointerDown).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['in intro', 100],
    ['in handoff', INTRO + 100],
  ])(
    'a keydown %s is prevented and never reaches the element beneath',
    async (_, at) => {
      await renderReadyHomeTo(at);
      const poster = screen.getByRole('button', { name: 'the poster' });

      let notPrevented = true;
      act(() => {
        notPrevented = fireEvent.keyDown(poster, { key: 'Enter' });
      });

      expect(notPrevented).toBe(false);
      expect(posterKeyDown).not.toHaveBeenCalled();
    }
  );

  it('a pointerdown in holding never reaches the home once it mounts', async () => {
    serveSlowHome();
    renderWelcome();
    await advanceClock(INTRO + 200);

    let notPrevented = true;
    act(() => {
      notPrevented = fireEvent.pointerDown(document.body);
    });
    await ready();

    expect(notPrevented).toBe(false);
    expect(posterPointerDown).not.toHaveBeenCalled();
    expect(posterNativePointerDown).not.toHaveBeenCalled();
  });
});

describe('WelcomeProvider: once done', () => {
  it('lets clicks and keys reach the home as usual', async () => {
    await renderReadyHomeTo(INTRO + HANDOFF);
    expectHome();
    const poster = screen.getByRole('button', { name: 'the poster' });

    let pointerNotPrevented = false;
    let keyNotPrevented = false;
    act(() => {
      pointerNotPrevented = fireEvent.pointerDown(poster);
      keyNotPrevented = fireEvent.keyDown(poster, { key: 'Enter' });
    });

    expect(pointerNotPrevented).toBe(true);
    expect(keyNotPrevented).toBe(true);
    expect(posterPointerDown).toHaveBeenCalledTimes(1);
    expect(posterNativePointerDown).toHaveBeenCalledTimes(1);
    expect(posterKeyDown).toHaveBeenCalledTimes(1);
    expect(splash()).toBeNull();
  });

  it('lets them reach the home after a skip too', async () => {
    renderWelcome();
    await advanceClock(100);
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    await advanceClock(SKIP);
    expectHome();
    const poster = screen.getByRole('button', { name: 'the poster' });

    act(() => {
      fireEvent.pointerDown(poster);
      fireEvent.keyDown(poster, { key: 'Enter' });
    });

    expect(posterPointerDown).toHaveBeenCalledTimes(1);
    expect(posterKeyDown).toHaveBeenCalledTimes(1);
    expect(splash()).toBeNull();
  });
});
