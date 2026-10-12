import styled from 'styled-components';

/**
 * The **Found-file choice** draws in the Files card's list section shape
 * (`filesCard.styles.ts`): its name on the slot measure, its rows filling the
 * rest.
 */
export {
  ListSection as Choice,
  ListLabel as ChoiceLabel,
} from '../filesCard.styles';

/** The choice's options and the picker under them, as the prototype stacks them. */
export const Options = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.s2};
`;

/** One found video: a 42px row, the chosen one on the accent's soft wash. */
export const Option = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 14px;
  text-align: left;
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : theme.colors.bg2};
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.accentLine : theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/** The radio dot: filled in the accent, ringed in the surface, when chosen. */
export const OptionDot = styled.span<{ $selected: boolean }>`
  display: block;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  border-radius: ${({ theme }) => theme.radius.pill};
  border: 2px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.accent : theme.colors.textFaint};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accent : 'transparent'};
  box-shadow: ${({ theme, $selected }) =>
    $selected ? `inset 0 0 0 3px ${theme.colors.surface}` : 'none'};
`;

/** The video's file name, in mono, cut short with an ellipsis. */
export const OptionName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
`;
