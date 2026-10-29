import styled, { css, keyframes } from 'styled-components';

import { Wordmark } from '@/primitives';

/** Where the splash wordmark lands: the header wordmark's top-left and size. */
export interface WordmarkLanding {
  /** The header wordmark's `getBoundingClientRect()` left, in px. */
  left: number;
  /** Its top, in px. */
  top: number;
  /** The header's `font-size` over the splash's `30·scale`. */
  ratio: number;
}

/** The background's fade (the prototype's `ffOut`). */
const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

/** The mark fades and shrinks where it stands (`ffMarkOut`). */
const markOut = keyframes`
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.7);
  }
`;

/** The glide (`ffToHeader`), its end the measured header wordmark. */
const toHeader = (scale: number, { left, top, ratio }: WordmarkLanding) =>
  keyframes`
    from {
      left: 50%;
      top: calc(50% + ${42 * scale}px);
      transform: translate(-50%, -50%) scale(1);
    }
    to {
      left: ${left}px;
      top: ${top}px;
      transform: translate(0, 0) scale(${ratio});
    }
  `;

/** The splash over the whole window, above the **Home layer**. */
export const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
`;

/**
 * The **Start-up splash**'s background: flat `bg`, so the two meet
 * seamlessly. In the handoff it fades out from 50ms for 400ms.
 */
export const Background = styled.div<{ $handingOff: boolean }>`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.colors.bg};
  ${({ $handingOff, theme }) =>
    $handingOff &&
    css`
      animation: ${fadeOut} 400ms 50ms both ${theme.motion.easeOut};
    `}
`;

/**
 * The FF mark, `132·scale × 80·scale`, centred `26·scale` above the middle;
 * in the handoff it fades and shrinks over 300ms.
 */
export const Mark = styled.svg<{ $scale: number; $handingOff: boolean }>`
  position: absolute;
  left: 50%;
  top: ${({ $scale }) => `calc(50% - ${26 * $scale}px)`};
  width: ${({ $scale }) => 132 * $scale}px;
  height: ${({ $scale }) => 80 * $scale}px;
  transform: translate(-50%, -50%);
  ${({ $handingOff, theme }) =>
    $handingOff &&
    css`
      animation: ${markOut} 300ms 0ms both ${theme.motion.easeOut};
    `}
`;

export const MarkF1 = styled.path`
  fill: ${({ theme }) => theme.colors.text};
`;

export const MarkF2 = styled.path`
  fill: ${({ theme }) => theme.colors.accent};
`;

/**
 * The wordmark's layer, centred `42·scale` below the middle. In the handoff
 * it glides about its top-left corner onto the header wordmark over 500ms.
 */
export const WordmarkLayer = styled.div<{
  $scale: number;
  $landing: WordmarkLanding | null;
}>`
  position: absolute;
  left: 50%;
  top: ${({ $scale }) => `calc(50% + ${42 * $scale}px)`};
  transform: translate(-50%, -50%);
  transform-origin: 0 0;
  font-size: ${({ $scale }) => 30 * $scale}px;
  line-height: normal;
  white-space: nowrap;
  ${({ $scale, $landing, theme }) =>
    $landing !== null &&
    css`
      animation: ${toHeader($scale, $landing)} 500ms 0ms both
        ${theme.motion.easeGlide};
    `}
`;

/**
 * The header's typography (`LogoMark`'s 2px gap and 0.3px tracking at 25px)
 * carried to the splash's size, in `em` so it scales with the layer.
 */
export const SplashWordmark = styled(Wordmark)`
  gap: ${2 / 25}em;
  letter-spacing: ${0.3 / 25}em;
`;
