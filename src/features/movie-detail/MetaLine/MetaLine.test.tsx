import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { MetaLine, type MetaLineProps } from './MetaLine';
import { theme } from '@/styles/theme';

const SEPARATOR = '•';

function renderMetaLine(props: Partial<MetaLineProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MetaLine
        year={props.year === undefined ? 1994 : props.year}
        runtimeLabel={
          props.runtimeLabel === undefined ? '2h 8m' : props.runtimeLabel
        }
        ratingPercent={
          props.ratingPercent === undefined ? 80 : props.ratingPercent
        }
        isWatched={props.isWatched ?? false}
      />
    </ThemeProvider>
  );
}

const separators = () => screen.queryAllByText(SEPARATOR);

/** The star row, drawn as glyph text rather than as an image. */
const stars = () => screen.queryAllByText('★★★★★');

describe('MetaLine — the segments', () => {
  it('shows the year, the runtime and the stars when the movie has all three', () => {
    renderMetaLine();

    expect(screen.getByText('1994')).toBeTruthy();
    expect(screen.getByText('2h 8m')).toBeTruthy();
    expect(stars()).not.toHaveLength(0);
  });

  it('omits the year without leaving a gap where it was', () => {
    renderMetaLine({ year: null });

    expect(screen.queryByText('1994')).toBeNull();
    expect(screen.getByText('2h 8m')).toBeTruthy();
  });

  it('omits the runtime when it is unknown', () => {
    renderMetaLine({ runtimeLabel: null });

    expect(screen.queryByText('2h 8m')).toBeNull();
    expect(screen.getByText('1994')).toBeTruthy();
  });

  it('draws no stars at all for an unrated movie, rather than an empty five', () => {
    // An empty five reading "0.0" would be the household asserting it scored
    // the movie zero, which is not the same as never having scored it.
    renderMetaLine({ ratingPercent: null });

    expect(stars()).toHaveLength(0);
  });
});

describe('MetaLine — the separators', () => {
  it('puts one between each pair of surviving segments', () => {
    renderMetaLine();

    // Three segments, two gaps.
    expect(separators()).toHaveLength(2);
  });

  it('draws none beside an absent segment', () => {
    renderMetaLine({ runtimeLabel: null });

    // Year and stars survive: one gap, not two.
    expect(separators()).toHaveLength(1);
  });

  it('draws none at all when only one segment survives', () => {
    renderMetaLine({ year: null, runtimeLabel: null });

    expect(separators()).toHaveLength(0);
  });

  it('leaves nothing dangling when the stars are the only survivor', () => {
    renderMetaLine({ year: null, runtimeLabel: null });

    expect(stars()).not.toHaveLength(0);
    expect(separators()).toHaveLength(0);
  });

  it('draws none when every segment is missing', () => {
    renderMetaLine({ year: null, runtimeLabel: null, ratingPercent: null });

    expect(separators()).toHaveLength(0);
  });
});

describe('MetaLine — the Watched badge', () => {
  it('closes the line with it for a watched movie', () => {
    renderMetaLine({ isWatched: true });

    expect(screen.getByText(/watched/i)).toBeTruthy();
  });

  it('omits it entirely for an unwatched movie', () => {
    renderMetaLine({ isWatched: false });

    expect(screen.queryByText(/watched/i)).toBeNull();
  });

  it('is never separated from the segments by a bullet', () => {
    // The badge is not a Meta segment — it is the end of the line, and a
    // bullet before it would read as a fourth fact about the movie.
    renderMetaLine({ isWatched: true });

    expect(separators()).toHaveLength(2);
  });
});
