import styled, { css } from 'styled-components';

import { IconButton } from '@/primitives';

/**
 * What both bars do when the player goes **Idle**: fade, drift a little the way
 * they came in, and stop taking the pointer. They are one thing on screen, so
 * they move together rather than each deciding.
 *
 * `visibility` is not what hides them — see `PlayerControls` on why the controls
 * are unmounted instead. This is the fade the unmount happens behind.
 */
const fade = css<{ $visible: boolean; $drift: string }>`
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: ${({ $visible, $drift }) =>
    $visible ? 'none' : `translateY(${$drift})`};
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
`;

/** The top bar: the way out and the film's name, over a downward scrim. */
export const TopBar = styled.div<{ $visible: boolean; $drift: string }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 24px 28px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent);
  ${fade}
`;

/** The bottom bar: the transport, over an upward scrim. */
export const BottomBar = styled.div<{ $visible: boolean; $drift: string }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 40px 28px 24px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.72), transparent);
  ${fade}
`;

/**
 * The way back to the film's page. A pill with a word in it rather than an
 * `IconButton`, because it is the one control on this screen a parent has to
 * find without knowing what the glyph means — and because it is the only way
 * out of a **Player notice**.
 */
export const BackPill = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s2};
  height: 48px;
  padding: 0 20px 0 16px;
  background: rgba(20, 17, 13, 0.55);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: ${({ theme }) => theme.radius.pill};
  color: #fff;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: rgba(40, 34, 27, 0.8);
  }
`;

/** The film's name, so a parent can see they opened the right one. */
export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
`;

/** The transport row. The two sliders and their neighbours join it next. */
export const TransportRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s2};
`;

/**
 * Play and pause. `IconButton` owns the square, the pill corner and the
 * accessible name; the chrome over a picture is this call site's, because white
 * ink over film is not the app's `ghost` face — see `IconButton.styles`, which
 * is why both hover properties are replaced rather than one.
 */
export const TransportButton = styled(IconButton)`
  background: transparent;
  border: none;
  color: #fff;

  &:hover:enabled {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }
`;

/**
 * The CC pill, translated from `subBtn` in `FamilyFlix.dc.html`.
 *
 * Two faces rather than two controls: filled, brighter-bordered and
 * white-inked when subtitles are showing, transparent and faint when they are
 * not. The state has to be visible to a parent glancing at the row, not only to
 * a screen reader reading `aria-pressed`.
 *
 * It is a plain button rather than an `IconButton`: the pill carries the letters
 * `CC` beside the glyph, which is what makes it legible to someone who does not
 * know the icon, and it is wider than the square the transport buttons sit in.
 */
export const SubtitleButton = styled.button<{ $on: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  height: 40px;
  padding: 0 14px;
  background-color: ${({ $on }) =>
    $on ? 'rgba(255, 255, 255, 0.16)' : 'transparent'};
  border: 1px solid
    ${({ $on }) =>
      $on ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.14)'};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ $on }) => ($on ? '#fff' : 'rgba(255, 255, 255, 0.6)')};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;

/**
 * The gap that pushes the CC pill to the far end of the transport row, the way
 * the prototype's `flex: 1` spacer does.
 */
export const RowSpacer = styled.div`
  flex: 1;
`;
