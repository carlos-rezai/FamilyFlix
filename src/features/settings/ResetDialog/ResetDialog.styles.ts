import styled from 'styled-components';

/** A list's small heading — _What goes_, _What stays_ — 13px semibold, dim. */
export const ListHeading = styled.div`
  margin-bottom: 6px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The list under it, 14px in the dim ink, bulleted. */
export const List = styled.ul`
  margin: 0;
  padding-left: 20px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The route's refusal, one 13px line in danger ink above the buttons. */
export const Refusal = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;

/** The two buttons, the erase first. */
export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
`;
