import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MaintainerLayout } from './MaintainerLayout';
import { theme } from '@/styles/theme';

function renderLayout(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <MaintainerLayout>{children}</MaintainerLayout>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The column the screen lands in — the element directly around the content. */
const column = () =>
  screen.getByText('the form goes here').parentElement as HTMLElement;

/**
 * The **Maintainer surface** — the sheet every column screen shares. Structure
 * only: it renders what it is given, at the one **Page measure**, and that is
 * the whole of it. The header is each screen's `PageHeader`.
 */
describe('MaintainerLayout', () => {
  it('renders the screen it is handed', () => {
    renderLayout(<p>the form goes here</p>);

    expect(screen.getByText('the form goes here')).toBeDefined();
  });

  it('draws the column at the one Page measure, whatever the screen', () => {
    renderLayout(<p>the form goes here</p>);

    // One width for every column screen, so moving between them never moves
    // the content sideways — the reason the per-screen `width` prop is gone.
    expect(getComputedStyle(column()).maxWidth).toBe('880px');
  });

  it('opens the column on the Back button’s line', () => {
    renderLayout(<p>the form goes here</p>);

    expect(getComputedStyle(column()).paddingTop).toBe('16px');
  });

  it('leaves the pinned Back button room beside the column', () => {
    renderLayout(<p>the form goes here</p>);

    const sheet = getComputedStyle(column().parentElement as HTMLElement);
    expect(sheet.paddingLeft).toBe('calc(60px)');
    expect(sheet.paddingRight).toBe('calc(60px)');
  });

  it('holds the scrollbar’s gutter, so a long screen centres as a short one', () => {
    renderLayout(<p>the form goes here</p>);

    const sheet = getComputedStyle(column().parentElement as HTMLElement);
    expect(sheet.getPropertyValue('scrollbar-gutter')).toBe(
      'stable both-edges'
    );
  });
});
