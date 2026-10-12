import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { CornerMenu, MenuItem } from '@/components';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * The ⋯ menu's furniture, `EditMenu`'s and `SeriesEditMenu`'s alike: the named
 * trigger, the rows it is handed, and the fixed corner. Opening, closing and
 * focus return are `mol.Menu`'s and are tested there.
 */
function renderCornerMenu(onSelect: () => void = () => undefined) {
  return render(
    <ThemeProvider theme={theme}>
      <CornerMenu>
        <MenuItem glyph="✎" onSelect={onSelect}>
          Edit details
        </MenuItem>
      </CornerMenu>
    </ThemeProvider>
  );
}

const trigger = () => screen.getByRole('button', { name: 'More options' });
const item = () => screen.queryByRole('menuitem', { name: 'Edit details' });

describe('CornerMenu', () => {
  it('offers a ⋯ trigger named More options', () => {
    renderCornerMenu();

    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
  });

  it('opens on the trigger onto the rows it is handed, and closes on one', () => {
    const onSelect = vi.fn();
    renderCornerMenu(onSelect);
    expect(item()).toBeNull();

    fireEvent.click(trigger());
    fireEvent.click(item() as HTMLElement);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(item()).toBeNull();
  });

  it('sits in the fixed top-right slot', () => {
    renderCornerMenu();

    const slot = trigger().parentElement as HTMLElement;
    const style = window.getComputedStyle(slot);
    expect(style.position).toBe('fixed');
    expect(style.top).toBe('24px');
    expect(style.right).toBe('24px');
  });
});

/**
 * 21 — Motion & interaction states, Phase 4 (issue #184): the ⋯ button on
 * IconButton's Control states; its file draws no scale.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * what the injected stylesheet resolves to for the rendered button in that
 * state — the cascade run by `resolvedStyle` — never a computed style.
 */
describe('CornerMenu — the ⋯ button through hover, press and focus', () => {
  it('shows a press and the ring, and does not scale on hover', () => {
    renderCornerMenu();
    const button = trigger();

    expect(resolvedStyle(button, { hover: true }).transform ?? 'none').toBe(
      'none'
    );
    const press = resolvedStyle(button, { hover: true, active: true });
    expect(press.transform).toBe(normCss('scale(.94)'));
    expect(press['transition-duration']).toBe('60ms');
    expect(resolvedStyle(button, { focusVisible: true })['box-shadow']).toBe(
      normCss(`0 0 0 3px ${theme.colors.focusRing}`)
    );
  });
});
