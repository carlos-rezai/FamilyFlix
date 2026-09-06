import styled from 'styled-components';

/**
 * The screen's own scroll container, from `page.SettingsPage.dc.html`: a sheet on
 * the deeper background, the same shape the **Movie form** the ＋ button opens
 * is drawn on.
 *
 * `MainLayout` is deliberately not above it. Its header carries the gear that
 * opens this very screen, and a gear on Settings is a control that does nothing;
 * the back pill is the way out, exactly as on `MoviePage`.
 */
export const Sheet = styled.div`
  height: 100vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.bg2};
`;

/** The centred column everything sits in — the prototype's 780px measure. */
export const Column = styled.div`
  max-width: 780px;
  margin: 0 auto;
  padding: ${({ theme }) =>
    `${theme.space.s6} ${theme.space.s6} ${theme.space.s8}`};
`;

/** The back pill, the heading and the ＋ button on one line. */
export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s4};
  margin-bottom: 6px;
`;

/** Serif and large, and it takes the width the two controls do not. */
export const Heading = styled.h1`
  flex: 1;
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 30px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/**
 * The accent action, and the only route in the app to the **Movie form**.
 *
 * Its own button rather than the `Button` primitive: the prototype draws it 44px
 * tall on a 10px corner with a ＋ glyph, where `Button`'s `md` face is 50px on
 * `radius.md` and its glyph enum is `'none' | 'play'`. Widening a primitive that
 * four other screens share, to fit one call site's geometry, is the trade the
 * two `BackPill`s already declined.
 */
export const AddMovieButton = styled.button`
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

/**
 * The line under the heading, indented past the back pill so it hangs off the
 * heading rather than off the column edge.
 */
export const Subtitle = styled.p`
  margin: 0 0 30px 58px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
