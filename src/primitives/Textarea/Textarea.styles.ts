import styled from 'styled-components';

/**
 * The multi-line box from `prim.Textarea.dc.html`: the same surface fill, border
 * and type as `TextField`, opened at the prototype's own 96px so it reads as a
 * paragraph before one is typed, and draggable taller from there.
 *
 * The prototype's `minHeight` prop is not here: nothing passes a non-default,
 * which is the call `TextField`'s own styles file made for `height` until the
 * **Movie form** arrived to need it. It graduates into a prop when a second
 * caller wants a different box.
 *
 * The corner is `radius.md` (12px) rather than the prototype's inline `10px`,
 * the same deliberate deviation `TextField` records for its non-pill corner:
 * COMPONENT-SPEC §1 says every visual value is a token, and 10 is not one.
 *
 * The prototype's `outline: none` is deliberately **not** carried over, exactly
 * as on `TextField` — the focus ring is the only thing that tells a keyboard
 * user where they are.
 */
export const Area = styled.textarea`
  width: 100%;
  min-height: 96px;
  padding: 12px 14px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  line-height: 1.5;
  resize: vertical;
`;
