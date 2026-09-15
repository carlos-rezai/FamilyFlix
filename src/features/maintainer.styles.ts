import styled from 'styled-components';

/**
 * The furniture the Maintainer's screens share: the header a screen opens
 * with — the back pill and the heading on one row, and the lede under them —
 * as `feat.MovieForm.dc.html` and `feat.ImportFlow.dc.html` both draw it,
 * and `feat.SettingsHeader.dc.html` draws a pixel and a `flex: 1` apart.
 *
 * This is the features rung's furniture rather than any one feature's, on
 * `layouts/chrome.styles.ts`'s precedent: the three blocks were written
 * twice, character for character, and a third time nearly so. In the
 * prototype they are one header the container hands to each screen. Each
 * feature extends these and states only what is genuinely its own; none owns
 * them. Not a molecule: the prototype has no `mol.*` for a page header —
 * these are container-level styles handed to the features, which is what a
 * furniture file is.
 */

/** The back pill and the heading, read as one group. */
export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s4};
  margin-bottom: ${({ theme }) => theme.space.s2};
`;

/** Serif and large — the one heading on the screen. */
export const Heading = styled.h1`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 30px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/**
 * The line under the heading — what this screen is for, said once, indented to
 * clear the back pill the way the prototype sets it.
 */
export const Lede = styled.p`
  margin: 0 0 28px 58px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
