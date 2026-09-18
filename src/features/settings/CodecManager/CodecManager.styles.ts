import styled from 'styled-components';

/** The summary over the rows, the prototype's 14px apart. */
export const Report = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

/** The **Codec summary**, 13px in the faint ink. */
export const Summary = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The rows, stacked 8px apart. */
export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
