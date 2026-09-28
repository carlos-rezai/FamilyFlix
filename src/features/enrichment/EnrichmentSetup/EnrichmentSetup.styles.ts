import styled from 'styled-components';

/** The setup's blocks, 20px apart. */
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

/** A block's small uppercase heading — _What to sync_, _Fields to fill_. */
export const GroupLabel = styled.div`
  margin: 0 0 12px 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The scope cards in a wrapping row. */
export const Scopes = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

/**
 * One scope card (`scopeCard`): on the surface inside the soft border, or —
 * selected — on the accent-soft fill inside the accent line.
 */
export const ScopeCard = styled.button<{ $selected: boolean }>`
  flex: 1 1 260px;
  text-align: left;
  padding: 16px 18px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.accentSoft : theme.colors.surface};
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.accentLine : theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;
`;

/** The dot and the label on one line. */
export const ScopeTitle = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
`;

/** The 18px radio dot (`scopeDot`). */
export const ScopeDot = styled.span<{ $selected: boolean }>`
  display: block;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: ${({ theme }) => theme.radius.pill};
  border: 2px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.accent : theme.colors.textFaint};
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.accent : 'transparent'};
  box-shadow: ${({ $selected, theme }) =>
    $selected ? `inset 0 0 0 3px ${theme.colors.surface2}` : 'none'};
`;

/** The scope's name: 15px sans, semibold. */
export const ScopeLabel = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** The line under the name, indented to clear the dot. */
export const ScopeDescription = styled.span`
  display: block;
  margin: 6px 0 0 28px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The field chips, wrapping 9px apart. */
export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
`;

/** The rating note under the chips, its star in the accent. */
export const RatingNote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** What a series gets, under the rating note. */
export const SeriesNote = styled.div`
  margin-top: 6px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textFaint};
  text-wrap: pretty;
`;

export const Star = styled.span`
  color: ${({ theme }) => theme.colors.accent};
`;

/** Start and the estimate beside it. */
export const StartRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
`;

export const Estimate = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** _Where it is saved_'s card: the Write target rows on the surface. */
export const Targets = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

/** One **Write target row**: the glyph tile, the two lines, the trailing control. */
export const Target = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
`;

/** The row's 38px glyph tile. */
export const TargetGlyph = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.surface3};
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The title and the line, taking the width the tile and control do not. */
export const TargetText = styled.div`
  flex: 1;
  min-width: 0;
`;

export const TargetTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const TargetLine = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** _Required_, where a Toggle would sit on a target that can be turned off. */
export const RequiredPill = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.surface3};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 4px 11px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;

/** The hairline between two **Write target rows**. */
export const TargetDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.borderSoft};
`;

/** A target's path under its title, in mono, clipped to one line. */
export const TargetPath = styled.div`
  margin-top: 3px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** The note under the card while either target writes into the collection. */
export const SourceNote = styled.div`
  margin: 10px 0 0 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textFaint};
  text-wrap: pretty;
`;

export const SourceNoteMono = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.textDim};
`;
