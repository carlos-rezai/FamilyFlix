import styled from 'styled-components';

/**
 * The **Codecs row**: the whole row one bare button — the Network group's
 * _Sync metadata & posters_ row, rule for rule, under its own names.
 */
export const CodecsRow = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 15px 4px 4px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
`;

/** The microchip in its accent tile — the prototype's own 38px and 9px. */
export const CodecsTile = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accent};
`;

/** The label and its line, taking the width the tile and chevron do not. */
export const CodecsText = styled.span`
  flex: 1;
  min-width: 0;
`;

export const CodecsLabel = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const CodecsDesc = styled.span`
  display: block;
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The chevron at the row's end, in the faintest ink. */
export const CodecsChevron = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The Subtitles half's own header: title and lede, 14px over the first row. */
export const SubtitlesHeader = styled.div`
  margin-bottom: 14px;
`;

/**
 * One **Setting row**: its title and description on the left, its control on
 * the right. The last row of the card closes on 2px rather than 12px, so the
 * card's own padding is not doubled under it.
 */
export const Row = styled.div<{ $last?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: ${({ $last }) => ($last ? '12px 0 2px' : '12px 0')};
`;

/** A row's title beside whatever pill it wears. */
export const RowTitleLine = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
`;

/** A row's title, 15px medium in the text ink. */
export const RowTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
`;

/** The description under a row's title, 13px in the faint ink. */
export const RowDesc = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The **Coming soon** pill: small caps in the faint ink on the third surface. */
export const ComingSoon = styled.span`
  padding: 2px 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.surface3};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
`;

/** The hairline between two rows — the card's divider on a row's 6px. */
export const RowRule = styled.div`
  height: 1px;
  margin: 6px 0;
  background: ${({ theme }) => theme.colors.borderSoft};
`;
