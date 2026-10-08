import { EpisodeFileRow, FileField } from '@/components';
import { FilePicker, ImageIcon } from '@/primitives';
import type { EpisodeFormRow, MovieFormFile } from '@/types';

import {
  Caption,
  Card,
  EpisodeRows,
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
const EPISODES_ADD = 'Add episode files';

/** What the episode picker offers a file dialog — the movie's video answer. */
const VIDEO_ACCEPT = 'video/*,.mkv,.avi';

/** What a callback the caller left out does: nothing. */
const ignore = (): void => undefined;

export interface SeriesFormFilesProps {
  /** What is in the poster slot, or `null` while it is empty. */
  poster: MovieFormFile | null;
  /** Reports the artwork that was picked — the `File` itself. */
  onPickPoster: (file: File) => void;
  /** Reports that the poster slot's ✕ was pressed. */
  onRemovePoster: () => void;
  /** The **Episode file rows**, in the order they are held. */
  episodes?: readonly EpisodeFormRow[];
  /** Reports every video picked in one dialog of _＋ Add episode files_. */
  onAddEpisodeFiles?: (files: File[]) => void;
  onSeasonChange?: (key: string, season: string) => void;
  onNumberChange?: (key: string, number: string) => void;
  onEpisodeTitleChange?: (key: string, title: string) => void;
  onRemoveEpisode?: (key: string) => void;
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
  episodes = [],
  onAddEpisodeFiles = ignore,
  onSeasonChange = ignore,
  onNumberChange = ignore,
  onEpisodeTitleChange = ignore,
  onRemoveEpisode = ignore,
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
        <EpisodeRows>
          {episodes.map((episode) => (
            // The row's own key, never its index, for the subtitle list's
            // reason: a removal moves what is left up.
            <EpisodeFileRow
              key={episode.key}
              filename={episode.file.filename}
              season={episode.season}
              number={episode.number}
              title={episode.title}
              onSeasonChange={(season) => onSeasonChange(episode.key, season)}
              onNumberChange={(number) => onNumberChange(episode.key, number)}
              onTitleChange={(title) =>
                onEpisodeTitleChange(episode.key, title)
              }
              onRemove={() => onRemoveEpisode(episode.key)}
            />
          ))}
          <FilePicker
            label={EPISODES_ADD}
            accept={VIDEO_ACCEPT}
            multiple
            onPickFiles={onAddEpisodeFiles}
          />
        </EpisodeRows>
      </Episodes>
    </Card>
  );
}
