import styled from 'styled-components';

export const Root = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s7};
  margin-top: 28px;
  flex-wrap: wrap;
`;

export const Credit = styled.div`
  min-width: 0;
`;

/** The cast takes the leftover width; the director hugs its name. */
export const CastCredit = styled(Credit)`
  flex: 1 1 280px;
`;

export const CreditLabel = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-bottom: 6px;
`;

export const CreditValue = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  color: ${({ theme }) => theme.colors.text};
`;

/** The cast can wrap onto a second line, so it gets the looser leading. */
export const CastValue = styled(CreditValue)`
  line-height: 1.5;
`;
