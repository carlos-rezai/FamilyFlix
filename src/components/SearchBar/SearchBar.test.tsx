import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { SearchBar, type SearchBarProps } from '@/components';
import { theme } from '@/styles/theme';

function renderSearchBar(props: Partial<SearchBarProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <SearchBar value="" onChange={() => undefined} {...props} />
    </ThemeProvider>
  );
}

/** The search box, found the way a parent finds it — by the name it announces. */
function box(name = 'Search your movies') {
  return screen.getByRole('textbox', { name }) as HTMLInputElement;
}

describe('SearchBar', () => {
  it('renders the value it is given', () => {
    renderSearchBar({ value: 'lighthouse' });

    expect(box().value).toBe('lighthouse');
  });

  it('reports what was typed as the new value', () => {
    const onChange = vi.fn();
    renderSearchBar({ onChange });

    fireEvent.change(box(), { target: { value: 'light' } });

    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('carries the prototype’s placeholder without being asked', () => {
    renderSearchBar();

    expect(box().placeholder).toBe('Search your movies');
  });

  it('shows a different placeholder when a caller wants one', () => {
    renderSearchBar({ placeholder: 'Search this genre' });

    expect(box('Search this genre').placeholder).toBe('Search this genre');
  });

  it('names its field itself, so no caller can ship an unnamed search box', () => {
    // The bar takes no `aria-label` prop: the name comes from the caption it
    // already shows, which is the only visible caption an icon-led field has.
    renderSearchBar({ placeholder: 'Search your movies' });

    expect(box('Search your movies')).toBeDefined();
  });

  it('draws the magnifier, decorative, in the field’s icon slot', () => {
    // `SearchIcon` lifted out per COMPONENT-SPEC §3a, handed in as a slot. It is
    // chrome: it announces nothing and stays out of the field's name.
    const { container } = renderSearchBar();

    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(box('Search your movies')).toBeDefined();
  });
});

describe('SearchBar — how wide it grows', () => {
  /** The bar's own root — the element that carries its width cap. */
  function root(container: HTMLElement) {
    return container.firstElementChild as HTMLElement;
  }

  it('caps at the prototype’s 460px when the caller says nothing', () => {
    const { container } = renderSearchBar();

    expect(getComputedStyle(root(container)).maxWidth).toBe('460px');
  });

  it('caps where a caller asks it to', () => {
    const { container } = renderSearchBar({ maxWidth: 250 });

    expect(getComputedStyle(root(container)).maxWidth).toBe('250px');
  });
});
