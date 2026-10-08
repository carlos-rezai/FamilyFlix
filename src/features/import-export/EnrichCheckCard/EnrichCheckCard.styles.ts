import styled from 'styled-components';

import { visuallyHidden } from '@/styles/visuallyHidden';

/**
 * _Also fetch metadata and posters from TMDB_: the prototype's `<label>` card
 * over its native checkbox, so the whole card is the target and the checkbox
 * is the one control in the tree. The surface inside the soft border, 4px
 * below what comes before it, its text set left.
 */
export const Card = styled.label`
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  margin-top: 4px;
  padding: 14px 16px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
`;

/**
 * The native checkbox the card labels, clipped rather than hidden, so Space
 * and the tab order reach it as they reach any checkbox.
 */
export const Input = styled.input`
  ${visuallyHidden}
`;

/**
 * The 22px box (`enrichBoxStyle`): a 2px ring in the faint ink, or — ticked —
 * filled with the accent, the tick drawn dark on it at 14px bold.
 */
export const Box = styled.span<{ $checked: boolean }>`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border-radius: 6px;
  border: 2px solid
    ${({ $checked, theme }) =>
      $checked ? theme.colors.accent : theme.colors.textFaint};
  background: ${({ $checked, theme }) =>
    $checked ? theme.colors.accent : 'transparent'};
  color: #1a1109;
  font-size: 14px;
  font-weight: 700;
`;

/** The card's text column. */
export const Text = styled.span`
  flex: 1;
  min-width: 0;
`;

/** The card's label: 15px sans, semibold, in the text ink. */
export const Label = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** The hint under it: 13px in the faint ink, 2px down. */
export const Hint = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-top: 2px;
  line-height: 1.45;
  text-wrap: pretty;
`;
