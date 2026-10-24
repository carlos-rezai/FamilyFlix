import { EpisodeFileRow, FileField, SubtitleRow } from '@/components';
import { FileIcon, FilePicker, ImageIcon } from '@/primitives';
import {
  LANGUAGE_POOL,
  type EpisodeFormRow,
  type MovieFormFile,
  type SeasonPosterSlot,
} from '@/types';
import { formatEpisodeTag } from '@/utils';

import {
  CARD_LABEL,
  POSTER_ACCEPT,
  POSTER_CHOOSE,
  POSTER_LABEL,
  SUBTITLE_ACCEPT,
  VIDEO_ACCEPT,
} from '../filesCard';
import { typedNumber } from '../formValues/formValues';
import type { EpisodeRefusal } from '../useEpisodeList/useEpisodeList';
import {
  AddShowFolder,
  Caption,
  Card,
  EpisodeRows,
  Episodes,
  EpisodesLabel,
  SeasonPosters,
  SeasonPostersLabel,
  StrayLine,
} from './SeriesFormFiles.styles';

/** The episodes section's name, and what its picker says. */
const EPISODES_LABEL = 'Episodes';
const EPISODES_ADD = 'Add episode files';

/** The **Show folder pick**'s button, and its row's label. */
const SHOW_FOLDER_ADD = 'Add show folder';
const SHOW_FOLDER_LABEL = 'Show folder';
const SHOW_FOLDER_REMOVES = 'show folder';

/** The line counting the subtitles the Show folder read matched to no episode. */
const strayLine = (count: number): string =>
  `${count} subtitle ${count === 1 ? 'file' : 'files'} matched no episode.`;

/** The _Season posters_ list's caption, and what an empty slot says. */
const SEASON_POSTERS_LABEL = 'Season posters';
const SEASON_POSTERS_LABEL_ID = 'season-posters-label';
const seasonPosterChoose = (season: number): string =>
  `Choose poster for season ${season}`;

/** A row's **Still** slot's name, and what it says while empty. */
const STILL_LABEL = 'Still';
const stillChoose = (tag: string): string => `Choose still for ${tag}`;
const stillRemoves = (tag: string): string => `still for ${tag}`;

/**
 * What a row is called in its still picker's name: its tag while both numbers
 * are typed, else its file's name — a blank number is a row mid-edit.
 */
function rowTag(row: EpisodeFormRow): string {
  const season = typedNumber(row.season);
  const number = typedNumber(row.number);
  return season === null || number === null
    ? row.file.filename
    : formatEpisodeTag({ season, number });
}

/** What a row's own subtitle picker says. */
const SUBTITLE_ADD = 'Add subtitle';

