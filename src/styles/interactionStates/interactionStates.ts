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
 * - The press is written at doubled specificity (`&&`). A press is always also
 *   a hover, so it has to win against any hover that writes `transform` —
 *   the caller's own, and a `styled()` extension's, which would otherwise rank
 *   equal and come later. A caller whose press differs writes it at the same
 *   doubled rank.
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

    &&:active:not(:disabled) {
      transform: ${pressTransform};
      transition-duration: 60ms;
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focusRing};
    }
  `;
}

/**
 * The **Card** vocabulary (`COMPONENT-SPEC.md` §2a), the half that goes on the
 * tile: a Card signals with elevation, never with colour, so this recolours no
 * fill. It rests on a shadow, lifts 4px on hover with a deeper one and the
 * `accentLine` edge, and settles to `-1px` on press — in 70ms, faster than the
 * lift, the one place 70ms is spelled.
 *
 * The lift is the tile's own `:hover`, never an ancestor's: the prototype
 * lifts the art and not the title under it.
 */
export const cardLift = css`
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  transition:
    transform ${({ theme }) => theme.motion.durBase}
      ${({ theme }) => theme.motion.easeOut},
    box-shadow ${({ theme }) => theme.motion.durBase}
      ${({ theme }) => theme.motion.easeOut},
    border-color ${({ theme }) => theme.motion.durBase}
      ${({ theme }) => theme.motion.easeOut};

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
    border-color: ${({ theme }) => theme.colors.accentLine};
  }

  &:active {
    transform: translateY(-1px);
    transition-duration: 70ms;
  }
`;

/**
 * The Card vocabulary's other half, on the focusable root: a 2px `focusRing`
 * outline 4px clear of the artwork, under `:focus-visible` only. The radius is
 * the caller's — the outline follows whatever the root rounds to.
 */
export const cardFocus = css`
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focusRing};
    outline-offset: 4px;
  }
`;
