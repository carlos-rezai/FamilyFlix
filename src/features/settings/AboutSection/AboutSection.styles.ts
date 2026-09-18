import styled from 'styled-components';

import { Card } from '../section.styles';

/**
 * The About card is its brand row and nothing else, so the row's own inset —
 * the prototype's `16px 20px` — is the card's, and the row's flex is the
 * card's: the brand, the version, then the tagline pushed to the far end.
 *
 * The last card on the page carries no group gap: `Card` sets the 32px the
 * Playback and Storage cards need under them, and the prototype's About card
 * has none — the column's own bottom padding is what follows it.
 */
export const AboutCard = styled(Card)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  margin-bottom: 0;
`;

/** **Family** run straight into **Flix**, on one baseline. */
export const Brand = styled.div`
  display: flex;
  align-items: baseline;
  gap: 1px;
`;

/** The brand's serif at 18px bold; `Family` in the text ink. */
export const Family = styled.span`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

/** The same serif; `Flix` in the accent. */
export const Flix = styled(Family)`
  color: ${({ theme }) => theme.colors.accent};
`;

/** The **App version**, mono at 13px in the faint ink, beside the brand. */
export const Version = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** _Offline · local-only · no account_, sans at 13px, pushed to the far end. */
export const Tagline = styled.span`
  margin-left: auto;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
