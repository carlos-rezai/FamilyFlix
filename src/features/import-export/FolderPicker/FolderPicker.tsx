import { FolderIcon } from '@/primitives';
import type { CandidateFolder } from '@/types';
import {
  Body,
  FolderCard,
  Glyph,
  Name,
  Path,
  Picker,
  Videos,
} from './FolderPicker.styles';

export interface FolderPickerProps {
  candidates: readonly CandidateFolder[];
  /** A card pressed, by its folder's path. */
  onPick: (folder: string) => void;
  /** The group's accessible name: `Folders for <title>`. */
  label: string;
}

/** _1 video_ in the singular, _N videos_ otherwise. */
const videosLabel = (videos: number): string =>
  videos === 1 ? '1 video' : `${videos} videos`;

/**
 * An `ambiguous` **Problem**'s face, from `feat.ImportFlow.dc.html`: the
 * **Folder picker** — `CandidatePicker`'s shape with its own pixels, one 220px
 * card per **Candidate folder**: the folder glyph, its name, its path in mono
 * and its video count. No poster, no _% match_. It reports a press and holds
 * no state.
 */
export function FolderPicker({ candidates, onPick, label }: FolderPickerProps) {
  return (
    <Picker role="group" aria-label={label}>
      {candidates.map((candidate) => (
        <FolderCard
          key={candidate.path}
          type="button"
          onClick={() => onPick(candidate.path)}
        >
          <Glyph>
            <FolderIcon size={16} />
          </Glyph>
          <Body>
            <Name>{candidate.name}</Name>
            <Path>{candidate.path}</Path>
            <Videos>{videosLabel(candidate.videos)}</Videos>
          </Body>
        </FolderCard>
      ))}
    </Picker>
  );
}
