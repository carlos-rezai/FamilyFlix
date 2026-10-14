import styled from 'styled-components';

import { IconButton } from '@/primitives';

/**
 * `$on` is the whole of its appearance: filled in the accent when the flag is
 * set, a bare outline when it is not, so the state is legible without reading
 * the icon inside it. The square itself, and the `aria-pressed` that carries
 * `$on` to a screen reader, come from `IconButton`.
 */
export const Circle = styled(IconButton)<{ $on: boolean }>`
  background: ${({ theme, $on }) =>
    $on ? theme.colors.accentSoft : 'transparent'};
  border: 1px solid
    ${({ theme, $on }) => ($on ? theme.colors.accentLine : theme.colors.border)};
  color: ${({ theme, $on }) =>
    $on ? theme.colors.accent : theme.colors.textDim};

  /* Hovering brightens the outline, never the fill — a circle that is off must
     not preview the filled state it would take on. It draws no scale either,
     so the transform is restated (IconButton's rule 2); the press is the
     primitive's. */
  &:hover:not(:disabled) {
    background: ${({ theme, $on }) =>
      $on ? theme.colors.accentSoft : 'transparent'};
    border-color: ${({ theme }) => theme.colors.accentLine};
    color: ${({ theme }) => theme.colors.accent};
    transform: none;
  }
`;
