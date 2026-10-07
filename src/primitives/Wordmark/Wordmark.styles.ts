import styled from 'styled-components';

/**
 * **Family** run straight into **Flix**, on one baseline. No size of its own:
 * the mark takes the `font-size` its parent sets, so the header's 25px, the
 * About card's 18px and the **Default poster**'s fraction of its tile are each
 * the caller's. The gap between the words is the caller's too, by
 * `styled(Wordmark)`.
 */
export const Root = styled.span`
  display: inline-flex;
  align-items: baseline;
`;

/** The brand's serif at 700; `Family` in the text ink. */
export const Family = styled.span`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

/** The same serif; `Flix` in the accent. */
export const Flix = styled(Family)`
  color: ${({ theme }) => theme.colors.accent};
`;
