import { FileField } from '@/components';
import { ImageIcon } from '@/primitives';
import type { MovieFormFile } from '@/types';

import {
  Caption,
  Card,
  Episodes,
  EpisodesLabel,
} from './SeriesFormFiles.styles';

/** What the poster slot offers a file dialog — the movie card's own answer. */
const POSTER_ACCEPT = 'image/*';

/** The caption over the card, and the names of its slots. */
const CARD_LABEL = 'Files';
const POSTER_LABEL = 'Poster';
const POSTER_CHOOSE = 'Choose poster image';
const EPISODES_LABEL = 'Episodes';

export interface SeriesFormFilesProps {
  /** What is in the poster slot, or `null` while it is empty. */
  poster: MovieFormFile | null;
  /** Reports the artwork that was picked — the `File` itself. */
  onPickPoster: (file: File) => void;
  /** Reports that the poster slot's ✕ was pressed. */
  onRemovePoster: () => void;
}

/**
 * The Files card of the **Movie form** on the series kind —
 * `MovieFormFiles`' shape for a **Series**: the _Files_ caption, the Poster
 * slot, and the _Episodes_ label the **Episode file rows** sit beside. No
 * video slot — a series' videos are its episodes' — no subtitle list of its
 * own, and no backdrop slot.
 */
export function SeriesFormFiles({
  poster,
  onPickPoster,
  onRemovePoster,
}: SeriesFormFilesProps) {
  return (
    <Card>
      <Caption>{CARD_LABEL}</Caption>
      <FileField
        label={POSTER_LABEL}
        chooseLabel={POSTER_CHOOSE}
        filename={poster?.filename}
        accept={POSTER_ACCEPT}
        icon={<ImageIcon size={16} />}
        onPick={onPickPoster}
        onRemove={onRemovePoster}
      />
      <Episodes>
        <EpisodesLabel>{EPISODES_LABEL}</EpisodesLabel>
      </Episodes>
    </Card>
  );
}
