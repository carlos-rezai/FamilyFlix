/**
 * Breakpoint tokens — responsive width thresholds for the browse grid and
 * page chrome. `tokens.css` carries no breakpoints of its own, so these are the
 * canonical set for the codebase; keep them here as the single source.
 */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;
