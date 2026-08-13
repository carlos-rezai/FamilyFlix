import styled, { keyframes } from 'styled-components';

/** Every placeholder in the app breathes on the same beat. */
const pulse = keyframes`
  from { opacity: 0.45; }
  to { opacity: 0.8; }
`;

/**
 * The placeholder surface, with no dimensions of its own. A skeleton is a
 * tracing of the screen it stands in for, so the shape belongs to that screen
 * and only the material is shared.
 */
export const Root = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.sm};
  animation: ${pulse} 1.1s ease-in-out infinite alternate;
`;
