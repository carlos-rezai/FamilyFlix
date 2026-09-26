import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { GlobalStyle } from '@/styles/GlobalStyle';
import { theme } from '@/styles/theme';
import LibraryPage from '@/pages/LibraryPage/LibraryPage';
import MoviePage from '@/pages/MoviePage/MoviePage';
import SeriesPage from '@/pages/SeriesPage/SeriesPage';
import SeasonPage from '@/pages/SeasonPage/SeasonPage';
import PlayerPage from '@/pages/PlayerPage/PlayerPage';
import AddMoviePage from '@/pages/AddMoviePage/AddMoviePage';
import GenrePage from '@/pages/GenrePage/GenrePage';
import SettingsPage from '@/pages/SettingsPage/SettingsPage';
import ImportPage from '@/pages/ImportPage/ImportPage';
import EnrichmentPage from '@/pages/EnrichmentPage/EnrichmentPage';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';

/**
 * The app root: the theme and global reset every screen renders under, plus the
 * route table. The router itself lives outside (`main.tsx` supplies a
 * `BrowserRouter`, tests a `MemoryRouter`), so the app can be mounted at any
 * entry URL. The **Snackbar stack** sits here too, above the route table, so a
 * notice raised on one screen is still in the corner on the next.
 *
 * Every route a real screen: the browse home at `/`, the movie page at
 * `/movie/:id` and the genre page at `/genre/:name` (the home's two
 * destinations), the player at `/movie/:id/play` (and on an episode at `/episode/:id/play`), the movie form at `/add`
 * (with `?movie=<id>` to edit), the series page at `/series/:id`, the Settings
 * hub at `/settings`, the bulk
 * importer at `/import` and the TMDB **Sync** at `/enrich`. The URLs were the stable part all along — each screen
 * landed behind the link already pointed at it, without any link changing,
 * which is how every link in the app could be honest before the screen behind
 * it existed.
 */
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <SnackbarProvider>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/movie/:id" element={<MoviePage />} />
          <Route path="/movie/:id/play" element={<PlayerPage />} />
          <Route
            path="/episode/:id/play"
            element={<PlayerPage kind="episode" />}
          />
          <Route path="/series/:id" element={<SeriesPage />} />
          <Route path="/series/:id/season/:n" element={<SeasonPage />} />
          <Route path="/add" element={<AddMoviePage />} />
          <Route path="/genre/:name" element={<GenrePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/enrich" element={<EnrichmentPage />} />
        </Routes>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
