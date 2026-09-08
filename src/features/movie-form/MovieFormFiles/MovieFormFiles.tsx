import { FileField } from '@/components';
import { VideoIcon } from '@/primitives';
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

/** The caption over the card, and the name of its one slot. */
const CARD_LABEL = 'Files';
const VIDEO_LABEL = 'Video';
const VIDEO_CHOOSE = 'Choose video file';

export interface MovieFormFilesProps {
  /** What is in the video slot, or `null` while it is empty. */
  video: MovieFormFile | null;
  /** Reports the film that was picked — the `File` itself. */
  onPickVideo: (file: File) => void;
  /** Reports that the slot's ✕ was pressed. */
  onRemoveVideo: () => void;
}

/**
 * The Files card of the **Movie form**: the panel the prototype draws under the
 * metadata fields, and this slice's one slot in it.
 *
 * A feature sibling rather than a molecule, on the player's shape — the organism
 * owns the values and this draws one thing it is told. It knows which slots a
 * **Movie** has and what each of them offers a file dialog; `FileField` knows
 * how a slot looks, and neither of them knows what a save is.
 *
 * The **Poster** and **Subtitle** slots the prototype draws beside the video one
 * arrive with #103 and #104.
 */
export function MovieFormFiles({
  video,
  onPickVideo,
  onRemoveVideo,
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
    </Card>
  );
}
