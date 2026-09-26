import type { EnrichField, EnrichScope } from '@/types';
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

/** The two library scopes, as the prototype's `scopeDefs` names them. */
const LIBRARY_SCOPES: ReadonlyArray<{
  scope: Exclude<EnrichScope, 'single'>;
  label: string;
  description: string;
}> = [
  {
    scope: 'missing',
    label: 'Only what’s missing',
    description: 'Titles with no synopsis or artwork',
  },
  {
    scope: 'all',
    label: 'Everything',
    description: 'Every title — re-checks ones already filled in',
  },
];

export interface EnrichmentSetupProps {
  /** The scope chosen — `single` draws _Just this movie_ alone. */
  scope: EnrichScope;
  /** The film's title, once read — the _Just this movie_ card's line. */
  title: string | null;
  /** The chips that are on. */
  fields: readonly EnrichField[];
  onChooseScope: (scope: EnrichScope) => void;
  onToggleField: (field: EnrichField) => void;
  onStart: () => void;
}

/**
 * The **Setup step**, from `feat.EnrichmentFlow.dc.html`: the scope cards —
 * _Only what's missing_ and _Everything_ for the library, or _Just this
 * movie_ in their place for one film — the field chips with the rating note,
 * and Start: _Start sync_, or _Fetch details_ with its estimate for one film.
 */
export function EnrichmentSetup({
  scope,
  title,
  fields,
  onChooseScope,
  onToggleField,
  onStart,
}: EnrichmentSetupProps) {
  const single = scope === 'single';
  return (
    <Stack>
      <div>
        <GroupLabel>What to sync</GroupLabel>
        <Scopes role="radiogroup" aria-label="What to sync">
          {single ? (
            <ScopeCard type="button" role="radio" aria-checked $selected>
              <ScopeTitle>
                <ScopeDot aria-hidden="true" $selected />
                <ScopeLabel>Just this movie</ScopeLabel>
              </ScopeTitle>
              <ScopeDescription>{title ?? ''}</ScopeDescription>
            </ScopeCard>
          ) : (
            LIBRARY_SCOPES.map((each) => {
              const selected = each.scope === scope;
              return (
                <ScopeCard
                  key={each.scope}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  $selected={selected}
                  onClick={() => onChooseScope(each.scope)}
                >
                  <ScopeTitle>
                    <ScopeDot aria-hidden="true" $selected={selected} />
                    <ScopeLabel>{each.label}</ScopeLabel>
                  </ScopeTitle>
                  <ScopeDescription>{each.description}</ScopeDescription>
                </ScopeCard>
              );
            })
          )}
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
        <Button
          label={single ? 'Fetch details' : 'Start sync'}
          variant="primary"
          onClick={onStart}
        />
        {single ? <Estimate>About 1s for 1 title</Estimate> : null}
      </StartRow>
    </Stack>
  );
}
