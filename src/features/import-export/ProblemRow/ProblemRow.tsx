import { Button } from '@/primitives';
import type { ImportProblem } from '@/types';
import { movieFormPath } from '@/utils';
import { DOT_TONE, Dot, Reason, Row, Text, Title } from './ProblemRow.styles';

export interface ProblemRowProps {
  /** The **Problem** the row is about. */
  problem: ImportProblem;
  /** _Skip_ was pressed: the row reports it, and the **Run hook** removes it. */
  onSkip: () => void;
}

/**
 * Where _Resolve_ lands: the **Movie form** in import context, by the
 * problem's id. A `missing-meta` problem is already in the library, so its
 * Resolve names the movie too — the Edit job under the banner, rather than
 * adding the film twice.
 */
const resolveRoute = ({ id, movieId }: ImportProblem): string =>
  movieFormPath({ movie: movieId, problem: id });

/**
 * Whether a kind can be resolved in a form. An `unplaced` episode cannot: no
 * form takes an episode, and its reason already names the fix — rename the
 * file and import again — so its row draws _Skip_ alone.
 */
const resolvable = ({ kind }: ImportProblem): boolean => kind !== 'unplaced';

/**
 * One row of the **Review step**'s **Needs attention** list, from
 * `feat.ImportFlow.dc.html`: a 10px dot coloured by the **Problem**'s kind,
 * the title and the reason under it, and _Resolve_ and _Skip_ as `Button`
 * `secondary` `sm`.
 *
 * _Resolve_ is a navigation — `/add?problem=<id>`, or `/add?movie=<movieId>&problem=<id>`
 * for the soft kind — so it is a link, which
 * the maintainer can middle-click; _Skip_ is an action, so it is a button.
 * Neither knows what happens next: the row draws a problem and reports a
 * press.
 */
export function ProblemRow({ problem, onSkip }: ProblemRowProps) {
  return (
    <Row>
      <Dot $tone={DOT_TONE[problem.kind]} />
      <Text>
        <Title>{problem.title}</Title>
        <Reason>{problem.reason}</Reason>
      </Text>
      {resolvable(problem) && (
        <Button
          label="Resolve"
          variant="secondary"
          size="sm"
          to={resolveRoute(problem)}
        />
      )}
      <Button label="Skip" variant="secondary" size="sm" onClick={onSkip} />
    </Row>
  );
}
