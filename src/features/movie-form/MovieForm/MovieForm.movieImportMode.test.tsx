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
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 48 — Add a show folder, Phase 3 (issue #419): the movie add links by
 * default.
 *
 * In the shell the movie add draws the **Import mode** — `ImportModeChoice`,
 * the caption _Files_ over Link and Copy — and only there: never on an edit,
 * never in a browser. **Link** is chosen on every visit. The moment a video is
 * picked its path is read through the **Path bridge** (`pathOf`) and checked
 * with `GET /api/library-folders/containing`: a `null` disables the Link card,
 * reading _Only for files inside one of your library folders._, and **Copy**
 * is chosen; a later pick under a **Library folder** enables it again.
 *
 * On Save the body's first field is `mode`. In Link the video travels as its
 * path, `videoPath`, and no bytes; in Copy as its bytes.
 *
 * The wire is a stubbed `fetch`; the bridge is `fakeFolderBridge`.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const POOL: Genre[] = ['Action', 'Comedy', 'Drama'].map((name, index) => ({
  id: `g${index + 1}`,
  name,
}));

const HEAT = 'Heat.1995.mp4';
const HEAT_PATH = 'E:\\Films\\Heat (1995)\\Heat.1995.mp4';
const LANTERN = 'Lantern.2020.mp4';
const LANTERN_PATH = 'D:\\Downloads\\Lantern.2020.mp4';

const DISABLED_LINE = 'Only for files inside one of your library folders.';

/** What the containing read answers, by the path it was asked about. */
const CONTAINING: Record<string, string | null> = {
  [HEAT_PATH]: 'films',
  [LANTERN_PATH]: null,
};

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === 'POST' || init?.method === 'PATCH') {
      return Promise.resolve(
        createdResponse(makeMovie({ id: 'm1', title: 'Heat' }))
      );
    }
    if (url.includes('/api/library-folders/containing')) {
      const path =
        new URL(url, 'http://localhost').searchParams.get('path') ?? '';
      return Promise.resolve(
        okResponse({ libraryFolderId: CONTAINING[path] ?? null })
      );
    }
    if (url.includes('/api/movies/')) {
      return Promise.resolve(okResponse(makeMovie({ id: 'a1' })));
    }
    return Promise.resolve(okResponse({ genres: POOL }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The form at `url`, with Settings behind it, every read on mount settled. */
async function renderAt(url = '/add') {
  const view = render(
    <MemoryRouter initialEntries={['/settings', url]} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  await act(async () => undefined);
  return view;
}

const choice = () => screen.queryByRole('radiogroup', { name: 'Files' });

const modeRadio = (name: 'Link' | 'Copy') =>
  within(choice() as HTMLElement).getByRole('radio', {
    name: new RegExp(`^${name}`),
  });

const isChecked = (name: 'Link' | 'Copy') =>
  modeRadio(name).getAttribute('aria-checked') === 'true';

const isDisabled = (element: HTMLElement) =>
  element.hasAttribute('disabled') ||
  element.getAttribute('aria-disabled') === 'true';

const videoPicker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

const videoFile = (name: string) =>
  new File(['video bytes'], name, { type: 'video/mp4' });

async function pickVideo(name: string): Promise<File> {
  const file = videoFile(name);
  await userEvent.upload(videoPicker(), file, { applyAccept: false });
  await act(async () => undefined);
  return file;
}

async function removeVideo() {
  fireEvent.click(screen.getByRole('button', { name: /remove video/i }));
  await act(async () => undefined);
}

const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;

const movieSaves = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes('/api/movies') && init?.method === 'POST'
  );

const containingReads = () =>
  fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/library-folders/containing'));

function typeTitle(title = 'Heat') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: title },
  });
}

/** Press Save and answer the one body it sent. */
async function savedBody(): Promise<FormData> {
  fireEvent.click(save());
  await waitFor(() => expect(movieSaves()).toHaveLength(1));
  return movieSaves()[0][1]?.body as FormData;
}

