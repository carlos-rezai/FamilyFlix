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
 */
export const Stage = styled.div`
  position: relative;
  height: 100vh;
  overflow: hidden;
  background: #000;
`;

/**
 * The picture, fitted rather than filled: `contain` letterboxes a film whose
 * shape is not the window's, where `cover` would crop it. The family's library
 * is a mix of aspect ratios, so cropping would silently cut the sides off some
 * of them.
 */
export const Picture = styled.video`
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
`;
