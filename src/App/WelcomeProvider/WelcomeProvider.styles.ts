import styled, { css } from 'styled-components';

import type { WelcomePhase } from '@/App/welcomeStep/welcomeStep';

/**
 * The **Home layer**: the routes, mounted beneath the splash from the first
 * frame. Unseen through the intro and the hold, faded in over the handoff,
 * and with no style at all once the welcome is done (or never played). It is
 * never `aria-hidden` nor `inert`.
 */
export const HomeLayer = styled.div<{ $phase: WelcomePhase; $fadeMs: number }>`
  ${({ $phase, $fadeMs, theme }) => {
    if ($phase === 'intro' || $phase === 'holding') {
      return css`
        opacity: 0;
      `;
    }
    if ($phase === 'handoff') {
      return css`
        opacity: 1;
        transition: opacity ${$fadeMs}ms ${theme.motion.easeOut};
      `;
    }
    return '';
  }}
`;
