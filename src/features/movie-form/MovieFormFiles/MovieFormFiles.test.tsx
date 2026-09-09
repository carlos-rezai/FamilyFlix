import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { MovieFormFiles } from './MovieFormFiles';
import { theme } from '@/styles/theme';
import type { MovieFormFile } from '@/types';

/** A film off the maintainer's own disk, as the browser hands it over. */
const LANTERN = new File(['video bytes'], 'lantern.mp4', { type: 'video/mp4' });

/** The artwork beside it in the same folder. */
const ARTWORK = new File(['image bytes'], 'lantern-poster.jpg', {
  type: 'image/jpeg',
});

/** The video slot holding a **Picked file**. */
const PICKED_VIDEO: MovieFormFile = {
  kind: 'picked',
  file: LANTERN,
  filename: 'lantern.mp4',
};

/** The poster slot holding one. */
const PICKED_POSTER: MovieFormFile = {
  kind: 'picked',
  file: ARTWORK,
  filename: 'lantern-poster.jpg',
};

/** What is in the card's slots for one test — an empty one is the default. */
interface Slots {
  video?: MovieFormFile | null;
  poster?: MovieFormFile | null;
}

function renderFiles(slots: Slots = {}) {
  const onPickVideo = vi.fn<(file: File) => void>();
  const onRemoveVideo = vi.fn<() => void>();
  const onPickPoster = vi.fn<(file: File) => void>();
  const onRemovePoster = vi.fn<() => void>();

  render(
    <ThemeProvider theme={theme}>
      <MovieFormFiles
        video={slots.video ?? null}
        poster={slots.poster ?? null}
        onPickVideo={onPickVideo}
        onRemoveVideo={onRemoveVideo}
        onPickPoster={onPickPoster}
        onRemovePoster={onRemovePoster}
      />
    </ThemeProvider>
  );

  return { onPickVideo, onRemoveVideo, onPickPoster, onRemovePoster };
}

const picker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

const posterPicker = () =>
  screen.getByLabelText(/choose poster image/i) as HTMLInputElement;

/**
 * The Files card of the **Movie form** — the panel the prototype draws under
 * the metadata fields, and the two slots this slice puts in it.
 *
 * A feature sibling rather than a molecule, on the player's shape: the organism
 * owns the values and this draws what it is told. It knows which slots a
 * **Movie** has and what each of them offers a file dialog; `FileField` knows
 * how a slot looks, and neither knows what a save is.
 *
 * The **Subtitle** rows the prototype draws under these two arrive with #104.
 * Their absence here is the slice boundary, not a miss.
 */
describe('MovieFormFiles', () => {
  it('draws the Files card the prototype captions', () => {
    renderFiles();

    expect(screen.getByText(/^files$/i)).toBeDefined();
  });

  it('names the video slot', () => {
    renderFiles();

    expect(screen.getByText(/^video$/i)).toBeDefined();
  });

  it('offers an empty slot as a choose button', () => {
    renderFiles();

    expect(picker().type).toBe('file');
    expect(screen.queryByText('lantern.mp4')).toBeNull();
  });

  it('offers the container types a browser will not name', () => {
    renderFiles();

    // Chromium gives MKV and AVI no MIME type at all, so `video/*` alone would
    // grey out most of the family folder in the dialog. This is the one place
    // in the app that knows what a video file may be called.
    const accept = picker().getAttribute('accept') ?? '';
    expect(accept).toContain('video/*');
    expect(accept).toContain('.mkv');
    expect(accept).toContain('.avi');
  });

  it('reports the film that was picked', async () => {
    const { onPickVideo } = renderFiles();

    await userEvent.upload(picker(), LANTERN, { applyAccept: false });

    expect(onPickVideo).toHaveBeenCalledWith(LANTERN);
  });

  it('shows the filename of the film in the slot', () => {
    renderFiles({ video: PICKED_VIDEO });

    // Story 29: the filename is the only way to tell the right film from the
    // one beside it in the folder.
    expect(screen.getByText('lantern.mp4')).toBeDefined();
  });

  it('offers no picker while the slot is filled', () => {
    renderFiles({ video: PICKED_VIDEO });

    expect(screen.queryByLabelText(/choose video file/i)).toBeNull();
  });

  it('reports the removal without emptying the slot itself', () => {
    const { onRemoveVideo } = renderFiles({ video: PICKED_VIDEO });

    fireEvent.click(screen.getByRole('button', { name: /remove video/i }));

    // What is in the slot lives one level up, in the form's values — this says
    // the ✕ was pressed and nothing about what that means.
    expect(onRemoveVideo).toHaveBeenCalledTimes(1);
    expect(screen.getByText('lantern.mp4')).toBeDefined();
  });

  // --- 11 — Movie form, Phase 4: the poster slot (issue #103) ---------------
  //
  // A second instance of the same molecule, and nothing new invented at that
  // rung: if the poster needed anything `FileField` does not have, that would
  // be a sign `FileField` was shaped wrong. What is new here is only what this
  // card knows — that a **Movie** has a second kind of file, and what that one
  // offers a file dialog.

  it('names the poster slot', () => {
    renderFiles();

    expect(screen.getByText(/^poster$/i)).toBeDefined();
  });

  it('offers an empty poster slot as a choose button', () => {
    renderFiles();

    expect(posterPicker().type).toBe('file');
    expect(screen.queryByText('lantern-poster.jpg')).toBeNull();
  });

  it('offers pictures, which a browser does name', () => {
    renderFiles();

    // The mirror of the video slot's list, and the reason that one is long:
    // every image container a poster arrives in has a MIME type, so `image/*`
    // is the whole of what this slot has to say. The server re-checks by
    // extension regardless — an accept list is a convenience, never a
    // guarantee.
    expect(posterPicker().getAttribute('accept')).toBe('image/*');
  });

  it('reports the poster that was picked', async () => {
    const { onPickPoster } = renderFiles();

    await userEvent.upload(posterPicker(), ARTWORK, { applyAccept: false });

    expect(onPickPoster).toHaveBeenCalledWith(ARTWORK);
  });

  it('shows the filename of the poster in its own slot', () => {
    renderFiles({ video: PICKED_VIDEO, poster: PICKED_POSTER });

    // Two filled slots, two filenames: a card that showed one of them would
    // leave the maintainer unable to tell which file went where.
    expect(screen.getByText('lantern.mp4')).toBeDefined();
    expect(screen.getByText('lantern-poster.jpg')).toBeDefined();
  });

  it('reports the poster’s removal and nothing about the film', () => {
    const { onRemovePoster, onRemoveVideo } = renderFiles({
      video: PICKED_VIDEO,
      poster: PICKED_POSTER,
    });

    fireEvent.click(screen.getByRole('button', { name: /remove poster/i }));

    // A column of these reads as a column of identical ✕ buttons to anything
    // that cannot see the row, and the label is the only thing that tells them
    // apart — which is what makes pressing the right one possible at all.
    expect(onRemovePoster).toHaveBeenCalledTimes(1);
    expect(onRemoveVideo).not.toHaveBeenCalled();
  });
});
