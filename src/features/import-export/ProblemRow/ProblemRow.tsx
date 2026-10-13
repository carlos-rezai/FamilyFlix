import { FieldDiff, type FieldDiffSide } from '@/components';
import { Button } from '@/primitives';
import type { ImportProblem, SheetChoices, SheetField } from '@/types';
import { movieFormPath } from '@/utils';
import {
  Card,
  DOT_TONE,
  Dot,
  Head,
  Reason,
  Text,
  Title,
} from './ProblemRow.styles';

export interface ProblemRowProps {
  /** The **Problem** the row is about. */
  problem: ImportProblem;
  /** _Skip_ was pressed: the row reports it, and the **Run hook** removes it. */
  onSkip: () => void;
  /** _Apply choices_ on a `differs` row: the side kept for each field. */
  onApply: (choices: SheetChoices) => void;
}

/**
 * Where _Resolve_ lands: the **Movie form** in import context, by the
 * problem's id. A `missing-meta` problem is already in the library, so its
 * Resolve names the movie too — the Edit job under the banner, rather than
 * adding the film twice. An `unplaced` show opens the **Series Resolve**, the
 * form's series kind, naming the held series beside it when there is one.
 */
const resolveRoute = ({
  id,
  kind,
  movieId,
  seriesId,
}: ImportProblem): string =>
  kind === 'unplaced'
    ? movieFormPath({ kind: 'series', problem: id, series: seriesId })
    : movieFormPath({ movie: movieId, problem: id });

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
 * _Resolve_ is a navigation — `/add?problem=<id>`, or `/add?movie=<movieId>&problem=<id>`
 * for the soft kind — so it is a link, which
 * the maintainer can middle-click; _Skip_ is an action, so it is a button.
 * A `differs` row has no _Resolve_: it is settled on the row, by the
 * _Yours | Spreadsheet_ diff, whose _Keep all mine_ is the row's _Skip_.
 * Neither knows what happens next: the row draws a problem and reports a
 * press.
 */
export function ProblemRow({ problem, onSkip, onApply }: ProblemRowProps) {
  const differs = problem.kind === 'differs';
  return (
    <Card>
      <Head>
        <Dot $tone={DOT_TONE[problem.kind]} />
        <Text>
          <Title>{problem.title}</Title>
          <Reason>{problem.reason}</Reason>
        </Text>
        {differs ? null : (
          <Button
            label="Resolve"
            variant="secondary"
            size="sm"
            to={resolveRoute(problem)}
          />
        )}
        <Button label="Skip" variant="secondary" size="sm" onClick={onSkip} />
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
          onApply={(choices) => onApply(sheetChoices(choices))}
          onKeepAll={onSkip}
        />
      ) : null}
    </Card>
  );
}
