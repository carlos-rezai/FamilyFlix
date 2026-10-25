import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { FolderRow } from './FolderRow';
import type { LibraryFolderView } from '@/types';
import { theme } from '@/styles/theme';

/**
 * 51, Library audit, Phase 12: "Bring back on Library folders" (issue #455).
 *
 * A **Folder row** with **Left-out videos** draws a second line,
 * `mol.FolderRow.dc.html`: _3 videos left out_ (_1 video_ for one) and
 * _Bring back_ beside it. A folder with none draws no line. The press is
 * handed back through `onBringBack`.
 */

const folder = (leftOut: number): LibraryFolderView => ({
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
  leftOut,
});

function renderRow(row: LibraryFolderView, onBringBack = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <FolderRow folder={row} onBringBack={onBringBack} onRemove={vi.fn()} />
    </ThemeProvider>
  );
  return onBringBack;
}

const bringBack = () => screen.queryByRole('button', { name: 'Bring back' });

describe('FolderRow: the left-out line', () => {
  it('reads 3 videos left out, with Bring back, for a count of 3', () => {
    renderRow(folder(3));

    expect(screen.getByText('3 videos left out')).toBeDefined();
    expect(bringBack()).not.toBeNull();
  });

  it('reads 1 video left out for one', () => {
    renderRow(folder(1));

    expect(screen.getByText('1 video left out')).toBeDefined();
    expect(bringBack()).not.toBeNull();
  });

  it('draws the line only with a count: none, and no Bring back, at 0', () => {
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <FolderRow
          folder={folder(2)}
          onBringBack={vi.fn()}
          onRemove={vi.fn()}
        />
      </ThemeProvider>
    );
    expect(screen.getByText('2 videos left out')).toBeDefined();

    rerender(
      <ThemeProvider theme={theme}>
        <FolderRow
          folder={folder(0)}
          onBringBack={vi.fn()}
          onRemove={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.queryByText(/left out/)).toBeNull();
    expect(bringBack()).toBeNull();
    expect(screen.getByText('12 titles')).toBeDefined();
  });

  it('hands a Bring back press to its caller', async () => {
    const onBringBack = renderRow(folder(3));

    await userEvent.click(screen.getByRole('button', { name: 'Bring back' }));

    expect(onBringBack).toHaveBeenCalledTimes(1);
  });
});
