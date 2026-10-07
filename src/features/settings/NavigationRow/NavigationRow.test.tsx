import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { NavigationRow, type NavigationRowProps } from './NavigationRow';
import { ChevronRightIcon } from '@/primitives';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { withoutComments } from '@/test-support/shippingSources/shippingSources';

/**
 * 26 — Codecs page, Phase 3: "the navigation-row graduation" (issue #246).
 *
 * The Network group's _Sync metadata & posters_ row and the Playback group's
 * **Codecs row**, written twice, extracted once (log 26 Q14): one button whose
 * tile holds a glyph, then a label, a line under it, and a chevron. Pressed,
 * it pushes its destination. It stays in `features/settings/`, because both
 * callers are Settings groups.
 */

function renderRow(props: Partial<NavigationRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <NavigationRow
                  glyph={<span>★</span>}
                  label="Codecs"
                  line="2 video formats"
                  to="/settings/codecs"
                  {...props}
                />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('NavigationRow', () => {
  it('is one button, named for its label', () => {
    renderRow();

    expect(screen.getByRole('button', { name: /^Codecs/ })).toBeDefined();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('keeps its glyph decorative, out of the button’s name', () => {
    renderRow();

    expect(screen.queryByRole('button', { name: /★/ })).toBeNull();
    expect(
      screen.getByText('★').closest('[aria-hidden="true"]')
    ).not.toBeNull();
  });

  it('draws its line under the label', () => {
    renderRow();

    const button = screen.getByRole('button', { name: /^Codecs/ });
    expect(button.contains(screen.getByText('2 video formats'))).toBe(true);
  });

  it('draws its line blank when the line is empty', () => {
    renderRow({ line: '' });

    expect(screen.getByRole('button', { name: 'Codecs' })).toBeDefined();
  });

  it('pushes its destination when pressed', () => {
    renderRow({ to: '/enrich' });

    fireEvent.click(screen.getByRole('button', { name: /^Codecs/ }));

    expect(pathname()).toBe('/enrich');
    expect(navigationType()).toBe('PUSH');
  });

  it('pushes its destination on Enter after Tab', async () => {
    const user = userEvent.setup();
    renderRow({ to: '/enrich' });

    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /^Codecs/ })
    );
    await user.keyboard('{Enter}');

    expect(pathname()).toBe('/enrich');
    expect(navigationType()).toBe('PUSH');
  });

  it('pushes its destination on Space after Tab', async () => {
    const user = userEvent.setup();
    renderRow({ to: '/enrich' });

    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /^Codecs/ })
    );
    await user.keyboard(' ');

    expect(pathname()).toBe('/enrich');
    expect(navigationType()).toBe('PUSH');
  });

  it('carries a chevron at its end', () => {
    renderRow();

    const chevron = render(
      <ChevronRightIcon size={18} />
    ).container.querySelector('svg');
    const row = screen.getByRole('button', { name: /^Codecs/ });

    expect(row.lastElementChild?.querySelector('svg')?.innerHTML).toBe(
      chevron?.innerHTML
    );
  });
});

describe('NavigationRow — the two rows it replaced', () => {
  const read = (path: string) => withoutComments(readFileSync(path, 'utf8'));

  it.each([
    ['NetworkSection', /\bSync(Row|Tile|Text|Label|Desc|Chevron)\b/],
    ['PlaybackSection', /\bCodecs(Row|Tile|Text|Label|Desc|Chevron)\b/],
  ])('%s draws through it, keeping no copy of its styles', (name, copy) => {
    const section = read(`src/features/settings/${name}/${name}.tsx`);
    const styles = read(`src/features/settings/${name}/${name}.styles.ts`);

    expect(section).toMatch(/<NavigationRow\b/);
    expect(section).not.toMatch(copy);
    expect(styles).not.toMatch(copy);
  });
});
