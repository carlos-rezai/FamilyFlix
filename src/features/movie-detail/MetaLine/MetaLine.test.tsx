import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
        onRate={props.onRate ?? (() => undefined)}
      />
    </ThemeProvider>
  );
}

const separators = () => screen.queryAllByText(SEPARATOR);

/**
 * The rating segment's **Half-star segments** — controls now, not glyph text,
 * because the line renders a `RatingPicker` where its `StarRating` used to sit.
 * They are the only buttons the line draws, and their position in the row is
 * what a parent aims at, so the role alone finds them.
 */
const segments = () => screen.queryAllByRole('button');

/** One segment, 1–10 from the left: 7 is the fourth star's left half. */
function segment(nth: number): HTMLElement {
  const found = segments()[nth - 1];

  if (found === undefined) {
    throw new Error(
      `No segment ${nth} — the line drew ${segments().length} of them.`
    );
  }
  return found;
}

/** The star a segment sits on — the box carrying the glyph and its size. */
const starBox = (nth: number) => segment(nth).parentElement as HTMLElement;

describe('MetaLine — the segments', () => {
  it('shows the year, the runtime and the stars when the movie has all three', () => {
    renderMetaLine();

    expect(screen.getByText('1994')).toBeTruthy();
    expect(screen.getByText('2h 8m')).toBeTruthy();
    expect(segments()).not.toHaveLength(0);
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

  it('draws no picker at all for an unrated movie, rather than an empty five', () => {
    // Still the `04-movie-detail` Q10 omission: an empty five reading "0.0"
    // would be the household asserting it scored the movie zero. Retracting it
    // in favour of five clickable empty stars is a later issue's, not this one's
    // — this line only stops being a label.
    renderMetaLine({ ratingPercent: null });

    expect(segments()).toHaveLength(0);
    expect(screen.queryByText(/not rated/i)).toBeNull();
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

    expect(segments()).not.toHaveLength(0);
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

/**
 * The line's one interactive segment. It is the same twenty pixels in the same
 * place the `StarRating` held — what changed is that a parent can now click it.
 * The line still asks no display question of its own: whether there is a rating
 * segment at all is a `null` `detailView` already decided.
 */
describe('MetaLine — the rating picker', () => {
  it('renders the full picker in the rating segment, not a label', () => {
    renderMetaLine({ ratingPercent: 80 });

    expect(segments()).toHaveLength(10);
  });

  it('shows the stored rating beside the stars', () => {
    renderMetaLine({ ratingPercent: 80 });

    expect(screen.getByText('4.0 / 5')).toBeTruthy();
  });

  it('draws its stars at 20px — the size the stars here have always been', () => {
    // A smaller picker, not a broken one: the meta line asks for 20 and the
    // segments, gaps and glyphs all come down with it.
    renderMetaLine({ ratingPercent: 80 });

    expect(getComputedStyle(starBox(1)).fontSize).toBe('20px');
  });

  it('reports the half-star segment that was clicked, as a percent', () => {
    const onRate = vi.fn();
    renderMetaLine({ ratingPercent: 80, onRate });

    fireEvent.click(segment(7));

    expect(onRate).toHaveBeenCalledWith(70);
  });

  it('reports null when the segment holding the current rating is clicked', () => {
    // The client end of "a cleared rating is genuinely unrated in the database,
    // not a zero": the line hands the picker's `null` straight to the rate
    // callback, which is what puts `{ value: null }` on the wire.
    const onRate = vi.fn();
    renderMetaLine({ ratingPercent: 80, onRate });

    fireEvent.click(segment(8));

    expect(onRate).toHaveBeenCalledWith(null);
  });

  it('reports nothing on render — drawing the line writes no rating', () => {
    const onRate = vi.fn();
    renderMetaLine({ ratingPercent: 80, onRate });

    expect(onRate).not.toHaveBeenCalled();
  });

  it('sits where the stars sat — after the runtime, before the Watched badge', () => {
    renderMetaLine({ isWatched: true });

    const runtime = screen.getByText('2h 8m');
    const picker = segment(1);
    const badge = screen.getByText(/✓\s*watched/i);

    expect(
      runtime.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      picker.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
