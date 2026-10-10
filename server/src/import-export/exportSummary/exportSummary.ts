import { join } from 'node:path';

import type { LibraryStorage } from '../../library';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import { exportName } from '../exportName/exportName';
import type { ExportSummary } from '@/types';

/**
 * The **Export summary** the **Export dialog** reads on open: how many films,
 * series and episodes an export would carry — the series and the episode
 * total off the Series tab's one read — where _Save to_ starts, and the
 * **Export name** an export made `now` would take.
 *
 * _Save to_ starts at the first **Library folder**, in the order added, that
 * `readableFolder` calls readable now, else `<home>\Downloads`. Answers a
 * value and never throws; the route hands it the home folder and the clock.
 */
export async function exportSummary(
  storage: LibraryStorage,
  home: string,
  now: Date
): Promise<ExportSummary> {
  const { series, episodeCount } = storage.getSeriesHome({ sort: 'a-z' });
  return {
    movieCount: storage.countMovies(),
    seriesCount: series.length,
    episodeCount,
    defaultDestination: await defaultDestination(storage, home),
    defaultName: exportName(now),
  };
}

/** The first listed folder that can be read now, else the home's Downloads. */
async function defaultDestination(
  storage: LibraryStorage,
  home: string
): Promise<string> {
  for (const folder of storage.libraryFolders()) {
    if ((await readableFolder(folder.path)) === 'readable') {
      return folder.path;
    }
  }
  return join(home, 'Downloads');
}
