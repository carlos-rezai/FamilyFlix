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
