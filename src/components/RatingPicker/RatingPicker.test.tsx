import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { RatingPicker, type RatingPickerProps } from '@/components';
import { theme } from '@/styles/theme';

function picker(props: Partial<RatingPickerProps> = {}) {
  return (
    <ThemeProvider theme={theme}>
      <RatingPicker
        value={props.value === undefined ? 80 : props.value}
        size={props.size}
        onChange={props.onChange ?? (() => undefined)}
      />
    </ThemeProvider>
  );
}

function renderPicker(props: Partial<RatingPickerProps> = {}) {
  return render(picker(props));
}

/**
 * The ten **Half-star segments**, in the order they span the row. Every button
 * the molecule draws is one of them, so the role alone finds the set — and a
 * segment's position in it is what a parent aims at, which is why the tests
 * below ask for "the fourth star's left half" rather than for a label. Naming
 * them for a screen reader is the next issue's; this one is the geometry, the
 * interaction, and the label beside the stars.
 */
const segments = () => screen.queryAllByRole('button');

/** One segment, 1–10 from the left: 1 is the first star's left half. */
function segment(nth: number): HTMLElement {
  const found = segments()[nth - 1];

  if (found === undefined) {
    throw new Error(
      `No segment ${nth} — the picker drew ${segments().length} of them.`
    );
  }
  return found;
}

/**
 * The smallest element holding all of `elements` — how the strip and each star
 * box are found without reaching for a test id, and without pinning how deeply
 * the picker happens to nest them.
 */
function commonAncestor(elements: HTMLElement[]): HTMLElement {
  let node: HTMLElement | null = elements[0].parentElement;

  while (node !== null) {
    const candidate = node;
    if (elements.every((element) => candidate.contains(element))) {
      return candidate;
    }
    node = node.parentElement;
  }
  throw new Error('Those segments share no ancestor.');
}

/** The strip the ten segments span — what a pointer leaves to drop a preview. */
const strip = () => commonAncestor([segment(1), segment(10)]);

/** One star's box: the element its own two segments sit in, and nothing else's. */
const starBox = (nth: number) =>
  commonAncestor([segment(nth * 2 - 1), segment(nth * 2)]);

/**
 * The accent overlay clipped over one star's dim glyph — the prototype's way of
 * drawing a part-filled star, and the only place the fill exists. It is found
 * as the one element inside the star measured as a percentage of it, so the
 * picker stays free to arrange the rest of the box however it likes.
 */
function fillOverlay(nth: number): Element | undefined {
  return Array.from(starBox(nth).querySelectorAll('span')).find((candidate) =>
    getComputedStyle(candidate).width.endsWith('%')
  );
}

/** How full one star is drawn, as that overlay's width. */
function fillOf(nth: number): string {
  const overlay = fillOverlay(nth);

  return overlay === undefined
    ? 'no fill drawn'
    : getComputedStyle(overlay).width;
}

/** Every percent the picker asked for, in the order it asked. */
function asked(onChange: ReturnType<typeof vi.fn>): unknown[] {
  return onChange.mock.calls.map(([percent]) => percent);
}

describe('RatingPicker — the ten segments', () => {
  it('spans the row in ten of them, each one a real button', () => {
    // The prototype draws its hit areas as bare `<div onClick>`s. Identical
    // pixels, real elements — a control something other than a mouse can reach.
    renderPicker();

    expect(segments()).toHaveLength(10);
    for (const hitArea of segments()) {
      expect(hitArea.tagName).toBe('BUTTON');
      expect(hitArea.getAttribute('type')).toBe('button');
    }
  });

  it('lays them two to a star, so the row still draws five stars', () => {
    renderPicker();

    const boxes = new Set(segments().map((hitArea) => hitArea.parentElement));

    expect(boxes.size).toBe(5);
  });

  it('gives each segment half a star to be clicked in', () => {
    renderPicker();

    expect(getComputedStyle(segment(1)).width).toBe('50%');
    expect(getComputedStyle(segment(1)).height).toBe('100%');
  });
});

