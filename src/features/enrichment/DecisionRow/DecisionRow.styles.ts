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

/** The candidate picker: one horizontal, scrolling row. */
export const Picker = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 6px;
  padding: 16px 2px 4px;
  overflow-x: auto;
`;

/** One candidate card: a 132px button on the raised surface. */
export const CandidateCard = styled.button`
  flex: 0 0 auto;
  width: 132px;
  padding: 10px;
  text-align: left;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;
`;

/** The candidate's poster: the Gradient fallback, the TMDB image over it. */
export const Poster = styled.span<{ $g1: string; $g2: string }>`
  display: block;
  width: 100%;
  height: 160px;
  overflow: hidden;
  border-radius: 8px;
  background: ${({ $g1, $g2 }) =>
    `linear-gradient(155deg, ${$g1} 0%, ${$g2} 100%)`};
`;

export const PosterImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const CandidateTitle = styled.span`
  display: block;
  margin-top: 9px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.text};
`;

export const CandidateMeta = styled.span`
  display: block;
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** _% match_: the watched green above 70, faint otherwise. */
export const Score = styled.span<{ $strong: boolean }>`
  display: inline-block;
  margin-top: 8px;
  padding: 3px 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ $strong, theme }) =>
    $strong ? theme.colors.watched : theme.colors.textFaint};
  background: ${({ $strong, theme }) =>
    $strong ? 'rgba(138, 154, 107, 0.16)' : theme.colors.surface3};
`;

/** The dashed _Search by title_ card closing the picker. */
export const SearchCard = styled.button`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  gap: 8px;
  width: 132px;
  padding: 16px 10px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  background: transparent;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.textDim};
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/** The search box and _Search_. */
export const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
`;

export const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 14px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 9px;
  outline: none;
`;
