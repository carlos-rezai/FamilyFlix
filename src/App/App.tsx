import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { GlobalStyle } from '@/styles/GlobalStyle';
import { theme } from '@/styles/theme';
import LibraryPage from '@/pages/LibraryPage/LibraryPage';
import MoviePage from '@/pages/MoviePage/MoviePage';
import PlayerPage from '@/pages/PlayerPage/PlayerPage';
import AddMoviePage from '@/pages/AddMoviePage/AddMoviePage';
import GenrePage from '@/pages/GenrePage/GenrePage';
import SettingsPage from '@/pages/SettingsPage/SettingsPage';

/**
 * The app root: the theme and global reset every screen renders under, plus the
 * route table. The router itself lives outside (`main.tsx` supplies a
 * `BrowserRouter`, tests a `MemoryRouter`), so the app can be mounted at any
 * entry URL.
 *
 * `/movie/:id` is the browse home's destination and a real screen; `/genre/:name`,
 * `/movie/:id/play` and `/add` are placeholders. The URLs are the stable part —
 * each real screen lands behind the one already pointed at, without any link
 * changing, which is why every link in the app can be honest before the screen
 * behind it exists.
 */
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/movie/:id" element={<MoviePage />} />
        <Route path="/movie/:id/play" element={<PlayerPage />} />
        <Route path="/add" element={<AddMoviePage />} />
        <Route path="/genre/:name" element={<GenrePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </ThemeProvider>
  );
}
