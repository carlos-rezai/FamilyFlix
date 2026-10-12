import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PageHeader, type PageHeaderProps } from './PageHeader';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

function renderHeader(props: Partial<PageHeaderProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <PageHeader heading="Settings" {...props} />
    </ThemeProvider>
  );
}

const heading = () => screen.getByRole('heading', { level: 1 });
/** The heading's row: the heading sits in its titles box inside it. */
const row = () => heading().parentElement?.parentElement as HTMLElement;

/**
 * The header every column screen opens with, written once so no two screens
 * draw it apart: the Back button, the heading on its line, the screen's own
 * controls at the row's end, and the lede.
 */
describe('PageHeader', () => {
  it('draws the screen’s one heading', () => {
    renderHeader();
    expect(heading().textContent).toBe('Settings');
  });

  it('draws the Back button and hands it the press', () => {
    const onBack = vi.fn();
    renderHeader({ onBack });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('names Back for where it goes, when told', () => {
    renderHeader({ onBack: vi.fn(), backLabel: 'Back to series' });
    expect(
      screen.getByRole('button', { name: 'Back to series' })
    ).toBeDefined();
  });

  it('draws no Back for a screen that draws its own', () => {
    renderHeader();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('puts the eyebrow above the heading', () => {
    renderHeader({ eyebrow: 'Harbor & Vine' });
    expect(comesBefore(screen.getByText('Harbor & Vine'), heading())).toBe(
      true
    );
  });

  it('puts the screen’s own controls at the row’s end, after the heading', () => {
    renderHeader({ end: <button type="button">Add a title</button> });

    const add = screen.getByRole('button', { name: 'Add a title' });
    expect(row().contains(add)).toBe(true);
    expect(comesBefore(heading(), add)).toBe(true);
  });

  it('is as tall as the Back button, so the heading sits on its line', () => {
    renderHeader();
    expect(getComputedStyle(row()).minHeight).toBe('44px');
  });

  it('draws the lede under the row, at the column’s edge', () => {
    renderHeader({ lede: 'Manage your library, playback, and storage.' });

    const lede = screen.getByText(
      'Manage your library, playback, and storage.'
    );
    expect(row().contains(lede)).toBe(false);
    expect(comesBefore(row(), lede)).toBe(true);
    expect(getComputedStyle(lede).marginLeft).toBe('0px');
  });

  it('draws no lede when given none', () => {
    const { container } = renderHeader();
    expect(container.querySelector('p')).toBeNull();
  });
});
