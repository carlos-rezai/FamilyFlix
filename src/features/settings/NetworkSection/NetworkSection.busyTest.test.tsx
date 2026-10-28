import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { NetworkSection } from './NetworkSection';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53 — Loading states, Phase 4 (issue #486): _Test connection_ as a busy
 * button.
 *
 * `useTmdbKey`'s `testing` runs on the **Loader timing**: _Test connection_
 * locks at once on its idle label, reads _Testing…_ only once the test has
 * run 300ms, and its result (the notice, the pill, _Test again_) is drawn
 * only after the 500ms hold, because it follows `run`'s promise.
 *
 * The key read lands on real timers; the clock is faked from the press on.
 */

const KEY_ROUTE = '/api/tmdb/key';
const NEW_KEY = 'fedcba9876543210fedcba9876543210';
const NOTICE = 'Connected to TMDB.';

const isPost = (init?: RequestInit) =>
  (init?.method ?? 'GET').toUpperCase() === 'POST';

const { fetchMock, respond } = heldFetch((url, init) =>
  url === KEY_ROUTE && isPost(init) ? undefined : okResponse({ key: null })
);

afterEach(() => {
  vi.useRealTimers();
});

/** The section with the key read landed and a new key typed. */
async function typedNewKey() {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <NetworkSection />
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.change(screen.getByPlaceholderText('Paste your TMDB API key'), {
    target: { value: NEW_KEY },
  });
}

/** _Test connection_, under whichever label it wears. */
const testButton = () =>
  screen.getByRole('button', {
    name: /^(Test connection|Testing…|Test again)$/,
  }) as HTMLButtonElement;

const notice = () => within(snackbarStack()).queryByText(NOTICE);

/** Press _Test connection_ on a faked clock. */
function pressTest() {
  vi.useFakeTimers();
  fireEvent.click(testButton());
}

/** Answer the test as accepted. */
async function accept() {
  await respond(okResponse({ key: NEW_KEY }));
}

describe('NetworkSection — Test connection on the Loader timing', () => {
  it('locks at once on Test connection, and reads Testing… only after 300ms', async () => {
    await typedNewKey();
    pressTest();

    expect(testButton().disabled).toBe(true);
    expect(testButton().getAttribute('aria-busy')).toBe('true');
    expect(testButton().textContent).toBe('Test connection');

    await advanceClock(299);
    expect(testButton().textContent).toBe('Test connection');
    expect(screen.queryByText('Testing…')).toBeNull();

    await advanceClock(1);
    expect(testButton().textContent).toBe('Testing…');
    expect(
      testButton().querySelector('[aria-live="polite"]')?.textContent
    ).toBe('Testing…');

    await accept();
    await advanceClock(500);
  });

  it('never reads Testing… for a test under 300ms, and answers at once', async () => {
    await typedNewKey();
    pressTest();

    await advanceClock(100);
    await accept();
    await advanceClock(0);

    expect(screen.queryByText('Testing…')).toBeNull();
    expect(testButton().textContent).toBe('Test again');
    expect(notice()).not.toBeNull();
  });

  it('draws its result only once the 500ms hold is out', async () => {
    await typedNewKey();
    pressTest();

    // Shown at 300ms; the test lands at 400ms; the hold runs to 800ms.
    await advanceClock(400);
    await accept();

    await advanceClock(399);
    expect(testButton().textContent).toBe('Testing…');
    expect(notice()).toBeNull();
    expect(screen.getByText('Not set up')).toBeDefined();

    await advanceClock(1);
    expect(testButton().textContent).toBe('Test again');
    expect(testButton().disabled).toBe(false);
    expect(notice()).not.toBeNull();
    expect(screen.getByText('Connected')).toBeDefined();
  });
});
