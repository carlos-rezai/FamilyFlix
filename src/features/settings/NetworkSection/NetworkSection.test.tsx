import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { NetworkSection } from './NetworkSection';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';

/**
 * 23 — Enrichment, Phase 1: "the TMDB key" (issue #203).
 *
 * The Settings hub's fifth **Settings group**, `Network`, from
 * `page.SettingsPage.dc.html`: the Group heading over a **Section card**
 * titled _The Movie Database (TMDB)_ with its status pill, the lede, the
 * masked key field in mono, and _Test connection_. The section owns
 * `useTmdbKey`: the stored key read on mount through `GET /api/tmdb/key` and
 * shown masked; _Test connection_ is the test and the save in one,
 * `POST /api/tmdb/key { key }` — _Testing…_ while it asks, _Test again_ once
 * connected. The pill reads _Connected_ while the stored key is in the field
 * and _Not set up_ the moment it is edited.
 *
 * The four outcomes each raise a plain notice through `useSnackbar()` — the
 * **Snackbar stack**'s first callers — asserted through the real
 * `SnackbarProvider`: _Paste a key first._ (warning), _Connected to TMDB._
 * (success), _TMDB didn't accept that key._ (error), _Couldn't reach TMDB._
 * (error).
 */

type FetchMock = ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

let fetchMock: FetchMock;

const KEY_ROUTE = '/api/tmdb/key';
const STORED_KEY = '0123456789abcdef0123456789abcdef';
const NEW_KEY = 'fedcba9876543210fedcba9876543210';

/** A refusal by status, carrying the route's own sentence. */
function statusResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: `status ${status}` }),
  } as unknown as Response;
}

/** A request that answers only when the test says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return { pending, settle: (response: Response) => settle(response) };
}

const isPost = (init?: RequestInit) =>
  (init?.method ?? 'GET').toUpperCase() === 'POST';

/**
 * The key read answers `stored`; the save answers `save` — a response, or a
 * held request the test settles.
 */
function answerWith({
  stored = null,
  save = okResponse({ key: NEW_KEY }),
}: {
  stored?: string | null;
  save?: Response | Promise<Response>;
} = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === KEY_ROUTE && isPost(init)) {
      return Promise.resolve(save);
    }
    if (url === KEY_ROUTE) {
      return Promise.resolve(okResponse({ key: stored }));
    }
    return Promise.reject(new Error(`unexpected request: ${url}`));
  });
}

const posts = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) => String(input) === KEY_ROUTE && isPost(init)
  );

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

function renderSection() {
  return render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <NetworkSection />
      </SnackbarProvider>
    </ThemeProvider>
  );
}

const keyField = () =>
  screen.getByPlaceholderText('Paste your TMDB API key') as HTMLInputElement;
const testButton = (name: string | RegExp) =>
  screen.getByRole('button', { name });

/** Waits for the key read to have been asked and answered. */
async function loaded() {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  // Let the answer land, so a typed key is never overwritten by the read.
  await act(async () => {
    await Promise.resolve();
  });
}

describe('NetworkSection — what it draws', () => {
  it('draws the Network group heading in small caps', async () => {
    answerWith();
    renderSection();
    await loaded();

    const heading = screen.getByText('Network');
    expect(getComputedStyle(heading).textTransform).toBe('uppercase');
  });

  it('titles the card The Movie Database (TMDB)', async () => {
    answerWith();
    renderSection();
    await loaded();

    expect(screen.getByText('The Movie Database (TMDB)')).toBeDefined();
  });

  it('draws the lede', async () => {
    answerWith();
    renderSection();
    await loaded();

    expect(
      screen.getByText(
        /Nothing is sent about your household — just movie titles, to look up posters and synopses/
      )
    ).toBeDefined();
  });

  it('draws the key field masked, in mono', async () => {
    answerWith();
    renderSection();
    await loaded();

    expect(keyField().type).toBe('password');
    expect(getComputedStyle(keyField()).fontFamily).toMatch(/mono/i);
  });

  it('reads Not set up and Test connection with no key stored', async () => {
    answerWith({ stored: null });
    renderSection();
    await loaded();

    expect(screen.getByText('Not set up')).toBeDefined();
    expect(testButton('Test connection')).toBeDefined();
    expect(keyField().value).toBe('');
  });
});

