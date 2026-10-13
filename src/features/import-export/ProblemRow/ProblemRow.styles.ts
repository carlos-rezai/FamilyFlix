import styled from 'styled-components';

import type { ProblemKind } from '@/types';

/**
 * The inks a dot can take: what the kind's colour is named after, and `gold`,
 * the Sync's `conflict` hue that no token names.
 */
export type DotTone = 'danger' | 'accent' | 'textFaint' | 'gold';

/** The prototype's gold for a `differs` dot — the Sync's `conflict` gold. */
const GOLD = '#c9a86a';

/**
 * The dot's colour by kind: `danger` for the film that is not there and cannot
 * be got without a hand — `no-folder`, `no-video`, `failed`, and the episode
 * that is `unplaced`; `accent` for
 * `ambiguous`, a choice to make; `text-faint` for `no-row` and the soft
 * `missing-meta`, which the library can live with; and the Sync's gold for
 * `differs`, a comparison to settle on the row.
 */
export const DOT_TONE: Record<ProblemKind, DotTone> = {
  'no-folder': 'danger',
  'no-video': 'danger',
  failed: 'danger',
  unplaced: 'danger',
  ambiguous: 'accent',
  'no-row': 'textFaint',
  'missing-meta': 'textFaint',
  differs: 'gold',
};

/** The row on the surface: its head, then a face when its kind has one. */
export const Card = styled.div`
  padding: 16px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The head: dot, text block and the controls in a line. */
export const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

/** The 10px circle before the text, filled in the kind's colour. */
export const Dot = styled.div<{ $tone: DotTone }>`
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 99px;
  background: ${({ $tone, theme }) =>
    $tone === 'gold' ? GOLD : theme.colors[$tone]};
`;

/**
 * The title and the reason. `min-width: 0` is what lets a long title wrap
 * inside the row rather than widen it past the list.
 */
export const Text = styled.div`
  flex: 1;
  min-width: 0px;
`;

/** The title, 16px semibold in the text ink. */
export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** The reason under it, 13px in the faint ink. */
export const Reason = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
