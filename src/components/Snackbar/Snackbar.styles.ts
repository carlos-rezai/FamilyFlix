import styled, { type DefaultTheme } from 'styled-components';

/** The four **Snackbar variants** — the prototype's `variant` enum. */
export type SnackbarVariant = 'info' | 'success' | 'warning' | 'error';

/**
 * The variant's colour, off the status tokens: the prototype's own map, in
 * which `error` reads `--color-danger` rather than a token of its own.
 */
export function variantColour(
  theme: DefaultTheme,
  variant: SnackbarVariant
): string {
  switch (variant) {
    case 'info':
      return theme.colors.info;
    case 'success':
      return theme.colors.success;
    case 'warning':
      return theme.colors.warning;
    case 'error':
      return theme.colors.danger;
  }
}

/**
 * The card, as `mol.Snackbar.dc.html` draws it: 360px on `surface2` under a
 * deep shadow, shrinking to the window rather than scrolling it sideways,
 * clipped so the accent bar keeps to the corner, entering on `ffSnackIn`
 * (the keyframes are `GlobalStyle`'s). The shadow is the prototype's literal
 * `rgba(0,0,0,.5)`; no token stands behind it.
 */
export const Card = styled.div`
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 360px;
  max-width: calc(100vw - 48px);
  padding: 14px 14px 14px 18px;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  animation: ffSnackIn 0.26s ease;
`;

/** The 4px accent bar down the card's left edge, in the variant's colour. */
export const AccentBar = styled.div<{ $variant: SnackbarVariant }>`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: ${({ theme, $variant }) => variantColour(theme, $variant)};
`;

/** The glyph's seat: the ink the icon inherits, nudged 1px down to the text. */
export const IconWrap = styled.div<{ $variant: SnackbarVariant }>`
  flex: 0 0 auto;
  margin-top: 1px;
  color: ${({ theme, $variant }) => variantColour(theme, $variant)};
`;

/** The text column: the title, the message and the action, in that order. */
export const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

/** The bold line over the message. */
export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 2px;
`;

/** The message, dim at 14px. */
export const Message = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.textDim};
`;

/**
 * The action: a bordered button written and outlined in the variant's colour.
 * `8px` is the prototype's own corner, not a radius token.
 */
export const Action = styled.button<{ $variant: SnackbarVariant }>`
  margin-top: 10px;
  padding: 7px 14px;
  background: transparent;
  border: 1px solid ${({ theme, $variant }) => variantColour(theme, $variant)};
  border-radius: 8px;
  color: ${({ theme, $variant }) => variantColour(theme, $variant)};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    opacity: 0.82;
  }
`;

/**
 * The card's own ✕, on `Modal`'s `CloseButton` precedent: a 28px square on a
 * 7px corner in the faintest ink, pulled 2px up and 4px right into the card's
 * padding, brightening over `surface3` on hover. Not `RemoveButton`, which
 * names itself _Remove <thing>_ and turns the danger colour. `7px` is the
 * prototype's own corner, not a radius token.
 */
export const Dismiss = styled.button`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: ${({ theme }) => theme.colors.textFaint};
  cursor: pointer;
  font-size: 15px;
  margin: -2px -4px 0 0;

  &:hover {
    color: ${({ theme }) => theme.colors.textDim};
    background: ${({ theme }) => theme.colors.surface3};
  }
`;
