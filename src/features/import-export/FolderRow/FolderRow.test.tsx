import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { FolderRow } from './FolderRow';
import type { LibraryFolder } from '@/types';
import { theme } from '@/styles/theme';

/**
 * 30 — Library folders, Phase 1: "a remembered list, end to end" (issue #268).
 *
 * One **Folder row**, `mol.FolderRow.dc.html` in `CodecRow`'s shape: the 40px
 * tile with the folder glyph, the path in mono, then the line — _N titles_,
 * or _Can't be reached right now_ in `danger` for an **Unreachable** folder —
 * and last the `RemoveButton`, labelled _Remove `<path>`_. Presentational to
 * the last prop: the press is handed back, and the row knows nothing of what
 * a removal does.
 */

const DANGER = 'rgb(201, 122, 106)';

const folder = (overrides: Partial<LibraryFolder> = {}): LibraryFolder => ({
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
  ...overrides,
});

function renderRow(row: LibraryFolder = folder(), onRemove = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <FolderRow folder={row} onRemove={onRemove} />
    </ThemeProvider>
  );
  return onRemove;
}

describe('FolderRow — what it shows', () => {
  it('shows the path in mono', () => {
    renderRow();

    const path = screen.getByText('E:\\Movies');
    expect(getComputedStyle(path).fontFamily).toContain('JetBrains Mono');
  });

  it('shows the folder’s title count', () => {
    renderRow();

    expect(screen.getByText('12 titles')).toBeDefined();
  });

  it('shows 0 titles for a folder nothing came from yet', () => {
    renderRow(folder({ titleCount: 0 }));

    expect(screen.getByText('0 titles')).toBeDefined();
  });

  it('draws the folder glyph in the tile', () => {
    renderRow();

    expect(document.querySelector('svg')).not.toBeNull();
  });
});

describe('FolderRow — an unreachable folder', () => {
  it('says it cannot be reached, in danger, in place of the count', () => {
    renderRow(folder({ reachable: false }));

    const line = screen.getByText(/^Can['’]t be reached right now$/);
    expect(getComputedStyle(line).color).toBe(DANGER);
    expect(screen.queryByText('12 titles')).toBeNull();
  });

  it('keeps the path and the ✕', () => {
    renderRow(folder({ reachable: false }));

    expect(screen.getByText('E:\\Movies')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Remove E:\\Movies' })
    ).toBeDefined();
  });
});

describe('FolderRow — the ✕', () => {
  it('is labelled Remove and the path', () => {
    renderRow();

    expect(
      screen.getByRole('button', { name: 'Remove E:\\Movies' })
    ).toBeDefined();
  });

  it('calls back on a press', async () => {
    const onRemove = renderRow();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove E:\\Movies' })
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
