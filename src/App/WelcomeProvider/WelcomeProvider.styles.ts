import styled, { css, keyframes } from 'styled-components';

import type { WelcomePhase } from '@/App/welcomeStep/welcomeStep';

/** The prototype's `ffIn`. */
const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

/**
 * The **Home layer**: the routes, mounted beneath the splash from the first
 * frame. Unseen through the intro and the hold, faded in from the handoff's
 * 100ms for 400ms (for 300ms under reduced motion, `$still`; over 150ms on a
 * skip), and with no style at all once the welcome is done (or
 * never played). It is never `aria-hidden` nor `inert`.
 */
export const HomeLayer = styled.div<{ $phase: WelcomePhase; $still: boolean }>`
  ${({ $phase, $still, theme }) => {
    if ($phase === 'intro' || $phase === 'holding') {
      return css`
        opacity: 0;
      `;
    }
    if ($phase === 'skipping') {
      return css`
        animation: ${fadeIn} 150ms both ${theme.motion.easeOut};
      `;
    }
    if ($phase === 'handoff') {
      return css`
        animation: ${fadeIn} ${$still ? 300 : 400}ms 100ms both
          ${theme.motion.easeOut};
      `;
    }
    return '';
  }}
`;
