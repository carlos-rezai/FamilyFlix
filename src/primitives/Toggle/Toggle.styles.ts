import styled from 'styled-components';

/**
 * The prototype's geometry: a 46×26 track on a 3px pad, the knob what is left.
 * The pad is measured from the track's outer edge, but an absolute child is
 * placed from inside the 1px border — so the knob's offsets are the pad less
 * the border, on every side, which is what centres it.
 */
const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 26;
const BORDER = 1;
const PAD = 3;
const KNOB = TRACK_HEIGHT - PAD * 2;
const INSET = PAD - BORDER;
const KNOB_ON = TRACK_WIDTH - BORDER * 2 - KNOB - INSET;

interface TrackProps {
  $checked: boolean;
  $disabled: boolean;
}

/**
 * The track: a pill that fills with the accent when on and the third surface
 * when off, fading to .45 under `not-allowed` when disabled. Everything above
 * the geometry is undoing the UA's button chrome; the focus ring is
 * deliberately left alone.
 */
export const Track = styled.button<TrackProps>`
  appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: ${TRACK_WIDTH}px;
  height: ${TRACK_HEIGHT}px;
  padding: 0;
  border: ${BORDER}px solid
    ${({ theme, $checked }) =>
      $checked ? theme.colors.accent : theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme, $checked }) =>
    $checked ? theme.colors.accent : theme.colors.surface3};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.45 : 1)};
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
`;

/**
 * The knob: slides from the left pad to the right, and darkens against the
 * accent fill when on. Decoration — it carries no text.
 */
export const Knob = styled.span<{ $checked: boolean }>`
  position: absolute;
  top: ${INSET}px;
  left: ${({ $checked }) => ($checked ? KNOB_ON : INSET)}px;
  width: ${KNOB}px;
  height: ${KNOB}px;
  border-radius: 50%;
  background: ${({ theme, $checked }) =>
    $checked ? '#1a1109' : theme.colors.textFaint};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition:
    left 0.18s ease,
    background 0.18s ease;
`;