describe('RatingPicker — its size', () => {
  it('draws the prototype’s 30px stars, 5px apart, by default', () => {
    renderPicker();

    expect(getComputedStyle(starBox(1)).fontSize).toBe('30px');
    expect(getComputedStyle(starBox(1)).width).toBe('30px');
    expect(getComputedStyle(strip()).gap).toBe('5px');
  });

  it('scales the whole strip when asked for 20px', () => {
    // The meta line asks for 20 — a smaller picker rather than a broken one,
    // which is why the gap scales off the size instead of sitting at a flat 5.
    renderPicker({ size: 20 });

    expect(getComputedStyle(starBox(1)).fontSize).toBe('20px');
    expect(getComputedStyle(starBox(1)).width).toBe('20px');
    expect(getComputedStyle(strip()).gap).toBe('3px');
  });
});

describe('RatingPicker — reading the stored value', () => {
  it('fills every star up to the stored value', () => {
    renderPicker({ value: 80 });

    expect(fillOf(4)).toBe('100%');
    expect(fillOf(5)).toBe('0%');
  });

  it('draws a stored half-star as half a star', () => {
    renderPicker({ value: 70 });

    expect(fillOf(3)).toBe('100%');
    expect(fillOf(4)).toBe('50%');
    expect(fillOf(5)).toBe('0%');
  });

  it('draws no fill at all for an unrated movie', () => {
    renderPicker({ value: null });

    expect(fillOf(1)).toBe('0%');
    expect(fillOf(5)).toBe('0%');
  });

  it('draws the fill in the prototype’s accent colour', () => {
    renderPicker({ value: 100 });

    expect(getComputedStyle(fillOverlay(1) as Element).color).toBe(
      'rgb(217, 122, 78)'
    );
  });
});

describe('RatingPicker — clicking a segment', () => {
  it('reports the fourth star’s right half as 80 and its left half as 70', () => {
    // The half-star this issue exists for: "three and a half" stops being
    // something a parent has to round away from.
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });

    fireEvent.click(segment(8));
    fireEvent.click(segment(7));

    expect(asked(onChange)).toEqual([80, 70]);
  });

  it('covers the whole scale in ten steps of ten, and offers no flat zero', () => {
    // The picker's smallest click is half a star, so a literal 0 can only ever
    // arrive from a seeded import — which is what makes clearing unambiguous.
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });

    for (let nth = 1; nth <= 10; nth += 1) {
      fireEvent.click(segment(nth));
    }

    expect(asked(onChange)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(onChange).not.toHaveBeenCalledWith(0);
  });

  it('changes a rating that is already set', () => {
    const onChange = vi.fn();
    renderPicker({ value: 40, onChange });

    fireEvent.click(segment(9));

    expect(onChange).toHaveBeenCalledWith(90);
  });

  it('speaks percent, never the units the column stores', () => {
    // A molecule that is meant to know nothing about the domain must not start
    // speaking in the stored 0–10.
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });

    fireEvent.click(segment(10));

    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('reports nothing until a segment is actually clicked', () => {
    const onChange = vi.fn();
    renderPicker({ value: 60, onChange });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('holds its value from the caller — a click alone does not restyle it', () => {
    // The picker is controlled: the click is a request, and the value that
    // comes back is the caller's answer. Anything else would let the stars
    // claim a rating the server never took.
    renderPicker({ value: 40, onChange: () => undefined });

    fireEvent.click(segment(10));

    expect(fillOf(5)).toBe('0%');
    expect(screen.getByText('2.0 / 5')).toBeTruthy();
  });
});

