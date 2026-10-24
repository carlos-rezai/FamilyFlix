import styled from 'styled-components';

/** The linked callout: the handoff's danger-tinted card, `!` then the line. */
export const Callout = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(201, 122, 106, 0.1);
  border: 1px solid rgba(201, 122, 106, 0.32);
  border-radius: 9px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.text};
  text-wrap: pretty;
`;

/** The callout's `!`, in danger ink. */
export const CalloutMark = styled.span`
  flex: 0 0 auto;
  color: ${({ theme }) => theme.colors.danger};
  font-weight: 700;
`;

/** The route's refusal, one 13px line in danger ink above the buttons. */
export const Refusal = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;

/** The **Recycle choice**'s two cards, the **Import mode**'s row. */
export const Cards = styled.div`
  display: flex;
  gap: 10px;
`;
