import styled from 'styled-components';

import { IconButton } from '@/primitives';

/** The speaker button and its bar, which the prototype groups as one control. */
export const Group = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s2};
  margin-left: 6px;
`;

/**
 * The speaker. `IconButton` owns the square, the pill corner and the accessible
 * name; white ink over film is this call site's, because it is not the app's
 * `ghost` face — the same reason the transport row states its own.
 */
export const MuteButton = styled(IconButton)`
  background: transparent;
  border: none;
  color: #fff;

  &:hover:enabled {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }
`;

/**
 * The bar: 90px and 5px tall, which is the prototype's, and shorter and thinner
 * than the **Scrubber**'s on purpose — this one is a setting, and that one is
 * where you are in the film.
 */
export const Track = styled.div`
  width: 90px;
  height: 5px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: ${({ theme }) => theme.radius.pill};
  cursor: pointer;
  touch-action: none;
`;

/**
 * How loud it is. White rather than the accent, and knobless: the accent bar
 * with a knob on it is the one that says where you are in the film, and two of
 * them side by side would read as two of the same control.
 */
export const Fill = styled.div<{ $percent: string }>`
  width: ${({ $percent }) => $percent};
  height: 100%;
  background: #fff;
  border-radius: ${({ theme }) => theme.radius.pill};
`;
