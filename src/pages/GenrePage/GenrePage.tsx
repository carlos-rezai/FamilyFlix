import { useParams } from 'react-router-dom';

import { MainLayout } from '../../layouts/MainLayout/MainLayout';

/**
 * `/genre/:name` — a placeholder that echoes the routed genre, so every row's
 * "View all" has a real destination now. The full grid for one genre arrives
 * with the browse-grid follow-up and slots in behind this same URL.
 *
 * The name comes back decoded, which is what makes a genre with a space in it
 * ("Science Fiction") survive the round-trip through the URL.
 */
export default function GenrePage() {
  const { name } = useParams<{ name: string }>();

  return (
    <MainLayout>
      <h1>{name}</h1>
      <p>Every movie in this genre lands here.</p>
    </MainLayout>
  );
}
