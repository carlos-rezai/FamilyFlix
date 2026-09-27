import { useState } from 'react';

import { Button } from '@/primitives';
import type {
  ConflictChoices,
  ConflictField,
  FieldChoice,
  FieldConflict,
} from '@/types';
import {
  Actions,
  Caption,
  Frame,
  Label,
  Row,
  Side,
  Value,
} from './FieldDiff.styles';

export interface FieldDiffProps {
  fields: FieldConflict[];
  onApply: (choices: ConflictChoices) => void;
  onKeepAll: () => void;
}

/**
 * The `conflict` face of a **Decision row**, from `feat.EnrichmentFlow.dc.html`:
 * one _Yours | TMDB_ row per **Field conflict**, every field on TMDB until a
 * press chooses otherwise, then _Apply choices_ and _Keep all mine_. It holds
 * the choices and reports them; it writes nothing.
 */
export function FieldDiff({ fields, onApply, onKeepAll }: FieldDiffProps) {
  const [chosen, setChosen] = useState<ConflictChoices>({});
  const choiceOf = (field: ConflictField): FieldChoice =>
    chosen[field] ?? 'tmdb';
  const choose = (field: ConflictField, side: FieldChoice) =>
    setChosen((before) => ({ ...before, [field]: side }));

  function apply() {
    const choices: ConflictChoices = {};
    for (const { field } of fields) choices[field] = choiceOf(field);
    onApply(choices);
  }

  return (
    <>
      <Frame>
        {fields.map(({ field, label, mine, tmdb }) => (
          <Row key={field}>
            <Label>{label}</Label>
            <Side
              type="button"
              $chosen={choiceOf(field) === 'mine'}
              aria-pressed={choiceOf(field) === 'mine'}
              onClick={() => choose(field, 'mine')}
            >
              <Caption>Yours</Caption>
              <Value>{mine}</Value>
            </Side>
            <Side
              type="button"
              $chosen={choiceOf(field) === 'tmdb'}
              aria-pressed={choiceOf(field) === 'tmdb'}
              onClick={() => choose(field, 'tmdb')}
            >
              <Caption>TMDB</Caption>
              <Value>{tmdb}</Value>
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
