import {
  ENRICH_FIELD_LABELS,
  ENRICH_FIELDS,
  type EnrichField,
  type EnrichmentSummary,
  type EnrichScope,
} from '@/types';
import {
  Button,
  Chip,
  DatabaseIcon,
  LandscapeIcon,
  TableIcon,
} from '@/primitives';
import {
  enrichmentEstimate,
  scopeDescription,
} from '../enrichmentView/enrichmentView';
import { ScopeCard } from '../ScopeCard/ScopeCard';
import { SetupBanner } from '../SetupBanner/SetupBanner';
import { WriteTargetRow } from '../WriteTargetRow/WriteTargetRow';
import {
  Chips,
  Estimate,
  GroupLabel,
  LetGoLine,
  RatingNote,
  SeriesNote,
  SourceNote,
  SourceNoteMono,
  Scopes,
  Stack,
  Star,
  StartRow,
  TargetDivider,
  Targets,
} from './EnrichmentSetup.styles';

const SHEET_TITLE = 'Metadata sheet in the collection root';
const POSTERS_TITLE = 'Posters into each movie folder';

/** The two library scopes, as the prototype's `scopeDefs` names them. */
const LIBRARY_SCOPES: ReadonlyArray<{
  scope: Exclude<EnrichScope, 'single'>;
  label: string;
}> = [
  { scope: 'missing', label: 'Only what’s missing' },
  { scope: 'all', label: 'Everything' },
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
  /**
   * The **let-go line** under Start while a **Waiting run** has Decisions —
   * `null` draws none.
   */
  letGo: string | null;
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
  letGo,
  onRetry,
  onOpenKeySettings,
}: EnrichmentSetupProps) {
  const single = scope === 'single';
  const ready = summary.keySet && summary.online;
  const folders = summary.libraryFolders;
  const root = folders.length === 1 ? folders[0] : null;
  const anyFolder = folders.length > 0;
  return (
    <Stack>
      {summary.online ? null : (
        <SetupBanner
          tone="danger"
          title="No internet connection"
          line="FamilyFlix works fine offline — this is the one feature that needs the network. Everything already in your library stays available."
          actionLabel="Retry"
          onAction={onRetry}
        />
      )}
      {summary.keySet ? null : (
        <SetupBanner
          tone="accent"
          title="A TMDB API key is needed first"
          line="It’s free and takes a minute. Paste it under Settings → Network, and it stays on this machine."
          actionLabel="Open Network settings"
          onAction={onOpenKeySettings}
        />
      )}

      <div>
        <GroupLabel>What to sync</GroupLabel>
        <Scopes role="radiogroup" aria-label="What to sync">
          {single ? (
            <ScopeCard
              label="Just this movie"
              description={title ?? ''}
              selected
            />
          ) : (
            LIBRARY_SCOPES.map((each) => (
              <ScopeCard
                key={each.scope}
                label={each.label}
                description={scopeDescription(summary, each.scope)}
                selected={each.scope === scope}
                onSelect={() => onChooseScope(each.scope)}
              />
            ))
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
          <WriteTargetRow
            glyph={<DatabaseIcon size={19} />}
            title="Your library"
            line="Always. This is what the app reads from."
          />
          {!anyFolder ? null : (
            <>
              <TargetDivider />
              <WriteTargetRow
                glyph={<TableIcon size={19} />}
                title={SHEET_TITLE}
                line={
                  root === null
                    ? 'familyflix-metadata.csv in each library folder'
                    : `${root}\\familyflix-metadata.csv`
                }
                path
                toggle={{ checked: writeSheet, onToggle: onToggleSheet }}
              />
              <TargetDivider />
              <WriteTargetRow
                glyph={<LandscapeIcon size={19} />}
                title={POSTERS_TITLE}
                line={
                  root === null
                    ? '<movie folder>\\poster.jpg in each library folder'
                    : `${root}\\<movie folder>\\poster.jpg`
                }
                path
                toggle={{ checked: writePosters, onToggle: onTogglePosters }}
              />
            </>
          )}
        </Targets>
        {anyFolder && (writeSheet || writePosters) ? (
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
      {letGo === null ? null : <LetGoLine>{letGo}</LetGoLine>}
    </Stack>
  );
}
