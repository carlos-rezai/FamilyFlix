import styled from 'styled-components';

import type { Decision } from '@/types';

/** One Decision row: the surface card inside the soft border. */
export const Card = styled.div`
  padding: 18px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The dot, the text block and _Skip_ in one row. */
export const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
`;

/** The prototype's gold for a `conflict` dot — a hue no token names. */
const CONFLICT_GOLD = '#c9a86a';

/**
 * The 10px dot, coloured by kind: accent for `ambiguous`, gold for
 * `conflict`, danger for `missing`.
 */
export const Dot = styled.span<{ $kind: Decision['kind'] }>`
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  margin-top: 7px;
  border-radius: 99px;
  background: ${({ $kind, theme }) =>
    $kind === 'ambiguous'
      ? theme.colors.accent
      : $kind === 'conflict'
        ? CONFLICT_GOLD
        : theme.colors.danger};
`;

export const Text = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const Reason = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The source path in mono, cut with an ellipsis. */
export const Path = styled.div`
  margin-top: 4px;
  overflow: hidden;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SkipSlot = styled.div`
  flex: 0 0 auto;
`;
