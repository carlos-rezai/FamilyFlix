import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { CircleToggle, type CircleToggleProps } from '@/components';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * The round toggle beside a detail page's Play — the movie page's and the
 * series page's watched tick and heart. Named and titled by one `label`, its
 * state carried as `aria-pressed` and drawn as the accent fill.
 */
function renderCircle(props: Partial<CircleToggleProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <CircleToggle
        on={false}
        label="Mark as watched"
        onClick={() => undefined}
        {...props}
      >
        <span data-testid="glyph" />
      </CircleToggle>
    </ThemeProvider>
  );
}

const circle = () => screen.getByRole('button', { name: 'Mark as watched' });

describe('CircleToggle', () => {
  it('is named and titled by its label, around the glyph it is handed', () => {
    renderCircle();

    expect(circle().getAttribute('title')).toBe('Mark as watched');
    expect(circle().contains(screen.getByTestId('glyph'))).toBe(true);
  });

  it.each([false, true])('carries on: %s as aria-pressed', (on) => {
    renderCircle({ on });

    expect(circle().getAttribute('aria-pressed')).toBe(String(on));
  });

  it('fills with the accent while on, and is a bare outline while off', () => {
    const { unmount } = renderCircle({ on: true });
    expect(getComputedStyle(circle()).backgroundColor).not.toBe(
      'rgba(0, 0, 0, 0)'
    );
    unmount();

    renderCircle({ on: false });
    expect(getComputedStyle(circle()).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('draws at 58px unless told otherwise', () => {
    const { unmount } = renderCircle();
    expect(getComputedStyle(circle()).width).toBe('58px');
    unmount();

    renderCircle({ size: 44 });
    expect(getComputedStyle(circle()).width).toBe('44px');
  });

  it('reports a press', () => {
    const onClick = vi.fn();
    renderCircle({ onClick });

    fireEvent.click(circle());

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  /**
   * 21 — Motion & interaction states, Phase 4 (issue #184): the circle
   * toggles on IconButton's Control states; this file draws no scale. jsdom
   * computes no `:hover`, `:active` or `:focus-visible`, so each state is the
   * cascade `resolvedStyle` runs for the rendered button.
   */
  describe.each([false, true])('on: %s', (on) => {
    it('shows a press and the ring, and does not scale on hover', () => {
      renderCircle({ on });

      expect(resolvedStyle(circle(), { hover: true }).transform ?? 'none').toBe(
        'none'
      );
      const press = resolvedStyle(circle(), { hover: true, active: true });
      expect(press.transform).toBe(normCss('scale(.94)'));
      expect(press['transition-duration']).toBe('60ms');
      expect(
        resolvedStyle(circle(), { focusVisible: true })['box-shadow']
      ).toBe(normCss(`0 0 0 3px ${theme.colors.focusRing}`));
    });
  });
});
