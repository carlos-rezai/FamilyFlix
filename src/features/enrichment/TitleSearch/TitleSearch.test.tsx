import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { TitleSearch } from './TitleSearch';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: `TitleSearch` is its own
 * unit, its leaves moved down from `DecisionRow`'s suite.
 *
 * The review's search box: the 44px input prefilled with what it is handed,
 * and _Search_ — or Enter — reporting the query exactly as typed.
 */
function renderSearch(initial = 'Sundial') {
  const onSearch = vi.fn<(query: string) => void>();
  render(
    <ThemeProvider theme={theme}>
      <TitleSearch initial={initial} onSearch={onSearch} />
    </ThemeProvider>
  );
  return onSearch;
}

const box = () =>
  screen.getByRole('textbox', {
    name: 'Search TMDB by title and year',
  }) as HTMLInputElement;

describe('TitleSearch', () => {
  it('draws the box prefilled, and Search', () => {
    renderSearch();

    expect(box().value).toBe('Sundial');
    expect(box().getAttribute('placeholder')).toBe(
      'Search TMDB by title and year'
    );
    expect(screen.getByRole('button', { name: 'Search' })).toBeDefined();
  });

  it('draws the box 44px tall', () => {
    renderSearch();

    expect(normCss(resolvedStyle(box()).height ?? '')).toBe('44px');
  });

  it('reports the query as typed on Search', () => {
    const onSearch = renderSearch();

    fireEvent.change(box(), { target: { value: 'Sundial 2004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith('Sundial 2004');
  });

  it('reports the query on Enter', () => {
    const onSearch = renderSearch();

    fireEvent.change(box(), { target: { value: 'Sundials' } });
    fireEvent.keyDown(box(), { key: 'Enter' });

    expect(onSearch).toHaveBeenCalledWith('Sundials');
  });

  it('reports nothing for any other key', () => {
    const onSearch = renderSearch();

    fireEvent.keyDown(box(), { key: 'a' });

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('reports the prefill untouched when nothing is typed', () => {
    const onSearch = renderSearch('Harbor Lights');

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith('Harbor Lights');
  });
});
