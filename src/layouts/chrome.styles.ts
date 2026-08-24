import styled from 'styled-components';

/**
 * The chrome a full-screen route sits in: one page filling the viewport exactly
 * once, a fixed strip across the top of it, and a single scrolling body below.
 *
 * This is the app's furniture rather than any one screen's. The gradient, the
 * 100vh flex column, the translucent blurred strip and the `z-index` that keeps
 * it above the body were written twice before the genre page arrived, and
 * Settings and the player are two more screens due behind chrome that is neither
 * layout's. Each layout extends these and states only what is genuinely its own.
 *
 * Deliberately not `GenreLayout` extending `MainLayout`: that would make
 * `MainLayout` an implicit base class and one screen's styles another screen's
 * public surface. Both extend the furniture; neither owns it.
 */

/** The page: the viewport, once, with the app's background behind it. */
export const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: radial-gradient(
    140% 90% at 80% -10%,
    #1d1812 0%,
    ${({ theme }) => theme.colors.bg} 60%
  );
`;

/**
 * The strip across the top: fixed height, translucent over whatever scrolls
 * beneath it, and above that content rather than under it. Each layout sets its
 * own `gap`, which is the one thing they space differently.
 */
export const Header = styled.header`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: ${({ theme }) => `${theme.space.s4} ${theme.space.s6}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderSoft};
  background: rgba(20, 17, 13, 0.85);
  backdrop-filter: blur(12px);
  position: relative;
  z-index: 40;
`;

/** Pushes the trailing header controls to the right edge. */
export const Spacer = styled.div`
  flex: 1 1 auto;
`;

/** The one thing that scrolls: everything the header is not. */
export const Body = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
`;
