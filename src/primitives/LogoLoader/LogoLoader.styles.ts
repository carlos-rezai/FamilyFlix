import styled, { css, keyframes } from 'styled-components';

/** The mount pop-in; collapsed under reduced motion like every other. */
const popIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;

/** The two Fs take turns rising: dim and down, then lit and up 7%. */
const beat = keyframes`
  0%,
  64%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  22% {
    opacity: 1;
    transform: translateY(-7%);
  }
`;

/** Under reduced motion the beat fades instead; nothing moves. */
const fade = keyframes`
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
`;

/** The status: the mark over its words, or beside them when `inline`. */
export const Root = styled.div<{ $inline: boolean }>`
  display: inline-flex;
  flex-direction: ${({ $inline }) => ($inline ? 'row' : 'column')};
  align-items: center;
  gap: ${({ $inline }) => ($inline ? '8px' : '14px')};
  animation: ${popIn} ${({ theme }) => theme.motion.durBase}
    ${({ theme }) => theme.motion.easeOut};
`;

export const MarkBox = styled.div`
  flex: 0 0 auto;
`;

export const Svg = styled.svg`
  display: block;
  overflow: visible;
`;

/** Which ink an F is painted in: F1 `text`, F2 `accent`, or `currentColor`. */
export type Ink = 'text' | 'accent' | 'current';

/**
 * One F of the mark. `$beat` is its place in the indeterminate turn-taking
 * (F2 0.22s behind F1); left out, the F is still, under a determinate fill.
 * The beat eases in and out: the handoff's own curve is no motion token, and
 * the structural guard keeps every curve in the tokens.
 *
 * Its reduced-motion fade is the second rule allowed to out-rank
 * `GlobalStyle`'s `*`: the beat must still say it is working when nothing may
 * move, rather than freeze at its dimmest frame.
 */
export const F = styled.path<{ $ink: Ink; $beat?: number }>`
  fill: ${({ $ink, theme }) =>
    $ink === 'current' ? 'currentColor' : theme.colors[$ink]};
  ${({ $beat }) =>
    $beat !== undefined &&
    css`
      transform-box: fill-box;
      transform-origin: 50% 100%;
      animation: ${beat} 1.3s ease-in-out ${$beat * 0.22}s infinite;

      @media (prefers-reduced-motion: reduce) {
        &[data-beat] {
          animation: ${fade} 1.3s ease-in-out ${$beat * 0.22}s infinite !important;
        }
      }
    `}
`;

/** The determinate fill's clip, scaled from the mark's left edge. */
export const ClipRect = styled.rect`
  transform-origin: 174px 0;
  transform-box: view-box;
  transition: transform ${({ theme }) => theme.motion.durSlow}
    ${({ theme }) => theme.motion.easeOut};
`;

export const Words = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
`;

export const Label = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const Detail = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  font-variant-numeric: tabular-nums;
`;
