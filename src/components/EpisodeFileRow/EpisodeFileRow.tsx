import type { ReactNode } from 'react';

import { RemoveButton } from '@/primitives';

import {
  Card,
  Children,
  Controls,
  Filename,
  NumberInput,
  Tag,
  TitleInput,
} from './EpisodeFileRow.styles';

export interface EpisodeFileRowProps {
  /** The name of the episode's video file, drawn in mono under the controls. */
  filename: string;
  /** The season as typed: digits, at most two. */
  season: string;
  /** The episode number as typed: digits, at most three. */
  number: string;
  /** The episode's title; empty reads _Untitled episode_. */
  title: string;
  onSeasonChange: (season: string) => void;
  onNumberChange: (number: string) => void;
  onTitleChange: (title: string) => void;
  /** Reports that the ✕ was pressed. */
  onRemove: () => void;
  /** The row's subtitles, under the filename. */
  children?: ReactNode;
}

/** The most digits a season can have. */
const SEASON_LENGTH = 2;

/** The most digits an episode number can have. */
const NUMBER_LENGTH = 3;

/** A typed value held to digits, at most `length` of them. */
const digits = (value: string, length: number): string =>
  value.replace(/\D/g, '').slice(0, length);

/**
 * One **Episode file row**, from `mol.EpisodeFileRow.dc.html`: an `S` field, an
 * `E` field, the title and the ✕, the filename in mono under them, then a
 * children slot. Presentational — it holds nothing and knows no series.
 */
export function EpisodeFileRow({
  filename,
  season,
  number,
  title,
  onSeasonChange,
  onNumberChange,
  onTitleChange,
  onRemove,
  children,
}: EpisodeFileRowProps) {
  return (
    <Card>
      <Controls>
        <Tag>
          S
          <NumberInput
            value={season}
            aria-label="Season"
            inputMode="numeric"
            onChange={(event) =>
              onSeasonChange(digits(event.target.value, SEASON_LENGTH))
            }
          />
        </Tag>
        <Tag>
          E
          <NumberInput
            value={number}
            aria-label="Episode"
            inputMode="numeric"
            onChange={(event) =>
              onNumberChange(digits(event.target.value, NUMBER_LENGTH))
            }
          />
        </Tag>
        <TitleInput
          value={title}
          aria-label="Episode title"
          placeholder="Untitled episode"
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <RemoveButton removes={filename} onClick={onRemove} />
      </Controls>
      <Filename>{filename}</Filename>
      <Children>{children}</Children>
    </Card>
  );
}
