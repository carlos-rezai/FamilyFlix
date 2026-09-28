import {
  ENRICH_FIELD_LABELS,
  ENRICH_FIELDS,
  type EnrichField,
  type EnrichmentSummary,
  type EnrichScope,
} from '@/types';
import {
  BangRingIcon,
  Button,
  Chip,
  DatabaseIcon,
  LandscapeIcon,
  TableIcon,
  Toggle,
} from '@/primitives';
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
  SeriesNote,
  SourceNote,
  SourceNoteMono,
  ScopeCard,
  ScopeDescription,
  ScopeDot,
  ScopeLabel,
  Scopes,
  ScopeTitle,
  Stack,
  Star,
  StartRow,
  RequiredPill,
  Target,
  TargetDivider,
  TargetGlyph,
  TargetLine,
  TargetPath,
  Targets,
  TargetText,
  TargetTitle,
} from './EnrichmentSetup.styles';

const SHEET_TITLE = 'Metadata sheet in the collection root';
const POSTERS_TITLE = 'Posters into each movie folder';

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
  /** The two optional **Write targets**' switches, drawn only with a root. */
  writeSheet: boolean;
  writePosters: boolean;
  onToggleSheet: () => void;
  onTogglePosters: () => void;
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
 * _Where it is saved_ with _Your library_ as Required, and Start: _Start sync_, or _Fetch details_ with its estimate for one film.
 */
export function EnrichmentSetup({
  scope,
  summary,
  title,
  fields,
  writeSheet,
  writePosters,
  onToggleSheet,
  onTogglePosters,
  onChooseScope,
  onToggleField,
  onStart,
  onRetry,
  onOpenKeySettings,
}: EnrichmentSetupProps) {
  const single = scope === 'single';
  const ready = summary.keySet && summary.online;
  const root = summary.libraryRoot;
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
          {ENRICH_FIELDS.map((field) => (
            <Chip
              key={field}
              label={ENRICH_FIELD_LABELS[field]}
              selected={fields.includes(field)}
              onClick={() => onToggleField(field)}
            />
          ))}
        </Chips>
        <RatingNote>
          <Star>★</Star>Your household rating is yours — TMDB’s score is stored
          beside it, never over it.
        </RatingNote>
        <SeriesNote>
          Series get the same fields at show level, plus episode titles, air
          dates, and stills for every season found on disk.
        </SeriesNote>
      </div>

      <div>
        <GroupLabel>Where it is saved</GroupLabel>
        <Targets>
          <Target>
            <TargetGlyph>
              <DatabaseIcon size={19} />
            </TargetGlyph>
            <TargetText>
              <TargetTitle>Your library</TargetTitle>
              <TargetLine>Always. This is what the app reads from.</TargetLine>
            </TargetText>
            <RequiredPill>Required</RequiredPill>
          </Target>
          {root === null ? null : (
            <>
              <TargetDivider />
              <Target>
                <TargetGlyph>
                  <TableIcon size={19} />
                </TargetGlyph>
                <TargetText>
                  <TargetTitle>{SHEET_TITLE}</TargetTitle>
                  <TargetPath>{`${root}\\familyflix-metadata.csv`}</TargetPath>
                </TargetText>
                <Toggle
                  checked={writeSheet}
                  onToggle={onToggleSheet}
                  label={SHEET_TITLE}
                />
              </Target>
              <TargetDivider />
              <Target>
                <TargetGlyph>
                  <LandscapeIcon size={19} />
                </TargetGlyph>
                <TargetText>
                  <TargetTitle>{POSTERS_TITLE}</TargetTitle>
                  <TargetPath>{`${root}\\<movie folder>\\poster.jpg`}</TargetPath>
                </TargetText>
                <Toggle
                  checked={writePosters}
                  onToggle={onTogglePosters}
                  label={POSTERS_TITLE}
                />
              </Target>
            </>
          )}
        </Targets>
        {root !== null && (writeSheet || writePosters) ? (
          <SourceNote>
            FamilyFlix will write into your movie folders. Existing files are
            never replaced — a new <SourceNoteMono>poster.jpg</SourceNoteMono>{' '}
            is only written where there isn’t one.
          </SourceNote>
        ) : null}
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
