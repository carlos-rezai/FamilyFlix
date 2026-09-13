import styled from 'styled-components';

/**
 * The group heading, from `page.SettingsPage.dc.html`: small caps in the
 * faintest ink, nudged the prototype's 2px in to sit on the rows' text edge.
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

/** The rows, stacked, with the group's own gap under them before the next. */
export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.s2};
  margin-bottom: ${({ theme }) => theme.space.s6};
`;
