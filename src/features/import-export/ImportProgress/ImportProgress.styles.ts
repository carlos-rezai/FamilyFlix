import styled from 'styled-components';

/** The running block, set the prototype's 8px under the lede. */
export const Running = styled.div`
  padding-top: ${({ theme }) => theme.space.s2};
`;

/** "Scanning your library…" / "Importing movies…" — serif, and the step's one heading. */
export const Headline = styled.div`
  margin-bottom: ${({ theme }) => theme.space.s1};
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 24px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** "Found N movies so far" / "N of M imported", under the headline, above the bar. */
export const StatLine = styled.div`
  margin-bottom: ${({ theme }) => theme.space.s4};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** Cancel's own row, set the prototype's 22px under what is above it. */
export const Actions = styled.div`
  margin-top: 22px;
`;

/** The row under the bar: the current item at the left, the timing at the right. */
export const UnderBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.s4};
  margin: ${({ theme }) => theme.space.s3} 0 22px;
`;

/** The folder or title being worked on, in mono, cut with an ellipsis rather than wrapped. */
export const CurrentItem = styled.div`
  flex: 1;
  min-width: 0;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textFaint};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** "Elapsed m:ss · About m:ss left", never squeezed by the item beside it. */
export const Timing = styled.div`
  flex: 0 0 auto;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** "ACTIVITY LOG" — the small tracked caption over the console. */
export const LogHeading = styled.div`
  margin-bottom: ${({ theme }) => theme.space.s2};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;
