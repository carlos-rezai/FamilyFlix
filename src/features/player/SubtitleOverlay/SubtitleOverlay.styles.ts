import styled from 'styled-components';

/**
 * How far up the picture the line sits with the **Chrome** on screen — the
 * prototype's `bottom: 130px`, which is what clears the transport row.
 */
const LIFTED = '130px';

/**
 * And where it drops back to once the chrome has faded. The lift exists to
 * clear the transport row; with the chrome gone there is nothing to clear, and
 * a line left at the chrome's height would sit in the middle of the film for
 * the rest of the evening.
 */
const RESTING = '60px';

/**
 * The full-width band the box is centred in — what actually positions it.
 *
 * `z-index` puts it over the chrome rather than under it: "above the controls"
 * is a stacking claim as much as a vertical one, and the last line of a film
 * must not end up behind the transport row.
 *
 * It never takes the pointer. The picture underneath is the pause target, and a
 * band that swallowed clicks would make the middle of the screen dead for as
 * long as a line is up.
 */
export const Band = styled.div<{ $lifted: boolean }>`
  position: absolute;
  left: 0;
  right: 0;
  bottom: ${({ $lifted }) => ($lifted ? LIFTED : RESTING)};
  z-index: 25;
  padding: 0 60px;
  text-align: center;
  pointer-events: none;
  transition: bottom 0.25s ease;
`;

/**
 * The box itself: the half-black plate behind white 26px text, in the
 * prototype's own padding and corner — the styling `::cue` has no way to reach,
 * which is half of why the box is ours in the first place.
 *
 * `white-space: pre-wrap` is what keeps a two-line cue on two lines: one cue is
 * one thing said, and the break the parsers normalised to `\n` has to survive
 * to the screen rather than collapsing into a single long row.
 * `box-decoration-break` keeps the plate behind both of those rows.
 */
export const Box = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 26px;
  font-weight: 500;
  line-height: 1.5;
  white-space: pre-wrap;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 6px 16px;
  border-radius: ${({ theme }) => theme.radius.sm};
  box-decoration-break: clone;
`;
