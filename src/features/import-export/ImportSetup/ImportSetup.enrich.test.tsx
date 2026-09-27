import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ImportSetup, type ImportSetupProps } from './ImportSetup';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 23 — Enrichment, Phase 9: "from the import" (issue #212).
 *
 * The **Setup step** gains the _Also fetch metadata and posters from TMDB_
 * checkbox card over _Start import_, from `feat.ImportFlow.dc.html` and the
 * prototype's `enrichBoxStyle` / `enrichHint`: a card that is itself the one
 * `role="checkbox"` (its native input visually hidden, never a second
 * checkbox in the tree), the 22px box first in it, the 15px label and the
 * 13px hint under it. The hint is chosen by whether a TMDB key is stored.
 *
 * Controlled, as the rest of the step is: `enrich`, `keySet` and
 * `onToggleEnrich` are handed in.
 */

const LABEL = 'Also fetch metadata and posters from TMDB';
const HINT_WITH_KEY =
  'Runs straight after the import, over everything it brings in. Needs the internet.';
const HINT_WITHOUT_KEY =
  'Needs a TMDB key — add one under Settings → Network first.';

function renderSetup(props: Partial<ImportSetupProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ImportSetup
        sheet=""
        root=""
        sheetError={null}
        rootError={null}
        onSheet={() => undefined}
        onRoot={() => undefined}
        onStart={() => undefined}
        enrich={false}
        keySet={true}
        onToggleEnrich={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

/** The card: the one checkbox in the tree, named by its label. */
const card = () => screen.getByRole('checkbox', { name: new RegExp(LABEL) });
/** The prototype's 22px box — the first thing drawn in the card. */
const box = () => card().firstElementChild as HTMLElement;

describe('ImportSetup — the Also fetch from TMDB card', () => {
  it('draws one checkbox named by its label, between the accepted shapes and Start import', () => {
    renderSetup();

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByText(LABEL)).toBeDefined();
    expect(
      comesBefore(screen.getByText('What the scanner accepts'), card())
    ).toBe(true);
    expect(
      comesBefore(card(), screen.getByRole('button', { name: 'Start import' }))
    ).toBe(true);
  });

  it('is unticked when enrich is off and ticked when it is on', () => {
    const { unmount } = renderSetup({ enrich: false });
    expect(card().getAttribute('aria-checked')).toBe('false');
    expect(box().textContent).toBe('');
    unmount();

    renderSetup({ enrich: true });
    expect(card().getAttribute('aria-checked')).toBe('true');
    expect(box().textContent).toBe('✓');
  });

  it('reports a press to its handler', () => {
    const onToggleEnrich = vi.fn();
    renderSetup({ onToggleEnrich });

    fireEvent.click(card());

    expect(onToggleEnrich).toHaveBeenCalledTimes(1);
  });

  it('reads the with-key hint when a key is stored', () => {
    renderSetup({ keySet: true });

    expect(screen.getByText(HINT_WITH_KEY)).toBeDefined();
    expect(screen.queryByText(HINT_WITHOUT_KEY)).toBeNull();
  });

  it('reads the without-key hint when none is', () => {
    renderSetup({ keySet: false });

    expect(screen.getByText(HINT_WITHOUT_KEY)).toBeDefined();
    expect(screen.queryByText(HINT_WITH_KEY)).toBeNull();
  });
});

describe('ImportSetup — the card drawn as the prototype draws it', () => {
  it('is the surface card: 14px 16px padding, a 1px soft border, 10px corners', () => {
    renderSetup();
    const style = getComputedStyle(card());

    expect(style.display).toBe('flex');
    expect(style.alignItems).toBe('flex-start');
    expect(style.gap).toBe('12px');
    expect(style.paddingTop).toBe('14px');
    expect(style.paddingBottom).toBe('14px');
    expect(style.paddingLeft).toBe('16px');
    expect(style.paddingRight).toBe('16px');
    expect(style.backgroundColor).toBe('rgb(33, 27, 21)');
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(style.getPropertyValue(`border-${side}-width`)).toBe('1px');
      expect(style.getPropertyValue(`border-${side}-style`)).toBe('solid');
      expect(style.getPropertyValue(`border-${side}-color`)).toBe(
        'rgb(44, 36, 27)'
      );
    }
    expect(style.borderRadius).toBe('10px');
    expect(style.cursor).toBe('pointer');
    expect(style.marginTop).toBe('4px');
  });

  it('draws the label at 15px 600 in the text colour, and the hint at 13px in the faint one', () => {
    renderSetup();
    const label = getComputedStyle(screen.getByText(LABEL));
    const hint = getComputedStyle(screen.getByText(HINT_WITH_KEY));

    expect(label.fontSize).toBe('15px');
    expect(label.fontWeight).toBe('600');
    expect(label.color).toBe('rgb(243, 236, 224)');
    expect(hint.fontSize).toBe('13px');
    expect(hint.color).toBe('rgb(133, 122, 104)');
    expect(hint.marginTop).toBe('2px');
  });

  it('draws the unticked box 22px, 6px corners, a 2px faint border and no fill', () => {
    renderSetup({ enrich: false });
    const style = getComputedStyle(box());

    expect(style.width).toBe('22px');
    expect(style.height).toBe('22px');
    expect(style.borderRadius).toBe('6px');
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(style.getPropertyValue(`border-${side}-width`)).toBe('2px');
      expect(style.getPropertyValue(`border-${side}-color`)).toBe(
        'rgb(133, 122, 104)'
      );
    }
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('fills the ticked box with the accent and draws the tick dark, 14px 700', () => {
    renderSetup({ enrich: true });
    const style = getComputedStyle(box());

    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(style.getPropertyValue(`border-${side}-color`)).toBe(
        'rgb(217, 122, 78)'
      );
    }
    expect(style.backgroundColor).toBe('rgb(217, 122, 78)');
    expect(style.color).toBe('rgb(26, 17, 9)');
    expect(style.fontSize).toBe('14px');
    expect(style.fontWeight).toBe('700');
  });
});
