import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { FolderRow } from './FolderRow';
import type { LibraryFolderView } from '@/types';
import { theme } from '@/styles/theme';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';

/**
 * 57 — Tidy into folders, Phase 6: "the Folder row reads the plan" (issue #529).
 *
 * A **Folder row** with **Loose videos** (`loose > 0`) draws a line under the
 * left-out one, `mol.FolderRow.dc.html`: _4 loose videos_ (_1 loose video_
 * for one) and **Tidy** beside it, in _Bring back_'s look. A folder with none
 * draws no line. The press is handed back through `onTidy`.
 */

const folder = (loose: number, leftOut = 0): LibraryFolderView => ({
  ...makeLibraryFolder({ id: 'f-movies', path: 'E:\\Movies', titleCount: 12 }),
  leftOut,
  loose,
});

function renderRow(row: LibraryFolderView, onTidy = vi.fn()) {
  const view = render(
    <ThemeProvider theme={theme}>
      <FolderRow
        folder={row}
        onBringBack={vi.fn()}
        onTidy={onTidy}
        onRemove={vi.fn()}
      />
    </ThemeProvider>
  );
  return { onTidy, view };
}

const tidy = () => screen.queryByRole('button', { name: 'Tidy' });

describe('FolderRow: the loose line', () => {
  it('reads 4 loose videos, with Tidy, for a count of 4', () => {
    renderRow(folder(4));

    expect(screen.getByText('4 loose videos')).toBeDefined();
    expect(tidy()).not.toBeNull();
  });

  it('reads 1 loose video for one', () => {
    renderRow(folder(1));

    expect(screen.getByText('1 loose video')).toBeDefined();
    expect(tidy()).not.toBeNull();
  });

  it('draws the line only with a count: none, and no Tidy, at 0', () => {
    const { view } = renderRow(folder(2));
    expect(screen.getByText('2 loose videos')).toBeDefined();

    view.rerender(
      <ThemeProvider theme={theme}>
        <FolderRow
          folder={folder(0)}
          onBringBack={vi.fn()}
          onTidy={vi.fn()}
          onRemove={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.queryByText(/loose video/)).toBeNull();
    expect(tidy()).toBeNull();
    expect(screen.getByText('12 titles')).toBeDefined();
  });

  it('draws the line under the left-out one', () => {
    renderRow(folder(2, 3));

    const leftOut = screen.getByText('3 videos left out');
    const loose = screen.getByText('2 loose videos');

    expect(
      leftOut.compareDocumentPosition(loose) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('hands a Tidy press to its caller', async () => {
    const { onTidy } = renderRow(folder(4));

    await userEvent.click(screen.getByRole('button', { name: 'Tidy' }));

    expect(onTidy).toHaveBeenCalledTimes(1);
  });
});
