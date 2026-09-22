import styled, { css } from 'styled-components';

import { controlStates } from '@/styles/interactionStates/interactionStates';

export type ChipSize = 'sm' | 'md';

interface FaceProps {
  $size: ChipSize;
  $selected: boolean;
}

/**
 * The chip's whole appearance, shared by both of its shapes. Selected swaps the
 * neutral surface for the accent-soft fill, the border for the accent line, and
 * the dim text for accent at a heavier weight — the same three-part shift the
 * prototype makes.
 */
const face = css<FaceProps>`
  display: inline-block;
  padding: ${({ $size }) => ($size === 'sm' ? '6px 14px' : '9px 16px')};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : theme.colors.surface};
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.accentLine : theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accent : theme.colors.textDim};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: ${({ $selected }) => ($selected ? 600 : 400)};
`;

/** The static form — a genre tag on the movie detail page. Not a control. */
export const Tag = styled.span<FaceProps>`
  ${face}
`;

/**
 * The selectable form — MovieForm's genre picker and the library's filters.
 * Everything above `${face}` is undoing the UA's button chrome so the two shapes
 * render identically. The states are the Control's, as `prim.Chip` draws them:
 * a 1px lift on hover (the prototype file wins over §2a's "buttons never lift"),
 * pressed back down and in. A selected chip keeps its accent-soft fill under the
 * pointer, so only an unselected one takes the surface2 hover.
 */
export const Control = styled.button<FaceProps>`
  appearance: none;
  font: inherit;
  ${face}
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.accentLine};
    ${({ theme, $selected }) =>
      $selected ? '' : `background: ${theme.colors.surface2};`}
    transform: translateY(-1px);
  }

  /* After the hover, so a press — which is always also a hover — wins it. */
  ${controlStates('translateY(0) scale(.97)')}
`;
