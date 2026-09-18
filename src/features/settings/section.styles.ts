import styled from 'styled-components';

/**
 * The furniture every **Settings group** draws with, from
 * `page.SettingsPage.dc.html` — the `maintainer.styles.ts` precedent one rung
 * down: the **Group heading** over either a list of rows or a **Section
 * card**, and the card's own title, lede and divider. Built once here so the
 * Library group's heading and the Playback card's are one styled component
 * rather than two copies.
 */

/**
 * The **Group heading**: small caps in the faintest ink, nudged the
 * prototype's 2px in to sit on the rows' text edge.
 */
export const GroupHeading = styled.div`
  margin: 0 0 ${({ theme }) => theme.space.s3} 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * The **Section card**: the surface a group's items sit on, with the group's
 * own gap under it before the next.
 */
export const Card = styled.div`
  padding: 20px;
  margin-bottom: 32px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The hairline between two halves of one card. */
export const Divider = styled.div`
  height: 1px;
  margin: 22px 0;
  background: ${({ theme }) => theme.colors.borderSoft};
`;

/** An item's title in a card, 16px semibold in the text ink. */
export const ItemTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** The lede under it, 13px in the faint ink, held to the prototype's measure. */
export const ItemDesc = styled.div`
  margin-top: 2px;
  max-width: 440px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
