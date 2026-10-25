import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre } from '@/types';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  conflictResponse,
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 51, Library audit, Phase 7 (issue #450): the movie add refuses a held
 * video.
 *
 * A shell movie add whose linked video a held title already plays is refused
 * on the wire, `409` with _<Title> already plays this file._ The form draws
 * that sentence, the way it draws a held Show folder's refusal (log 48 Q10),
 * and stays standing on `/add` with the title still typed. An add no title
 * holds goes through as before.
 *
 * The wire is a stubbed `fetch`; the bridge is `fakeFolderBridge`.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** What the movie add answers; each case sets its own. */
let answerSave: () => Promise<Response>;

const POOL: Genre[] = ['Action', 'Drama'].map((name, index) => ({
  id: `g${index + 1}`,
  name,
}));

const COCO = 'Coco.2017.mp4';
const COCO_PATH = 'E:\\Films\\Coco (2017)\\Coco.2017.mp4';
const REFUSAL = 'Coco already plays this file.';

beforeEach(() => {
  answerSave = () =>
    Promise.resolve(createdResponse(makeMovie({ id: 'm1', title: 'Coco' })));
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === 'POST') {
      return answerSave();
    }
    if (url.includes('/api/library-folders/containing')) {
      return Promise.resolve(okResponse({ libraryFolderId: 'films' }));
    }
    return Promise.resolve(okResponse({ genres: POOL }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderAdd() {
  render(
    <MemoryRouter initialEntries={['/settings', '/add']} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  await act(async () => undefined);
}

const titleField = () =>
  screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;

const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;

const containingReads = () =>
  fetchMock.mock.calls.filter(([input]) =>
    String(input).includes('/api/library-folders/containing')
  );

/** Type the title, pick Coco's video in Link, and press Save. */
async function addCoco() {
  fireEvent.change(titleField(), { target: { value: 'Coco (again)' } });
  await userEvent.upload(
    screen.getByLabelText(/choose video file/i) as HTMLInputElement,
    new File(['video bytes'], COCO, { type: 'video/mp4' }),
    { applyAccept: false }
  );
  await act(async () => undefined);
  await waitFor(() => expect(containingReads()).toHaveLength(1));
  fireEvent.click(save());
}

describe('MovieForm: a shell add of a held video', () => {
  const bridge = fakeFolderBridge();

  beforeEach(() => {
    bridge.setPathOf(COCO, COCO_PATH);
  });

  it('draws the refusal naming the title that plays the file', async () => {
    answerSave = () => Promise.resolve(conflictResponse(REFUSAL));
    await renderAdd();

    await addCoco();

    expect(await screen.findByText(REFUSAL)).toBeDefined();
  });

  it('stays standing on the form with the title still typed', async () => {
    answerSave = () => Promise.resolve(conflictResponse(REFUSAL));
    await renderAdd();

    await addCoco();

    await screen.findByText(REFUSAL);
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(pathname()).toBe('/add');
    expect(titleField().value).toBe('Coco (again)');
  });

  it('adds an unheld video as before, drawing no refusal', async () => {
    await renderAdd();

    await addCoco();

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(screen.queryByText(REFUSAL)).toBeNull();
  });
});
