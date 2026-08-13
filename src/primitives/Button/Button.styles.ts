import styled, { css } from 'styled-components';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

/**
 * Size is purely dimensional — height, horizontal padding, text size, and the
 * corner. `lg` is the hero action (MoviePage's Play), so it goes pill; `md` is
 * every form and dialog button, so it keeps the standard card radius.
 */
const sizes = {
  md: css`
    height: 50px;
    padding: 0 26px;
    font-size: 16px;
    border-radius: ${({ theme }) => theme.radius.md};
  `,
  lg: css`
    height: 58px;
    padding: 0 32px;
    font-size: 18px;
    border-radius: ${({ theme }) => theme.radius.pill};
  `,
} as const;

/**
 * Variant is purely chromatic — fill, text color, border, and weight, plus the
 * hover each one shifts. Only `primary` carries a fill; the other three sit on
 * whatever surface they are dropped onto.
 */
const variants = {
  primary: css`
    background: ${({ theme }) => theme.colors.accent};
    /* Near-black warm ink, the one value the prototype writes literally: it is
       the text *on* the accent fill, not a surface, so no --color-* fits it. */
    color: #1a1109;
    border: none;
    font-weight: 700;

    &:hover:enabled {
      background: ${({ theme }) => theme.colors.accentHover};
    }
  `,
  secondary: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font-weight: 500;

    &:hover:enabled {
      border-color: ${({ theme }) => theme.colors.textFaint};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.textDim};
    border: none;
    font-weight: 600;

    &:hover:enabled {
      background: ${({ theme }) => theme.colors.surface};
    }
  `,
  danger: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.danger};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font-weight: 600;

    &:hover:enabled {
      border-color: ${({ theme }) => theme.colors.danger};
    }
  `,
} as const;

/**
 * The disabled face overrides every variant's chrome, so it comes last in the
 * cascade. `:disabled` rather than an `$disabled` prop keeps the styling tied
 * to the same attribute that takes the button out of the tab order — the two
 * can never drift apart.
 *
 * Declared as a `button` but rendered as a router `Link` when `Button` is given
 * a destination. Everything above is element-agnostic, which is what makes one
 * definition able to dress both.
 */
export const Root = styled.button<{
  $variant: ButtonVariant;
  $size: ButtonSize;
  $fullWidth: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space.s2};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  font-family: ${({ theme }) => theme.fonts.sans};
  cursor: pointer;
  white-space: nowrap;
  /* For the link form. A button element is never underlined, so this costs the
     button face nothing and saves the anchor face from being a second copy. */
  text-decoration: none;

  ${({ $size }) => sizes[$size]}
  ${({ $variant }) => variants[$variant]}

  &:disabled {
    background: ${({ theme }) => theme.colors.surface3};
    color: ${({ theme }) => theme.colors.textFaint};
    border: 1px solid ${({ theme }) => theme.colors.border};
    cursor: default;
    opacity: 0.8;
  }
`;
