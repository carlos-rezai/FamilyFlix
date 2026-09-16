import styled from 'styled-components';

/**
 * The card: one button, on the surface inside the border, or — selected — on
 * the accent-soft fill inside the accent line, from `feat.ExportModal.dc.html`
 * (`exCard`). 14px 16px inside, on the 12px radius, its text set left.
 */
export const Card = styled.button<{ $selected: boolean }>`
  flex: 1;
  text-align: left;
  padding: 14px 16px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.accentSoft : theme.colors.surface};
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.accentLine : theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;
`;

/** The label and the dot, on one line with the dot at the far end. */
export const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

/** The format's name: 16px sans, semibold, in the text ink. */
export const Label = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/**
 * The 18px radio dot (`exDot`): a 2px ring in the faint ink, or — selected —
 * filled with the accent inside an accent ring, the 3px inset shadow in the
 * card's own surface drawing the gap between the two.
 */
export const Dot = styled.span<{ $selected: boolean }>`
  display: block;
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

/** The line under the name: 12.5px sans in the faint ink. */
export const Description = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-top: 4px;
  text-align: left;
`;
