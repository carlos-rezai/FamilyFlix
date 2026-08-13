import styled from 'styled-components';

export const Root = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: radial-gradient(
    140% 90% at 80% -10%,
    #1d1812 0%,
    ${({ theme }) => theme.colors.bg} 60%
  );
`;

export const Header = styled.header`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s5};
  padding: ${({ theme }) => `${theme.space.s4} ${theme.space.s6}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderSoft};
  background: rgba(20, 17, 13, 0.85);
  backdrop-filter: blur(12px);
  position: relative;
  z-index: 40;
`;

export const Logo = styled.button`
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex: 0 0 auto;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  user-select: none;
`;

export const LogoWord = styled.span`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 700;
  font-size: 25px;
  letter-spacing: 0.3px;
  color: ${({ theme }) => theme.colors.text};
`;

export const LogoAccent = styled(LogoWord)`
  color: ${({ theme }) => theme.colors.accent};
`;

/** Pushes the trailing header controls to the right edge. */
export const Spacer = styled.div`
  flex: 1 1 auto;
`;

export const Body = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: ${({ theme }) => `${theme.space.s6} 0 ${theme.space.s8}`};
`;
