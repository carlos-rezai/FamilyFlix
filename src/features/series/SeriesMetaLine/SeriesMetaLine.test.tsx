import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { SeriesMetaLine, type SeriesMetaLineProps } from './SeriesMetaLine';
import { theme } from '@/styles/theme';

const SEPARATOR = '•';

function renderLine(props: Partial<SeriesMetaLineProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <SeriesMetaLine
        yearLabel={
          props.yearLabel === undefined ? '2019–2023' : props.yearLabel
        }
        countLabel={props.countLabel ?? '2 seasons · 22 episodes'}
        ratingPercent={
          props.ratingPercent === undefined ? 80 : props.ratingPercent
        }
        ratingSource={
          props.ratingSource === undefined ? 'household' : props.ratingSource
        }
      />
    </ThemeProvider>
  );
}

const separators = () => screen.queryAllByText(SEPARATOR);

describe('SeriesMetaLine', () => {
  it('reads the year range, the counts and the stars, a separator between each', () => {
    renderLine();

    expect(screen.getByText('2019–2023')).toBeDefined();
    expect(screen.getByText('2 seasons · 22 episodes')).toBeDefined();
    expect(screen.getByText('4.0')).toBeDefined();
    expect(separators()).toHaveLength(2);
  });

  it('draws an open range as it is given', () => {
    renderLine({ yearLabel: '2021–' });

    expect(screen.getByText('2021–')).toBeDefined();
  });

  it('drops the year segment and its separator when there is no year', () => {
    renderLine({ yearLabel: null });

    expect(screen.getByText('2 seasons · 22 episodes')).toBeDefined();
    expect(separators()).toHaveLength(1);
  });

  it('draws the stars read-only — nothing to click, no rating picker', () => {
    renderLine();

    expect(screen.queryByRole('group', { name: 'Your rating' })).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps the stars for a series nobody has rated', () => {
    renderLine({ ratingPercent: null });

    expect(separators()).toHaveLength(2);
    expect(screen.queryByText('4.0')).toBeNull();
  });
});

/**
 * 26 — TMDB ratings (issue #372): a `tmdb`-sourced rating is drawn as
 * **TMDB-marked stars** — the `TMDB` tag after the value — and a household one as the family's own, unmarked.
 */
describe('SeriesMetaLine — the rating’s source', () => {
  it('draws the TMDB tag after the value for a tmdb source, and none for a household one', () => {
    const { unmount } = renderLine({ ratingPercent: 70, ratingSource: 'tmdb' });

    expect(screen.getByText('3.5')).toBeDefined();
    expect(screen.getByText('TMDB')).toBeDefined();
    unmount();

    renderLine({ ratingPercent: 80, ratingSource: 'household' });

    expect(screen.getByText('4.0')).toBeDefined();
    expect(screen.queryByText('TMDB')).toBeNull();
  });

  it('stays read-only for a tmdb source — no picker', () => {
    renderLine({ ratingPercent: 70, ratingSource: 'tmdb' });

    expect(screen.getByText('TMDB')).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Your rating' })).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
