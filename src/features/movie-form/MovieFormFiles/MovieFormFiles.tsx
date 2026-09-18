import { FileField, SubtitleRow } from '@/components';
import { FilePicker, ImageIcon, VideoIcon } from '@/primitives';
import {
  SUBTITLE_LANGUAGES,
  type MovieFormFile,
  type MovieFormSubtitle,
} from '@/types';

import {
  Caption,
  Card,
  Subtitles,
  SubtitlesLabel,
  Tracks,
} from './MovieFormFiles.styles';

/**
 * What the video slot offers a file dialog.
 *
 * Chromium gives MKV and AVI no MIME type at all, so `video/*` on its own would
 * grey out most of the family folder — the extensions are named beside it for
 * exactly the containers a browser will not name. It is a convenience and never
 * a guarantee: the server re-checks, and accepts an unplayable container rather
 * than refusing it, because `cannot-play` is a state the player is designed to
 * draw.
 */
const VIDEO_ACCEPT = 'video/*,.mkv,.avi';

/**
 * What the poster slot offers a file dialog.
 *
 * The mirror of the video slot's list, and the reason that one is long: every
 * image container a poster arrives in has a MIME type a browser will name, so
 * `image/*` is the whole of what this slot has to say. It is a convenience just
 * the same — the server decides what a poster may be called, by extension,
 * because a file under the media root is served with the Content-Type its
 * extension implies.
 */
const POSTER_ACCEPT = 'image/*';

/**
 * What the subtitle picker offers a file dialog: the same four extensions
 * `parseSubtitle/` dispatches on, because a file the player could never read is
 * not one the dialog should offer.
 *
 * No MIME type beside them, unlike the two slots above — a browser calls a
 * `.srt` `text/plain` if it names it at all, and `text/plain` would offer the
 * maintainer every note in the folder. The server re-checks by extension
 * anyway, and refuses what this list is only asking for.
 */
const SUBTITLE_ACCEPT = '.srt,.vtt,.ass,.sub';

/** The caption over the card, and the names of its slots. */
const CARD_LABEL = 'Files';
const VIDEO_LABEL = 'Video';
const VIDEO_CHOOSE = 'Choose video file';
const POSTER_LABEL = 'Poster';
const POSTER_CHOOSE = 'Choose poster image';
const SUBTITLES_LABEL = 'Subtitles';
const SUBTITLE_ADD = 'Add subtitle file';

export interface MovieFormFilesProps {
  /** What is in the video slot, or `null` while it is empty. */
  video: MovieFormFile | null;
  /** Reports the film that was picked — the `File` itself. */
  onPickVideo: (file: File) => void;
  /** Reports that the slot's ✕ was pressed. */
  onRemoveVideo: () => void;
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
      <FileField
        label={VIDEO_LABEL}
        chooseLabel={VIDEO_CHOOSE}
        filename={video?.filename}
        accept={VIDEO_ACCEPT}
        icon={<VideoIcon size={16} />}
        onPick={onPickVideo}
        onRemove={onRemoveVideo}
      />
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
