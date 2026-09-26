import styled from 'styled-components';

/** The running card, on the surface inside the soft border. */
export const Card = styled.div`
  padding: 24px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The headline and elapsed, on one baseline. */
export const HeadRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 6px;
`;

/** _Fetching from TMDB…_ — serif, 22px. */
export const Headline = styled.div`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 22px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** `Elapsed m:ss`, in mono. */
export const Elapsed = styled.div`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** `N of M looked up`. */
export const StatLine = styled.div`
  margin-bottom: 16px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The current item and the ETA, 12px under the bar. */
export const ItemRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
`;

/** The title being looked up, in mono under the bar. */
export const CurrentItem = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** `About m:ss left`. */
export const Eta = styled.div`
  flex: 0 0 auto;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The log, 20px under the bar. */
export const LogSlot = styled.div`
  margin-top: 20px;
`;

/** _Stop_, and the kept line pushed to the far end. */
export const StopRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
`;

export const KeptLine = styled.span`
  align-self: center;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
