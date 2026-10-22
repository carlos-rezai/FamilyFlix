import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import type { LibraryTab, Settings } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

import { StartTabGate } from './StartTabGate';

/**
 * 49, Start on Series, Phase 7 (issue #432): the launch, gated.
 *
 * `StartTabGate` draws its children only once `useStartTabSettled()` allows
 * the browse home to draw, and nothing before. On the **Launch entry** that is
 * after the settings read settles (and, for the **Start tab** Series, after
 * the entry is replaced with `/?tab=series`); anywhere else it is at once.
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

/**
 * Every URL the gated children were ever drawn at, in order: the record that
 * says what the parent saw first, not merely what is on screen at the end.
 */
let drawnAt: string[];

function BrowseHome() {
  const location = useLocation();
  drawnAt.push(`${location.pathname}${location.search}`);
  return <p>browse home</p>;
}

function renderGate(entry = '/') {
  drawnAt = [];
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <StartTabGate>
        <BrowseHome />
      </StartTabGate>
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('StartTabGate', () => {
  it('draws nothing while the read is pending, and its children once it allows', async () => {
    const answer = servePending();

    renderGate();

    expect(screen.queryByText('browse home')).toBeNull();
    expect(drawnAt).toEqual([]);

    await act(async () => {
      answer(okResponse(settingsWith('movies')));
    });

    expect(await screen.findByText('browse home')).toBeDefined();
    expect(url()).toBe('/');
  });

  it('with Series stored, first draws its children on the Series tab, never on bare /', async () => {
    const answer = servePending();

    renderGate();
    expect(screen.queryByText('browse home')).toBeNull();

    await act(async () => {
      answer(okResponse(settingsWith('series')));
    });

    expect(await screen.findByText('browse home')).toBeDefined();
    expect(url()).toBe('/?tab=series');
    expect(drawnAt.length).toBeGreaterThan(0);
    expect(drawnAt.every((at) => at === '/?tab=series')).toBe(true);
  });

  it('draws its children on bare / once a refused read settles', async () => {
    const answer = servePending();

    renderGate();
    expect(screen.queryByText('browse home')).toBeNull();

    await act(async () => {
      answer(serverErrorResponse());
    });

    expect(await screen.findByText('browse home')).toBeDefined();
    expect(url()).toBe('/');
  });

  it('draws its children at once off the Launch entry, reading nothing', () => {
    servePending();

    renderGate('/?tab=movies');

    expect(screen.getByText('browse home')).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