describe('MovieForm — the Import mode on a shell movie add', () => {
  const bridge = fakeFolderBridge();

  beforeEach(() => {
    bridge.setPathOf(HEAT, HEAT_PATH);
    bridge.setPathOf(LANTERN, LANTERN_PATH);
  });

  describe('where it is drawn', () => {
    it('draws Files over Link and Copy, Link chosen', async () => {
      await renderAt();

      expect(choice()).not.toBeNull();
      expect(isChecked('Link')).toBe(true);
      expect(isChecked('Copy')).toBe(false);
      expect(isDisabled(modeRadio('Link'))).toBe(false);
    });

    it('is drawn on the add and never on a movie edit', async () => {
      const add = await renderAt();
      expect(choice()).not.toBeNull();
      add.unmount();

      await renderAt('/add?movie=a1');

      expect(screen.getByRole('textbox', { name: 'Title' })).toBeDefined();
      expect(choice()).toBeNull();
    });

    it('chooses Link on every visit, never remembering Copy', async () => {
      const first = await renderAt();
      fireEvent.click(modeRadio('Copy'));
      expect(isChecked('Copy')).toBe(true);
      first.unmount();

      await renderAt();

      expect(isChecked('Link')).toBe(true);
      expect(isChecked('Copy')).toBe(false);
    });
  });

  describe('whether Link is available', () => {
    it('checks a picked video’s path with the containing read the moment it is picked', async () => {
      await renderAt();

      await pickVideo(HEAT);

      await waitFor(() => expect(containingReads()).toHaveLength(1));
      const asked = new URL(containingReads()[0], 'http://localhost');
      expect(asked.pathname).toBe('/api/library-folders/containing');
      expect(asked.searchParams.get('path')).toBe(HEAT_PATH);
      expect(isDisabled(modeRadio('Link'))).toBe(false);
      expect(isChecked('Link')).toBe(true);
    });

    it('disables Link with its line and chooses Copy for a video under no Library folder', async () => {
      await renderAt();

      await pickVideo(LANTERN);

      await waitFor(() => expect(isDisabled(modeRadio('Link'))).toBe(true));
      expect(within(modeRadio('Link')).getByText(DISABLED_LINE)).toBeDefined();
      expect(isChecked('Copy')).toBe(true);
      expect(isChecked('Link')).toBe(false);
    });

    it('enables Link again on a later pick under a Library folder', async () => {
      await renderAt();
      await pickVideo(LANTERN);
      await waitFor(() => expect(isDisabled(modeRadio('Link'))).toBe(true));

      await removeVideo();
      await pickVideo(HEAT);

      await waitFor(() => expect(isDisabled(modeRadio('Link'))).toBe(false));
      expect(within(modeRadio('Link')).queryByText(DISABLED_LINE)).toBeNull();
      fireEvent.click(modeRadio('Link'));
      expect(isChecked('Link')).toBe(true);
    });
  });

  describe('the wire', () => {
    it('sends mode link first and the video as its path, with no bytes', async () => {
      await renderAt();
      typeTitle();
      await pickVideo(HEAT);
      await waitFor(() => expect(containingReads()).toHaveLength(1));

      const body = await savedBody();

      expect([...body.keys()][0]).toBe('mode');
      expect(body.get('mode')).toBe('link');
      expect(body.get('videoPath')).toBe(HEAT_PATH);
      expect(body.get('video')).toBeNull();
    });

    it('sends mode copy first and the video as its bytes when Copy is chosen', async () => {
      await renderAt();
      typeTitle();
      const file = await pickVideo(HEAT);
      await waitFor(() => expect(containingReads()).toHaveLength(1));
      fireEvent.click(modeRadio('Copy'));

      const body = await savedBody();

      expect([...body.keys()][0]).toBe('mode');
      expect(body.get('mode')).toBe('copy');
      expect((body.get('video') as File).name).toBe(file.name);
    });

    it('sends mode copy and the bytes when Link is unavailable', async () => {
      await renderAt();
      typeTitle('Lantern');
      const file = await pickVideo(LANTERN);
      await waitFor(() => expect(isDisabled(modeRadio('Link'))).toBe(true));

      const body = await savedBody();

      expect([...body.keys()][0]).toBe('mode');
      expect(body.get('mode')).toBe('copy');
      expect((body.get('video') as File).name).toBe(file.name);
    });
  });
});

describe('MovieForm — the movie add in a browser', () => {
  it('draws no Import mode, and sends mode copy first with the video’s bytes', async () => {
    await renderAt();
    expect(choice()).toBeNull();
    typeTitle();
    const file = await pickVideo(HEAT);

    const body = await savedBody();

    expect([...body.keys()][0]).toBe('mode');
    expect(body.get('mode')).toBe('copy');
    expect((body.get('video') as File).name).toBe(file.name);
    expect(containingReads()).toEqual([]);
  });
});
