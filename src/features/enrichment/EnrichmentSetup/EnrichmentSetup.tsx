import type { EnrichField, EnrichmentSummary, EnrichScope } from '@/types';
import { BangRingIcon, Button, Chip } from '@/primitives';
import { enrichmentEstimate } from '../enrichmentView/enrichmentView';
import {
  Banner,
  BannerAction,
  BannerGlyph,
  BannerLine,
  BannerText,
  BannerTitle,
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
  description: (summary: EnrichmentSummary) => string;
}> = [
  {
    scope: 'missing',
    label: 'Only what’s missing',
    description: ({ total, complete }) =>
      `${total - complete} titles have no synopsis or artwork`,
  },
  {
    scope: 'all',
    label: 'Everything',
    description: ({ total }) =>
      `${total} titles — re-checks ones already filled in`,
  },
];

export interface EnrichmentSetupProps {
  /** The scope chosen — `single` draws _Just this movie_ alone. */
  scope: EnrichScope;
  /** What the library and the connection are, as the server read them. */
  summary: EnrichmentSummary;
  /** The film's title, once read — the _Just this movie_ card's line. */
  title: string | null;
  /** The chips that are on. */
  fields: readonly EnrichField[];
  onChooseScope: (scope: EnrichScope) => void;
  onToggleField: (field: EnrichField) => void;
  onStart: () => void;
  /** The offline banner's _Retry_. */
  onRetry: () => void;
  /** The key banner's _Open Network settings_. */
  onOpenKeySettings: () => void;
}

/**
 * The **Setup step**, from `feat.EnrichmentFlow.dc.html`: the offline banner
 * and the key banner when either applies, the scope cards —
 * _Only what's missing_ and _Everything_ for the library, or _Just this
 * movie_ in their place for one film — the field chips with the rating note,
 * and Start: _Start sync_, or _Fetch details_ with its estimate for one film.
 */
export function EnrichmentSetup({
  scope,
  summary,
  title,
  fields,
  onChooseScope,
  onToggleField,
  onStart,
  onRetry,
  onOpenKeySettings,
}: EnrichmentSetupProps) {
  const single = scope === 'single';
  const ready = summary.keySet && summary.online;
  return (
    <Stack>
      {summary.online ? null : (
        <Banner $tone="danger">
          <BannerGlyph>
            <BangRingIcon size={20} />
          </BannerGlyph>
          <BannerText>
            <BannerTitle>No internet connection</BannerTitle>
            <BannerLine>
              FamilyFlix works fine offline — this is the one feature that needs
              the network. Everything already in your library stays available.
            </BannerLine>
          </BannerText>
          <BannerAction>
            <Button
              label="Retry"
              variant="secondary"
              size="md"
              onClick={onRetry}
            />
          </BannerAction>
        </Banner>
      )}
      {summary.keySet ? null : (
        <Banner $tone="accent">
          <BannerText>
            <BannerTitle>A TMDB API key is needed first</BannerTitle>
            <BannerLine>
              It’s free and takes a minute. Paste it under Settings → Network,
              and it stays on this machine.
            </BannerLine>
          </BannerText>
          <BannerAction>
            <Button
              label="Open Network settings"
              variant="primary"
              size="md"
              onClick={onOpenKeySettings}
            />
          </BannerAction>
        </Banner>
      )}

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
                  <ScopeDescription>
                    {each.description(summary)}
                  </ScopeDescription>
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
          variant={ready ? 'primary' : 'secondary'}
          size="md"
          onClick={onStart}
        />
        <Estimate>{enrichmentEstimate(summary, scope)}</Estimate>
      </StartRow>
    </Stack>
  );
}
