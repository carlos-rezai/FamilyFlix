import styled from 'styled-components';

/**
 * The accent action, and the only route in the app to the **Movie form**.
 *
 * Its own button rather than the `Button` primitive: the prototype draws it 44px
 * tall on a 10px corner with a ＋ glyph, where `Button`'s `md` face is 50px on
 * `radius.md` and its glyph enum is `'none' | 'play'`. Widening a primitive that
 * four other screens share, to fit one call site's geometry, is the trade the
 * two `BackPill`s already declined.
 */
export const AddTitleButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s2};
  flex: 0 0 auto;
  height: 44px;
  padding: 0 20px;
  background: ${({ theme }) => theme.colors.accent};
  border: none;
  border-radius: 10px;
  /* The ink *on* the accent fill, the one value the prototype writes literally —
     the Button primitive's primary face carries the same note against the same
     colour. (No backticks in here: this comment is inside a template literal.) */
  color: #1a1109;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.accentHover};
  }
`;

/** The ＋, at its own size. Decorative: the label is the accessible name. */
export const AddGlyph = styled.span`
  font-size: 17px;
`;
