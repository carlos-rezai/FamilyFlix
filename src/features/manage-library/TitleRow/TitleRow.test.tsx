import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { TitleRow } from './TitleRow';
import type { LibraryTitle } from '@/types';
import { theme } from '@/styles/theme';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
 *
 * One **Title row** on the **Manage library page**, on the **Folder row**'s
 * furniture: the 40px accent tile with the folder glyph, the title and its
 * year (none when absent, a **Year range** for a show), the path in mono,
 * then the meta line — the _Linked_ / _Copied_ badge, _N files_ or _N
 * seasons · N episodes_, and the **Details state**'s dot and words — and,
 * for a title whose Library folder can't be read, `folderLine`'s _Can’t be
 * reached right now_ in `danger`. Its words are `titleRowView`'s. No menus
 * yet: this phase is read-only.
 */

const DANGER = 'rgb(201, 122, 106)';

function renderRow(title: LibraryTitle) {
  return render(
    <ThemeProvider theme={theme}>
      <TitleRow title={title} />
    </ThemeProvider>
  );
}

describe('TitleRow — a film', () => {
  it('draws the title and its year', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', year: 2017 }));

    expect(screen.getByText('Coco')).toBeDefined();
    expect(screen.getByText('2017')).toBeDefined();
  });

  it('draws no year when there is none', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', year: null }));

    expect(screen.getByText('Coco')).toBeDefined();
    expect(screen.queryByText(/^\d{4}/)).toBeNull();
  });

  it('draws the path in mono', () => {
    renderRow(makeLibraryMovie({ path: 'E:\\Movies\\Coco (2017)' }));

    const path = screen.getByText('E:\\Movies\\Coco (2017)');
    expect(getComputedStyle(path).fontFamily).toContain('JetBrains Mono');
  });

  it('draws the folder glyph in the tile', () => {
    const { container } = renderRow(makeLibraryMovie());

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('badges a copied film Copied', () => {
    renderRow(makeLibraryMovie({ linkedFiles: null }));

    expect(screen.getByText('Copied')).toBeDefined();
    expect(screen.queryByText('Linked')).toBeNull();
  });

  it('badges a linked film Linked', () => {
    renderRow(makeLibraryMovie({ linkedFiles: 'folder' }));

    expect(screen.getByText('Linked')).toBeDefined();
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('counts the film’s files', () => {
    renderRow(makeLibraryMovie({ files: 3 }));

    expect(screen.getByText('3 files')).toBeDefined();
  });

  it.each([
    ['synced', 'Synced with TMDB'],
    ['own', 'Your own details'],
    ['none', 'No details'],
  ] as const)('reads a %s title’s dot as %s', (details, words) => {
    renderRow(makeLibraryMovie({ details }));

    expect(screen.getByText(words)).toBeDefined();
  });

  it('draws no unreachable line for a reachable title', () => {
    renderRow(makeLibraryMovie({ linkedFiles: 'folder' }));

    expect(screen.queryByText(/^Can['’]t be reached right now$/)).toBeNull();
  });
});

describe('TitleRow — an unreachable title', () => {
  it('says it can’t be reached right now, in danger', () => {
    renderRow(makeLibraryMovie({ linkedFiles: 'unreachable' }));

    const line = screen.getByText('Can’t be reached right now');
    expect(getComputedStyle(line).color).toBe(DANGER);
  });

  it('keeps its path and its Linked badge', () => {
    renderRow(
      makeLibraryMovie({
        linkedFiles: 'unreachable',
        path: 'E:\\Movies\\Heat (1995)',
      })
    );

    expect(screen.getByText('E:\\Movies\\Heat (1995)')).toBeDefined();
    expect(screen.getByText('Linked')).toBeDefined();
  });
});

describe('TitleRow — a show', () => {
  it('draws its Year range', () => {
    renderRow(makeLibrarySeries({ year: 2019, endYear: 2023 }));

    expect(screen.getByText('2019–2023')).toBeDefined();
  });

  it('counts its seasons and episodes', () => {
    renderRow(makeLibrarySeries({ seasons: 3, episodes: 151 }));

    expect(screen.getByText('3 seasons · 151 episodes')).toBeDefined();
  });

  it('badges a show with linked episodes Linked', () => {
    renderRow(makeLibrarySeries({ linkedFiles: 'videos' }));

    expect(screen.getByText('Linked')).toBeDefined();
  });
});
