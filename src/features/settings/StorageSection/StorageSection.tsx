import { useState } from 'react';

import { folderBridge } from '@/api/folderBridge/folderBridge';
import { formatBytes } from '@/utils';

import { useStorageReport } from '../useStorageReport/useStorageReport';
import { GroupHeading, ItemTitle } from '../section.styles';
import {
  Bytes,
  Dot,
  Folder,
  FolderText,
  OpenFolder,
  Path,
  SpaceLine,
  StorageCard,
} from './StorageSection.styles';

/** `1 title`, `12 titles`. */
const titles = (count: number) =>
  `${count} ${count === 1 ? 'title' : 'titles'}`;

/**
 * The Settings hub's Storage **Settings group**, from
 * `page.SettingsPage.dc.html`: the `Storage` **Group heading** over a
 * **Section card** that puts a number on the **Managed media directory**
 * which agrees with Explorer. _Managed media folder_ with the folder's
 * absolute path under it in mono, on one line with an ellipsis when long;
 * under it the space line — **Space used** in bold, _of movies_, a faint `·`,
 * and `N titles`.
 *
 * _Open folder_ ends the folder line in the desktop app: a `secondary`, `sm`
 * button that asks the **Folder bridge**'s `openMedia()` — no argument, the
 * renderer never names a path — and shows nothing after: no busy state, no
 * snackbar, no error face, since main logs any failure to the **Shell log**.
 * It is a control, not a read, so it is drawn before the report lands. A
 * browser has no bridge, and the title and path stand alone on their line.
 *
 * The section owns `useStorageReport`. **Blank until it lands**: the path and
 * the space line are drawn from the report and not before — the title alone
 * while it is `null`, and left so if it never lands.
 */
export function StorageSection() {
  const { report } = useStorageReport();
  const [bridge] = useState(folderBridge);

  return (
    <>
      <GroupHeading>Storage</GroupHeading>
      <StorageCard>
        <Folder>
          <FolderText>
            <ItemTitle>Managed media folder</ItemTitle>
            {report ? <Path>{report.mediaPath}</Path> : null}
          </FolderText>
          {bridge ? (
            <OpenFolder
              label="Open folder"
              variant="secondary"
              size="sm"
              onClick={() => void bridge.openMedia()}
            />
          ) : null}
        </Folder>
        {report ? (
          <SpaceLine>
            <Bytes>{formatBytes(report.bytesUsed)}</Bytes> of movies{' '}
            <Dot>·</Dot> {titles(report.movieCount)}
          </SpaceLine>
        ) : null}
      </StorageCard>
    </>
  );
}
