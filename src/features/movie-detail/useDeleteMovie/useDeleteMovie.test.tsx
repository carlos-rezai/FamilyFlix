import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  type MemoryRouterProps,
} from 'react-router-dom';

import { useDeleteMovie } from './useDeleteMovie';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';
import {
  noContentResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * The hook behind the Delete dialog's confirm: it sends the delete and, on
 * resolution, goes back through `useGoBack` — the app's one Back rule, which
 * steps through history and falls back to the browse home only when there is
 * none. Not `navigate('/')`: a step lands on the shelf as it was left.
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

/**
 * A screen whose only control is the one this hook returns. Nothing about the
 * screen matters — the hook is the unit, and what it does is move the router.
 */
function Screen() {
  const { deleting, deleteMovie } = useDeleteMovie('m1');

  return (
    <>
      <span>Movie screen</span>
      <span data-testid="deleting">{String(deleting)}</span>
      <button
        type="button"
        // Whether the hook swallows a refusal or rethrows it is the dialog's
        // concern, not this file's; the location is what is asserted here.
        onClick={() => {
          void Promise.resolve(deleteMovie()).catch(() => undefined);
        }}
      >
        Delete movie
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
        <Route path="/genre/:name" element={<span>Genre screen</span>} />
        <Route path="/movie/:id" element={<Screen />} />
      </Routes>
    </MemoryRouter>
  );
}

const confirm = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Delete movie' }));

describe('useDeleteMovie', () => {
  it('sends DELETE to the movie’s route', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    renderAt(['/', '/movie/m1'], 1);

    confirm();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/movies/m1');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });

  it('goes back one step on 204, to the shelf as it was left', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    // Arrived on the movie from a sorted genre shelf, which came from the home.
    // One step is one step: the shelf with its sort, not the home beneath it.
    renderAt(['/', '/genre/Drama?sort=az', '/movie/m1'], 2);
    expect(url()).toBe('/movie/m1');

    confirm();

    await waitFor(() => expect(url()).toBe('/genre/Drama?sort=az'));
  });

  it('goes back one step on 404 too — gone is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown movie: m1'));
    renderAt(['/', '/genre/Drama', '/movie/m1'], 2);

    confirm();

    await waitFor(() => expect(url()).toBe('/genre/Drama'));
  });

  it('lands on the browse home when the page was deep-linked or reloaded', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    // Nothing behind this screen: a history step would leave the maintainer on
    // the page of a movie that no longer exists.
    renderAt(['/movie/m1']);

    confirm();

    await waitFor(() => expect(url()).toBe('/'));
  });

  it('stays where it is when the delete is refused', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());
    renderAt(['/', '/genre/Drama', '/movie/m1'], 2);

    confirm();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Settle whatever the rejection does, then check nothing moved.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(url()).toBe('/movie/m1');
    expect(screen.getByText('Movie screen')).toBeTruthy();
  });
});

/**
 * A delete the test settles by hand, so `deleting` can be read while the
 * request is still running.
 */
function holdDelete() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  fetchMock.mockReturnValue(
    new Promise<Response>((resolve, reject) => {
      settle = resolve;
      refuse = reject;
    })
  );
  return {
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

const deleting = () => screen.getByTestId('deleting').textContent;

describe('useDeleteMovie — deleting', () => {
  it('is false before anything is asked', () => {
    renderAt(['/', '/movie/m1'], 1);

    expect(deleting()).toBe('false');
  });

  it('is true for the life of the request and false once it lands', async () => {
    const request = holdDelete();
    renderAt(['/', '/genre/Drama', '/movie/m1'], 2);

    confirm();

    await waitFor(() => expect(deleting()).toBe('true'));
    // Still running: nothing has moved, and the flag holds.
    expect(url()).toBe('/movie/m1');
    expect(deleting()).toBe('true');

    request.settle(noContentResponse());

    await waitFor(() => expect(url()).toBe('/genre/Drama'));
  });

  it('is false again after a refusal, with the location untouched', async () => {
    const request = holdDelete();
    renderAt(['/', '/genre/Drama', '/movie/m1'], 2);

    confirm();
    await waitFor(() => expect(deleting()).toBe('true'));

    request.settle(serverErrorResponse());

    await waitFor(() => expect(deleting()).toBe('false'));
    expect(url()).toBe('/movie/m1');
  });

  it('is false again when the request itself could not be made', async () => {
    const request = holdDelete();
    renderAt(['/', '/genre/Drama', '/movie/m1'], 2);

    confirm();
    await waitFor(() => expect(deleting()).toBe('true'));

    request.refuse(new TypeError('Failed to fetch'));

    await waitFor(() => expect(deleting()).toBe('false'));
    expect(url()).toBe('/movie/m1');
  });
});
