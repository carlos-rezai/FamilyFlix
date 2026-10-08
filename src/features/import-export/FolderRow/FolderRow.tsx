import { FolderIcon, RemoveButton } from '@/primitives';
import type { LibraryFolder } from '@/types';
import { Line, Path, Row, Text, Tile } from './FolderRow.styles';

export interface FolderRowProps {
  /** The folder the row draws. */
  folder: LibraryFolder;
  /**
   * What to do when the ✕ is pressed — the row knows nothing of what follows.
   */
  onRemove: () => void;
}

/**
 * One **Folder row**, `mol.FolderRow.dc.html` in `CodecRow`'s shape: the 40px
 * tile with the folder glyph, the path in mono, the line — _N titles_, or
 * _Can't be reached right now_ in `danger` for an **Unreachable** folder —
 * and the `RemoveButton`, labelled _Remove `<path>`_.
 */
export function FolderRow({ folder, onRemove }: FolderRowProps) {
  return (
    <Row>
      <Tile>
        <FolderIcon size={20} />
      </Tile>
      <Text>
        <Path>{folder.path}</Path>
        <Line $unreachable={!folder.reachable}>
          {folder.reachable
            ? `${folder.titleCount} titles`
            : 'Can’t be reached right now'}
        </Line>
      </Text>
      <RemoveButton removes={folder.path} onClick={onRemove} />
    </Row>
  );
}
