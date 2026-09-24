import { useParams } from 'react-router-dom';

import { Player } from '@/features/player/Player/Player';
import type { Playable } from '@/types';

interface PlayerPageProps {
  /**
   * What the route's `:id` names — a movie unless the route table says
   * otherwise; `/episode/:id/play` hands it `episode`.
   */
  kind?: Playable['kind'];
}

/**
 * `/movie/:id/play` and `/episode/:id/play` — the player screen.
 *
 * Composition only, the way every page in this app is: read the `:id` the route
 * matched and hand it to `Player` as a **Playable**, which owns the picture, the
 * chrome, the hooks and the state.
 *
 * No `MainLayout` — COMPONENT-SPEC §6 makes the player one self-contained
 * screen owning its own chrome, as the movie detail page already does.
 */
export default function PlayerPage({ kind = 'movie' }: PlayerPageProps) {
  const { id } = useParams<{ id: string }>();

  // Keyed on what it plays, so a **Sideways move** to the next episode is a
  // fresh player rather than the last one's state carried over.
  return (
    <Player key={`${kind}:${id ?? ''}`} playable={{ kind, id: id ?? '' }} />
  );
}