export interface SeriesFormFilesProps {
  /** What is in the poster slot, or `null` while it is empty. */
  poster: MovieFormFile | null;
  /** Reports the artwork that was picked — the `File` itself. */
  onPickPoster: (file: File) => void;
  /** Reports that the poster slot's ✕ was pressed. */
  onRemovePoster: () => void;
  /**
   * One slot per **Season** the episode rows hold, in the order drawn — none
   * draws no list.
   */
  seasonPosters: readonly SeasonPosterSlot[];
  /** Reports the artwork picked into a season's slot. */
  onPickSeasonPoster: (season: number, file: File) => void;
  /** Reports that a season's ✕ was pressed. */
  onRemoveSeasonPoster: (season: number) => void;
  /** The **Episode file rows**, in the order they are held. */
  episodes: readonly EpisodeFormRow[];
  /** Each row the **Save gate** refuses, by its key, with why. */
  refusals: Readonly<Record<string, EpisodeRefusal>>;
  /**
   * Opens the one-folder dialog of _＋ Add show folder_ — `null` draws no
   * button: a browser has no **Folder bridge**.
   */
  onAddShowFolder: (() => void) | null;
  /** The picked **Show folder**, absolute — `null` draws no Show folder row. */
  showFolder: string | null;
  /** Reports that the Show folder row's ✕ was pressed. */
  onRemoveShowFolder: () => void;
  /**
   * How many subtitles the Show folder read matched to no episode — counted
   * in one line under the episodes, and nothing drawn at zero.
   */
  straySubtitles: number;
  /** Reports every video picked in one dialog of _＋ Add episode files_. */
  onAddEpisodeFiles: (files: File[]) => void;
  onSeasonChange: (key: string, season: string) => void;
  onNumberChange: (key: string, number: string) => void;
  onEpisodeTitleChange: (key: string, title: string) => void;
  onRemoveEpisode: (key: string) => void;
  /**
   * Whether each row draws its **Still** slot, over the two handlers below —
   * none in a Series Resolve.
   */
  stills: boolean;
  /** Reports the image picked into the row holding `key`'s still slot. */
  onPickEpisodeStill: (key: string, file: File) => void;
  /** Reports that the row's still ✕ was pressed. */
  onRemoveEpisodeStill: (key: string) => void;
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
 * slot, the _Season posters_ list under it — one slot per **Season** the rows
 * hold, labelled `S01`, `S02`… — and the _Episodes_ label the **Episode file
 * rows** sit beside. No
 * video slot — a series' videos are its episodes' — no subtitle list of its
 * own, and no backdrop slot.
 */
export function SeriesFormFiles({
  poster,
  onPickPoster,
  onRemovePoster,
  seasonPosters,
  onPickSeasonPoster,
  onRemoveSeasonPoster,
  episodes,
  refusals,
  onAddEpisodeFiles,
  onAddShowFolder,
  showFolder,
  onRemoveShowFolder,
  straySubtitles,
  onSeasonChange,
  onNumberChange,
  onEpisodeTitleChange,
  onRemoveEpisode,
  stills,
  onPickEpisodeStill,
  onRemoveEpisodeStill,
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
      {seasonPosters.length > 0 && (
        <SeasonPosters role="group" aria-labelledby={SEASON_POSTERS_LABEL_ID}>
          <SeasonPostersLabel id={SEASON_POSTERS_LABEL_ID}>
            {SEASON_POSTERS_LABEL}
          </SeasonPostersLabel>
          {seasonPosters.map(({ season, poster: held }) => (
            <FileField
              key={season}
              label={formatEpisodeTag({ season })}
              chooseLabel={seasonPosterChoose(season)}
              filename={held?.filename}
              accept={POSTER_ACCEPT}
              icon={<ImageIcon size={16} />}
              onPick={(file) => onPickSeasonPoster(season, file)}
              onRemove={() => onRemoveSeasonPoster(season)}
            />
          ))}
        </SeasonPosters>
      )}
      {showFolder !== null && (
        // Only ever drawn filled: the folder comes from the button below, so
        // the slot's picker is never reached.
        <FileField
          label={SHOW_FOLDER_LABEL}
          chooseLabel={SHOW_FOLDER_ADD}
          removes={SHOW_FOLDER_REMOVES}
          filename={showFolder}
          accept=""
          icon={<FileIcon size={16} />}
          onPick={() => undefined}
          onRemove={onRemoveShowFolder}
          truncateStart
        />
      )}
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
              seasonRefused={refusals[episode.key]?.season ?? false}
              numberRefused={refusals[episode.key]?.number ?? false}
              refusal={refusals[episode.key]?.message ?? null}
              onSeasonChange={(season) => onSeasonChange(episode.key, season)}
              onNumberChange={(number) => onNumberChange(episode.key, number)}
              onTitleChange={(title) =>
                onEpisodeTitleChange(episode.key, title)
              }
              onRemove={() => onRemoveEpisode(episode.key)}
            >
              {stills && (
                <FileField
                  label={STILL_LABEL}
                  chooseLabel={stillChoose(rowTag(episode))}
                  removes={stillRemoves(rowTag(episode))}
                  filename={episode.still?.filename}
                  accept={POSTER_ACCEPT}
                  icon={<ImageIcon size={16} />}
                  onPick={(file) => onPickEpisodeStill(episode.key, file)}
                  onRemove={() => onRemoveEpisodeStill(episode.key)}
                />
              )}
              {episode.subtitles.map((subtitle) => (
                <SubtitleRow
                  key={subtitle.key}
                  filename={subtitle.file.filename}
                  language={subtitle.language}
                  languages={LANGUAGE_POOL}
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
          {straySubtitles > 0 && (
            <StrayLine>{strayLine(straySubtitles)}</StrayLine>
          )}
          {onAddShowFolder !== null && (
            <AddShowFolder type="button" onClick={onAddShowFolder}>
              ＋ {SHOW_FOLDER_ADD}
            </AddShowFolder>
          )}
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
