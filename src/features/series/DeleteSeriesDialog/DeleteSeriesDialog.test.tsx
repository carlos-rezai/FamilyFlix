import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { DeleteSeriesDialog } from './DeleteSeriesDialog';
import type { LinkedFiles } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';
import {
  conflictResponse,
  noContentResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 38 — Title editing, Slice 1: "delete a series" (issue #304).
 *
 * The series' **Delete dialog** on `Modal`, worded the movie dialog's way
 * (log 38 Q18, `page.SeriesPage.dc.html`): the show named in the heading, the
 * episode count in the body, _Delete series_ before _Cancel_, _Deleting…_ in
 * flight, and four ways out that send nothing.
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

interface RenderDialogOptions {
  open?: boolean;
  title?: string;
  episodeCount?: number;
  linkedFiles?: LinkedFiles | null;
  onClose?: () => void;
}

function renderDialog({
  open = true,
  title = 'F’ck That’s Delicious',
  episodeCount = 24,
  linkedFiles = null,
  onClose = () => undefined,
}: RenderDialogOptions = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={['/?tab=series', '/series/ftd']}
        initialIndex={1}
      >
        <LocationProbe />
        <Routes>
          <Route path="/" element={<h1>Your library</h1>} />
          <Route
            path="/series/:id"
            element={
              <DeleteSeriesDialog
                seriesId="ftd"
                title={title}
                episodeCount={episodeCount}
                deleteFacts={{ path: '', linkedFiles, originalPath: null }}
                open={open}
                onClose={onClose}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog');
const scrim = () => dialog().parentElement as HTMLElement;
const confirmButton = () =>
  within(dialog()).getByRole('button', { name: 'Delete series' });
const cancelButton = () =>
  within(dialog()).getByRole('button', { name: 'Cancel' });
const deletingButton = () =>
  within(dialog()).getByRole('button', { name: 'Deleting…' });

/** A delete the test settles by hand, so the dialog can be read in flight. */
function holdDelete() {
  let settle: (response: Response) => void = () => undefined;
  fetchMock.mockReturnValue(
    new Promise<Response>((resolve) => {
      settle = resolve;
    })
  );
  return { settle: (response: Response) => settle(response) };
}

describe('DeleteSeriesDialog — the copy', () => {
  it('titles itself with the show’s name, in the prototype’s quotes', () => {
    renderDialog({ title: 'F’ck That’s Delicious' });

    const name = 'Delete “F’ck That’s Delicious”?';
    expect(screen.getByRole('dialog', { name })).toBeTruthy();
    expect(within(dialog()).getByRole('heading', { name })).toBeTruthy();
  });

  it('names whichever show it was handed', () => {
    renderDialog({ title: 'Harbor & Vine' });

    expect(
      screen.getByRole('dialog', { name: 'Delete “Harbor & Vine”?' })
    ).toBeTruthy();
  });

  it('says it can’t be undone, exactly', () => {
    renderDialog();

    expect(within(dialog()).getByText('This can’t be undone.')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DeleteSeriesDialog — the two buttons', () => {
  it('offers Delete series and Cancel, in that order', () => {
    renderDialog();

    expect(comesBefore(confirmButton(), cancelButton())).toBe(true);
  });

  it('draws Delete series as the danger button and Cancel as the secondary one', () => {
    renderDialog();

    expect(getComputedStyle(confirmButton()).color).toBe('rgb(201, 122, 106)');
    expect(getComputedStyle(cancelButton()).color).toBe('rgb(243, 236, 224)');
  });

  it('sends the delete from Delete series', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    renderDialog();

    fireEvent.click(confirmButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/series/ftd');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });

  it('reads Deleting… and is disabled while the request runs', async () => {
    holdDelete();
    renderDialog();

    fireEvent.click(confirmButton());

    await waitFor(() => expect(deletingButton()).toBeTruthy());
    expect((deletingButton() as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(dialog()).queryByRole('button', { name: 'Delete series' })
    ).toBeNull();
    fireEvent.click(deletingButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('goes back one step once the series is gone', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    renderDialog();

    fireEvent.click(confirmButton());

    await waitFor(() => expect(url()).toBe('/?tab=series'));
  });

  it('puts the button back and stays put when the delete is refused', async () => {
    const request = holdDelete();
    renderDialog();

    fireEvent.click(confirmButton());
    await waitFor(() => expect(deletingButton()).toBeTruthy());

    request.settle(serverErrorResponse());

    await waitFor(() => expect(confirmButton()).toBeTruthy());
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
    expect(url()).toBe('/series/ftd');
  });
});

describe('DeleteSeriesDialog — the ways out', () => {
  it.each([
    ['Cancel', () => fireEvent.click(cancelButton())],
    [
      'the ✕',
      () =>
        fireEvent.click(
          within(dialog()).getByRole('button', { name: 'Close' })
        ),
    ],
    ['Escape', () => fireEvent.keyDown(dialog(), { key: 'Escape' })],
    ['the scrim', () => fireEvent.click(scrim())],
  ])('closes from %s with no request sent', (_way, leave) => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    leave();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * The refusal line, the overview's: a `409`'s one sentence drawn in danger ink
 * above the buttons, held until the next press is answered — cleared when it
 * deletes, replaced when it is refused again. The page stays on the show.
 */
const NO_SHELL =
  'Only the desktop app can move a linked title’s files to the Recycle Bin.';
const LOCKED =
  'Couldn’t move E:\\Series\\Harbor & Vine to the Recycle Bin. Close anything playing it and try again.';
const DANGER = 'rgb(201, 122, 106)';

describe('DeleteSeriesDialog — the refusal line', () => {
  it('draws a 409’s sentence in danger ink above the buttons', async () => {
    fetchMock.mockResolvedValue(conflictResponse(NO_SHELL));
    renderDialog({ linkedFiles: 'folder' });
    expect(within(dialog()).queryByText(NO_SHELL)).toBeNull();

    fireEvent.click(confirmButton());

    const line = await within(dialog()).findByText(NO_SHELL);
    expect(getComputedStyle(line).color).toBe(DANGER);
    expect(comesBefore(line, confirmButton())).toBe(true);
    expect(comesBefore(line, cancelButton())).toBe(true);
  });

  it('stays on the show, the dialog up and Delete series live again', async () => {
    fetchMock.mockResolvedValue(conflictResponse(NO_SHELL));
    renderDialog({ linkedFiles: 'folder' });

    fireEvent.click(confirmButton());
    await within(dialog()).findByText(NO_SHELL);

    expect(url()).toBe('/series/ftd');
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('holds the sentence while the next press is in flight', async () => {
    fetchMock.mockResolvedValueOnce(conflictResponse(NO_SHELL));
    renderDialog({ linkedFiles: 'folder' });
    fireEvent.click(confirmButton());
    await within(dialog()).findByText(NO_SHELL);

    holdDelete();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(deletingButton()).toBeTruthy());
    expect(within(dialog()).getByText(NO_SHELL)).toBeTruthy();
  });

  it('replaces the sentence with the next press’s own refusal', async () => {
    fetchMock
      .mockResolvedValueOnce(conflictResponse(NO_SHELL))
      .mockResolvedValueOnce(conflictResponse(LOCKED));
    renderDialog({ linkedFiles: 'folder' });

    fireEvent.click(confirmButton());
    await within(dialog()).findByText(NO_SHELL);
    fireEvent.click(confirmButton());

    expect(await within(dialog()).findByText(LOCKED)).toBeTruthy();
    expect(within(dialog()).queryByText(NO_SHELL)).toBeNull();
    expect(url()).toBe('/series/ftd');
  });

  it('lands as it does today once the next press deletes', async () => {
    fetchMock
      .mockResolvedValueOnce(conflictResponse(LOCKED))
      .mockResolvedValueOnce(noContentResponse());
    renderDialog({ linkedFiles: 'folder' });

    fireEvent.click(confirmButton());
    await within(dialog()).findByText(LOCKED);
    fireEvent.click(confirmButton());

    await waitFor(() => expect(url()).toBe('/?tab=series'));
    expect(screen.queryByText(LOCKED)).toBeNull();
  });
});
