import {
  ENRICH_FIELD_LABELS,
  ENRICH_FIELDS,
  type EnrichField,
  type EnrichmentSummary,
  type EnrichScope,
  type TitleReference,
} from '@/types';
import { Button, Chip, DatabaseIcon, FolderIcon } from '@/primitives';
import {
  enrichmentEstimate,
  scopeDescription,
  singleScopeLabel,
} from '../enrichmentView/enrichmentView';
import { ScopeCard } from '../ScopeCard/ScopeCard';
import { SetupBanner } from '../SetupBanner/SetupBanner';
import {
  Chips,
  Estimate,
  GroupLabel,
  LetGoNote,
  RatingNote,
  SeriesNote,
  SavedBadge,
  SavedGlyph,
  SavedLine,
  SavedPath,
  SavedRow,
  SavedText,
  SavedTitle,
  SourceNote,
  SourceNoteMono,
  Scopes,
  Stack,
  Star,
  StartRow,
  TargetDivider,
  Targets,
} from './EnrichmentSetup.styles';

/** The two library scopes, as the prototype's `scopeDefs` names them. */
const LIBRARY_SCOPES: ReadonlyArray<{
  scope: Exclude<EnrichScope, 'single'>;
  label: string;
}> = [
  { scope: 'missing', label: 'Only what’s missing' },
  { scope: 'all', label: 'Everything' },
];

/** The third card, drawn only when the summary was read with `since`. */
const ADDED_SCOPE = {
  scope: 'added',
  label: 'Just what was added',
} as const;

export interface EnrichmentSetupProps {
  /** The scope chosen — `single` draws _Just this movie_ alone. */
  scope: EnrichScope;
  /** What the library and the connection are, as the server read them. */
  summary: EnrichmentSummary;
  /** The title's name, once read — the _Just this …_ card's line. */
  title: string | null;
  /**
   * What the one title of a `single` Sync is — _Just this movie_ or _Just
   * this series_. A film by default.
   */
  titleKind?: TitleReference['kind'];
  /** The chips that are on. */
  fields: readonly EnrichField[];
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
 * and the key banner when either applies, the scope cards — _Only what's
 * missing_ and _Everything_ for the library, or _Just this movie_ (or _Just
 * this series_) in their place for one title, and _Just what was added_
 * beside the two when the summary counts what a run brought in, the field
 * chips with the rating note, _Where it is saved_ with _Your library_ as
 * Required and _Your library folders_ as Always, the note under them, and
 * Start: _Start sync_, or _Fetch details_ with its estimate for
 * one film.
 */
export function EnrichmentSetup({
  scope,
  summary,
  title,
  titleKind = 'movie',
  fields,
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
  // Several Library folders: the line in words. One: its own path; none: the
  // prototype's stand-in path.
  const layoutPath =
    folders.length > 1
      ? '<title folder>\\Images in each library folder'
      : `${folders[0] ?? 'E:\\Movies'}\\<title folder>\\Images`;
  const libraryScopes =
    summary.added === undefined
      ? LIBRARY_SCOPES
      : [...LIBRARY_SCOPES, ADDED_SCOPE];
  return (
    <Stack>
      {summary.online ? null : (
        <SetupBanner
          tone="danger"
          title="No internet connection"
          line="FamilyFlix works fine offline. This is the one feature that needs the network. Everything already in your library stays available."
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
              label={singleScopeLabel(titleKind)}
              description={title ?? ''}
              selected
            />
          ) : (
            libraryScopes.map((each) => (
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
          <Star>★</Star>Your household rating is yours. TMDB’s score is stored
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
          <SavedRow>
            <SavedGlyph>
              <DatabaseIcon size={19} />
            </SavedGlyph>
            <SavedText>
              <SavedTitle>Your library</SavedTitle>
              <SavedLine>Always. This is what the app reads from.</SavedLine>
            </SavedText>
            <SavedBadge>Required</SavedBadge>
          </SavedRow>
          <TargetDivider />
          <SavedRow>
            <SavedGlyph>
              <FolderIcon size={19} />
            </SavedGlyph>
            <SavedText>
              <SavedTitle>Your library folders</SavedTitle>
              <SavedPath>{layoutPath}</SavedPath>
            </SavedText>
            <SavedBadge>Always</SavedBadge>
          </SavedRow>
        </Targets>
        <SourceNote>
          Art goes into each title folder's{' '}
          <SourceNoteMono>Images</SourceNoteMono> folder, only where there isn’t
          one already: nothing of yours is ever replaced. The sheet in{' '}
          <SourceNoteMono>Meta</SourceNoteMono> is FamilyFlix’s own and is kept
          up to date.
        </SourceNote>
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
      {letGo === null ? null : <LetGoNote>{letGo}</LetGoNote>}
    </Stack>
  );
}
