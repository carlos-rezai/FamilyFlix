import { FilePicker } from '@/primitives';
import type { MovieFormFile } from '@/types';

import { VIDEO_ACCEPT, VIDEO_CHOOSE, VIDEO_LABEL } from '../filesCard';
import {
  Choice,
  ChoiceLabel,
  Option,
  OptionDot,
  OptionName,
  Options,
} from './FoundFileChoice.styles';

export interface FoundFileChoiceProps {
  /** The folder's videos, one **Found file** slot each, in name order. */
  videos: MovieFormFile[];
  /** What is in the video slot, or `null` while it is empty. */
  video: MovieFormFile | null;
  /** Reports the found video chosen. */
  onChoose: (video: MovieFormFile) => void;
  /** Reports a film picked from somewhere else — the `File` itself. */
  onPick: (file: File) => void;
}

/** Whether the slot holds this found video. */
const holds = (video: MovieFormFile | null, found: MovieFormFile): boolean =>
  video?.kind === 'found' &&
  found.kind === 'found' &&
  video.path === found.path;

/**
 * The **Found-file choice**: a film Resolve's videos by name as a radio group
 * named _Video_, the one in the slot checked, and the picker kept under them
 * for a film from somewhere else — whose pick joins the group as its last row,
 * chosen. It draws in the video slot's place; which slot it is and what the
 * pick becomes are the Files card's and the form's.
 */
export function FoundFileChoice({
  videos,
  video,
  onChoose,
  onPick,
}: FoundFileChoiceProps) {
  return (
    <Choice>
      <ChoiceLabel>{VIDEO_LABEL}</ChoiceLabel>
      <Options role="radiogroup" aria-label={VIDEO_LABEL}>
        {videos.map((found) => {
          const selected = holds(video, found);
          return (
            <Option
              key={found.kind === 'picked' ? found.filename : found.path}
              type="button"
              role="radio"
              aria-checked={selected}
              $selected={selected}
              onClick={() => onChoose(found)}
            >
              <OptionDot $selected={selected} />
              <OptionName>{found.filename}</OptionName>
            </Option>
          );
        })}
        {video !== null && video.kind !== 'found' && (
          <Option type="button" role="radio" aria-checked $selected>
            <OptionDot $selected />
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
