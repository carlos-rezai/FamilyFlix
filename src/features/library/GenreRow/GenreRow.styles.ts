import styled from 'styled-components';

export const Root = styled.section`
  margin-bottom: ${({ theme }) => theme.space.s7};
`;

export const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: ${({ theme }) => `0 ${theme.space.s6}`};
  margin: ${({ theme }) => `0 0 ${theme.space.s4}`};
`;

export const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 22px;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

export const ViewAll = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textDim};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

export const ViewAllArrow = styled.span`
  font-size: 17px;
  line-height: 1;
`;
