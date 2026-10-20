import styled from 'styled-components';

/** The body copy — the one paragraph the dialog says under its heading. */
export const Copy = styled.p`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textDim};
  margin: 0;
`;

/** The two buttons, confirm first. */
export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
`;

/**
 * The route's `409` sentence, one 13px line in danger ink above the buttons —
 * the overview's Delete dialog's refusal line.
 */
export const Refusal = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;
