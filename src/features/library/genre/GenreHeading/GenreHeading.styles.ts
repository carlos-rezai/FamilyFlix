import styled from 'styled-components';

/**
 * The genre's name in the header strip — `page.GenrePage.dc.html`'s 26px serif.
 * An `h1` because it is the screen's heading; the prototype's `div` was a
 * prototype's shortcut, and nothing about the type changes by saying so.
 *
 * It truncates rather than wraps: the strip is one row tall, and a long genre
 * name growing it would push the Back pill and the controls out of line.
 */
export const Name = styled.h1`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 26px;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.05;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** The count line under the name — the quiet half of the heading. */
export const Count = styled.p`
  margin: 3px 0 0;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
