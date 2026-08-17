import styled from 'styled-components';

/**
 * The field's box, from `prim.TextField.dc.html`: a pill on the surface fill,
 * 46px tall, with the icon and the input laid out in a row 10px apart. An
 * icon-led field is padded 16px, a bare one 14px — the prototype's own two
 * values, so the glyph and a plain caption both start on the same optical edge.
 *
 * The prototype's `rounded` and `height` props are not here: their non-default
 * values arrive with MovieForm and ImportFlow, and building them now would be
 * two props nothing passes.
 */
export const Field = styled.div<{ $hasIcon: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 46px;
  padding: ${({ $hasIcon }) => ($hasIcon ? '0 16px' : '0 14px')};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
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
 */
export const Input = styled.input`
  flex: 1;
  min-width: 0;
  height: 100%;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
`;
