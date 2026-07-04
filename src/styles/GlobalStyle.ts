import { createGlobalStyle } from 'styled-components';

/**
 * Global reset + app chrome — the code-side of the `:root`/`*` blocks and
 * keyframes in `docs/handoff/tokens.css`. Sets the dark cinematic background,
 * normalizes box-sizing, styles the scrollbar, and registers the shared
 * keyframes the primitives animate against. (The brand fonts are loaded via a
 * `<link>` in `index.html` — `@import` inside `createGlobalStyle` is
 * unsupported by styled-components' production CSSOM path.)
 */
export const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.sans};
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar {
    height: 10px;
    width: 10px;
  }
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.surface3};
    border-radius: 99px;
    border: 2px solid ${({ theme }) => theme.colors.bg};
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }

  @keyframes ffFade {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes ffPop {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: none; }
  }
  @keyframes ffBar {
    from { background-position: 0 0; }
    to { background-position: 32px 0; }
  }
  @keyframes ffSnackIn {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }
  @keyframes ffIndeterminate {
    0% { left: -40%; width: 40%; }
    50% { width: 58%; }
    100% { left: 100%; width: 40%; }
  }
`;