describe('RatingPicker — clearing', () => {
  it('asks for null when the segment already holding the value is clicked', () => {
    // The same "click it again to turn it off" grammar the favorite heart and
    // the watched tick already use — and the only undo a mis-click has until
    // the maintainer's form ships.
    const onChange = vi.fn();
    renderPicker({ value: 70, onChange });

    fireEvent.click(segment(7));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('clears from a whole-star value too', () => {
    const onChange = vi.fn();
    renderPicker({ value: 80, onChange });

    fireEvent.click(segment(8));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('clears from the top of the scale', () => {
    const onChange = vi.fn();
    renderPicker({ value: 100, onChange });

    fireEvent.click(segment(10));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('clears only from the segment that holds the value, not its neighbours', () => {
    const onChange = vi.fn();
    renderPicker({ value: 70, onChange });

    fireEvent.click(segment(6));
    fireEvent.click(segment(8));

    expect(asked(onChange)).toEqual([60, 80]);
  });

  it('leaves a stored zero with no segment of its own to clear it', () => {
    // A seeded 0 is a real rating this picker can read and cannot write, so no
    // segment holds it — the first one still asks for half a star.
    const onChange = vi.fn();
    renderPicker({ value: 0, onChange });

    fireEvent.click(segment(1));

    expect(onChange).toHaveBeenCalledWith(10);
    expect(onChange).not.toHaveBeenCalledWith(null);
  });

  it('reads Not rated the moment the cleared value comes back', () => {
    const { rerender } = renderPicker({ value: 70 });
    expect(screen.getByText('3.5 / 5')).toBeTruthy();

    rerender(picker({ value: null }));

    expect(screen.getByText(/not rated/i)).toBeTruthy();
    expect(screen.queryByText('3.5 / 5')).toBeNull();
    expect(fillOf(4)).toBe('0%');
  });
});

describe('RatingPicker — the Rating preview', () => {
  it('previews exactly the fill the segment under the pointer would set', () => {
    // Story 5: aiming at three-and-a-half without having to guess where the
    // boundary is.
    renderPicker({ value: null });

    fireEvent.mouseEnter(segment(7));

    expect(fillOf(3)).toBe('100%');
    expect(fillOf(4)).toBe('50%');
    expect(fillOf(5)).toBe('0%');
  });

  it('writes nothing while the pointer is only passing over', () => {
    const onChange = vi.fn();
    renderPicker({ value: 40, onChange });

    fireEvent.mouseEnter(segment(9));
    fireEvent.mouseEnter(segment(2));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('follows the pointer to the next segment', () => {
    renderPicker({ value: null });

    fireEvent.mouseEnter(segment(3));
    expect(fillOf(2)).toBe('50%');

    fireEvent.mouseEnter(segment(10));

    expect(fillOf(2)).toBe('100%');
    expect(fillOf(5)).toBe('100%');
  });

  it('restores the stored value when the pointer leaves the strip', () => {
    renderPicker({ value: 80 });

    fireEvent.mouseEnter(segment(3));
    expect(fillOf(4)).toBe('0%');

    fireEvent.mouseLeave(strip());

    expect(fillOf(4)).toBe('100%');
    expect(fillOf(5)).toBe('0%');
  });

  it('gives an unrated picker its empty stars back when the pointer leaves', () => {
    renderPicker({ value: null });

    fireEvent.mouseEnter(segment(6));
    expect(fillOf(3)).toBe('100%');

    fireEvent.mouseLeave(strip());

    expect(fillOf(1)).toBe('0%');
    expect(fillOf(3)).toBe('0%');
  });

  it('keeps the label on the stored value while the preview is showing', () => {
    // The preview is a fill, not a reading — the prototype's label follows the
    // stored value, so a hover can never look like a rating that took. It is
    // also how "no uncommitted rating escapes the molecule" is visible: the one
    // number on screen still says what the database says.
    renderPicker({ value: 80 });

    fireEvent.mouseEnter(segment(3));

    expect(fillOf(2)).toBe('50%');
    expect(screen.getByText('4.0 / 5')).toBeTruthy();
  });

  it('says Not rated throughout a preview on an unrated movie', () => {
    renderPicker({ value: null });

    fireEvent.mouseEnter(segment(9));

    expect(screen.getByText(/not rated/i)).toBeTruthy();
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

  it('sits beside the stars at the prototype’s 14px, dimmed', () => {
    renderPicker({ value: 80 });

    const label = getComputedStyle(screen.getByText('4.0 / 5'));

    expect(label.fontSize).toBe('14px');
    expect(label.color).toBe('rgb(182, 169, 148)');
  });
});
