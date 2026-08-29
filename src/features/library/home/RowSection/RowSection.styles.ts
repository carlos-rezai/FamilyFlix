import styled from 'styled-components';

/**
 * One shelf on the browse home. The bottom margin is the gap between rows, so
 * a row owns the space beneath it and the page needs no separator of its own.
 */
export const Root = styled.section`
  margin-bottom: ${({ theme }) => theme.space.s7};
`;

/**
 * The heading strip above the carousel: the title on the left and, when the row
 * has one, its trailing action pushed to the right. Baseline-aligned rather
 * than centred, so a 14px action sits on the same text baseline as a 22px
 * serif heading instead of floating in the middle of it.
 *
 * The horizontal padding lives here rather than on the heading, so the title
 * and the action share one inset and line up with the carousel's own
 * `scroll-padding` below.
 */
export const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: ${({ theme }) => `0 ${theme.space.s6}`};
  margin: ${({ theme }) => `0 0 ${theme.space.s4}`};
`;

/**
 * The row's title. The size is a prop rather than a token because the prototype
 * genuinely differs per row — Continue Watching is 24px, a genre row is 22px —
 * and that difference is the spec, not an inconsistency to average out.
 *
 * It is a flex container so an optional leading mark and the title text share
 * one centred line, 10px apart. **`inline-flex`, not `flex`**: `Header` lines
 * its trailing action up on the heading's baseline, and a block-level flex box
 * has no baseline to share — a genre row's "View all" would drop off the
 * heading's line the moment this became `display: flex`.
 *
 * The mark is dropped in bare, exactly as the caller passed it. Colouring it is
 * the caller's business; this heading knows only that something may lead it.
 */
export const Title = styled.h2<{ $size: number }>`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: ${({ $size }) => `${$size}px`};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;
