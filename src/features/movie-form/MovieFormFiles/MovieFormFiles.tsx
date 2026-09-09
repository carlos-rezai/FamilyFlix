import { FileField } from '@/components';
import { ImageIcon, VideoIcon } from '@/primitives';
import type { MovieFormFile } from '@/types';

import { Caption, Card } from './MovieFormFiles.styles';

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

/** The caption over the card, and the names of its slots. */
const CARD_LABEL = 'Files';
const VIDEO_LABEL = 'Video';
const VIDEO_CHOOSE = 'Choose video file';
const POSTER_LABEL = 'Poster';
const POSTER_CHOOSE = 'Choose poster image';

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
}

/**
 * The Files card of the **Movie form**: the panel the prototype draws under the
 * metadata fields, and the two slots this slice puts in it.
 *
 * A feature sibling rather than a molecule, on the player's shape — the organism
 * owns the values and this draws what it is told. It knows which slots a
 * **Movie** has and what each of them offers a file dialog; `FileField` knows
 * how a slot looks, and neither of them knows what a save is.
 *
 * The poster is a second instance of that same molecule and nothing new at that
 * rung: what is new here is only that a **Movie** has a second kind of file, and
 * what that one offers a file dialog.
 *
 * The **Subtitle** rows the prototype draws under these two arrive with #104.
 */
export function MovieFormFiles({
  video,
  onPickVideo,
  onRemoveVideo,
  poster,
  onPickPoster,
  onRemovePoster,
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
    </Card>
  );
}
