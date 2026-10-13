import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import type { CandidateFolder } from '@/types';
import { FolderPicker, type FolderPickerProps } from './FolderPicker';

/**
 * 40 — Import review, Phase 4: "the Folder picker" (issue #334).
 *
 * An `ambiguous` row's face, `feat.ImportFlow.dc.html`: `CandidatePicker`'s
 * shape — a horizontally scrolling group of cards — with its own pixels: one
 * 220px card per **Candidate folder**, the folder's name, its path in mono and
 * its video count as a pill (_1 video_ / _N videos_). No poster, no _% match_.
 * A press reports `onPick(path)`, nothing more: what the press does is the
 * run hook's.
 */

const CANDIDATES: CandidateFolder[] = [
  {
    path: 'D:/Films/Die.Hard.1988.1080p',
    name: 'Die.Hard.1988.1080p',
    videos: 1,
  },
  { path: 'D:/Films/Die Hard (1988)', name: 'Die Hard (1988)', videos: 2 },
];

function renderPicker(props: Partial<FolderPickerProps> = {}) {
  const onPick = vi.fn<(folder: string) => void>();
  render(
    <ThemeProvider theme={theme}>
      <FolderPicker
        candidates={props.candidates ?? CANDIDATES}
        onPick={props.onPick ?? onPick}
      />
    </ThemeProvider>
  );
  return { onPick };
}

const cards = () => within(screen.getByRole('group')).getAllByRole('button');

describe('FolderPicker — the cards', () => {
  it('draws one card per Candidate folder, in a group', () => {
    renderPicker();

    expect(cards()).toHaveLength(2);
  });

  it('draws a folder’s name, its path and its video count', () => {
    renderPicker();

    const card = cards()[1];
    expect(within(card).getByText('Die Hard (1988)')).toBeDefined();
    expect(within(card).getByText('D:/Films/Die Hard (1988)')).toBeDefined();
    expect(within(card).getByText('2 videos')).toBeDefined();
  });

  it('counts one video in the singular', () => {
    renderPicker();

    expect(within(cards()[0]).getByText('1 video')).toBeDefined();
  });

  it('counts no video as 0 videos', () => {
    renderPicker({
      candidates: [{ path: '/films/Empty', name: 'Empty', videos: 0 }],
    });

    expect(within(cards()[0]).getByText('0 videos')).toBeDefined();
  });

  it('draws the cards in the order given', () => {
    renderPicker();

    expect(within(cards()[0]).getByText('Die.Hard.1988.1080p')).toBeDefined();
    expect(within(cards()[1]).getByText('Die Hard (1988)')).toBeDefined();
  });

  it('draws no poster and no % match', () => {
    renderPicker();

    for (const card of cards()) {
      expect(card.querySelector('img')).toBeNull();
      expect(within(card).queryByText(/% match/)).toBeNull();
    }
  });

  it('draws the path in the mono face', () => {
    renderPicker();

    const path = within(cards()[0]).getByText('D:/Films/Die.Hard.1988.1080p');
    expect(normCss(resolvedStyle(path)['font-family'] ?? '')).toBe(
      normCss(theme.fonts.mono)
    );
  });

  it('draws each card 220px wide', () => {
    renderPicker();

    expect(normCss(resolvedStyle(cards()[0])['width'] ?? '')).toBe('220px');
  });
});

describe('FolderPicker — the press', () => {
  it('reports the folder pressed by its path', () => {
    const { onPick } = renderPicker();

    fireEvent.click(cards()[1]);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('D:/Films/Die Hard (1988)');
  });

  it('reports nothing before a press', () => {
    const { onPick } = renderPicker();

    expect(onPick).not.toHaveBeenCalled();
  });
});
