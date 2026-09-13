import styled from 'styled-components';

/**
 * The field's box, from `prim.TextField.dc.html`: a pill on the surface fill,
 * 46px tall, with the icon and the input laid out in a row 10px apart. An
 * icon-led field is padded 16px, a bare one 14px — the prototype's own two
 * values, so the glyph and a plain caption both start on the same optical edge.
 *
 * The prototype's `height` and `rounded` are now props, because the caller
 * their absence was waiting for has arrived: the **Movie form**'s metadata
 * fields are the prototype's 48px box with a soft corner rather than the 46px
 * pill the search bar wears. Both keep the prototype's own defaults, so the
 * screen already built on this primitive is drawn exactly as it was.
 *
 * **One deliberate deviation, recorded here:** the non-pill corner is
 * `radius.md` (12px) rather than the prototype's inline `10px`. COMPONENT-SPEC
 * §1 says every visual value is a token, and 10 is not one.
 */
export const Field = styled.div<{
  $hasIcon: boolean;
  $height: number;
  $rounded: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: ${({ $height }) => `${$height}px`};
  padding: ${({ $hasIcon }) => ($hasIcon ? '0 16px' : '0 14px')};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme, $rounded }) =>
    $rounded ? theme.radius.pill : theme.radius.md};
`;

/** Holds the glyph at its own size, centred, in the faintest ink. */
export const IconSlot = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * The control itself — chrome-less, so the box above is the only thing seen.
 *
 * The prototype's `outline: none` is deliberately **not** carried over: the
 * focus ring is left alone here, as it is on `Chip` and `ContinueCard`. It is
 * the only thing that tells a keyboard user where they are, and suppressing it
 * is not a token or a layout the prototype is the authority on.
 *
 * `$mono` is the **Setup step**'s face: a path is set on the mono font at 14px,
 * as `feat.ImportFlow.dc.html` draws it, where every other field is sans at 16.
 */
export const Input = styled.input<{ $mono: boolean }>`
  flex: 1;
  min-width: 0;
  height: 100%;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme, $mono }) =>
    $mono ? theme.fonts.mono : theme.fonts.sans};
  font-size: ${({ $mono }) => ($mono ? '14px' : '16px')};
`;
