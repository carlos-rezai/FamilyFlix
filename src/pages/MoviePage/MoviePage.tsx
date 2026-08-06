import { useParams } from 'react-router-dom';

import { MainLayout } from '../../layouts/MainLayout/MainLayout';

/**
 * `/movie/:id` — a placeholder that echoes the routed id, so every card on the
 * browse home has a real destination now. The backdrop, synopsis, cast, and
 * playback actions arrive with the movie-detail feature and slot in behind this
 * same URL.
 */
export default function MoviePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <MainLayout>
      <h1>Movie {id}</h1>
      <p>The movie detail screen lands here.</p>
    </MainLayout>
  );
}
