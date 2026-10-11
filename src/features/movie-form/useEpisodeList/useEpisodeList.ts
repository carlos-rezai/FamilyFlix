import { useCallback, useMemo, useRef, useState } from 'react';

import type { EpisodeFormRow, MovieFormSubtitle } from '@/types';
import { pickedFile, pickedSubtitle } from '../formValues/formValues';
import { readEpisodeTag } from '../readEpisodeTag/readEpisodeTag';

export interface EpisodeList {
  /** The rows, in the order they landed — never re-sorted on an edit. */
  episodes: EpisodeFormRow[];
  /**
   * Append a pick: its tagged files in tag order, prefilled from the tag, then
   * its untagged ones, each the next free number in season 1.
   */
  addEpisodeFiles: (files: readonly File[]) => void;
  /**
   * Put a held series' rows in place of the list — the **Series edit job**'s
   * opening, each row under its episode's id with **Stored file** slots — or
   * the **Series Resolve**'s found rows, with the `season x number` pairs a
   * joined series holds already, which the gate then refuses.
   */
  holdEpisodes: (
    rows: readonly EpisodeFormRow[],
    taken?: readonly string[]
  ) => void;
  setSeason: (key: string, season: string) => void;
  setNumber: (key: string, number: string) => void;
  setEpisodeTitle: (key: string, title: string) => void;
  removeEpisode: (key: string) => void;
  /** Append a picked track to the row holding `rowKey`, in English. */
  addEpisodeSubtitle: (rowKey: string, file: File) => void;
  changeEpisodeSubtitleLanguage: (
    rowKey: string,
    subtitleKey: string,
    language: string
  ) => void;
  removeEpisodeSubtitle: (rowKey: string, subtitleKey: string) => void;
  /**
   * The series half of the **Save gate**: at least one row, every season and
   * number at least 1, no (season, number) pair twice, and none a joined
   * series holds.
   */
  episodesComplete: boolean;
}

/** A typed number as the count it is, or `null` for one that is not ≥ 1. */
function counted(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return value >= 1 ? value : null;
}

/** The smallest number at least 1 that season 1 does not hold yet. */
function nextFreeInSeasonOne(taken: Set<number>): number {
  let number = 1;
  while (taken.has(number)) {
    number += 1;
  }
  return number;
}

/** The **Movie form**'s episode list: keyed rows, read off a pick's tags. */
export function useEpisodeList(): EpisodeList {
  const [episodes, setEpisodes] = useState<EpisodeFormRow[]>([]);
  const [taken, setTaken] = useState<ReadonlySet<string>>(() => new Set());
  const nextKey = useRef(0);

  const addEpisodeFiles = useCallback((files: readonly File[]) => {
    const keyed = files.map((file) => {
      nextKey.current += 1;
      return { key: `episode-${nextKey.current}`, file };
    });

    setEpisodes((current) => {
      const tagged: { row: EpisodeFormRow; season: number; number: number }[] =
        [];
      const untagged: { key: string; file: File }[] = [];
      for (const { key, file } of keyed) {
        // A pick is a Show folder's root, so the Episode word reads as season 1.
        const tag = readEpisodeTag(file.name, 1);
        if (tag === null) {
          untagged.push({ key, file });
          continue;
        }
        tagged.push({
          season: tag.season,
          number: tag.number,
          row: {
            key,
            file: pickedFile(file),
            season: String(tag.season),
            number: String(tag.number),
            title: tag.title ?? '',
            subtitles: [],
          },
        });
      }
      tagged.sort((a, b) => a.season - b.season || a.number - b.number);

      const added = tagged.map(({ row }) => row);
      const seasonOne = new Set<number>();
      for (const row of [...current, ...added]) {
        const number = counted(row.number);
        if (counted(row.season) === 1 && number !== null) {
          seasonOne.add(number);
        }
      }
      for (const { key, file } of untagged) {
        const number = nextFreeInSeasonOne(seasonOne);
        seasonOne.add(number);
        added.push({
          key,
          file: pickedFile(file),
          season: '1',
          number: String(number),
          title: '',
          subtitles: [],
        });
      }
      return [...current, ...added];
    });
  }, []);

  const holdEpisodes = useCallback(
    (rows: readonly EpisodeFormRow[], held: readonly string[] = []) => {
      setEpisodes([...rows]);
      setTaken(new Set(held));
    },
    []
  );

  const edit = useCallback(
    (key: string, change: Partial<EpisodeFormRow>) =>
      setEpisodes((current) =>
        current.map((row) => (row.key === key ? { ...row, ...change } : row))
      ),
    []
  );

  const setSeason = useCallback(
    (key: string, season: string) => edit(key, { season }),
    [edit]
  );
  const setNumber = useCallback(
    (key: string, number: string) => edit(key, { number }),
    [edit]
  );
  const setEpisodeTitle = useCallback(
    (key: string, title: string) => edit(key, { title }),
    [edit]
  );
  const removeEpisode = useCallback(
    (key: string) =>
      setEpisodes((current) => current.filter((row) => row.key !== key)),
    []
  );

  const editSubtitles = useCallback(
    (
      rowKey: string,
      change: (subtitles: MovieFormSubtitle[]) => MovieFormSubtitle[]
    ) =>
      setEpisodes((current) =>
        current.map((row) =>
          row.key === rowKey
            ? { ...row, subtitles: change(row.subtitles) }
            : row
        )
      ),
    []
  );

  const addEpisodeSubtitle = useCallback(
    (rowKey: string, file: File) => {
      nextKey.current += 1;
      const key = `episode-subtitle-${nextKey.current}`;
      editSubtitles(rowKey, (subtitles) => [
        ...subtitles,
        pickedSubtitle(key, file),
      ]);
    },
    [editSubtitles]
  );
  const changeEpisodeSubtitleLanguage = useCallback(
    (rowKey: string, subtitleKey: string, language: string) =>
      editSubtitles(rowKey, (subtitles) =>
        subtitles.map((subtitle) =>
          subtitle.key === subtitleKey ? { ...subtitle, language } : subtitle
        )
      ),
    [editSubtitles]
  );
  const removeEpisodeSubtitle = useCallback(
    (rowKey: string, subtitleKey: string) =>
      editSubtitles(rowKey, (subtitles) =>
        subtitles.filter((subtitle) => subtitle.key !== subtitleKey)
      ),
    [editSubtitles]
  );

  const episodesComplete = useMemo(() => {
    if (episodes.length === 0) {
      return false;
    }
    const seen = new Set<string>();
    for (const row of episodes) {
      const season = counted(row.season);
      const number = counted(row.number);
      if (season === null || number === null) {
        return false;
      }
      const pair = `${season}x${number}`;
      if (seen.has(pair) || taken.has(pair)) {
        return false;
      }
      seen.add(pair);
    }
    return true;
  }, [episodes, taken]);

  return {
    episodes,
    addEpisodeFiles,
    holdEpisodes,
    setSeason,
    setNumber,
    setEpisodeTitle,
    removeEpisode,
    addEpisodeSubtitle,
    changeEpisodeSubtitleLanguage,
    removeEpisodeSubtitle,
    episodesComplete,
  };
}
