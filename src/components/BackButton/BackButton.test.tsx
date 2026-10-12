import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { BackButton, type BackButtonProps } from './BackButton';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

function renderBack(props: Partial<BackButtonProps> = {}) {
  const onClick = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <BackButton onClick={onClick} {...props} />
    </ThemeProvider>
  );
  return onClick;
}

const back = (name = 'Back') => screen.getByRole('button', { name });

/**
 * The **Back button**: one face and one place on every screen but the player,
 * so leaving any screen is the same reach of the hand.
 */
describe('BackButton', () => {
  it('is named Back unless the screen says where it goes', () => {
    renderBack();
    expect(back()).toBeDefined();
  });

  it('takes the name a screen gives it', () => {
    renderBack({ label: 'Back to series' });
    expect(back('Back to series')).toBeDefined();
  });

  it('hands a press to the caller', () => {
    const onClick = renderBack();
    fireEvent.click(back());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is pinned to the viewport at the header strip’s inset, 44px glass', () => {
    renderBack();

    expect(resolvedStyle(back())).toMatchObject({
      position: 'fixed',
      top: '16px',
      left: '32px',
      width: '44px',
      height: '44px',
      background: normCss('rgba(20, 17, 13, 0.6)'),
      'backdrop-filter': normCss('blur(10px)'),
      border: normCss('1px solid rgba(255, 255, 255, 0.14)'),
      color: '#fff',
    });
  });

  it('darkens on hover and keeps its white glyph', () => {
    renderBack();

    const hover = resolvedStyle(back(), { hover: true });
    expect(hover.background).toBe(normCss('rgba(40, 34, 27, 0.85)'));
    expect(hover.color).toBe('#fff');
  });
});
