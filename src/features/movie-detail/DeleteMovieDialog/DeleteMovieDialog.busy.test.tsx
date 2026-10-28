import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { DeleteMovieDialog } from './DeleteMovieDialog';
import type { LinkedFiles } from '@/types';
import { theme } from '@/styles/theme';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';
import {
  noContentResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 53 — Loading states, Phase 6 (issue #488): the movie page's **Delete
 * dialog** in the **Reset dialog**'s shape.
 *
 * From the confirm press the dialog is **Locked** and _Cancel_ disabled, in
 * `waiting` too; once the delete has run 300ms it becomes the **Dialog
 * loader** reading _Deleting “Northwind”_, saying nothing about files. A
 * delete that lands goes back one step, only after the 500ms hold; a failed
 * one returns the live idle face with _Couldn’t delete “Northwind”. Try
 * again._, cleared by the next confirm.
 *
 * The clock is faked from the press on.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** The delete in flight, answered when the test says so. */
let answer: (response: Response) => void;

beforeEach(() => {
  answer = () => undefined;
  const fetchMock = vi.fn<FetchFn>();
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const TITLE = 'Northwind';
const DELETING = 'Deleting “Northwind”';
const FAILED = 'Couldn’t delete “Northwind”. Try again.';

function renderDialog({
  linkedFiles = null,
  onClose = () => undefined,
}: { linkedFiles?: LinkedFiles | null; onClose?: () => void } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={['/', '/genre/Drama', '/movie/m1']}
        initialIndex={2}
      >
        <LocationProbe />
        <Routes>
          <Route path="/" element={<h1>Your library</h1>} />
          <Route path="/genre/:name" element={<h1>Drama</h1>} />
          <Route
            path="/movie/:id"
            element={
              <DeleteMovieDialog
                movieId="m1"
                title={TITLE}
                deleteFacts={{
                  path: 'E:\\Movies\\Northwind',
                  linkedFiles,
                  originalPath: null,
                }}
                open
                onClose={onClose}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const dialog = () =>
  screen.queryByRole('dialog', { name: `Delete “${TITLE}”?` });
const liveDialog = () => dialog() as HTMLElement;
const confirm = () =>
  within(liveDialog()).getByRole('button', {
    name: /^Delet/,
  }) as HTMLButtonElement;
const cancel = () =>
  within(liveDialog()).getByRole('button', {
    name: 'Cancel',
  }) as HTMLButtonElement;
const loader = () => screen.queryByRole('status', { name: DELETING });

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function pressDelete() {
  vi.useFakeTimers();
  fireEvent.click(confirm());
}

async function respond(response: Response) {
  await act(async () => {
    answer(response);
  });
}

async function failOnce() {
  pressDelete();
  await advance(300);
  await respond(serverErrorResponse());
  await advance(500);
}

describe('DeleteMovieDialog — locked from the confirm press', () => {
  it('locks at once, while waiting: no ✕, Cancel disabled, the confirm busy on its idle label', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    pressDelete();

    expect(confirm().disabled).toBe(true);
    expect(confirm().getAttribute('aria-busy')).toBe('true');
    expect(confirm().textContent).toBe('Delete movie');
    expect(cancel().disabled).toBe(true);
    expect(
      within(liveDialog()).queryByRole('button', { name: 'Close' })
    ).toBeNull();

    fireEvent.click(cancel());
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(liveDialog().parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    await respond(noContentResponse());
    await advance(500);
  });

  it('becomes the dialog loader reading Deleting “Northwind” at 300ms, still locked', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    pressDelete();

    await advance(299);
    expect(loader()).toBeNull();
    expect(dialog()).not.toBeNull();

    await advance(1);
    const status = loader();
    expect(status).not.toBeNull();
    expect(status?.closest('[aria-busy="true"]')).not.toBeNull();
    expect(dialog()).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    await respond(noContentResponse());
    await advance(500);
  });

  it.each<[string, LinkedFiles | null]>([
    ['a copied film', null],
    ['a linked film', 'folder'],
  ])('says nothing about files for %s', async (_, linkedFiles) => {
    renderDialog({ linkedFiles });
    pressDelete();
    await advance(300);

    expect(loader()).not.toBeNull();
    expect(
      within(screen.getByRole('dialog')).queryByText(
        /file|folder|recycle|original|keep/i
      )
    ).toBeNull();

    await respond(noContentResponse());
    await advance(500);
  });
});

describe('DeleteMovieDialog — a delete that lands', () => {
  it('goes back one step only once the loader’s hold is out', async () => {
    renderDialog();
    pressDelete();
    await advance(300);

    await respond(noContentResponse());
    await advance(499);
    expect(url()).toBe('/movie/m1');
    expect(loader()).not.toBeNull();

    await advance(1);
    expect(url()).toBe('/genre/Drama');
  });
});

describe('DeleteMovieDialog — a failed delete', () => {
  it('returns, after the hold, to the live idle face with the failure line, staying put', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    pressDelete();
    await advance(300);

    await respond(serverErrorResponse());
    await advance(499);
    expect(loader()).not.toBeNull();
    expect(screen.queryByText(FAILED)).toBeNull();

    await advance(1);
    expect(loader()).toBeNull();
    expect(within(liveDialog()).getByText(FAILED)).toBeDefined();
    expect(confirm().disabled).toBe(false);
    expect(confirm().getAttribute('aria-busy')).not.toBe('true');
    expect(confirm().textContent).toBe('Delete movie');
    expect(cancel().disabled).toBe(false);
    expect(url()).toBe('/movie/m1');

    fireEvent.click(
      within(liveDialog()).getByRole('button', { name: 'Close' })
    );
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(cancel());
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('draws the failure line above the buttons', async () => {
    renderDialog();
    await failOnce();

    const line = within(liveDialog()).getByText(FAILED);
    expect(
      line.compareDocumentPosition(confirm()) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('clears the failure line on the next confirm, before the new attempt is answered', async () => {
    renderDialog();
    await failOnce();

    fireEvent.click(confirm());

    expect(screen.queryByText(FAILED)).toBeNull();
    expect(confirm().getAttribute('aria-busy')).toBe('true');

    await respond(noContentResponse());
    await advance(500);
  });
});
