import type { EnrichField } from '@/types';
import { Button, Chip } from '@/primitives';
import {
  Chips,
  Estimate,
  GroupLabel,
  RatingNote,
  ScopeCard,
  ScopeDescription,
  ScopeDot,
  ScopeLabel,
  Scopes,
  ScopeTitle,
  Stack,
  Star,
  StartRow,
} from './EnrichmentSetup.styles';

/** The ten chips in the prototype's order, each with its label. */
export const ENRICH_FIELDS: ReadonlyArray<{
  field: EnrichField;
  label: string;
}> = [
  { field: 'synopsis', label: 'Synopsis' },
  { field: 'poster', label: 'Poster' },
  { field: 'backdrop', label: 'Backdrop' },
  { field: 'runtime', label: 'Runtime' },
  { field: 'year', label: 'Year' },
  { field: 'genres', label: 'Genres' },
  { field: 'director', label: 'Director' },
  { field: 'cast', label: 'Cast' },
  { field: 'originalTitle', label: 'Original title' },
  { field: 'tmdbScore', label: 'TMDB score' },
];

export interface EnrichmentSetupProps {
  /** The film's title, once read — the _Just this movie_ card's line. */
  title: string | null;
  /** The chips that are on. */
  fields: readonly EnrichField[];
  onToggleField: (field: EnrichField) => void;
  onStart: () => void;
}

/**
 * The **Setup step** for one film, from `feat.EnrichmentFlow.dc.html`: the
 * _Just this movie_ card in place of the two library scopes, the field chips
 * with the rating note, and Start — _Fetch details_ — with its estimate.
 */
export function EnrichmentSetup({
  title,
  fields,
  onToggleField,
  onStart,
}: EnrichmentSetupProps) {
  return (
    <Stack>
      <div>
        <GroupLabel>What to sync</GroupLabel>
        <Scopes role="radiogroup" aria-label="What to sync">
          <ScopeCard type="button" role="radio" aria-checked $selected>
            <ScopeTitle>
              <ScopeDot aria-hidden="true" $selected />
              <ScopeLabel>Just this movie</ScopeLabel>
            </ScopeTitle>
            <ScopeDescription>{title ?? ''}</ScopeDescription>
          </ScopeCard>
        </Scopes>
      </div>

      <div>
        <GroupLabel>Fields to fill</GroupLabel>
        <Chips>
          {ENRICH_FIELDS.map(({ field, label }) => (
            <Chip
              key={field}
              label={label}
              selected={fields.includes(field)}
              onClick={() => onToggleField(field)}
            />
          ))}
        </Chips>
        <RatingNote>
          <Star>★</Star>Your household rating is yours — TMDB’s score is stored
          beside it, never over it.
        </RatingNote>
      </div>

      <StartRow>
        <Button label="Fetch details" variant="primary" onClick={onStart} />
        <Estimate>About 1s for 1 title</Estimate>
      </StartRow>
    </Stack>
  );
}
