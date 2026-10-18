import { useRef, useState } from 'react';

import type { Playable } from '@/types';
import { Player } from '../Player/Player';
import { Surface } from './PlayerScreen.styles';

interface PlayerScreenProps {
  playable: Playable;
}

/**
 * The player screen: a **Fullscreen surface** that outlives the player inside
 * it.
 *
 * The `Player` is keyed on what it plays, so a **Sideways move** to the next
 * episode is a fresh player rather than the last one's state carried over. But
 * a browser leaves fullscreen the moment the element filling the screen leaves
 * the document, so a player that sent its own stage up took the family out of
 * fullscreen at every episode. What goes up is this surface instead — unkeyed,
 * so the route changing its `:id` keeps it — and a run of episodes watched in
 * fullscreen stays there. Leaving the player unmounts it, and fullscreen ends
 * with it, as before.
 *
 * It holds the **Audio choice** for the same reason: the language of the track
 * last picked by hand, handed to each player it keys so the next episode opens
 * on its own track in that language. Leaving the player forgets it; it is
 * never persisted and never posted.
 */
export function PlayerScreen({ playable }: PlayerScreenProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [audioChoice, setAudioChoice] = useState<string | null>(null);

  return (
    <Surface ref={surfaceRef}>
      <Player
        key={`${playable.kind}:${playable.id}`}
        playable={playable}
        surfaceRef={surfaceRef}
        audioChoice={audioChoice}
        onAudioChoice={setAudioChoice}
      />
    </Surface>
  );
}
