import styled from 'styled-components';

/** The back pill and the heading, read as one group. */
export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s4};
  margin-bottom: ${({ theme }) => theme.space.s2};
`;

/** Serif and large — the one heading on the screen. */
export const Heading = styled.h1`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 30px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/**
 * The line under the heading — what this screen is for, said once, indented to
 * clear the back pill the way the prototype sets it.
 */
export const Lede = styled.p`
  margin: 0 0 28px 58px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
