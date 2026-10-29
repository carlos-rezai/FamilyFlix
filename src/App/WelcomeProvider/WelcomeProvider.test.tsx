import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import type { LibraryTab } from '@/types';
import { theme } from '@/styles/theme';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';
import { StartTabGate } from '@/features/library/StartTabGate/StartTabGate';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';

import { WelcomeProvider } from './WelcomeProvider';

/**
 * 55, Intro animation, Phase 2 (issue #504): a cold start draws the welcome
 * and ends on the home.
 *
 * A **Cold start** (the **Launch entry**, and no `familyflix.welcomed` flag in
 * `sessionStorage`) draws the **Welcome splash** over the **Home layer**, the
 * header's wordmark hidden beneath it. The provider is the clock: 1750ms of
 * intro, then the 500ms handoff, and in one frame the splash goes, the header
 * wordmark shows and focus lands on the header's logo button. Anywhere else,
 * or a second time in a session, it draws nothing.
 *
 * The home here is the real one's shape: `StartTabGate` settling the Launch
 * entry, then `MainLayout`, whose wordmark mounting is what makes the home
 * ready.
 */

stubScrollMetrics(6390);

const INTRO = 1750;
const HANDOFF = 500;

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

function serveStartTab(startTab: LibraryTab) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(okResponse(makeSettings({ startTab })))
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
  serveStartTab('movies');
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

function renderWelcome(
  entry: NonNullable<MemoryRouterProps['initialEntries']>[0] = '/'
) {
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

const splash = () =>
  screen.queryByRole('status', { name: 'Opening FamilyFlix' });

/** The header's logo button: the first button in the banner. */
function logoButton(): HTMLButtonElement {
  const button = screen.getByRole('banner').querySelector('button');
  if (button === null) {
    throw new Error('the header has no logo button');
  }
  return button;
}

/** The header's wordmark, the logo button's one child. */
function headerWordmark(): Element {
  const mark = logoButton().firstElementChild;
  if (mark === null) {
    throw new Error('the logo button has no wordmark');
  }
  return mark;
}

const isHidden = (element: Element) =>
  getComputedStyle(element).visibility === 'hidden';

describe('WelcomeProvider: a cold start', () => {
  it('draws the splash as a status named Opening FamilyFlix, its layers aria-hidden', async () => {
    renderWelcome();
    await advanceClock(100);

    const root = splash();
    expect(root).not.toBeNull();
    const layers = Array.from(root?.children ?? []);
    expect(layers.length).toBeGreaterThan(0);
    for (const layer of layers) {
      expect(layer.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('hides the header wordmark under the splash', async () => {
    renderWelcome();
    await advanceClock(100);

    expect(isHidden(headerWordmark())).toBe(true);
  });

  it('keeps the splash up until the end of intro plus handoff', async () => {
    renderWelcome();
    await advanceClock(INTRO);
    await advanceClock(HANDOFF - 1);

    expect(splash()).not.toBeNull();
    expect(isHidden(headerWordmark())).toBe(true);
  });

  it('at 1750ms plus 500ms is gone, the header wordmark shown and the logo focused', async () => {
    renderWelcome();
    await advanceClock(INTRO);
    await advanceClock(HANDOFF);

    expect(splash()).toBeNull();
    expect(isHidden(headerWordmark())).toBe(false);
    expect(document.activeElement).toBe(logoButton());
  });

  it.each<LibraryTab>(['movies', 'series'])(
    'plays with the Start tab %s',
    async (startTab) => {
      serveStartTab(startTab);
      renderWelcome();
      await advanceClock(100);

      expect(splash()).not.toBeNull();

      await advanceClock(INTRO + HANDOFF);

      expect(splash()).toBeNull();
      expect(isHidden(headerWordmark())).toBe(false);
      expect(document.activeElement).toBe(logoButton());
    }
  );

  it('never hides the Home layer from assistive tech nor makes it inert', async () => {
    renderWelcome();

    for (const at of [100, INTRO - 100, HANDOFF]) {
      await advanceClock(at);
      for (
        let node: Element | null = screen.getByRole('banner');
        node !== null;
        node = node.parentElement
      ) {
        expect(node.getAttribute('aria-hidden')).toBeNull();
        expect(node.hasAttribute('inert')).toBe(false);
      }
    }
  });
});

describe('WelcomeProvider: not a cold start', () => {
  it('draws nothing on a second mount in the same session', async () => {
    const first = renderWelcome();
    await advanceClock(INTRO + HANDOFF);
    first.unmount();

    renderWelcome();
    await advanceClock(100);

    expect(splash()).toBeNull();
    expect(isHidden(headerWordmark())).toBe(false);
  });

  it.each([
    ['a deep link', '/movie/a1'],
    ['a query', '/?tab=series'],
  ])('draws nothing on %s', async (_, entry) => {
    renderWelcome(entry);
    await advanceClock(100);

    expect(splash()).toBeNull();
    expect(isHidden(headerWordmark())).toBe(false);
  });

  it('draws nothing on a non-default key', async () => {
    renderWelcome({ pathname: '/', search: '', key: 'k3y' });
    await advanceClock(100);

    expect(splash()).toBeNull();
    expect(isHidden(headerWordmark())).toBe(false);
  });
});

describe('WelcomeProvider: a refused sessionStorage', () => {
  it('still plays the welcome when the read throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    renderWelcome();
    await advanceClock(100);

    expect(splash()).not.toBeNull();
  });

  it('does not throw when the write throws, and still plays', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => renderWelcome()).not.toThrow();
    await advanceClock(100);

    expect(splash()).not.toBeNull();
  });
});
