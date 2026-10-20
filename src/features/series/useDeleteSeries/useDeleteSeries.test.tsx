import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  type MemoryRouterProps,
} from 'react-router-dom';

import { useDeleteSeries } from './useDeleteSeries';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';
import {
  conflictResponse,
  noContentResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 38 — Title editing, Slice 1: "delete a series" (issue #304).
 *
 * The hook behind the series Delete dialog's confirm, `useDeleteMovie`'s twin:
 * it sends the delete and, on resolution, goes back through `useGoBack` — one
 * **History step**, or the Series tab, its **Landing**, when nothing is behind.
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

/** A screen whose only control is the one this hook returns. */
function Screen() {
  const { deleting, refusal, deleteSeries } = useDeleteSeries('harbor');

  return (
    <>
      <span>Series screen</span>
      <span data-testid="deleting">{String(deleting)}</span>
      <span data-testid="refusal">{refusal ?? 'none'}</span>
      <button
        type="button"
        onClick={() => {
          void Promise.resolve(deleteSeries()).catch(() => undefined);
        }}
      >
        Delete series
      </button>
    </>
  );
}

function renderAt(
  initialEntries: MemoryRouterProps['initialEntries'],
  initialIndex?: number
) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<span>Browse home</span>} />
        <Route path="/series/:id" element={<Screen />} />
      </Routes>
    </MemoryRouter>
  );
}

const confirm = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Delete series' }));

/** A delete the test settles by hand, so `deleting` can be read in flight. */
function holdDelete() {
  let settle: (response: Response) => void = () => undefined;
  fetchMock.mockReturnValue(
    new Promise<Response>((resolve) => {
      settle = resolve;
    })
  );
  return { settle: (response: Response) => settle(response) };
}

const deleting = () => screen.getByTestId('deleting').textContent;

describe('useDeleteSeries', () => {
  it('sends DELETE to the series’ route', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    renderAt(['/?tab=series', '/series/harbor'], 1);

    confirm();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/series/harbor');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });

  it('goes back one step on 204, to where the series was opened from', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    renderAt(['/', '/?tab=series&genre=Drama', '/series/harbor'], 2);

    confirm();

    await waitFor(() => expect(url()).toBe('/?tab=series&genre=Drama'));
  });

  it('goes back one step on 404 too — gone is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown series: harbor'));
    renderAt(['/', '/?tab=series', '/series/harbor'], 2);

    confirm();

    await waitFor(() => expect(url()).toBe('/?tab=series'));
  });

  it('lands on the Series tab when nothing is behind the page', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    // Deep-linked or reloaded: the Series tab is this screen's Landing, not
    // the Movies home.
    renderAt(['/series/harbor']);

    confirm();

    await waitFor(() => expect(url()).toBe('/?tab=series'));
  });

  it('stays where it is when the delete is refused', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());
    renderAt(['/', '/?tab=series', '/series/harbor'], 2);

    confirm();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(url()).toBe('/series/harbor');
    expect(screen.getByText('Series screen')).toBeTruthy();
  });
});

describe('useDeleteSeries — deleting', () => {
  it('is false before anything is asked', () => {
    renderAt(['/', '/series/harbor'], 1);

    expect(deleting()).toBe('false');
  });

  it('is true for the life of the request', async () => {
    const request = holdDelete();
    renderAt(['/', '/?tab=series', '/series/harbor'], 2);

    confirm();

    await waitFor(() => expect(deleting()).toBe('true'));
    expect(url()).toBe('/series/harbor');

    request.settle(noContentResponse());

    await waitFor(() => expect(url()).toBe('/?tab=series'));
  });

  it('is false again after a refusal, with the location untouched', async () => {
    const request = holdDelete();
    renderAt(['/', '/?tab=series', '/series/harbor'], 2);

    confirm();
    await waitFor(() => expect(deleting()).toBe('true'));

    request.settle(serverErrorResponse());

    await waitFor(() => expect(deleting()).toBe('false'));
    expect(url()).toBe('/series/harbor');
  });
});

/**
 * 47 — Manage library, issue #413: `useDeleteMovie`'s twin. A `409`'s one
 * sentence is held as `refusal` until the next press is answered — cleared
 * when it deletes, replaced when it is refused again. Nothing moves on a
 * refusal.
 */
const NO_SHELL =
  'Only the desktop app can move a linked title’s files to the Recycle Bin.';
const LOCKED =
  'Couldn’t move Harbor & Vine to the Recycle Bin. Close anything playing it and try again.';
const refusal = () => screen.getByTestId('refusal').textContent;

describe('useDeleteSeries — refusal', () => {
  it('holds the route’s sentence on a 409, and stays on the show', async () => {
    fetchMock.mockResolvedValue(conflictResponse(NO_SHELL));
    renderAt(['/', '/?tab=series', '/series/harbor'], 2);
    expect(refusal()).toBe('none');

    confirm();

    await waitFor(() => expect(refusal()).toBe(NO_SHELL));
    expect(deleting()).toBe('false');
    expect(url()).toBe('/series/harbor');
  });

  it('holds the sentence until the next press is answered', async () => {
    fetchMock.mockResolvedValueOnce(conflictResponse(NO_SHELL));
    renderAt(['/', '/?tab=series', '/series/harbor'], 2);
    confirm();
    await waitFor(() => expect(refusal()).toBe(NO_SHELL));

    holdDelete();
    confirm();

    await waitFor(() => expect(deleting()).toBe('true'));
    expect(refusal()).toBe(NO_SHELL);
  });

  it('replaces the sentence with the next press’s own refusal', async () => {
    fetchMock
      .mockResolvedValueOnce(conflictResponse(NO_SHELL))
      .mockResolvedValueOnce(conflictResponse(LOCKED));
    renderAt(['/', '/?tab=series', '/series/harbor'], 2);

    confirm();
    await waitFor(() => expect(refusal()).toBe(NO_SHELL));
    confirm();

    await waitFor(() => expect(refusal()).toBe(LOCKED));
    expect(url()).toBe('/series/harbor');
  });

  it('clears the sentence and goes back once the next press deletes', async () => {
    fetchMock
      .mockResolvedValueOnce(conflictResponse(LOCKED))
      .mockResolvedValueOnce(noContentResponse());
    renderAt(['/', '/?tab=series', '/series/harbor'], 2);

    confirm();
    await waitFor(() => expect(refusal()).toBe(LOCKED));
    confirm();

    await waitFor(() => expect(url()).toBe('/?tab=series'));
  });
});
