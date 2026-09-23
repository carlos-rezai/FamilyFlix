import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — the import path MovieForm, ExportModal and the
// movie detail page's genre tags will all use.
import { Chip, type ChipProps } from '@/primitives';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
  type StyleState,
} from '@/test-support/resolvedStyle/resolvedStyle';

function renderChip(props: Partial<ChipProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Chip label={props.label ?? 'Drama'} {...props} />
    </ThemeProvider>
  );
}

describe('Chip', () => {
  it('renders its label', () => {
    const { getByText } = renderChip({ label: 'Drama' });

    expect(getByText('Drama')).toBeTruthy();
  });

  it.each(['sm', 'md'] as const)('keeps its label at size %s', (size) => {
    const { getByText } = renderChip({ label: 'Thriller', size });

    expect(getByText('Thriller')).toBeTruthy();
  });
});

describe('Chip — as a selectable control', () => {
  it('is activatable when given an onClick', () => {
    const onClick = vi.fn();
    renderChip({ label: 'Drama', onClick });

    fireEvent.click(screen.getByRole('button', { name: 'Drama' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reports itself unselected when it is not selected', () => {
    renderChip({ label: 'Drama', onClick: () => undefined });

    expect(
      screen.getByRole('button', { name: 'Drama' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('reports itself selected, so the accent fill is not the only signal', () => {
    renderChip({ label: 'Drama', selected: true, onClick: () => undefined });

    expect(
      screen.getByRole('button', { name: 'Drama' }).getAttribute('aria-pressed')
    ).toBe('true');
  });
});

describe('Chip — as a static tag', () => {
  it('offers no button affordance without an onClick', () => {
    renderChip({ label: 'Drama' });

    // The movie detail page's genre tags are labels, not controls. A tag that
    // is still a button is a tab stop that does nothing when activated.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('stays a static tag even when it is selected', () => {
    const { getByText } = renderChip({ label: 'Drama', selected: true });

    expect(getByText('Drama')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/**
 * 21 — Motion & interaction states, Phase 3 (issue #183): the selectable Chip
 * on `controlStates`, as `prim.Chip.dc.html` draws it.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each Chip is
 * rendered into the document and `resolvedStyle` runs the cascade for the
 * named state — what wins there, the way Button's are. A press is always also
 * a hover, so a press is resolved as both.
 */
describe('Chip — hover, press and keyboard focus', () => {
  const HOVER: StyleState = { hover: true };
  const PRESS: StyleState = { hover: true, active: true };

  /** One Chip, rendered afresh, as the element its face is drawn on. */
  function face(tree: ReactElement): Element {
    cleanup();
    render(<ThemeProvider theme={theme}>{tree}</ThemeProvider>);
    const element = screen.getByText('Drama').closest('button, span');
    if (element === null) {
      throw new Error('the chip drew no face');
    }
    return element;
  }

  const c = theme.colors;
  const select = () => undefined;

  it('hovers an unselected chip to the accent line, the surface2 fill and a 1px lift', () => {
    const hover = resolvedStyle(
      face(<Chip label="Drama" onClick={select} />),
      HOVER
    );

    expect(hover['border-color']).toBe(normCss(c.accentLine));
    expect(hover.background).toBe(normCss(c.surface2));
    expect(hover.transform).toBe('translateY(-1px)');
  });

  it('presses back down and in, at translateY(0) scale(.97), in 60ms', () => {
    const press = resolvedStyle(
      face(<Chip label="Drama" onClick={select} />),
      PRESS
    );

    expect(press.transform).toBe(normCss('translateY(0) scale(.97)'));
    expect(press['transition-duration']).toBe('60ms');
  });

  it('eases its states in at durFast on easeOut', () => {
    const transition =
      resolvedStyle(face(<Chip label="Drama" onClick={select} />)).transition ??
      '';

    for (const property of [
      'background',
      'border-color',
      'color',
      'transform',
    ]) {
      expect(transition).toContain(
        normCss(`${property} ${theme.motion.durFast} ${theme.motion.easeOut}`)
      );
    }
  });

  it('draws the accent Focus ring under Tab, and none for a click', () => {
    const chip = face(<Chip label="Drama" onClick={select} />);

    expect(resolvedStyle(chip, { focusVisible: true })['box-shadow']).toBe(
      normCss(`0 0 0 3px ${c.focusRing}`)
    );
    expect(resolvedStyle(chip, { focus: true })).toEqual(resolvedStyle(chip));
  });

  it('keeps a selected chip’s accent-soft fill under the pointer, and still lifts it', () => {
    const hover = resolvedStyle(
      face(<Chip label="Drama" selected onClick={select} />),
      HOVER
    );

    expect(hover.background).toBe(normCss(c.accentSoft));
    expect(hover.transform).toBe('translateY(-1px)');
  });

  it.each([false, true])(
    'gives a Tag (selected: %s) no hover, no press and no ring',
    (selected) => {
      const tag = face(<Chip label="Drama" selected={selected} />);
      const resting = resolvedStyle(tag);

      expect(tag.tagName).not.toBe('BUTTON');
      expect(resolvedStyle(tag, HOVER)).toEqual(resting);
      expect(resolvedStyle(tag, PRESS)).toEqual(resting);
      expect(resolvedStyle(tag, { focusVisible: true })).toEqual(resting);
      expect(resting.transform).toBeUndefined();
    }
  );
});
