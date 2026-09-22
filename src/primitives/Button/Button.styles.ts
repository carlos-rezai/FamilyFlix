import styled, { css } from 'styled-components';

import { controlStates } from '@/styles/interactionStates/interactionStates';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Size is purely dimensional — height, horizontal padding, text size, and the
 * corner. `lg` is the hero action (MoviePage's Play), so it goes pill; `md` is
 * every form and dialog button, so it keeps the standard card radius; `sm` is
 * the pair in a list row (ImportFlow's Resolve / Skip), one rung below `md`
 * in every dimension, on the small radius.
 */
const sizes = {
  sm: css`
    height: 40px;
    padding: 0 18px;
    font-size: 14px;
    border-radius: ${({ theme }) => theme.radius.sm};
  `,
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
 * hover and press each one shifts. The press's scale, its speed and the Focus
 * ring are the Control's, from `controlStates`; `sm` and `lg` share every state
 * with `md`. Only `primary` carries a fill; the other three sit on
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

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.accentHover};
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colors.accentPress};
    }
  `,
  secondary: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font-weight: 500;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surface2};
      border-color: ${({ theme }) => theme.colors.textFaint};
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colors.surface3};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.textDim};
    border: none;
    font-weight: 600;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surface};
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colors.surface2};
    }
  `,
  danger: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.danger};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font-weight: 600;

    /* The danger tints are the two literals prim.Button writes: the
       danger colour (201, 122, 106) at 12% under hover and 20% under press.
       No --color-* token carries a danger alpha. */
    &:hover:not(:disabled) {
      background: rgba(201, 122, 106, 0.12);
      border-color: ${({ theme }) => theme.colors.danger};
    }

    &:active:not(:disabled) {
      background: rgba(201, 122, 106, 0.2);
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

  ${controlStates('scale(.98)')}
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
