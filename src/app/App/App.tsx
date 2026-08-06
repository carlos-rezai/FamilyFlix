import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { GlobalStyle } from '../../styles/GlobalStyle';
import { theme } from '../../styles/theme';
import LibraryPage from '../../pages/LibraryPage/LibraryPage';
import MoviePage from '../../pages/MoviePage/MoviePage';
import GenrePage from '../../pages/GenrePage/GenrePage';
import SettingsPage from '../../pages/SettingsPage/SettingsPage';

/**
 * The app root: the theme and global reset every screen renders under, plus the
 * route table. The router itself lives outside (`main.tsx` supplies a
 * `BrowserRouter`, tests a `MemoryRouter`), so the app can be mounted at any
 * entry URL.
 *
 * `/movie/:id` and `/genre/:name` are the two parameterized URLs the browse
 * home links to; both are placeholders today, but the URLs are the stable part
 * — the real screens land behind them without any link changing.
 */
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/movie/:id" element={<MoviePage />} />
        <Route path="/genre/:name" element={<GenrePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </ThemeProvider>
  );
}
