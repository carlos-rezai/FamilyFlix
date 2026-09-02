import styled from 'styled-components';

/** The track and its two clocks, on one line above the transport row. */
export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
`;

/**
 * A clock. Monospaced and fixed-width on purpose: the elapsed side changes
 * every second, and a proportional face would shuffle the track sideways with
 * every digit that got wider.
 */
export const Clock = styled.span`
  min-width: 52px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
`;

/** How long the film runs — dimmer than the elapsed side, and right-aligned. */
export const TotalClock = styled(Clock)`
  color: rgba(255, 255, 255, 0.6);
  text-align: right;
`;

/**
 * The bar itself. `touch-action: none` so a finger dragging the knob scrubs the
 * film rather than scrolling the page out from under it.
 */
export const Track = styled.div`
  position: relative;
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: ${({ theme }) => theme.radius.pill};
  cursor: pointer;
  touch-action: none;
`;

/** How much of the film is behind you, in the app's accent. */
export const Fill = styled.div<{ $percent: string }>`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: ${({ $percent }) => $percent};
  background: ${({ theme }) => theme.colors.accent};
  border-radius: ${({ theme }) => theme.radius.pill};
`;

/** The knob, centred on the fill's end so it sits *on* the position, not past it. */
export const Knob = styled.div<{ $percent: string }>`
  position: absolute;
  top: 50%;
  left: ${({ $percent }) => $percent};
  width: 14px;
  height: 14px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%);
`;
