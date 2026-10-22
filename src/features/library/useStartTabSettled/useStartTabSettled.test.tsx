import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

import type { LibraryTab, Settings } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import {
  LocationProbe,
  navigationType,
  url,
} from '@/test-support/LocationProbe/LocationProbe';

import { useStartTabSettled } from './useStartTabSettled';

/**
 * 49 — Start on Series, Phase 6 (issue #431): the **Launch entry**'s decision.
 *
 * `useStartTabSettled()` answers whether the Launch entry is settled. Off
 * the Launch entry (a deep link, `/?tab=movies`, a search query, a
 * non-default location key) it answers `true` at once and reads nothing. On it
 * (bare `/`, no query, `location.key === 'default'`) it reads the settings
 * route itself, once, and answers `false` until the read settles: the
 * **Start tab** Series replaces the entry with `/?tab=series`; Movies, or a
 * refused read, leaves `/` alone.
 *
 * It reads the route rather than the provider's value because it must tell a
 * refusal from a value still on its way (log 49 Q13), `useOpeningReads`'s
 * precedent.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function settingsWith(startTab: LibraryTab): Settings {
  return {
    subtitleLanguage: 'English',
    audioLanguage: 'English',
    ultrawideMargins: false,
    tmdbRatings: true,
    startTab,
  };
}

/** Answer `GET /api/settings` with the given Start tab. */
function serveStartTab(startTab: LibraryTab) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(okResponse(settingsWith(startTab)))
  );
}

/** A settings read that answers only when the test says so. */
function servePending(): (value: Response) => void {
  let answer: (value: Response) => void = () => undefined;
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
  );
  return (value) => answer(value);
}

function settingsReads(): number {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((asked) => asked === '/api/settings').length;
}

/** Draws the hook's answer beside where the router is. */
function Harness() {
  const allowed = useStartTabSettled();
  return <div data-testid="allowed">{String(allowed)}</div>;
}

function renderAt(entry: NonNullable<MemoryRouterProps['initialEntries']>[0]) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness />
      <LocationProbe withBack />
    </MemoryRouter>
  );
}

const allowed = () => screen.getByTestId('allowed').textContent;

/** Let every pending promise and effect run. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useStartTabSettled — off the Launch entry', () => {
  it.each([
    ['a deep link', '/?genre=Drama&sort=year'],
    ['the Movies tab named on the URL', '/?tab=movies'],
    ['a search query', '/?q=lighthouse'],
  ])('answers true at once and reads nothing for %s', async (_, entry) => {
    serveStartTab('series');

    renderAt(entry);

    expect(allowed()).toBe('true');
    await settle();
    expect(settingsReads()).toBe(0);
    expect(url()).toBe(entry);
  });

  it('answers true at once and reads nothing for a non-default key', async () => {
    serveStartTab('series');

    renderAt({ pathname: '/', search: '', key: 'k3y' });

    expect(allowed()).toBe('true');
    await settle();
    expect(settingsReads()).toBe(0);
    expect(url()).toBe('/');
  });
});

describe('useStartTabSettled — on the Launch entry', () => {
  it('answers false until the read settles, then true', async () => {
    const answer = servePending();

    renderAt('/');

    expect(allowed()).toBe('false');
    await settle();
    expect(allowed()).toBe('false');

    answer(okResponse(settingsWith('movies')));
    await waitFor(() => {
      expect(allowed()).toBe('true');
    });
  });

  it('lands on the Series tab by a replace, with no entry behind it', async () => {
    serveStartTab('series');

    renderAt('/');

    await waitFor(() => {
      expect(allowed()).toBe('true');
    });
    expect(url()).toBe('/?tab=series');
    expect(navigationType()).toBe('REPLACE');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(url()).toBe('/?tab=series');
  });

  it('is on the Series tab by the time it answers true', async () => {
    // The browse home may not draw a single Movies frame first.
    const answer = servePending();

    renderAt('/');
    answer(okResponse(settingsWith('series')));

    await waitFor(() => {
      expect(allowed()).toBe('true');
    });
    expect(url()).toBe('/?tab=series');
  });

  it('stays on / with Movies stored', async () => {
    serveStartTab('movies');

    renderAt('/');

    await waitFor(() => {
      expect(allowed()).toBe('true');
    });
    expect(url()).toBe('/');
    expect(settingsReads()).toBe(1);
  });

  it('stays on / when the read is refused', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(serverErrorResponse()));

    renderAt('/');

    await waitFor(() => {
      expect(allowed()).toBe('true');
    });
    expect(url()).toBe('/');
    expect(settingsReads()).toBe(1);
  });

  it('stays on / when the settings route cannot be reached', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));

    renderAt('/');

    await waitFor(() => {
      expect(allowed()).toBe('true');
    });
    expect(url()).toBe('/');
  });

  it('reads the settings route once per mount', async () => {
    serveStartTab('series');

    const { rerender } = renderAt('/');
    await waitFor(() => {
      expect(allowed()).toBe('true');
    });
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Harness />
        <LocationProbe withBack />
      </MemoryRouter>
    );
    await settle();

    expect(settingsReads()).toBe(1);
  });
});
