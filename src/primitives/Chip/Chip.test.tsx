import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';

// Through the category barrel — the import path MovieForm, ExportModal and the
// movie detail page's genre tags will all use.
import { Chip, type ChipProps } from '@/primitives';
import { theme } from '@/styles/theme';

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
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * read as the rule the Chip writes for it — off the CSS styled-components
 * produces for one rendered Chip, whitespace aside — the way Button's are.
 */
describe('Chip — hover, press and keyboard focus', () => {
  interface Rule {
    selector: string;
    body: string;
  }

  const squash = (css: string) => css.replace(/\s+/g, '');
  /** `0.32` and `.32` are the same number; compare them as one. */
  const norm = (css: string) => squash(css).replace(/([(,:])0\./g, '$1.');

  function rulesOf(tree: ReactElement): Rule[] {
    const sheet = new ServerStyleSheet();
    try {
      renderToString(
        sheet.collectStyles(<ThemeProvider theme={theme}>{tree}</ThemeProvider>)
      );
      const css = norm(
        sheet
          .getStyleTags()
          .replace(/<\/?style[^>]*>/g, '')
          .replace(/\/\*!sc\*\//g, '')
      );
      return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
        selector: m[1],
        body: m[2],
      }));
    } finally {
      sheet.seal();
    }
  }

  /** Every declaration written under a selector naming this pseudo-class. */
  function state(rules: Rule[], pseudo: string): string {
    return rules
      .filter((rule) => rule.selector.includes(pseudo))
      .map((rule) => rule.body)
      .join(';');
  }

  const c = theme.colors;
  const select = () => undefined;

  it('hovers an unselected chip to the accent line, the surface2 fill and a 1px lift', () => {
    const hover = state(
      rulesOf(<Chip label="Drama" onClick={select} />),
      ':hover'
    );

    expect(hover).toContain(norm(`border-color:${c.accentLine}`));
    expect(hover).toContain(norm(`background:${c.surface2}`));
    expect(hover).toContain('transform:translateY(-1px)');
  });

  it('presses back down and in, at translateY(0) scale(.97), in 60ms', () => {
    const press = state(
      rulesOf(<Chip label="Drama" onClick={select} />),
      ':active'
    );

    expect(press).toContain('transform:translateY(0)scale(.97)');
    expect(press).toContain('transition-duration:60ms');
  });

  it('eases its states in at durFast on easeOut', () => {
    const resting = rulesOf(<Chip label="Drama" onClick={select} />)
      .filter((rule) => !rule.selector.includes(':'))
      .map((rule) => rule.body)
      .join(';');

    const eased = norm(`${theme.motion.durFast} ${theme.motion.easeOut}`);
    for (const property of [
      'background',
      'border-color',
      'color',
      'transform',
    ]) {
      expect(resting).toContain(`${property}${eased}`);
    }
  });

  it('draws the accent Focus ring under Tab, and none for a click', () => {
    const rules = rulesOf(<Chip label="Drama" onClick={select} />);

    expect(state(rules, ':focus-visible')).toContain(
      norm(`box-shadow:0 0 0 3px ${c.focusRing}`)
    );
    expect(
      rules.filter((rule) => /:focus(?!-visible)/.test(rule.selector))
    ).toEqual([]);
  });

  it('keeps a selected chip’s accent-soft fill under the pointer, and still lifts it', () => {
    const rules = rulesOf(<Chip label="Drama" selected onClick={select} />);
    const hover = state(rules, ':hover');

    expect(hover).not.toContain(norm(`background:${c.surface2}`));
    expect(hover).toContain('transform:translateY(-1px)');
    const fills = [...hover.matchAll(/background:([^;]*)/g)].map((m) => m[1]);
    for (const fill of fills) {
      expect(fill).toBe(norm(c.accentSoft));
    }
  });

  it.each([false, true])(
    'gives a Tag (selected: %s) no hover, no press and no ring',
    (selected) => {
      const rules = rulesOf(<Chip label="Drama" selected={selected} />);

      expect(
        rules.filter((rule) => /:(hover|active|focus)/.test(rule.selector))
      ).toEqual([]);
      expect(rules.map((rule) => rule.body).join(';')).not.toContain(
        'transform'
      );
    }
  );
});
