import { useState } from 'react';

import { Button } from '@/primitives';
import {
  Actions,
  Caption,
  Frame,
  Label,
  Row,
  Side,
  Value,
} from './FieldDiff.styles';

/** The side a row is left on: ours, or the other source's. */
export type FieldDiffSide = 'mine' | 'theirs';

/** One differing field: its key, its label, and both sides spelled. */
export interface FieldDiffRow<K extends string> {
  key: K;
  label: string;
  mine: string;
  theirs: string;
}

export interface FieldDiffProps<K extends string> {
  rows: FieldDiffRow<K>[];
  /** The other side's caption: _TMDB_ or _Spreadsheet_. */
  theirsLabel: string;
  onApply: (choices: Partial<Record<K, FieldDiffSide>>) => void;
  onKeepAll: () => void;
}

/**
 * `mol.FieldDiff.dc.html`: one _Yours | {theirsLabel}_ row per differing
 * field, every row on the theirs side until a press chooses otherwise, then
 * _Apply choices_ and _Keep all mine_. Presentational: it holds the choices
 * and reports them keyed by each row's key; each caller maps its own wire
 * type on and off it.
 */
export function FieldDiff<K extends string>({
  rows,
  theirsLabel,
  onApply,
  onKeepAll,
}: FieldDiffProps<K>) {
  const [chosen, setChosen] = useState<Partial<Record<K, FieldDiffSide>>>({});
  const sideOf = (key: K): FieldDiffSide => chosen[key] ?? 'theirs';
  const choose = (key: K, side: FieldDiffSide) =>
    setChosen((before) => ({ ...before, [key]: side }));

  function apply() {
    const choices: Partial<Record<K, FieldDiffSide>> = {};
    for (const { key } of rows) choices[key] = sideOf(key);
    onApply(choices);
  }

  return (
    <>
      <Frame>
        {rows.map(({ key, label, mine, theirs }) => (
          <Row key={key}>
            <Label>{label}</Label>
            <Side
              type="button"
              $chosen={sideOf(key) === 'mine'}
              aria-pressed={sideOf(key) === 'mine'}
              onClick={() => choose(key, 'mine')}
            >
              <Caption>Yours</Caption>
              <Value>{mine}</Value>
            </Side>
            <Side
              type="button"
              $chosen={sideOf(key) === 'theirs'}
              aria-pressed={sideOf(key) === 'theirs'}
              onClick={() => choose(key, 'theirs')}
            >
              <Caption>{theirsLabel}</Caption>
              <Value>{theirs}</Value>
            </Side>
          </Row>
        ))}
      </Frame>
      <Actions>
        <Button
          label="Apply choices"
          variant="primary"
          size="md"
          onClick={apply}
        />
        <Button
          label="Keep all mine"
          variant="secondary"
          size="md"
          onClick={onKeepAll}
        />
      </Actions>
    </>
  );
}
