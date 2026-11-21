import { BusyOverlay } from '@/components';
import { useBusyRow } from '@/hooks/useBusyRow/useBusyRow';
import { FolderIcon, RemoveButton } from '@/primitives';
import type { BusyPhase, LibraryFolderView } from '@/types';
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
   * The row's phase on the **Loader timing**, handed by the page: from
   * `waiting` it is locked, once `shown` it draws its **Busy overlay**.
   */
  busy: BusyPhase;
  /**
   * What to do when _Bring back_ is pressed on the left-out line.
   */
  onBringBack: () => void;
  /**
   * What to do when the ✕ is pressed — the row knows nothing of what follows.
   */
  onRemove: () => void;
}

/** The presses a row is timed across, and what its loader reads for each. */
type Press = 'remove' | 'bringBack';
const PRESS_LABELS: Record<Press, string> = {
  remove: 'Removing…',
  bringBack: 'Bringing back…',
};

/**
 * One **Folder row**, `mol.FolderRow.dc.html` in `CodecRow`'s shape: the 40px
 * tile with the folder glyph, the path in mono, the line — _N titles_, or
 * _Can't be reached right now_ in `danger` for an **Unreachable** folder —
 * and the `RemoveButton`, labelled _Remove `<path>`_. A folder with **Left-out
 * videos** draws a second line, _N videos left out_ with _Bring back_.
 *
 * A **Busy row**: from `waiting` its root is `inert` and `aria-busy`, every
 * control keeping its own face, and it refuses a press, as a **Busy button**
 * does; once `shown` it draws its **Busy overlay** last in its root, naming
 * its press over the row, the _N titles_ line kept and the row no taller.
 */
export function FolderRow({
  folder,
  busy,
  onBringBack,
  onRemove,
}: FolderRowProps) {
  const { pressed, label } = useBusyRow(busy, PRESS_LABELS);
  return (
    <Row $busy={busy}>
      <Tile>
        <FolderIcon size={20} />
      </Tile>
      <Text>
        <Path>{folder.path}</Path>
        <Line $unreachable={!folder.reachable}>{folderLine(folder)}</Line>
        {folder.leftOut > 0 ? (
          <LeftOutLine>
            <span>{`${folder.leftOut} ${folder.leftOut === 1 ? 'video' : 'videos'} left out`}</span>
            <BringBack
              type="button"
              onClick={pressed('bringBack', onBringBack)}
            >
              Bring back
            </BringBack>
          </LeftOutLine>
        ) : null}
      </Text>
      <RemoveButton
        removes={folder.path}
        onClick={pressed('remove', onRemove)}
      />
      {label !== null ? <BusyOverlay label={label} /> : null}
    </Row>
  );
}
