import styled, { keyframes } from 'styled-components';

/** The prototype's `ffPop` — the circle arriving rather than appearing. */
const pop = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
`;

/** The prototype's `ffSpin`, for the buffering ring. */
const spin = keyframes`
  to { transform: rotate(360deg); }
`;

/**
 * The one element in the centre of the picture, at the prototype's 96px.
 *
 * Every state the player draws over a film that is not running is drawn inside
 * this circle — the big play glyph, the buffering ring, the unavailable cross —
 * because the circle is already what sits there, and a second centred element
 * would give the screen two vocabularies for one idea.
 */
export const Circle = styled.div`
  width: 96px;
  height: 96px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: rgba(20, 17, 13, 0.55);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: grid;
  place-items: center;
  animation: ${pop} 0.2s ease;
`;

/**
 * The circle and whatever it is captioned with, stacked and centred.
 *
 * **One stack where `feat.PlayerControls.dc.html` has two.** The prototype
 * gives its buffering stack `gap: 20px` and nothing else, and its unavailable
 * stack `gap: 20px; padding: 0 40px; text-align: center`. This applies the
 * second to both, and that was measured in Chrome rather than assumed: the
 * caption box comes out 163.42×20 either way, at the same offset from the
 * centre line and the same distance down the screen, and so does the circle.
 * Only the stack's own invisible box differs — 80px wider, symmetric, around a
 * box that is centred — so nothing inside it moves.
 *
 * It holds because the stack is a max-content grid item and the caption is one
 * short line: there is nothing for `text-align` to act on and nothing for the
 * padding to push against. The unavailable state needs both, because
 * `NoticeBody` wraps at 440px and must not run into the edge of a narrow
 * window.
 */
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 0 40px;
  text-align: center;
`;

/** The buffering ring, turning inside the circle. */
export const Spinner = styled.svg`
  animation: ${spin} 0.9s linear infinite;
`;

/** One sentence under the circle — what the film is doing while it gets ready. */
export const Caption = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.72);
`;

/** The unavailable state's headline, in the app's serif. */
export const NoticeTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 21px;
  font-weight: 600;
  color: #fff;
`;

/** What happened, in a sentence a parent can act on. */
export const NoticeBody = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14.5px;
  color: rgba(255, 255, 255, 0.62);
  max-width: 440px;
  margin-top: 10px;
  line-height: 1.55;
`;
