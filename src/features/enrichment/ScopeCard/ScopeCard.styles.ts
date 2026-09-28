import styled from 'styled-components';

/**
 * One scope card (`scopeCard`): on the surface inside the soft border, or —
 * selected — on the accent-soft fill inside the accent line.
 */
export const Card = styled.button<{ $selected: boolean }>`
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
export const Title = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
`;

/** The 18px radio dot (`scopeDot`), on the left. */
export const Dot = styled.span<{ $selected: boolean }>`
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
export const Label = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** The line under the name, indented 28px to clear the dot. */
export const Description = styled.span`
  display: block;
  margin: 6px 0 0 28px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
