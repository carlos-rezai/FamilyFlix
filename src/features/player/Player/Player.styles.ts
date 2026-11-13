import styled from 'styled-components';

/**
 * The player's stage: the prototype's `playerWrap` — a black, non-scrolling
 * surface filling the window, which the picture, the chrome and the subtitle
 * overlay all sit inside.
 *
 * Black rather than the app's background token on purpose. This is the one
 * screen that is not part of the browse chrome: it owns the whole window (no
 * `MainLayout`, per COMPONENT-SPEC §6), and a film letterboxed against anything
 * other than black reads as a bug.
 *
 * The cursor is set here, once, for the whole screen: **Idle** takes it away
 * with the chrome, because a pointer left hovering over a film is the one piece
 * of chrome that cannot fade. Every control that wants its own cursor back —
 * the Back pill, the transport — says so itself.
 */
export const Stage = styled.div<{ $idle: boolean }>`
  position: relative;
  height: 100vh;
  overflow: hidden;
  background: #000;
  cursor: ${({ $idle }) => ($idle ? 'none' : 'pointer')};
`;

/**
 * The picture and whatever the centre of it is saying, and the surface a press
 * anywhere on the film lands on — one layer, because "click the picture to
 * pause" has to mean the letterbox bars and the notice as well as the film.
 */
export const PictureLayer = styled.div`
  position: absolute;
  inset: 0;
`;

/**
 * The picture, fitted rather than filled: `contain` letterboxes a film whose
 * shape is not the window's, where `cover` would crop it. The family's library
 * is a mix of aspect ratios, so cropping would silently cut the sides off some
 * of them.
 *
 * No background of its own: the letterbox bars are the stage's black showing
 * through, so there is one black on this screen, not two.
 */
export const Picture = styled.video`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

/** Where a **Player notice** sits: the middle of the picture, over the film. */
export const Centre = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
`;
