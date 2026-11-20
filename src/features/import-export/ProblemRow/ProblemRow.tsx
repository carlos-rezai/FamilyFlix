import { FieldDiff, type FieldDiffSide } from '@/components';
import { useBusyRow } from '@/hooks/useBusyRow/useBusyRow';
import { Button, LogoLoader } from '@/primitives';
import { BUSY_ROW_LOADER_SIZE } from '@/styles/busyRow';
import type {
  BusyPhase,
  ImportProblem,
  ProblemKind,
  SheetChoices,
  SheetField,
} from '@/types';
import { movieFormPath, opensSeriesResolve } from '@/utils';
import { FolderPicker } from '../FolderPicker/FolderPicker';
import {
  Card,
  DOT_TONE,
  Dot,
  Head,
  ImportAsSlot,
  Reason,
  Text,
  Title,
} from './ProblemRow.styles';

export interface ProblemRowProps {
  /** The **Problem** the row is about. */
  problem: ImportProblem;
  /**
   * The row's phase on the **Loader timing**, handed by the review: from
   * `waiting` it is locked, once `shown` its loader stands in the dot's slot.
   */
  busy: BusyPhase;
  /** _Skip_ was pressed: the row reports it, and the **Run hook** removes it. */
  onSkip: () => void;
  /** _Apply choices_ on a `differs` row: the side kept for each field. */
  onApply: (choices: SheetChoices) => void;
  /** A **Candidate folder** pressed on an `ambiguous` row, by its path. */
  onPick: (folder: string) => void;
  /** _Import as_ on a `no-row` row: the folder imported under its guess. */
  onImportAs: () => void;
  /** _Take out of library_ on a `missing` row: the title taken out. */
  onTakeOut: () => void;
}

/**
 * Where _Resolve_ lands: the **Movie form** in import context, by the
 * problem's id. A `missing-meta` problem is already in the library, so its
 * Resolve names the movie too — the Edit job under the banner, rather than
 * adding the film twice. An `unplaced` show opens the **Series Resolve**, the
 * form's series kind, naming the held series beside it when there is one;
 * so does a show's `failed` row once its series is held.
 */
const resolveRoute = (problem: ImportProblem): string =>
  opensSeriesResolve(problem)
    ? movieFormPath({
        kind: 'series',
        problem: problem.id,
        series: problem.seriesId,
      })
    : movieFormPath({ movie: problem.movieId, problem: problem.id });

/**
 * The kinds that draw no _Resolve_: a `differs` row is settled on the row by
 * the diff, a `missing` row on the row by _Take out_, and an `off-layout`
 * row is fixed only on disk.
 */
const NO_RESOLVE: ReadonlySet<ProblemKind> = new Set<ProblemKind>([
  'differs',
  'missing',
  'off-layout',
]);

/** The presses a row is timed across, and what its loader reads for each. */
type Press = 'import' | 'takeOut' | 'apply' | 'skip';
const PRESS_LABELS: Record<Press, string> = {
  import: 'Importing…',
  takeOut: 'Taking out…',
  apply: 'Updating details…',
  skip: 'Skipping…',
};

/** The diff's `'theirs'` read back as the import's own `'sheet'`. */
const sheetChoices = (
  choices: Partial<Record<SheetField, FieldDiffSide>>
): SheetChoices =>
  Object.fromEntries(
    Object.entries(choices).map(([field, side]) => [
      field,
      side === 'theirs' ? 'sheet' : 'mine',
    ])
  );

/**
 * One row of the **Review step**'s **Needs attention** list, from
 * `feat.ImportFlow.dc.html`: a 10px dot coloured by the **Problem**'s kind,
 * the title and the reason under it, and _Resolve_ and _Skip_ as `Button`
 * `secondary` `sm` — then, under the head, the face its kind draws.
 *
 * _Resolve_ is a navigation — `/add?problem=<id>`, or
 * `/add?movie=<movieId>&problem=<id>` for the soft kind — so it is a link,
 * which the maintainer can middle-click; _Skip_ is an action, so it is a
 * button. An `ambiguous` row draws the **Folder picker**, _Resolve_ kept
 * beside it, and a `no-row` row _Import as_ its guess, _Resolve_ kept the
 * same. A `differs` row has no _Resolve_: it is settled on the row, by the
 * _Yours | Spreadsheet_ diff, whose _Keep all mine_ is the row's _Skip_. A
 * `missing` row, a film or a show's gone episodes, has no _Resolve_: it
 * draws its `takeOut` words (_Take out of library_, _Take out 1 episode_) as
 * a button beside _Skip_, pressed with no confirm. An `off-layout` row is
 * fixed only on disk, so it draws _Skip_ alone. None knows what happens
 * next: the row draws a problem and reports a press.
 *
 * A **Busy row**: from `waiting` its root is `inert` and `aria-busy`, every
 * control keeping its own face; once `shown` it dims, and an 18px inline
 * **Logo loader** naming its press stands in the kind dot's slot.
 */
export function ProblemRow({
  problem,
  busy,
  onSkip,
  onApply,
  onPick,
  onImportAs,
  onTakeOut,
}: ProblemRowProps) {
  const { pressed, label: pressLabel } = useBusyRow(busy, PRESS_LABELS);
  const skip = pressed('skip', onSkip);
  const differs = problem.kind === 'differs';
  const resolvable = !NO_RESOLVE.has(problem.kind);
  return (
    <Card $busy={busy}>
      <Head>
        {pressLabel !== null ? (
          <LogoLoader size={BUSY_ROW_LOADER_SIZE} inline label={pressLabel} />
        ) : (
          <Dot $tone={DOT_TONE[problem.kind]} />
        )}
        <Text>
          <Title>{problem.title}</Title>
          <Reason>{problem.reason}</Reason>
        </Text>
        {resolvable ? (
          <Button
            label="Resolve"
            variant="secondary"
            size="sm"
            to={resolveRoute(problem)}
          />
        ) : null}
        {problem.kind === 'missing' && problem.takeOut !== undefined ? (
          <Button
            label={problem.takeOut}
            variant="secondary"
            size="sm"
            onClick={pressed('takeOut', onTakeOut)}
          />
        ) : null}
        <Button label="Skip" variant="secondary" size="sm" onClick={skip} />
      </Head>
      {differs ? (
        <FieldDiff<SheetField>
          rows={(problem.differences ?? []).map(
            ({ field, label, mine, sheet }) => ({
              key: field,
              label,
              mine,
              theirs: sheet,
            })
          )}
          theirsLabel="Spreadsheet"
          onApply={pressed('apply', (choices) =>
            onApply(sheetChoices(choices))
          )}
          onKeepAll={skip}
        />
      ) : null}
      {problem.kind === 'ambiguous' ? (
        <FolderPicker
          candidates={problem.candidates ?? []}
          label={`Folders for ${problem.title}`}
          onPick={pressed('import', onPick)}
        />
      ) : null}
      {problem.kind === 'no-row' && problem.guess !== undefined ? (
        <ImportAsSlot>
          <Button
            label={`Import as “${problem.guess}”`}
            variant="secondary"
            size="sm"
            onClick={pressed('import', onImportAs)}
          />
        </ImportAsSlot>
      ) : null}
    </Card>
  );
}
