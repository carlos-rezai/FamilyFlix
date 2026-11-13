import styled from 'styled-components';

/** _All series_ — `page.LibraryPage.dc.html`'s 24px serif section heading. */
export const Heading = styled.h2`
  margin: 0 0 ${({ theme }) => theme.space.s3};
  padding: 0 ${({ theme }) => theme.space.s6};
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.text};
`;

/** The count line under the heading — `N series · M episodes`. */
export const Count = styled.div`
  padding: 0 ${({ theme }) => theme.space.s6};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
