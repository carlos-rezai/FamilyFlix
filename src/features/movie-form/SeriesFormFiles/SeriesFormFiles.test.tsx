import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { SeriesFormFiles } from './SeriesFormFiles';
import { theme } from '@/styles/theme';
import type { MovieFormFile, SeasonPosterSlot } from '@/types';

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
        refusals={{}}
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

/**
 * 42 — Review at scale, Slice 8 (issue #365): the _Season posters_ list.
 *
 * Under the series poster, a 13px faint caption over one File field per
 * **Season** the episode rows hold, in the order the caller hands them —
 * labelled `S01`, `S02`… A held poster shows its stored name, a picked one its
 * file's, an empty slot the dashed _Choose poster for season 3_; ✕ reports the
 * season. Drawn only once a row holds a season — the caller hands no slots
 * before then.
 */
describe('SeriesFormFiles — the Season posters list', () => {
  const SEASON_ART = new File(['image bytes'], 'spring.jpg', {
    type: 'image/jpeg',
  });

  const HELD_SEASON_ONE: MovieFormFile = {
    kind: 'stored',
    path: 'harbor-vine-2019/S01-poster.jpg',
    filename: 'S01-poster.jpg',
  };

  function renderSlots(seasonPosters: SeasonPosterSlot[]) {
    const onPickSeasonPoster = vi.fn<(season: number, file: File) => void>();
    const onRemoveSeasonPoster = vi.fn<(season: number) => void>();

    render(
      <ThemeProvider theme={theme}>
        <SeriesFormFiles
          poster={null}
          onPickPoster={vi.fn()}
          onRemovePoster={vi.fn()}
          seasonPosters={seasonPosters}
          onPickSeasonPoster={onPickSeasonPoster}
          onRemoveSeasonPoster={onRemoveSeasonPoster}
          episodes={[]}
          refusals={{}}
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

    return { onPickSeasonPoster, onRemoveSeasonPoster };
  }

  const list = () => screen.getByRole('group', { name: 'Season posters' });

  it('draws the caption over one slot per season, labelled S01, S02…, in the order given', () => {
    renderSlots([
      { season: 1, poster: HELD_SEASON_ONE, held: true },
      { season: 2, poster: null, held: false },
      { season: 10, poster: null, held: false },
    ]);

    expect(within(list()).getByText('Season posters')).toBeDefined();
    const labels = within(list())
      .getAllByText(/^S\d{2}$/)
      .map((label) => label.textContent);
    expect(labels).toEqual(['S01', 'S02', 'S10']);
  });

  it('shows a held poster by its stored name, and an empty slot as its choose button', () => {
    renderSlots([
      { season: 1, poster: HELD_SEASON_ONE, held: true },
      { season: 3, poster: null, held: false },
    ]);

    expect(within(list()).getByText('S01-poster.jpg')).toBeDefined();
    expect(
      within(list()).getByLabelText(/choose poster for season 3/i)
    ).toBeDefined();
    expect(
      within(list()).queryByLabelText(/choose poster for season 1/i)
    ).toBeNull();
  });

  it('shows a picked poster by its file’s name', () => {
    renderSlots([
      {
        season: 2,
        poster: { kind: 'picked', file: SEASON_ART, filename: 'spring.jpg' },
        held: false,
      },
    ]);

    expect(within(list()).getByText('spring.jpg')).toBeDefined();
  });

  it('reports the season and the file picked into its slot', async () => {
    const { onPickSeasonPoster } = renderSlots([
      { season: 1, poster: HELD_SEASON_ONE, held: true },
      { season: 2, poster: null, held: false },
    ]);

    await userEvent.upload(
      within(list()).getByLabelText(
        /choose poster for season 2/i
      ) as HTMLInputElement,
      SEASON_ART,
      { applyAccept: false }
    );

    expect(onPickSeasonPoster).toHaveBeenCalledWith(2, SEASON_ART);
  });

  it('reports the season whose ✕ was pressed', () => {
    const { onRemoveSeasonPoster } = renderSlots([
      { season: 1, poster: HELD_SEASON_ONE, held: true },
    ]);

    fireEvent.click(
      within(list()).getByRole('button', { name: /^remove s01$/i })
    );

    expect(onRemoveSeasonPoster).toHaveBeenCalledWith(1);
  });
});
