import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { SeriesFormFiles } from './SeriesFormFiles';
import { theme } from '@/styles/theme';
import type { MovieFormFile } from '@/types';

/**
 * 29 — Add a series, Phase 2 (issue #262): the series kind's Files card.
 *
 * `MovieFormFiles`' shape for a **Series**: the _Files_ caption, the Poster
 * File field, and the _Episodes_ label the **Episode file rows** will sit
 * beside. No video slot — a series' videos are its episodes' — no subtitle
 * list of its own, and no backdrop slot. The rows and _＋ Add episode files_
 * are driven through `MovieForm`, so the episode callbacks here are inert.
 */

const ARTWORK = new File(['image bytes'], 'harbor-poster.jpg', {
  type: 'image/jpeg',
});

const PICKED_POSTER: MovieFormFile = {
  kind: 'picked',
  file: ARTWORK,
  filename: 'harbor-poster.jpg',
};

function renderFiles(poster: MovieFormFile | null = null) {
  const onPickPoster = vi.fn<(file: File) => void>();
  const onRemovePoster = vi.fn<() => void>();

  render(
    <ThemeProvider theme={theme}>
      <SeriesFormFiles
        poster={poster}
        onPickPoster={onPickPoster}
        onRemovePoster={onRemovePoster}
        episodes={[]}
        onAddEpisodeFiles={vi.fn()}
        onSeasonChange={vi.fn()}
        onNumberChange={vi.fn()}
        onEpisodeTitleChange={vi.fn()}
        onRemoveEpisode={vi.fn()}
        onAddEpisodeSubtitle={vi.fn()}
        onChangeEpisodeSubtitleLanguage={vi.fn()}
        onRemoveEpisodeSubtitle={vi.fn()}
      />
    </ThemeProvider>
  );

  return { onPickPoster, onRemovePoster };
}

const posterPicker = () =>
  screen.getByLabelText(/choose poster image/i) as HTMLInputElement;

describe('SeriesFormFiles', () => {
  it('draws the Files caption, the Poster field and the Episodes label', () => {
    renderFiles();

    expect(screen.getByText(/^files$/i)).toBeDefined();
    expect(screen.getByText(/^poster$/i)).toBeDefined();
    expect(screen.getByText(/^episodes$/i)).toBeDefined();
  });

  it('offers no movie video slot, no subtitle list of its own and no backdrop', () => {
    renderFiles();

    expect(screen.queryByText(/^video$/i)).toBeNull();
    expect(screen.queryByLabelText(/choose video file/i)).toBeNull();
    expect(screen.queryByText(/^subtitles$/i)).toBeNull();
    expect(screen.queryByText(/backdrop/i)).toBeNull();
  });

  it('reports the poster that was picked', async () => {
    const { onPickPoster } = renderFiles();

    await userEvent.upload(posterPicker(), ARTWORK, { applyAccept: false });

    expect(onPickPoster).toHaveBeenCalledWith(ARTWORK);
  });

  it('shows the poster it holds, and reports its ✕', () => {
    const { onRemovePoster } = renderFiles(PICKED_POSTER);

    expect(screen.getByText('harbor-poster.jpg')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /remove poster/i }));

    expect(onRemovePoster).toHaveBeenCalledTimes(1);
  });
});
