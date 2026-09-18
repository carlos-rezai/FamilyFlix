import { formatBytes } from '@/utils';

import { useStorageReport } from '../useStorageReport/useStorageReport';
import { GroupHeading, ItemTitle } from '../section.styles';
import {
  Bytes,
  Dot,
  Folder,
  FolderText,
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
 * No _Change…_: a control whose mechanism does not exist is not drawn, so the
 * title and path stand alone on their line.
 *
 * The section owns `useStorageReport`. **Blank until it lands**: the path and
 * the space line are drawn from the report and not before — the title alone
 * while it is `null`, and left so if it never lands.
 */
export function StorageSection() {
  const { report } = useStorageReport();

  return (
    <>
      <GroupHeading>Storage</GroupHeading>
      <StorageCard>
        <Folder>
          <FolderText>
            <ItemTitle>Managed media folder</ItemTitle>
            {report ? <Path>{report.mediaPath}</Path> : null}
          </FolderText>
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
