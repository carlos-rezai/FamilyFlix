import styled from 'styled-components';

/**
 * The heading row: as tall as the **Back button** beside it in the corner, so
 * a column screen's heading sits on Back's line when the column opens at the
 * top of the sheet.
 */
export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s4};
  min-height: ${({ theme }) => theme.layout.backSize};
  margin-bottom: ${({ theme }) => theme.space.s2};
`;

/** The eyebrow and the heading, taking the width the trailing controls leave. */
export const Titles = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

/** The small caps line above the heading — the Season page's series name. */
export const Eyebrow = styled.div`
  margin-bottom: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** Serif and large — the one heading on the screen. */
export const Heading = styled.h1`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 30px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** What the screen's own controls at the row's end sit in. */
export const End = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s3};
`;

/** The line under the heading — what this screen is for, said once. */
export const Lede = styled.p`
  margin: 0 0 28px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
