import styled from 'styled-components';

/** The search box and _Search_. */
export const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
`;

/** The 44px box on the page's own ground. */
export const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 14px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 9px;
  outline: none;
`;
