/**
 * Color tokens — translated 1:1 from `docs/handoff/tokens.css` (`--color-*`).
 * Dark, warm, cinematic palette. No React, no logic — pure values. The
 * accent's derivatives are not spelled here: `createTheme` computes them.
 */
export const colors = {
  bg: '#14110d',
  bg2: '#1b1611',
  surface: '#211b15',
  surface2: '#2a231b',
  surface3: '#332a20',
  border: '#3a3024',
  borderSoft: '#2c241b',
  text: '#f3ece0',
  textDim: '#b6a994',
  textFaint: '#857a68',
  accent: '#d97a4e',
  watched: '#8a9a6b',
  scrim: 'rgba(10, 8, 5, 0.72)',
  info: '#6b8aa8',
  success: '#8a9a6b',
  warning: '#e0a755',
  danger: '#c97a6a',
} as const;
