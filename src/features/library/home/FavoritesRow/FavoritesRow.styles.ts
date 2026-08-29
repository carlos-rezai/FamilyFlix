import styled from 'styled-components';

/**
 * The wrapper around the heading's heart, and the only place the shelf's accent
 * lives. `RowSection` drops the mark in bare, so the colour has to come from
 * here: `HeartIcon` paints with `currentColor`, so setting `color` is the whole
 * of it — no fill prop, no icon variant.
 *
 * `margin-top: 2px` is the prototype's optical nudge. A heart's visual centre
 * sits above its box's centre, so a heart centred on the serif heading reads a
 * touch high; 2px down puts it back on the word. `inline-flex` so the nudge
 * applies at all — margins do not move an inline box vertically — and so the
 * wrapper adds no line-height of its own around the 20px svg.
 */
export const HeartMark = styled.span`
  display: inline-flex;
  margin-top: 2px;
  color: ${({ theme }) => theme.colors.accent};
`;
