import styled from 'styled-components';

/** The caption _Files_: 13px sans, semibold, in the dim ink, 8px over the pair. */
export const Caption = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDim};
  margin-bottom: 8px;
`;

/** The two cards side by side, 10px apart. */
export const Cards = styled.div`
  display: flex;
  gap: 10px;
`;
