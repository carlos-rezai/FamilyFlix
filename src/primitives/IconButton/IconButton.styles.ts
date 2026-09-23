import styled, { css } from 'styled-components';

import { controlStates } from '@/styles/interactionStates/interactionStates';

export type IconButtonVariant = 'ghost' | 'outline';

/**
 * The two faces `prim.IconButton.dc.html` names. Both sit on whatever surface
 * they are dropped onto — neither carries a fill of its own, so an `IconButton`
 * over artwork is the call site's `styled(IconButton)` adding one, not a third
 * member here.
 */
const variants = {
  ghost: css`
    background: transparent;
    border: 1px solid transparent;
    color: ${({ theme }) => theme.colors.textFaint};

    &:hover:enabled {
      background: ${({ theme }) => theme.colors.surface};
      color: ${({ theme }) => theme.colors.textDim};
      transform: scale(1.06);
    }
  `,
  outline: css`
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.borderSoft};
    color: ${({ theme }) => theme.colors.textDim};

    /* The faces move the properties rule 2 below names — see the note there. */
    &:hover:enabled {
      background: transparent;
      color: ${({ theme }) => theme.colors.text};
      border-color: ${({ theme }) => theme.colors.textFaint};
      transform: scale(1.06);
    }
  `,
} as const;

/**
 * Geometry and behaviour only: a square that centres one icon, a pill corner,
 * and a pointer. Everything chromatic is one of the two faces above, or is
 * layered on by a `styled(IconButton)` at the call site — which is why the
 * variant block comes first in the cascade, so an extension's declarations win.
 *
 * The transition, the press (`scale(.94)`, in 60ms) and the keyboard Focus
 * ring are the Control's, from `controlStates`, and come after the faces — so
 * every extension inherits all three without writing a line.
 *
 * Three rules for those extensions, all consequences of the cascade rather
 * than of anything this file invents:
 *
 * 1. Write `&:hover:enabled`, not `&:hover`. The faces above are guarded that
 *    way so a disabled control never lights up, and a bare `&:hover` is one
 *    selector shorter — it would lose to the face it was meant to replace.
 * 2. Replace the hover *completely*. The faces move `background`, `color`,
 *    `border-color` and `transform` (the hover's `scale(1.06)`), so an
 *    extension that sets only some of them inherits the rest from the face
 *    underneath — an extension that draws no scale restates `transform: none`.
 * 3. The press is the primitive's, and no hover out-ranks it: `controlStates`
 *    writes it at doubled specificity (`&&`), so an extension inherits it
 *    even when its own hover writes `transform`. Only an extension whose press
 *    differs (the poster heart's `scale(.92)`), or that positions with
 *    `transform` (the carousel's `translateY(-50%)`, which must also restate
 *    it on hover, since the face's scale out-ranks a plain `transform`),
 *    writes its own at the same doubled rank, `&&:active`, and composes the
 *    shrink into its press: `translateY(-50%) scale(.94)`.
 */
export const Root = styled.button<{
  $size: number;
  $variant: IconButtonVariant;
}>`
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: ${({ $size }) => `${$size}px`};
  height: ${({ $size }) => `${$size}px`};
  padding: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  cursor: pointer;

  ${({ $variant }) => variants[$variant]}

  ${controlStates('scale(.94)')}

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;