describe('NetworkSection — a stored key', () => {
  it('comes back masked in the field', async () => {
    answerWith({ stored: STORED_KEY });
    renderSection();

    await waitFor(() => expect(keyField().value).toBe(STORED_KEY));
    expect(keyField().type).toBe('password');
  });

  it('reads Connected and Test again', async () => {
    answerWith({ stored: STORED_KEY });
    renderSection();

    await waitFor(() => expect(screen.getByText('Connected')).toBeDefined());
    expect(testButton('Test again')).toBeDefined();
    expect(screen.queryByText('Not set up')).toBeNull();
  });

  it('flips the pill to Not set up the moment the key is edited', async () => {
    const user = userEvent.setup();
    answerWith({ stored: STORED_KEY });
    renderSection();
    await waitFor(() => expect(screen.getByText('Connected')).toBeDefined());

    await user.type(keyField(), 'x');

    expect(screen.getByText('Not set up')).toBeDefined();
    expect(screen.queryByText('Connected')).toBeNull();
    expect(testButton('Test connection')).toBeDefined();
  });
});

describe('NetworkSection — Test connection', () => {
  it('raises Paste a key first. as a warning for an empty field, and asks nothing', async () => {
    const user = userEvent.setup();
    answerWith({ stored: null });
    renderSection();
    await loaded();

    await user.click(testButton('Test connection'));

    const notice = await within(snackbarStack()).findByRole('alert');
    expect(within(notice).getByText('Paste a key first.')).toBeDefined();
    expect(posts()).toHaveLength(0);
  });

  it('takes a blank field as empty', async () => {
    const user = userEvent.setup();
    answerWith({ stored: null });
    renderSection();
    await loaded();

    await user.type(keyField(), '   ');
    await user.click(testButton('Test connection'));

    const notice = await within(snackbarStack()).findByRole('alert');
    expect(within(notice).getByText('Paste a key first.')).toBeDefined();
    expect(posts()).toHaveLength(0);
  });

  it('sends the key in the field and reads Testing… while it asks', async () => {
    const user = userEvent.setup();
    const save = held();
    answerWith({ stored: null, save: save.pending });
    renderSection();
    await loaded();

    await user.type(keyField(), NEW_KEY);
    await user.click(testButton('Test connection'));

    await waitFor(() => expect(testButton('Testing…')).toBeDefined());
    expect(posts()).toHaveLength(1);
    const [, init] = posts()[0];
    expect(JSON.parse(String(init?.body))).toEqual({ key: NEW_KEY });

    save.settle(okResponse({ key: NEW_KEY }));
    await waitFor(() => expect(testButton('Test again')).toBeDefined());
  });

  it('raises Connected to TMDB. as a success and reads Connected once accepted', async () => {
    const user = userEvent.setup();
    answerWith({ stored: null, save: okResponse({ key: NEW_KEY }) });
    renderSection();
    await loaded();

    await user.type(keyField(), NEW_KEY);
    await user.click(testButton('Test connection'));

    const notice = await within(snackbarStack()).findByRole('status');
    expect(within(notice).getByText('Connected to TMDB.')).toBeDefined();
    expect(screen.getByText('Connected')).toBeDefined();
    expect(testButton('Test again')).toBeDefined();
  });

  it("raises TMDB didn't accept that key. as an error on a 422", async () => {
    const user = userEvent.setup();
    answerWith({ stored: null, save: statusResponse(422) });
    renderSection();
    await loaded();

    await user.type(keyField(), NEW_KEY);
    await user.click(testButton('Test connection'));

    const notice = await within(snackbarStack()).findByRole('alert');
    expect(
      within(notice).getByText("TMDB didn't accept that key.")
    ).toBeDefined();
    expect(screen.getByText('Not set up')).toBeDefined();
    expect(testButton('Test connection')).toBeDefined();
  });

  it("raises Couldn't reach TMDB. as an error on a 503", async () => {
    const user = userEvent.setup();
    answerWith({ stored: null, save: statusResponse(503) });
    renderSection();
    await loaded();

    await user.type(keyField(), NEW_KEY);
    await user.click(testButton('Test connection'));

    const notice = await within(snackbarStack()).findByRole('alert');
    expect(within(notice).getByText("Couldn't reach TMDB.")).toBeDefined();
    expect(screen.getByText('Not set up')).toBeDefined();
    expect(testButton('Test connection')).toBeDefined();
  });
});
