import { useCallback, useMemo, useRef, useState } from 'react';

import type { EpisodeFormRow, MovieFormSubtitle } from '@/types';
import { readEpisodeTag } from '../readEpisodeTag/readEpisodeTag';

export interface EpisodeList {
  /** The rows, in the order they landed — never re-sorted on an edit. */
  episodes: EpisodeFormRow[];
  /**
   * Append a pick: its tagged files in tag order, prefilled from the tag, then
   * its untagged ones, each the next free number in season 1.
   */
  addEpisodeFiles: (files: readonly File[]) => void;
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
   * number at least 1, and no (season, number) pair twice.
   */
  episodesComplete: boolean;
}

/** The language a picked track lands in — the movie subtitles' rule. */
const DEFAULT_LANGUAGE = 'English';

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
        const tag = readEpisodeTag(file.name);
        if (tag === null) {
          untagged.push({ key, file });
          continue;
        }
        tagged.push({
          season: tag.season,
          number: tag.number,
          row: {
            key,
            file: { kind: 'picked', file, filename: file.name },
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
          file: { kind: 'picked', file, filename: file.name },
          season: '1',
          number: String(number),
          title: '',
          subtitles: [],
        });
      }
      return [...current, ...added];
    });
  }, []);

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
        {
          key,
          file: { kind: 'picked', file, filename: file.name },
          language: DEFAULT_LANGUAGE,
        },
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
      if (seen.has(pair)) {
        return false;
      }
      seen.add(pair);
    }
    return true;
  }, [episodes]);

  return {
    episodes,
    addEpisodeFiles,
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
