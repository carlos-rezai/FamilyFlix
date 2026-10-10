import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ExportModal } from './ExportModal';
import { theme } from '@/styles/theme';
import {
  EXPORT_NAME_PREFIX,
  type ExportResult,
  type ExportSummary,
} from '@/types';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 36 — Export name (issue #295).
 *
 * The **Export dialog**'s name row becomes the **Folder name field**, against
 * the revised `feat.ExportModal.dc.html`: under _Save to_, the _Folder name_
 * heading with the titles count at the right end of its label row — absent
 * until the summary lands — then a mono `TextField` with the folder glyph,
 * named _Folder name_, prefilled with today's dated name and never overwritten
 * once edited. What is typed is what is posted. A refusal is drawn under the
 * field it names: a name refusal under _Folder name_ and not under _Save to_,
 * and the other way round.
 *
 * The dialog owns `useExport`, so it is read through its controls and its
 * copy with `fetch` stubbed.
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

const NAME = 'familyflix-collection_08-10-2026';

const SUMMARY: ExportSummary = {
  movieCount: 3,
  seriesCount: 1,
  episodeCount: 8,
  defaultDestination: 'E:\\Movies',
  defaultName: NAME,
};

const WRITTEN: ExportResult = {
  folder: 'E:\\Movies\\Family films',
  movieCount: 3,
  seriesCount: 1,
};

const isPost = (init?: RequestInit) => init?.method === 'POST';

/** A 400 carrying the route's sentence and the field it names. */
function refused(field: 'destination' | 'name', error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error, field }),
  } as unknown as Response;
}

function serve({
  summary = 'ok',
  post = () => Promise.resolve(createdResponse(WRITTEN)),
}: {
  summary?: 'ok' | 'pending';
  post?: () => Promise<Response>;
} = {}) {
  fetchMock.mockImplementation((_, init) => {
    if (isPost(init)) {
      return post();
    }
    if (summary === 'pending') {
      return new Promise<Response>(() => undefined);
    }
    return Promise.resolve(okResponse(SUMMARY));
  });
}

function renderDialog() {
  return render(
    <ThemeProvider theme={theme}>
      <ExportModal open onClose={() => undefined} />
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog');
const saveTo = () =>
  within(dialog()).getByRole('textbox', {
    name: 'Save to',
  }) as HTMLInputElement;
const folderName = () =>
  within(dialog()).getByRole('textbox', {
    name: 'Folder name',
  }) as HTMLInputElement;
const folderNameLabel = () => within(dialog()).getByText('Folder name');
const imagesToggle = () =>
  within(dialog()).getByRole('switch', { name: 'Images' });
const exportButton = () =>
  within(dialog()).getByRole('button', { name: 'Export as CSV' });
const countLabel = () => within(dialog()).queryByText(/^\d+ titles?$/);

/** The body of the one export POST, once it has been sent. */
async function postedBody(): Promise<unknown> {
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([, init]) => isPost(init))).toBe(true)
  );
  const [, init] = fetchMock.mock.calls.find(([, call]) => isPost(call)) ?? [];
  return JSON.parse(String(init?.body)) as unknown;
}

describe('ExportModal — the Folder name field', () => {
  it('draws the Folder name field after Save to and before Include', () => {
    serve();

    renderDialog();

    expect(comesBefore(saveTo(), folderNameLabel())).toBe(true);
    expect(comesBefore(folderNameLabel(), folderName())).toBe(true);
    expect(comesBefore(folderName(), imagesToggle())).toBe(true);
  });

  it('prefills the field with today’s dated name once the summary lands', async () => {
    serve();

    renderDialog();

    await waitFor(() => expect(folderName().value).toBe(NAME));
  });

  it('shows the prefix as the placeholder while the field is empty', () => {
    serve({ summary: 'pending' });

    renderDialog();

    expect(folderName().value).toBe('');
    expect(folderName().placeholder).toBe(EXPORT_NAME_PREFIX);
  });

  it('draws the name only in the field, not as a line of its own', async () => {
    serve();

    renderDialog();

    await waitFor(() => expect(folderName().value).toBe(NAME));
    expect(within(dialog()).queryByText(NAME)).toBeNull();
  });

  it('keeps what was typed when the summary lands after it', async () => {
    let land: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation((_, init) =>
      isPost(init)
        ? Promise.resolve(createdResponse(WRITTEN))
        : new Promise<Response>((resolve) => {
            land = resolve;
          })
    );
    renderDialog();

    fireEvent.change(folderName(), { target: { value: 'Family films' } });
    land(okResponse(SUMMARY));

    await waitFor(() => expect(countLabel()).not.toBeNull());
    expect(folderName().value).toBe('Family films');
  });
});

describe('ExportModal — the count in the label row', () => {
  it('draws the count after the Folder name heading and before the field', async () => {
    serve();

    renderDialog();

    const count = await within(dialog()).findByText('4 titles');
    expect(comesBefore(folderNameLabel(), count)).toBe(true);
    expect(comesBefore(count, folderName())).toBe(true);
  });

  it('draws no count before the summary lands, and the heading still', () => {
    serve({ summary: 'pending' });

    renderDialog();

    expect(folderNameLabel()).toBeDefined();
    expect(countLabel()).toBeNull();
  });
});

describe('ExportModal — typing reaches the posted body', () => {
  it('posts the name typed into the field', async () => {
    serve();
    renderDialog();
    await waitFor(() => expect(folderName().value).toBe(NAME));
    fireEvent.change(folderName(), { target: { value: 'Family films' } });

    fireEvent.click(exportButton());

    expect(await postedBody()).toMatchObject({ name: 'Family films' });
  });

  it('posts the default name when nothing was typed', async () => {
    serve();
    renderDialog();
    await waitFor(() => expect(folderName().value).toBe(NAME));

    fireEvent.click(exportButton());

    expect(await postedBody()).toMatchObject({ name: NAME });
  });
});

describe('ExportModal — each refusal under its own field', () => {
  it('draws a name refusal under Folder name, and not under Save to', async () => {
    serve({
      post: () =>
        Promise.resolve(refused('name', 'Give the export folder a name.')),
    });
    renderDialog();

    fireEvent.click(exportButton());

    const line = await within(dialog()).findByText(
      'Give the export folder a name.'
    );
    expect(comesBefore(folderName(), line)).toBe(true);
    expect(comesBefore(line, imagesToggle())).toBe(true);
    expect(
      within(dialog()).getAllByText('Give the export folder a name.')
    ).toHaveLength(1);
  });

  it('draws a destination refusal under Save to, and not under Folder name', async () => {
    serve({
      post: () =>
        Promise.resolve(refused('destination', 'No folder at that path.')),
    });
    renderDialog();

    fireEvent.click(exportButton());

    const line = await within(dialog()).findByText('No folder at that path.');
    expect(comesBefore(saveTo(), line)).toBe(true);
    expect(comesBefore(line, folderNameLabel())).toBe(true);
    expect(
      within(dialog()).getAllByText('No folder at that path.')
    ).toHaveLength(1);
  });

  it('keeps the refused name in the field, on the idle face', async () => {
    serve({
      post: () =>
        Promise.resolve(
          refused('name', "A folder name can't end in a space or a dot.")
        ),
    });
    renderDialog();
    await waitFor(() => expect(folderName().value).toBe(NAME));
    fireEvent.change(folderName(), { target: { value: 'Family.' } });

    fireEvent.click(exportButton());

    await within(dialog()).findByText(
      "A folder name can't end in a space or a dot."
    );
    expect(folderName().value).toBe('Family.');
    expect(exportButton()).toBeDefined();
  });
});
