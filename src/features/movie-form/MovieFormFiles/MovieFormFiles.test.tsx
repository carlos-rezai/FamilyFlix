import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { MovieFormFiles } from './MovieFormFiles';
import { theme } from '@/styles/theme';
import type { MovieFormFile } from '@/types';

/** A film off the maintainer's own disk, as the browser hands it over. */
const LANTERN = new File(['video bytes'], 'lantern.mp4', { type: 'video/mp4' });

/** The video slot holding a **Picked file**. */
const PICKED: MovieFormFile = {
  kind: 'picked',
  file: LANTERN,
  filename: 'lantern.mp4',
};

function renderFiles(video: MovieFormFile | null = null) {
  const onPickVideo = vi.fn<(file: File) => void>();
  const onRemoveVideo = vi.fn<() => void>();

  render(
    <ThemeProvider theme={theme}>
      <MovieFormFiles
        video={video}
        onPickVideo={onPickVideo}
        onRemoveVideo={onRemoveVideo}
      />
    </ThemeProvider>
  );

  return { onPickVideo, onRemoveVideo };
}

const picker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

/**
 * The Files card of the **Movie form** — the panel the prototype draws under
 * the metadata fields, and this slice's one slot in it.
 *
 * A feature sibling rather than a molecule, on the player's shape: the organism
 * owns the values and this draws one thing it is told. It knows which slots a
 * **Movie** has and what each of them offers a file dialog; `FileField` knows
 * how a slot looks, and neither knows what a save is.
 *
 * The **Poster** and **Subtitle** slots the prototype draws beside the video
 * one arrive with #103 and #104. Their absence here is the slice boundary, not
 * a miss.
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
    renderFiles(PICKED);

    // Story 29: the filename is the only way to tell the right film from the
    // one beside it in the folder.
    expect(screen.getByText('lantern.mp4')).toBeDefined();
  });

  it('offers no picker while the slot is filled', () => {
    renderFiles(PICKED);

    expect(screen.queryByLabelText(/choose video file/i)).toBeNull();
  });

  it('reports the removal without emptying the slot itself', () => {
    const { onRemoveVideo } = renderFiles(PICKED);

    fireEvent.click(screen.getByRole('button', { name: /remove video/i }));

    // What is in the slot lives one level up, in the form's values — this says
    // the ✕ was pressed and nothing about what that means.
    expect(onRemoveVideo).toHaveBeenCalledTimes(1);
    expect(screen.getByText('lantern.mp4')).toBeDefined();
  });
});
