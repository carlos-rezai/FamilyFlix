import { css } from 'styled-components';

/**
 * The **Control** vocabulary (`COMPONENT-SPEC.md` §2a): what every Button,
 * Chip, IconButton and FilterDropdown shares whatever its colours. A Control
 * signals with colour, so its hover stays with the caller; this is the rest —
 * the transition, the press and the keyboard Focus ring.
 *
 * - The transition eases in at `durFast` on `easeOut`.
 * - The press answers in 60ms, always faster than the hover: that asymmetry is
 *   what makes a control feel physical. The one place 60ms is spelled.
 * - The ring is a 3px shadow rather than an outline, so it follows the
 *   control's radius, and it is drawn under `:focus-visible` only — a click
 *   draws none.
 *
 * Every state is guarded by `:not(:disabled)` rather than `:enabled`, which an
 * anchor never matches — a Button's link face presses like its button face.
 */
export function controlStates(pressTransform: string) {
  return css`
    transition:
      background ${({ theme }) => theme.motion.durFast}
        ${({ theme }) => theme.motion.easeOut},
      border-color ${({ theme }) => theme.motion.durFast}
        ${({ theme }) => theme.motion.easeOut},
      color ${({ theme }) => theme.motion.durFast}
        ${({ theme }) => theme.motion.easeOut},
      transform ${({ theme }) => theme.motion.durFast}
        ${({ theme }) => theme.motion.easeOut},
      box-shadow ${({ theme }) => theme.motion.durFast}
        ${({ theme }) => theme.motion.easeOut};

    &:active:not(:disabled) {
      transform: ${pressTransform};
      transition-duration: 60ms;
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focusRing};
    }
  `;
}
