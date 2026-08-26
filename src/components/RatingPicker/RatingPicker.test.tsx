import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { RatingPicker, type RatingPickerProps } from '@/components';
import { theme } from '@/styles/theme';

function renderPicker(props: Partial<RatingPickerProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <RatingPicker
        value={props.value === undefined ? 80 : props.value}
        size={props.size}
        onChange={props.onChange ?? (() => undefined)}
      />
    </ThemeProvider>
  );
}

/** Every star, as the control it is — found by what a click on it would do. */
const stars = () => screen.queryAllByRole('button', { name: /^rate /i });

const star = (nth: number) =>
  screen.getByRole('button', {
    name: nth === 1 ? 'Rate 1 star' : `Rate ${nth} stars`,
  });

/**
 * How full one star is drawn, as the width of the overlay clipped over it. The
 * prototype draws each star as a dim glyph with a single accent-coloured span
 * laid over it, so the fill is that span's width — the one visual fact worth
 * pinning while the picker is still provisional.
 */
function fillOf(nth: number): string {
  const overlay = star(nth).querySelector('span');
  return overlay === null ? 'no fill drawn' : getComputedStyle(overlay).width;
}

describe('RatingPicker — the stars', () => {
  it('renders five of them, each one a control rather than a label', () => {
    // The whole point of the molecule: the stars on the detail page stop being
    // something you read and become something you click.
    renderPicker();

    expect(stars()).toHaveLength(5);
  });

  it('fills every star up to the stored value', () => {
    renderPicker({ value: 80 });

    expect(fillOf(4)).toBe('100%');
    expect(fillOf(5)).toBe('0%');
  });

  it('draws no fill at all for an unrated movie', () => {
    renderPicker({ value: null });

    expect(stars()).toHaveLength(5);
    expect(fillOf(1)).toBe('0%');
    expect(fillOf(5)).toBe('0%');
  });

  it('draws a stored half-star as half a star, though it cannot yet be clicked', () => {
    // A seeded 3.5 has to *show* as three and a half even while the picker can
    // only set whole stars — reading the scale and writing it are separate.
    renderPicker({ value: 70 });

    expect(fillOf(3)).toBe('100%');
    expect(fillOf(4)).toBe('50%');
    expect(fillOf(5)).toBe('0%');
  });
});

describe('RatingPicker — clicking a star', () => {
  it('reports the star that was clicked, as a percent', () => {
    const onChange = vi.fn();
    renderPicker({ value: 40, onChange });

    fireEvent.click(star(4));

    // Percent, not units: a molecule that knows nothing about the domain must
    // not start speaking in the 0–10 the column happens to store.
    expect(onChange).toHaveBeenCalledWith(80);
  });

  it('reports the first star as 20 and the last as 100', () => {
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });

    fireEvent.click(star(1));
    fireEvent.click(star(5));

    expect(onChange).toHaveBeenNthCalledWith(1, 20);
    expect(onChange).toHaveBeenNthCalledWith(2, 100);
  });

  it('reports nothing until a star is actually clicked', () => {
    const onChange = vi.fn();
    renderPicker({ value: 60, onChange });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('holds its value from the caller — a click alone does not restyle it', () => {
    // The picker is controlled: the click is a request, and the value that
    // comes back is the caller's answer. Anything else would let the stars
    // claim a rating the server never took.
    renderPicker({ value: 40, onChange: () => undefined });

    fireEvent.click(star(5));

    expect(fillOf(5)).toBe('0%');
    expect(screen.getByText('2.0 / 5')).toBeTruthy();
  });
});

describe('RatingPicker — the label', () => {
  it('reads the stored value out of five', () => {
    renderPicker({ value: 80 });

    expect(screen.getByText('4.0 / 5')).toBeTruthy();
  });

  it('reads a half-star value out of five', () => {
    renderPicker({ value: 70 });

    expect(screen.getByText('3.5 / 5')).toBeTruthy();
  });

  it('reads "Not rated" for an unrated movie', () => {
    renderPicker({ value: null });

    expect(screen.getByText(/not rated/i)).toBeTruthy();
  });

  it('reads 0.0 / 5 for a movie scored zero, which is not the same as unrated', () => {
    // The distinction the whole feature exists to keep: "we watched it and
    // scored it nothing" and "nobody has said anything yet" are two facts.
    renderPicker({ value: 0 });

    expect(screen.getByText('0.0 / 5')).toBeTruthy();
    expect(screen.queryByText(/not rated/i)).toBeNull();
  });
});

describe('RatingPicker — its size', () => {
  it('draws its stars at the prototype’s 30px by default', () => {
    renderPicker();

    expect(getComputedStyle(star(1)).fontSize).toBe('30px');
  });

  it('takes the size it is given, so a 20px instance is a smaller picker', () => {
    // The meta line asks for 20 — the size the stars there have always been.
    renderPicker({ size: 20 });

    expect(getComputedStyle(star(1)).fontSize).toBe('20px');
  });
});
