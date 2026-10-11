import { FileField, SubtitleRow } from '@/components';
import { FilePicker, ImageIcon, VideoIcon } from '@/primitives';
import {
  SUBTITLE_LANGUAGES,
  type MovieFormFile,
  type MovieFormSubtitle,
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
  Choice,
  ChoiceLabel,
  Option,
  OptionDot,
  OptionName,
  Options,
  Subtitles,
  SubtitlesLabel,
  Tracks,
} from './MovieFormFiles.styles';

/** The names of the slots only the movie's card draws. */
const VIDEO_LABEL = 'Video';
const VIDEO_CHOOSE = 'Choose video file';
const SUBTITLES_LABEL = 'Subtitles';
const SUBTITLE_ADD = 'Add subtitle file';

export interface MovieFormFilesProps {
  /** What is in the video slot, or `null` while it is empty. */
  video: MovieFormFile | null;
  /** Reports the film that was picked — the `File` itself. */
  onPickVideo: (file: File) => void;
  /** Reports that the slot's ✕ was pressed. */
  onRemoveVideo: () => void;
  /**
   * A film Resolve's **Found files**' videos, absolute paths in name order:
   * two or more draw the **Found-file choice** in place of the video slot.
   */
  foundVideos?: string[];
  /** Reports the found video chosen, by its path. */
  onChooseVideo?: (path: string) => void;
  /** What is in the poster slot, or `null` while it is empty. */
  poster: MovieFormFile | null;
  /** Reports the artwork that was picked — the `File` itself. */
  onPickPoster: (file: File) => void;
  /** Reports that the poster slot's ✕ was pressed. */
  onRemovePoster: () => void;
  /** The tracks attached so far, in the order they will be stored in. */
  subtitles: MovieFormSubtitle[];
  /** Reports the track that was picked — the `File` itself. What language it
   *  lands in is the form's decision, not this card's. */
  onAddSubtitle: (file: File) => void;
  /** Reports a language chosen on the row holding `key`. */
  onChangeSubtitleLanguage: (key: string, language: string) => void;
  /** Reports the ✕ pressed on the row holding `key`. */
  onRemoveSubtitle: (key: string) => void;
}

/**
 * The Files card of the **Movie form**: the panel the prototype draws under the
 * metadata fields, with the video slot, the poster slot and the subtitle list
 * in it.
 *
 * A feature sibling rather than a molecule, on the player's shape — the organism
 * owns the values and this draws what it is told. It knows which slots a
 * **Movie** has and what each of them offers a file dialog; `FileField` knows
 * how a slot looks, and neither of them knows what a save is. The video and
 * the poster are two instances of that one molecule, differing only in what
 * each offers a file dialog.
 *
 * **The subtitles are a list rather than a slot**, and that is the whole of what
 * is different about them: picking a file appends a row, the ＋ stays after it,
 * and a film carries as many tracks as the family needs. With them this card
 * also knows the **Language pool** — the same kind of knowledge as the accept
 * lists, which is why `SubtitleRow` is handed it rather than knowing it.
 *
 * Only one row's language list can be open at a time, and there is no state
 * here that arranges it: `SubtitleRow` is built on `Menu`, and opening the
 * second list is a press outside the first, which is already what shuts it.
 */
export function MovieFormFiles({
  video,
  onPickVideo,
  onRemoveVideo,
  foundVideos = [],
  onChooseVideo,
  poster,
  onPickPoster,
  onRemovePoster,
  subtitles,
  onAddSubtitle,
  onChangeSubtitleLanguage,
  onRemoveSubtitle,
}: MovieFormFilesProps) {
  return (
    <Card>
      <Caption>{CARD_LABEL}</Caption>
      {foundVideos.length > 1 ? (
        <FoundFileChoice
          videos={foundVideos}
          video={video}
          onChoose={(path) => onChooseVideo?.(path)}
          onPick={onPickVideo}
        />
      ) : (
        <FileField
          label={VIDEO_LABEL}
          chooseLabel={VIDEO_CHOOSE}
          filename={video?.filename}
          accept={VIDEO_ACCEPT}
          icon={<VideoIcon size={16} />}
          onPick={onPickVideo}
          onRemove={onRemoveVideo}
        />
      )}
      <FileField
        label={POSTER_LABEL}
        chooseLabel={POSTER_CHOOSE}
        filename={poster?.filename}
        accept={POSTER_ACCEPT}
        icon={<ImageIcon size={16} />}
        onPick={onPickPoster}
        onRemove={onRemovePoster}
      />
      <Subtitles>
        <SubtitlesLabel>{SUBTITLES_LABEL}</SubtitlesLabel>
        <Tracks>
          {subtitles.map((subtitle) => (
            // The row's own key, never its index: a removal re-orders what is
            // left, and an index-keyed list would hand a row's language to
            // whatever moved up into its place.
            <SubtitleRow
              key={subtitle.key}
              filename={subtitle.file.filename}
              language={subtitle.language}
              languages={SUBTITLE_LANGUAGES}
              onLanguageChange={(language) =>
                onChangeSubtitleLanguage(subtitle.key, language)
              }
              onRemove={() => onRemoveSubtitle(subtitle.key)}
            />
          ))}
          {/* The same picker a slot starts as — and unlike a slot's, it stays
              after a file is picked. This is a list, and the ＋ is how it
              grows. */}
          <FilePicker
            label={SUBTITLE_ADD}
            accept={SUBTITLE_ACCEPT}
            onPick={onAddSubtitle}
          />
        </Tracks>
      </Subtitles>
    </Card>
  );
}

/** A path's last segment, whichever separator the machine spells it with. */
const nameOf = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/**
 * The **Found-file choice**: the folder's videos by name as a radio group,
 * the one in the slot checked, and the picker kept under them for a film from
 * somewhere else — whose pick joins the group as its last row, chosen.
 */
function FoundFileChoice({
  videos,
  video,
  onChoose,
  onPick,
}: {
  videos: string[];
  video: MovieFormFile | null;
  onChoose: (path: string) => void;
  onPick: (file: File) => void;
}) {
  const chosen = video?.kind === 'found' ? video.path : null;
  return (
    <Choice>
      <ChoiceLabel>{VIDEO_LABEL}</ChoiceLabel>
      <Options role="radiogroup" aria-label={VIDEO_LABEL}>
        {videos.map((path) => (
          <Option
            key={path}
            type="button"
            role="radio"
            aria-checked={path === chosen}
            $on={path === chosen}
            onClick={() => onChoose(path)}
          >
            <OptionDot $on={path === chosen} />
            <OptionName>{nameOf(path)}</OptionName>
          </Option>
        ))}
        {video !== null && video.kind !== 'found' && (
          <Option type="button" role="radio" aria-checked $on>
            <OptionDot $on />
            <OptionName>{video.filename}</OptionName>
          </Option>
        )}
        <FilePicker
          label={VIDEO_CHOOSE}
          accept={VIDEO_ACCEPT}
          onPick={onPick}
        />
      </Options>
    </Choice>
  );
}
