import { colors, spacing, typography, radius, breakpoints } from '@/tokens';

/**
 * The styled-components theme — the design tokens assembled into the one object
 * passed to `<ThemeProvider>`. Component `.styles.ts` files read from here
 * (`props.theme.colors.accent`) instead of the raw `var(--token)` the prototype
 * uses. This is the code-side of `docs/handoff/tokens.css`.
 */
export const theme = {
  colors,
  space: spacing,
  fonts: typography,
  radius,
  breakpoints,
} as const;

export type Theme = typeof theme;
