/**
 * Motion tokens — translated 1:1 from `docs/handoff/tokens.css`
 * (`--dur-*`, `--ease-out`). No React, no logic — pure values.
 */
export const motion = {
  durFast: '120ms',
  durBase: '180ms',
  durSlow: '280ms',
  easeOut: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
  /** The **Welcome splash**'s curves: the Fs' drop, the sweep, the glide. */
  easeDrop: 'cubic-bezier(0.3, 0.6, 0.4, 1)',
  easeSweep: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeGlide: 'cubic-bezier(0.3, 0.7, 0.2, 1)',
} as const;
