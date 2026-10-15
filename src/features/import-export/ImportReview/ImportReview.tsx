import { useState } from 'react';

import { Accordion, PillTabs } from '@/components';
import { Button } from '@/primitives';
import {
  PROBLEM_KINDS,
  type ImportProblem,
  type ImportRun,
  type ProblemKind,
  type SheetChoices,
} from '@/types';
import { kindFilter } from '@/utils';
import { PROBLEM_KIND_LABELS, reviewGroups } from '../importView/importView';
import { ProblemRow } from '../ProblemRow/ProblemRow';
import { DOT_TONE } from '../ProblemRow/ProblemRow.styles';
import { StatTile } from '../StatTile/StatTile';
import {
  Actions,
  AllDone,
  AllDoneHeading,
  AllDoneLine,
  BulkActions,
  BulkButton,
  FilterRow,
  FilterScroll,
  KindMark,
  List,
  ListHeading,
  SkipAllButton,
  Tiles,
} from './ImportReview.styles';

export interface ImportReviewProps {
  /** The **Current run**, in review. */
  run: ImportRun;
  /** _Skip_ was pressed on the **Problem** with this id. */
  onSkip: (id: string) => void;
  /** _Apply choices_ was pressed on the `differs` **Problem** with this id. */
  onApply: (id: string, choices: SheetChoices) => void;
  /**
   * A **Candidate folder** was pressed on the `ambiguous` **Problem** with
   * this id.
   */
  onPick: (id: string, folder: string) => void;
  /** _Import as_ was pressed on the `no-row` **Problem** with this id. */
  onImportAs: (id: string) => void;
  /**
   * A bulk **Dismiss** was pressed — _Skip all_ on a **Review group** or
   * beside a chosen kind, or _Keep all mine_ beside `differs` — with every id
   * it dismisses, in the run's order.
   */
  onSkipMany: (ids: string[]) => void;
  /**
   * _Import all as guessed_ was pressed beside a chosen `no-row`, with every
   * `no-row` id in the run's order.
   */
  onImportManyAsGuessed: (ids: string[]) => void;
  /** Finish's words: where it goes, which the flow knows and this step does not. */
  finishLabel: string;
  onFinish: () => void;
}

/**
 * The **Review step**, from `feat.ImportFlow.dc.html`: two stat tiles —
 * `matched confidently and imported` and `need your attention` — over the
 * **Needs attention** list, one row per **Problem**; the `✓ All done` card
 * once the list is empty; and Finish either way, because the films that
 * matched are already in the library — under the words the flow hands it,
 * which say where it goes.
 *
 * The list draws the **Review groups**: a title with one Problem is its bare
 * row; two or more are one closed **Accordion** — the title, each kind's dot,
 * the count — over the same rows. Which groups are open is this step's own
 * screen state, by title.
 *
 * Over two kinds or more, the **Kind filter** sits above the list and lets
 * one kind's rows through `reviewGroups`; the choice is screen state, never
 * in the URL, and falls back to _All_ once its kind empties.
 *
 * A chosen kind draws its Bulk actions at the filter row's end — _Skip all_,
 * _Import all as guessed_ before it for `no-row`, or _Keep all mine_ in its
 * place for `differs` — and each group carries
 * _Skip all_ among its Accordion actions; every one reports its ids at once,
 * no confirm.
 *
 * The step draws the run it is handed and reports a press — _Skip_ and
 * _Apply choices_ name the problem's id — and never removes a row itself: the
 * **Run hook** does, and the next `run` shows it.
 */
export function ImportReview({
  run,
  onSkip,
  onApply,
  onPick,
  onImportAs,
  onSkipMany,
  onImportManyAsGuessed,
  finishLabel,
  onFinish,
}: ImportReviewProps) {
  const [chosen, setChosen] = useState<ProblemKind | 'all'>('all');
  const filter = kindFilter(
    run.problems,
    PROBLEM_KINDS,
    PROBLEM_KIND_LABELS,
    chosen
  );
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (title: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (!next.delete(title)) next.add(title);
      return next;
    });

  const kindIds =
    filter.value === 'all'
      ? []
      : run.problems
          .filter((problem) => problem.kind === filter.value)
          .map((problem) => problem.id);

  const row = (problem: ImportProblem) => (
    <ProblemRow
      key={problem.id}
      problem={problem}
      onSkip={() => onSkip(problem.id)}
      onApply={(choices) => onApply(problem.id, choices)}
      onPick={(folder) => onPick(problem.id, folder)}
      onImportAs={() => onImportAs(problem.id)}
    />
  );

  return (
    <>
      <Tiles>
        <StatTile
          value={run.matched}
          tone="watched"
          label={
            <>
              matched confidently
              <br />
              and imported
            </>
          }
        />
        <StatTile
          value={run.problems.length}
          tone="accent"
          label={
            <>
              need your
              <br />
              attention
            </>
          }
        />
      </Tiles>

      {run.problems.length > 0 ? (
        <>
          <ListHeading>Needs attention</ListHeading>
          {filter.options.length > 0 && (
            <FilterRow>
              <FilterScroll>
                <PillTabs
                  label="Problem kinds"
                  options={filter.options}
                  value={filter.value}
                  onChange={setChosen}
                />
              </FilterScroll>
              <BulkActions>
                {filter.value === 'differs' ? (
                  <BulkButton type="button" onClick={() => onSkipMany(kindIds)}>
                    Keep all mine
                  </BulkButton>
                ) : filter.value !== 'all' ? (
                  <>
                    {filter.value === 'no-row' && (
                      <BulkButton
                        type="button"
                        onClick={() => onImportManyAsGuessed(kindIds)}
                      >
                        Import all as guessed
                      </BulkButton>
                    )}
                    <SkipAllButton
                      type="button"
                      onClick={() => onSkipMany(kindIds)}
                    >
                      Skip all
                    </SkipAllButton>
                  </>
                ) : null}
              </BulkActions>
            </FilterRow>
          )}
          <List>
            {reviewGroups(run.problems, filter.value).map((group) =>
              group.problems.length === 1 ? (
                row(group.problems[0])
              ) : (
                <Accordion
                  key={`group:${group.title}`}
                  label={group.title}
                  count={group.problems.length}
                  expanded={open.has(group.title)}
                  onToggle={() => toggle(group.title)}
                  actions={
                    <SkipAllButton
                      type="button"
                      $tall
                      aria-label={`Skip all for ${group.title}`}
                      onClick={() =>
                        onSkipMany(group.problems.map((problem) => problem.id))
                      }
                    >
                      Skip all
                    </SkipAllButton>
                  }
                  marks={group.kinds.map((kind) => (
                    <KindMark
                      key={kind}
                      aria-hidden="true"
                      $tone={DOT_TONE[kind]}
                    />
                  ))}
                >
                  {group.problems.map(row)}
                </Accordion>
              )
            )}
          </List>
        </>
      ) : (
        <AllDone>
          <AllDoneHeading>✓ All done</AllDoneHeading>
          <AllDoneLine>Every flagged movie has been handled.</AllDoneLine>
        </AllDone>
      )}

      <Actions>
        <Button label={finishLabel} onClick={onFinish} />
      </Actions>
    </>
  );
}
