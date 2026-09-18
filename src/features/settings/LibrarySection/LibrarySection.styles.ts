import styled from 'styled-components';

/** The rows, stacked, with the group's own gap under them before the next. */
export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.s2};
  margin-bottom: ${({ theme }) => theme.space.s6};
`;
