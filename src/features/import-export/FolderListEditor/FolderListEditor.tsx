import { useState } from 'react';

import { Button, FolderIcon, TextField } from '@/primitives';
import { folderBridge } from '@/api/folderBridge/folderBridge';
import type { LibraryFolderView } from '@/types';
import { FolderRow } from '../FolderRow/FolderRow';
import type { LibraryFoldersState } from '../useLibraryFolders/useLibraryFolders';
import {
  Card,
  Divider,
  Empty,
  PathRow,
  Refusal,
  Rows,
} from './FolderListEditor.styles';

export type FolderListEditorProps = Omit<LibraryFoldersState, 'folders'> & {
  /** The listed folders, landed — the caller draws nothing while `null`. */
  folders: LibraryFolderView[];
};

/**
 * The **Library folders** list, editable: one **Folder row** per listed
 * folder (or _No folders yet._), a divider, and the add row — a mono
 * `TextField` with the folder glyph, _Add_, and in the desktop app
 * _Browse…_, the system folder dialog, each picked folder posted in order as
 * if it had been typed. A refused add is one 13px `danger` line under the
 * field, the typed path kept; a refused remove the same line under its row.
 * _Add_ locks from the press and reads _Adding…_ once the add has run 300ms,
 * on the **Loader timing**; _Browse…_ is disabled until the add settles.
 *
 * The list is the caller's `useLibraryFolders()`, handed in, because the
 * caller decides what a listed folder enables — **Scan folders** on the
 * Library folders page, _Start import_ in Import setup.
 */
export function FolderListEditor({
  folders,
  add,
  remove,
  bringBack,
  adding,
  refusal,
  removeRefusal,
}: FolderListEditorProps) {
  const [typed, setTyped] = useState('');
  const [bridge] = useState(folderBridge);

  const submit = async () => {
    if (await add(typed.trim())) {
      setTyped('');
    }
  };

  const browse = async () => {
    if (bridge === null) return;
    const picked = await bridge.pick();
    for (const path of picked) {
      await add(path);
    }
  };

  return (
    <Card>
      {folders.length === 0 ? (
        <Empty>No folders yet.</Empty>
      ) : (
        <Rows>
          {folders.map((folder) => (
            <div key={folder.id}>
              <FolderRow
                folder={folder}
                onBringBack={() => {
                  void bringBack(folder.id);
                }}
                onRemove={() => {
                  void remove(folder.id);
                }}
              />
              {removeRefusal?.id === folder.id ? (
                <Refusal>{removeRefusal.sentence}</Refusal>
              ) : null}
            </div>
          ))}
        </Rows>
      )}
      <Divider />
      <PathRow>
        <TextField
          value={typed}
          placeholder="E:\Movies"
          icon={<FolderIcon size={18} />}
          rounded={false}
          mono
          onChange={setTyped}
          aria-label="Folder path"
        />
        <Button
          label="Add"
          variant="secondary"
          size="sm"
          busyLabel="Adding…"
          busy={adding}
          disabled={typed.trim() === ''}
          onClick={() => {
            void submit();
          }}
        />
        {bridge === null ? null : (
          <Button
            label="Browse…"
            variant="secondary"
            size="sm"
            disabled={adding !== 'idle'}
            onClick={() => {
              void browse();
            }}
          />
        )}
      </PathRow>
      {refusal === null ? null : <Refusal>{refusal}</Refusal>}
    </Card>
  );
}
