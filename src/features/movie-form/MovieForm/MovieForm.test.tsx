import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Movie } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  createdResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** What the route answers with — a real library row, with no film behind it. */
const CREATED: Movie = makeMovie({
  id: 'new-1',
  title: 'Rear Window',
  year: 1954,
  videoPath: '',
});

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockResolvedValue(createdResponse(CREATED));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/add']}>
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const titleField = () =>
  screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
const yearField = () =>
  screen.getByRole('textbox', { name: /year/i }) as HTMLInputElement;
const save = () =>
  screen.getByRole('button', {
    name: /add to library|adding/i,
  }) as HTMLButtonElement;
const currentPath = () => screen.getByTestId('pathname').textContent;

/** The multipart body of the save, or `undefined` if nothing was ever sent. */
function savedFields(): FormData | undefined {
  const call = fetchMock.mock.calls.find(([input]) =>
    String(input).includes('/api/movies')
  );
  return call?.[1]?.body as FormData | undefined;
}

/**
 * The **Movie form** in its **Add context**, holding the two fields this slice
 * gives it. It is the only writer in the app that is not a single-signal write,
 * and the first screen that creates a record rather than amending one.
 *
 * The gate, the in-flight state and the destination are asserted here rather
 * than on `useMovieForm` directly: what the maintainer can press, and what the
 * button says while they wait, is the behaviour — the hook is where it happens
 * to live, and it has one more half of the gate to grow when the video slot
 * lands.
 */
describe('MovieForm', () => {
  it('offers a Title and a Year to type into', () => {
    renderForm();

    expect(titleField().value).toBe('');
    expect(yearField().value).toBe('');
  });

  describe('the Year field', () => {
    it('keeps the digits and drops everything else', () => {
      renderForm();

      fireEvent.change(yearField(), { target: { value: '19a5' } });

      // A year cannot hold something that is not a year, so there is no
      // invalid state to report and no error surface to design.
      expect(yearField().value).toBe('195');
    });

    it('stops at four characters', () => {
      renderForm();

      fireEvent.change(yearField(), { target: { value: '19544' } });

      expect(yearField().value).toBe('1954');
    });

    it('takes a four-digit year unchanged', () => {
      renderForm();

      fireEvent.change(yearField(), { target: { value: '1954' } });

      expect(yearField().value).toBe('1954');
    });

    it('can be cleared back to empty', () => {
      renderForm();

      fireEvent.change(yearField(), { target: { value: '1954' } });
      fireEvent.change(yearField(), { target: { value: '' } });

      expect(yearField().value).toBe('');
    });
  });

  describe('the save gate', () => {
    it('reads "Add to library"', () => {
      renderForm();

      expect(save().textContent).toContain('Add to library');
    });

    it('is disabled while there is no title', () => {
      renderForm();

      // A gate rather than a validation message: `title` is NOT NULL, and the
      // only "invalid" state this form can reach is one where Save cannot be
      // pressed.
      expect(save().disabled).toBe(true);
    });

    it('opens once a title is typed', () => {
      renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });

      expect(save().disabled).toBe(false);
    });

    it('closes again if the title is deleted', () => {
      renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      fireEvent.change(titleField(), { target: { value: '' } });

      expect(save().disabled).toBe(true);
    });

    it('does not open on a year alone', () => {
      renderForm();

      fireEvent.change(yearField(), { target: { value: '1954' } });

      expect(save().disabled).toBe(true);
    });
  });

  describe('saving', () => {
    it('sends the typed title and year', async () => {
      renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      fireEvent.change(yearField(), { target: { value: '1954' } });
      fireEvent.click(save());

      await waitFor(() => expect(savedFields()).toBeDefined());
      const fields = savedFields() as FormData;
      expect(fields.get('title')).toBe('Rear Window');
      expect(fields.get('year')).toBe('1954');
    });

    it('reads "Adding…" and is disabled while the request is in flight', async () => {
      let settle: (response: Response) => void = () => undefined;
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          settle = resolve;
        })
      );
      renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      fireEvent.click(save());

      // The one place a large-file save will show its cost. The label says the
      // work started, and the disabled button is what stops a second row being
      // written by an impatient second press.
      await waitFor(() => expect(save().textContent).toContain('Adding…'));
      expect(save().disabled).toBe(true);

      settle(createdResponse(CREATED));
      await waitFor(() => expect(currentPath()).toBe('/'));
    });

    it('writes one movie however many times Save is pressed', async () => {
      let settle: (response: Response) => void = () => undefined;
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          settle = resolve;
        })
      );
      renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      fireEvent.click(save());
      fireEvent.click(save());
      fireEvent.click(save());

      settle(createdResponse(CREATED));
      await waitFor(() => expect(currentPath()).toBe('/'));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('lands on the browse home once the movie is written', async () => {
      renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      fireEvent.click(save());

      // The **Add context** ends on the shelf the film just joined — the
      // prototype's `goBrowse()`, and the one place the maintainer can see the
      // save worked.
      await waitFor(() => expect(currentPath()).toBe('/'));
    });

    it('stays on the form and offers Save again when the save fails', async () => {
      fetchMock.mockResolvedValue(serverErrorResponse());
      renderForm();

      fireEvent.change(titleField(), { target: { value: 'Rear Window' } });
      fireEvent.click(save());

      // No snackbar in this slice, so the honest answer to a refused save is
      // the form still standing with everything typed still in it, rather than
      // a browse home with no new film on it.
      await waitFor(() => expect(save().disabled).toBe(false));
      expect(currentPath()).toBe('/add');
      expect(titleField().value).toBe('Rear Window');
      expect(save().textContent).toContain('Add to library');
    });
  });
});
