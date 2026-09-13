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
