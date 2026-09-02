import styled from 'styled-components';

import { Artwork } from '@/primitives';

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

/** The backdrop and its scrim, clipped to the stage so the scale cannot spill. */
export const ArtLayer = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
`;

/**
 * The film's own artwork, blurred out of legibility behind the picture — the
 * prototype's `blur(28px) brightness(.5)` over a `scale(1.2)`, which is what
 * keeps the blur's soft edge off the sides of the screen.
 *
 * It is drawn from the id's **Gradient fallback** before a record has arrived
 * and from the poster once one has, so the screen has something behind the
 * picture from its first frame rather than from its first byte of video.
 */
export const Backdrop = styled(Artwork)`
  filter: blur(28px) brightness(0.5);
  transform: scale(1.2);
`;

/** The prototype's flat wash over the backdrop, so white chrome stays legible. */
export const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(8, 6, 4, 0.55);
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
 * Transparent, not black: the backdrop is behind it, and an element painting
 * its own black over that would give the family the flat rectangle the backdrop
 * exists to replace — through the letterbox bars, and for as long as the first
 * frame takes to arrive.
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
