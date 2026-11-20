// 70 — Video quality, Phase 1: "one film, through the Movie form" (issue #664).
//
// `prim.MetaTag`: a word in a hairline box, a visual glance and never a
// control. It draws its label and nothing a keyboard or a screen reader could
// land on as a thing to press.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { MetaTag } from './MetaTag';
import { theme } from '@/styles/theme';

function renderTag(label = '1080p') {
  return render(
    <ThemeProvider theme={theme}>
      <MetaTag label={label} />
    </ThemeProvider>
  );
}

describe('MetaTag', () => {
  it('draws its label', () => {
    renderTag('4K');

    expect(screen.getByText('4K')).toBeTruthy();
  });

  it('is not a control', () => {
    const { container } = renderTag();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('button, a, input, [role]')).toBeNull();
  });

  it('is not focusable', () => {
    const { container } = renderTag();

    expect(container.querySelector('[tabindex]')).toBeNull();
    const tag = screen.getByText('1080p');
    tag.focus();
    expect(document.activeElement).not.toBe(tag);
  });
});
