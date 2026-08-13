import styled, { css } from 'styled-components';

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
    }
  `,
  outline: css`
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.borderSoft};
    color: ${({ theme }) => theme.colors.textDim};

    /* Both faces move the same two properties on hover — see the note below. */
    &:hover:enabled {
      background: transparent;
      color: ${({ theme }) => theme.colors.text};
    }
  `,
} as const;

/**
 * Geometry and behaviour only: a square that centres one icon, a pill corner,
 * and a pointer. Everything chromatic is one of the two faces above, or is
 * layered on by a `styled(IconButton)` at the call site — which is why the
 * variant block comes first in the cascade, so an extension's declarations win.
 *
 * Two rules for those extensions, both consequences of the cascade rather than
 * of anything this file invents:
 *
 * 1. Write `&:hover:enabled`, not `&:hover`. The faces above are guarded that
 *    way so a disabled control never lights up, and a bare `&:hover` is one
 *    selector shorter — it would lose to the face it was meant to replace.
 * 2. Replace the hover *completely*. Both faces move exactly `background` and
 *    `color`, so an extension that sets only one of them inherits the other
 *    from the face underneath.
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

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;
