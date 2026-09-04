import { useParams } from 'react-router-dom';

import { Player } from '@/features/player/Player/Player';

/**
 * `/movie/:id/play` — the player screen.
 *
 * Composition only, the way every page in this app is: read the `:id` the route
 * matched and hand it to `Player`, which owns the picture, the chrome, the
 * hooks and the state.
 *
 * No `MainLayout` — COMPONENT-SPEC §6 makes the player one self-contained
 * screen owning its own chrome, as the movie detail page already does.
 */
export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();

  return <Player movieId={id ?? ''} />;
}
