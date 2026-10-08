import { EpisodeFileRow, FileField, SubtitleRow } from '@/components';
import { FilePicker, ImageIcon } from '@/primitives';
import {
  SUBTITLE_LANGUAGES,
  type EpisodeFormRow,
  type MovieFormFile,
} from '@/types';

import {
  CARD_LABEL,
  POSTER_ACCEPT,
  POSTER_CHOOSE,
  POSTER_LABEL,
  SUBTITLE_ACCEPT,
  VIDEO_ACCEPT,
} from '../filesCard';
import {
  Caption,
  Card,
  EpisodeRows,
  Episodes,
  EpisodesLabel,
} from './SeriesFormFiles.styles';

/** The episodes section's name, and what its picker says. */
const EPISODES_LABEL = 'Episodes';
const EPISODES_ADD = 'Add episode files';

/** What a row's own subtitle picker says. */
const SUBTITLE_ADD = 'Add subtitle';

export interface SeriesFormFilesProps {
  /** What is in the poster slot, or `null` while it is empty. */
  poster: MovieFormFile | null;
  /** Reports the artwork that was picked — the `File` itself. */
  onPickPoster: (file: File) => void;
  /** Reports that the poster slot's ✕ was pressed. */
  onRemovePoster: () => void;
  /** The **Episode file rows**, in the order they are held. */
  episodes: readonly EpisodeFormRow[];
  /** Reports every video picked in one dialog of _＋ Add episode files_. */
  onAddEpisodeFiles: (files: File[]) => void;
  onSeasonChange: (key: string, season: string) => void;
  onNumberChange: (key: string, number: string) => void;
  onEpisodeTitleChange: (key: string, title: string) => void;
  onRemoveEpisode: (key: string) => void;
  /** Reports a track picked on the row holding `rowKey`. */
  onAddEpisodeSubtitle: (rowKey: string, file: File) => void;
  onChangeEpisodeSubtitleLanguage: (
    rowKey: string,
    subtitleKey: string,
    language: string
  ) => void;
  onRemoveEpisodeSubtitle: (rowKey: string, subtitleKey: string) => void;
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
  episodes,
  onAddEpisodeFiles,
  onSeasonChange,
  onNumberChange,
  onEpisodeTitleChange,
  onRemoveEpisode,
  onAddEpisodeSubtitle,
  onChangeEpisodeSubtitleLanguage,
  onRemoveEpisodeSubtitle,
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
            >
              {episode.subtitles.map((subtitle) => (
                <SubtitleRow
                  key={subtitle.key}
                  filename={subtitle.file.filename}
                  language={subtitle.language}
                  languages={SUBTITLE_LANGUAGES}
                  onLanguageChange={(language) =>
                    onChangeEpisodeSubtitleLanguage(
                      episode.key,
                      subtitle.key,
                      language
                    )
                  }
                  onRemove={() =>
                    onRemoveEpisodeSubtitle(episode.key, subtitle.key)
                  }
                />
              ))}
              <FilePicker
                label={SUBTITLE_ADD}
                accept={SUBTITLE_ACCEPT}
                onPick={(file) => onAddEpisodeSubtitle(episode.key, file)}
              />
            </EpisodeFileRow>
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
