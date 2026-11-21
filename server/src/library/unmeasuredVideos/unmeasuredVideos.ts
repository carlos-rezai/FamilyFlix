import type { StoredVideo, VideoQuality } from '@/types';

import type { SqliteDatabase } from '../../db';

/** Which table an {@link UnmeasuredVideo} is a row of. */
export type MeasuredKind = 'movie' | 'episode';

/** One held movie or episode with no **Video quality** yet. */
export interface UnmeasuredVideo extends StoredVideo {
  kind: MeasuredKind;
  id: string;
}

/** The **Quality sweep**'s slice: what it reads and its one written column. */
export interface UnmeasuredVideosRepository {
  unmeasuredVideos(): UnmeasuredVideo[];
  recordVideoQuality(
    kind: MeasuredKind,
    id: string,
    quality: VideoQuality
  ): void;
}

interface UnmeasuredRow {
  kind: MeasuredKind;
  id: string;
  video_path: string;
  video_folder_id: string | null;
}

export function createUnmeasuredVideos(
  db: SqliteDatabase
): UnmeasuredVideosRepository {
  const selectMovies = db.prepare(
    `SELECT 'movie' AS kind, m.id, m.video_path, m.video_folder_id
     FROM movies m WHERE m.video_quality IS NULL
     ORDER BY m.title COLLATE NOCASE, m.id`
  );
  const selectEpisodes = db.prepare(
    `SELECT 'episode' AS kind, e.id, e.video_path, e.video_folder_id
     FROM episodes e JOIN series s ON s.id = e.series_id
     WHERE e.video_quality IS NULL
     ORDER BY s.title COLLATE NOCASE, s.id, e.season_number, e.episode_number`
  );
  const updateMovie = db.prepare(
    'UPDATE movies SET video_quality = ? WHERE id = ?'
  );
  const updateEpisode = db.prepare(
    'UPDATE episodes SET video_quality = ? WHERE id = ?'
  );

  return {
    unmeasuredVideos() {
      const rows = [
        ...(selectMovies.all() as UnmeasuredRow[]),
        ...(selectEpisodes.all() as UnmeasuredRow[]),
      ];
      return rows.map((row) => ({
        kind: row.kind,
        id: row.id,
        videoPath: row.video_path,
        videoFolderId: row.video_folder_id,
      }));
    },
    recordVideoQuality(kind, id, quality) {
      (kind === 'movie' ? updateMovie : updateEpisode).run(quality, id);
    },
  };
}
