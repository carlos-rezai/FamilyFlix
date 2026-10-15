import { useCallback, useMemo, useState } from 'react';

import type { EpisodeFormRow, MovieFormFile, SeasonPosterSlot } from '@/types';
import { pickedFile, typedNumber } from '../formValues/formValues';

export interface SeasonPosters {
  /**
   * One slot per **Season** the episode rows hold, in season order, appearing
   * and going with the rows — none while the list is not drawn.
   */
  slots: SeasonPosterSlot[];
  /** Put artwork chosen off the disk into a season's poster slot. */
  pick: (season: number, file: File) => void;
  /** Empty a season's poster slot; a held poster goes on save. */
  remove: (season: number) => void;
  /**
   * Put a record's held **Season posters** in place of the slots' contents —
   * the **Series edit job**'s opening, each one `held` — once the form's reads
   * land, as `holdEpisodes` does the rows.
   */
  hold: (posters: Readonly<Record<number, MovieFormFile>>) => void;
}

/** What one season's slot holds, and whether the edit opened with a poster. */
type SlotContents = Omit<SeasonPosterSlot, 'season'>;

/**
 * The series' _Season posters_, `useEpisodeList`'s pattern: a slice of the
 * **Movie form**'s state in a hook of its own. Each slot is keyed by season,
 * so a row renumbered into another season finds that season's slot, and a
 * slot whose last row leaves goes with it — its contents kept should a row
 * come back. `drawn` is `false` for a **Series Resolve**, whose save has no
 * Season poster to send.
 */
export function useSeasonPosters(
  episodes: readonly EpisodeFormRow[],
  drawn: boolean
): SeasonPosters {
  const [contents, setContents] = useState<
    Readonly<Record<number, SlotContents>>
  >({});

  const pick = useCallback((season: number, file: File) => {
    setContents((current) => ({
      ...current,
      [season]: {
        poster: pickedFile(file),
        held: current[season]?.held ?? false,
      },
    }));
  }, []);

  const remove = useCallback((season: number) => {
    setContents((current) => ({
      ...current,
      [season]: { poster: null, held: current[season]?.held ?? false },
    }));
  }, []);

  const hold = useCallback(
    (posters: Readonly<Record<number, MovieFormFile>>) => {
      setContents(
        Object.fromEntries(
          Object.entries(posters).map(([season, poster]) => [
            season,
            { poster, held: true },
          ])
        )
      );
    },
    []
  );

  const slots = useMemo<SeasonPosterSlot[]>(() => {
    if (!drawn) {
      return [];
    }
    const seasons = new Set(
      episodes.flatMap((row) => {
        const season = typedNumber(row.season);
        return season === null ? [] : [season];
      })
    );
    return [...seasons]
      .sort((a, b) => a - b)
      .map((season) => ({
        season,
        poster: contents[season]?.poster ?? null,
        held: contents[season]?.held ?? false,
      }));
  }, [episodes, drawn, contents]);

  return { slots, pick, remove, hold };
}
