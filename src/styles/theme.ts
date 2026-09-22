import {
  colors,
  spacing,
  typography,
  radius,
  breakpoints,
  motion,
} from '@/tokens';
import { accentScale } from '@/utils/accentScale/accentScale';

/**
 * The theme factory — the design tokens assembled into the one object passed
 * to `<ThemeProvider>`, with the **Accent scale** derived from the one accent
 * rather than re-typed. Component `.styles.ts` files read from here
 * (`props.theme.colors.accent`) instead of the raw `var(--token)` the prototype
 * uses. This is the code-side of `docs/handoff/tokens.css`.
 */
export function createTheme(accent: string = colors.accent) {
  return {
    colors: { ...colors, accent, ...accentScale(accent) },
    space: spacing,
    fonts: typography,
    radius,
    breakpoints,
    motion,
  } as const;
}

export const theme = createTheme();

export type Theme = typeof theme;
