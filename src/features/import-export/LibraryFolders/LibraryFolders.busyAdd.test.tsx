import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolder } from '@/types';
import { theme } from '@/styles/theme';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';

/**
 * 53 — Loading states, Phase 4 (issue #486): Library folders' _Add_ as a busy
 * button.
 *
 * `useLibraryFolders`' `adding` runs on the **Loader timing**: _Add_ locks at
 * once on its idle label, reads _Adding…_ only once the add has run 300ms (it
 * had no label change before), and the new row or the refusal line appears
 * only after the 500ms hold. _Browse…_ beside it is disabled from the press
 * until the add settles.
 *
 * Drawn under the Desktop shell, so _Browse…_ is there. The list is read on
 * real timers; the clock is faked from the press on.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const KIDS: LibraryFolder = {
  id: 'f-kids',
  path: 'D:\\Kids',
  titleCount: 0,
  reachable: true,
};

const INSIDE =
  'That folder is inside E:\\Movies, which is already a library folder.';

/** A refusal the route words: `{ error }` under its status. */
function refusedResponse(status: number, error: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

/** The add in flight, answered when the test says so. */
let settleAdd: (response: Response) => void;

beforeEach(() => {
  settleAdd = () => undefined;
  fetchMock = vi.fn<FetchFn>();
  fetchMock.mockImplementation((_input, init) =>
    (init?.method ?? 'GET') === 'POST'
      ? new Promise<Response>((resolve) => {
          settleAdd = resolve;
        })
      : Promise.resolve(okResponse([]))
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** _Add_, under whichever label it wears. */
const addButton = () =>
  screen.getByRole('button', { name: /^(Add|Adding…)$/ }) as HTMLButtonElement;

const browseButton = () =>
  screen.getByRole('button', { name: 'Browse…' }) as HTMLButtonElement;

/** The page with the list landed and `D:\Kids` typed in the add row. */
async function typedKids() {
  render(
    <MemoryRouter initialEntries={['/settings/folders']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings/folders" element={<LibraryFolders />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeNull());
  fireEvent.change(screen.getByRole('textbox', { name: 'Folder path' }), {
    target: { value: KIDS.path },
  });
}

/** Move the clock on, and let every promise it frees settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Press _Add_ on a faked clock. */
function pressAdd() {
  vi.useFakeTimers();
  fireEvent.click(addButton());
}

async function answer(response: Response) {
  await act(async () => {
    settleAdd(response);
  });
}

describe('LibraryFolders — Add on the Loader timing', () => {
  fakeFolderBridge();

  it('locks at once on Add, and reads Adding… only after 300ms', async () => {
    await typedKids();
    pressAdd();

    expect(addButton().disabled).toBe(true);
    expect(addButton().getAttribute('aria-busy')).toBe('true');
    expect(addButton().textContent).toBe('Add');

    await advance(299);
    expect(addButton().textContent).toBe('Add');
    expect(screen.queryByText('Adding…')).toBeNull();

    await advance(1);
    expect(addButton().textContent).toBe('Adding…');
    expect(addButton().querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Adding…'
    );

    await answer(createdResponse(KIDS));
    await advance(500);
  });

  it('never reads Adding… for an add under 300ms, and draws the row at once', async () => {
    await typedKids();
    pressAdd();

    await advance(100);
    await answer(createdResponse(KIDS));
    await advance(0);

    expect(screen.queryByText('Adding…')).toBeNull();
    expect(screen.getByText(KIDS.path)).toBeDefined();
  });

  it('draws the new row only once the 500ms hold is out', async () => {
    await typedKids();
    pressAdd();

    // Shown at 300ms; the add lands at 400ms; the hold runs to 800ms.
    await advance(400);
    await answer(createdResponse(KIDS));

    await advance(399);
    expect(addButton().textContent).toBe('Adding…');
    expect(screen.queryByText(KIDS.path)).toBeNull();
    expect(screen.getByText('No folders yet.')).toBeDefined();

    await advance(1);
    expect(screen.getByText(KIDS.path)).toBeDefined();
    expect(screen.queryByText('No folders yet.')).toBeNull();
  });

  it('draws the refusal line only once the 500ms hold is out', async () => {
    await typedKids();
    pressAdd();

    await advance(400);
    await answer(refusedResponse(409, INSIDE));

    await advance(399);
    expect(addButton().textContent).toBe('Adding…');
    expect(screen.queryByText(INSIDE)).toBeNull();

    await advance(1);
    expect(screen.getByText(INSIDE)).toBeDefined();
    expect(addButton().textContent).toBe('Add');
  });

  it('disables Browse… from the press, and makes it live again once the add settles', async () => {
    await typedKids();
    expect(browseButton().disabled).toBe(false);
    pressAdd();

    expect(browseButton().disabled).toBe(true);

    await advance(400);
    await answer(createdResponse(KIDS));

    await advance(399);
    expect(browseButton().disabled).toBe(true);

    await advance(1);
    expect(browseButton().disabled).toBe(false);
  });
});
