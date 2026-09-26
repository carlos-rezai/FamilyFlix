import styled from 'styled-components';

/** The running card, on the surface inside the soft border. */
export const Card = styled.div`
  padding: 24px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** _Fetching from TMDB…_ — serif, 22px. */
export const Headline = styled.div`
  margin-bottom: 6px;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 22px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** `N of M looked up`. */
export const StatLine = styled.div`
  margin-bottom: 16px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The title being looked up, in mono under the bar. */
export const CurrentItem = styled.div`
  margin-top: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The log, 20px under the bar. */
export const LogSlot = styled.div`
  margin-top: 20px;
`;
