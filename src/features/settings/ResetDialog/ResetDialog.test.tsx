import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { ResetDialog } from './ResetDialog';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { stubLocation } from '@/test-support/stubLocation/stubLocation';
import {
  conflictResponse,
  noContentResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 37 — Factory reset, the surface (issue #299).
 *
 * The **Reset dialog**, from `page.SettingsPage.dc.html`, drawn on `Modal`:
 * _Erase everything?_ over _This can’t be undone._ with the warning triangle;
 * the **What goes** and **What stays** lists in the PRD's copy; a refusal in
 * danger ink above the buttons; _Erase everything_ (`danger`, busy and
 * disabled in flight) before _Cancel_. Amended by 53, Loading states (issue
 * #487): once the reset has run 300ms the dialog becomes the **Dialog
 * loader** reading _Erasing everything_, rather than the button _Erasing…_. The Modal's own contract is tested with
 * the Modal; what is left here is what makes this dialog _this_ dialog. Focus
 * lands on the card — no initial-focus prop, no type-to-confirm — so Enter
 * alone erases nothing.
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

const TITLE = 'Erase everything?';
const IMPORT_RUNNING =
  'An import is running. Stop it before erasing everything.';
const DANGER = 'rgb(201, 122, 106)';

const WHAT_GOES = [
  'Every title, with its watch history, ratings and hearts',
  'The library folders list',
  'Every setting, the TMDB key included',
  'Everything in the media folder',
  'An uploaded playback component',
];
const WHAT_STAYS = [
  'Your library folders and every file in them',
  'Your exports',
  'FamilyFlix itself',
];

function renderDialog({
  open = true,
  onClose = () => undefined,
}: { open?: boolean; onClose?: () => void } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ResetDialog open={open} onClose={onClose} />
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog', { name: TITLE });
const scrim = () => dialog().parentElement as HTMLElement;
const erase = () => screen.getByRole('button', { name: /^Eras/ });
const cancel = () => screen.getByRole('button', { name: 'Cancel' });

/** A request that answers only when the test says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return { pending, settle: (response: Response) => settle(response) };
}

/** The list under a heading: the `ul` that follows it. */
function listUnder(heading: string): HTMLElement {
  const label = within(dialog()).getByText(heading);
  const lists = within(dialog()).getAllByRole('list');
  const list = lists.find((candidate) => comesBefore(label, candidate));
  if (!list) {
    throw new Error(`no list under ${heading}`);
  }
  return list;
}

describe('ResetDialog — closed', () => {
  it('renders nothing', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ResetDialog — the copy', () => {
  it('is titled Erase everything?, with This can’t be undone. under it', () => {
    renderDialog();

    expect(dialog()).toBeDefined();
    expect(
      within(dialog()).getByRole('heading', { name: TITLE })
    ).toBeDefined();
    expect(within(dialog()).getByText('This can’t be undone.')).toBeDefined();
  });

  it('lists What goes, in the PRD’s copy and order', () => {
    renderDialog();

    const items = within(listUnder('What goes')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(WHAT_GOES);
  });

  it('lists What stays after it, in the PRD’s copy and order', () => {
    renderDialog();

    const goes = listUnder('What goes');
    const stays = listUnder('What stays');
    expect(stays).not.toBe(goes);
    expect(comesBefore(goes, stays)).toBe(true);
    const items = within(stays).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(WHAT_STAYS);
  });

  it('draws the warning glyph, decorative', () => {
    renderDialog();

    const glyph = dialog().querySelector('svg');
    expect(glyph).not.toBeNull();
    expect(glyph?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('ResetDialog — the buttons', () => {
  it('draws Erase everything before Cancel', () => {
    renderDialog();

    expect(erase().textContent).toBe('Erase everything');
    expect(comesBefore(erase(), cancel())).toBe(true);
  });
});

describe('ResetDialog — an erase', () => {
  const location = stubLocation();

  it('is disabled while the request runs, then reads Erasing everything once shown', async () => {
    const request = held();
    fetchMock.mockReturnValue(request.pending);
    renderDialog();

    await userEvent.click(erase());

    expect((erase() as HTMLButtonElement).disabled).toBe(true);
    expect(
      await screen.findByRole('status', { name: 'Erasing everything' })
    ).toBeDefined();
    await act(async () => {
      request.settle(noContentResponse());
      await request.pending;
    });
    // The reload waits out the loader's hold; let it land inside this test.
    await waitFor(() => expect(location.assigned()).toEqual(['/']));
  });

  it('posts the reset and reloads onto /', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    renderDialog();

    await userEvent.click(erase());

    await waitFor(() => expect(location.assigned()).toEqual(['/']));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/reset');
  });

  it('draws a refusal in danger ink above the buttons', async () => {
    fetchMock.mockResolvedValue(conflictResponse(IMPORT_RUNNING));
    renderDialog();

    await userEvent.click(erase());

    const line = await within(dialog()).findByText(IMPORT_RUNNING);
    expect(getComputedStyle(line).color).toBe(DANGER);
    expect(comesBefore(line, erase())).toBe(true);
    expect(location.assigned()).toEqual([]);
  });

  it('draws no refusal before one is answered', () => {
    renderDialog();

    expect(within(dialog()).queryByText(IMPORT_RUNNING)).toBeNull();
  });

  it('leaves the dialog as it was on a failure, the button live again', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());
    renderDialog();

    await userEvent.click(erase());

    await waitFor(() =>
      expect((erase() as HTMLButtonElement).disabled).toBe(false)
    );
    expect(erase().textContent).toBe('Erase everything');
    expect(location.assigned()).toEqual([]);
  });
});

describe('ResetDialog — the ways out', () => {
  it.each([
    ['Cancel', () => fireEvent.click(cancel())],
    [
      'the ✕',
      () => fireEvent.click(screen.getByRole('button', { name: 'Close' })),
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

describe('ResetDialog — focus', () => {
  it('lands on the card, not a button', () => {
    renderDialog();

    expect(document.activeElement).toBe(dialog());
  });

  it('erases nothing on Enter alone', () => {
    renderDialog();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Enter',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
