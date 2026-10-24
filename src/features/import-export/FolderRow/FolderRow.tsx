import { FolderIcon, RemoveButton } from '@/primitives';
import type { LibraryFolderView } from '@/types';
import { folderLine } from '../folderLine/folderLine';
import {
  BringBack,
  LeftOutLine,
  Line,
  Path,
  Row,
  Text,
  Tile,
} from './FolderRow.styles';

export interface FolderRowProps {
  /** The folder the row draws. */
  folder: LibraryFolderView;
  /**
   * What to do when _Bring back_ is pressed on the left-out line.
   */
  onBringBack: () => void;
  /**
   * What to do when the ✕ is pressed — the row knows nothing of what follows.
   */
  onRemove: () => void;
}

/**
 * One **Folder row**, `mol.FolderRow.dc.html` in `CodecRow`'s shape: the 40px
 * tile with the folder glyph, the path in mono, the line — _N titles_, or
 * _Can't be reached right now_ in `danger` for an **Unreachable** folder —
 * and the `RemoveButton`, labelled _Remove `<path>`_. A folder with **Left-out
 * videos** draws a second line, _N videos left out_ with _Bring back_.
 */
export function FolderRow({ folder, onBringBack, onRemove }: FolderRowProps) {
  return (
    <Row>
      <Tile>
        <FolderIcon size={20} />
      </Tile>
      <Text>
        <Path>{folder.path}</Path>
        <Line $unreachable={!folder.reachable}>{folderLine(folder)}</Line>
        {folder.leftOut > 0 ? (
          <LeftOutLine>
            <span>{`${folder.leftOut} ${folder.leftOut === 1 ? 'video' : 'videos'} left out`}</span>
            <BringBack type="button" onClick={onBringBack}>
              Bring back
            </BringBack>
          </LeftOutLine>
        ) : null}
      </Text>
      <RemoveButton removes={folder.path} onClick={onRemove} />
    </Row>
  );
}
