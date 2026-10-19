import styled from 'styled-components';

/** The tabs on the left, the summary on the right. */
export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
`;

export const Summary = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The Title rows, 8px apart. */
export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/** An empty tab's card. */
export const Empty = styled.div`
  padding: 48px 16px;
  text-align: center;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.md};
`;
