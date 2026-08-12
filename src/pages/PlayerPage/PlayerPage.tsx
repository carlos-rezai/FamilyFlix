import { useParams } from 'react-router-dom';

/**
 * `/movie/:id/play` — a placeholder that echoes the routed movie, so the detail
 * page's Play button has a real destination now. The built-in player, its
 * subtitle tracks and its transport controls arrive with the playback feature
 * and slot in behind this same URL.
 *
 * It writes nothing, and neither does the button that opens it: playback state
 * is written by the player, and until the player exists nothing writes it at
 * all.
 *
 * No `MainLayout` — COMPONENT-SPEC §6 makes the player one self-contained
 * screen owning its own chrome, as the movie detail page already does.
 */
export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <main>
      <h1>Player</h1>
      <p>Playback for movie {id} lands here.</p>
    </main>
  );
}
