import styled from 'styled-components';

import { Wordmark } from '@/primitives';

/**
 * The splash over the whole window, above the **Home layer**; in the
 * handoff it fades out over `$fadeMs` while the home fades in beneath it.
 */
export const Root = styled.div<{ $fading: boolean; $fadeMs: number }>`
  position: fixed;
  inset: 0;
  z-index: 1000;
  opacity: ${({ $fading }) => ($fading ? 0 : 1)};
  transition: opacity ${({ $fadeMs }) => $fadeMs}ms
    ${({ theme }) => theme.motion.easeOut};
`;

/** The **Start-up splash**'s background: flat `bg`, so the two meet seamlessly. */
export const Background = styled.div`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.colors.bg};
`;

/** The FF mark, `132·scale × 80·scale`, centred `26·scale` above the middle. */
export const Mark = styled.svg<{ $scale: number }>`
  position: absolute;
  left: 50%;
  top: ${({ $scale }) => `calc(50% - ${26 * $scale}px)`};
  width: ${({ $scale }) => 132 * $scale}px;
  height: ${({ $scale }) => 80 * $scale}px;
  transform: translate(-50%, -50%);
`;

export const MarkF1 = styled.path`
  fill: ${({ theme }) => theme.colors.text};
`;

export const MarkF2 = styled.path`
  fill: ${({ theme }) => theme.colors.accent};
`;

/** The wordmark's layer, centred `42·scale` below the middle. */
export const WordmarkLayer = styled.div<{ $scale: number }>`
  position: absolute;
  left: 50%;
  top: ${({ $scale }) => `calc(50% + ${42 * $scale}px)`};
  transform: translate(-50%, -50%);
  font-size: ${({ $scale }) => 30 * $scale}px;
  line-height: 1;
  white-space: nowrap;
`;

/**
 * The header's typography (`LogoMark`'s 2px gap and 0.3px tracking at 25px)
 * carried to the splash's size, in `em` so it scales with the layer.
 */
export const SplashWordmark = styled(Wordmark)`
  gap: ${2 / 25}em;
  letter-spacing: ${0.3 / 25}em;
`;
