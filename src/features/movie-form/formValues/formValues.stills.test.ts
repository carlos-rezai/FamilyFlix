import { describe, it, expect } from 'vitest';

import type { EpisodeFormRow, ShowFolderRead } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  foundFile,
  movieFormValues,
  seriesFormData,
  showFolderRows,
} from './formValues';

/**
 * 76, Whole add, Phase 3 (issue #718): a show's found Stills on the form.
 *
 * `showFolderRows` sets each row's **Still** as a **Found file** of the read's
 * `still` (`null` for none). On the save a found Still travels as its
 * `episode` field's `stillPath`, never as bytes.
 */

const SHOW = 'E:\\Shows\\The Show (2019)';
const PILOT = `${SHOW}\\Season 01\\The.Show.S01E01.mkv`;
const SECOND = `${SHOW}\\Season 01\\The.Show.S01E02.mkv`;
const PILOT_STILL = `${SHOW}\\Season 01\\Images\\Stills\\S01E01.jpg`;

const READ: ShowFolderRead = {
  path: SHOW,
  title: 'The Show',
  year: 2019,
  libraryFolderId: 'shows',
  heldSeriesId: null,
  poster: null,
  backdrop: null,
  seasonPosters: [],
  episodes: [
    {
      season: 1,
      number: 1,
      title: null,
      video: PILOT,
      relativePath: 'Season 01/The.Show.S01E01.mkv',
      subtitles: [],
      still: PILOT_STILL,
    },
    {
      season: 1,
      number: 2,
      title: null,
      video: SECOND,
      relativePath: 'Season 01/The.Show.S01E02.mkv',
      subtitles: [],
      still: null,
    },
  ],
  unplaced: [],
  straySubtitles: 0,
};

describe('showFolderRows: the Stills', () => {
  it('sets each row’s Still as a Found file, or null for none', () => {
    expect(showFolderRows(READ).map((row) => row.still)).toEqual([
      { kind: 'found', path: PILOT_STILL, filename: 'S01E01.jpg' },
      null,
    ]);
  });
});

describe('seriesFormData: a found Still', () => {
  const row: EpisodeFormRow = {
    key: 'show-folder-episode-0',
    file: foundFile(PILOT, 'Season 01/The.Show.S01E01.mkv'),
    season: '1',
    number: '1',
    title: '',
    subtitles: [],
    still: foundFile(PILOT_STILL),
  };

  it('sends a found Still as the episode field’s stillPath, and no bytes', () => {
    const body = seriesFormData(
      movieFormValues(makeMovie()),
      [row],
      [],
      'link'
    );

    const [episode] = body.getAll('episode');
    expect(JSON.parse(episode as string)).toMatchObject({
      videoPath: PILOT,
      stillPath: PILOT_STILL,
    });
    expect(body.getAll('episodeStill')).toEqual([]);
  });
});
