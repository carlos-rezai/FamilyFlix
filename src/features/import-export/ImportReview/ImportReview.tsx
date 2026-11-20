import { useState } from 'react';

import { Accordion, LogConsole, PillTabs } from '@/components';
import { Button } from '@/primitives';
import {
  PROBLEM_KINDS,
  type BusyPhase,
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
  ActivityLog,
  AllDone,
  AllDoneHeading,
  AllDoneLine,
  BulkActions,
  BulkButton,
  BulkSkipAllButton,
  FilterRow,
  FilterScroll,
  KindMark,
  List,
  ListHeading,
  SkipAllButton,
  Tiles,
} from './ImportReview.styles';

/**
 * The key of the Kind filter's _Skip all_ and _Keep all mine_: empty, which
 * no group's title is.
 */
const KIND_SKIP = '';

/** The console's height in the log's Accordion — the Running step's own 220. */
const LOG_HEIGHT = 220;

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
  /** _Take out of library_ was pressed on the `missing` **Problem** with this id. */
  onTakeOut: (id: string) => void;
  /** Each **Problem** row's phase on the **Loader timing**, by its id. */
  rowPhase: (id: string) => BusyPhase;
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
  /** _Skip all_'s and _Keep all mine_'s phase on the **Loader timing**. */
  skippingAll: BusyPhase;
  /** _Import all as guessed_'s phase on the **Loader timing**. */
  importingAll: BusyPhase;
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
 * no confirm. Each is a **Busy button** on `skippingAll` or `importingAll`,
 * and only the _Skip all_ pressed reads _Skipping…_, the step's own state.
 *
 * Between the tiles and the list, the run's **Activity log** on one closed
 * **Accordion** — _Activity log_ and its line count — opening onto the Running
 * step's own console, and absent for a run with no lines. A Link run places no
 * video bytes, so it can reach review inside one poll and the Running step is
 * never seen; this is where its lines are read.
 *
 * The **Kind filter**'s chips include _Off layout_ and _Missing_ once a run
 * files them: a folder the walk turned away, and a held title whose video is
 * no longer on disk, one row per film and one per show.
 *
 * The step draws the run it is handed and reports a press (_Skip_, _Apply
 * choices_ and _Take out_ name the problem's id), and never removes a row
 * itself: the **Run hook** does, and the next `run` shows it.
 */
export function ImportReview({
  run,
  onSkip,
  onApply,
  onPick,
  onImportAs,
  onTakeOut,
  rowPhase,
  onSkipMany,
  onImportManyAsGuessed,
  skippingAll,
  importingAll,
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
  const [logOpen, setLogOpen] = useState(false);
  // One bulk press at a time: while one runs, a press on another reports
  // nothing. Only the pressed one is a **Busy button**; the rest refuse.
  const bulkBusy = skippingAll !== 'idle' || importingAll !== 'idle';
  // Which _Skip all_ was pressed, `KIND_SKIP` or a group's title, so only it
  // reads _Skipping…_: one loader for one wait.
  const [skipFrom, setSkipFrom] = useState<string | null>(null);
  const skipBusy = (from: string): BusyPhase =>
    skipFrom === from ? skippingAll : 'idle';
  const skipManyFrom = (from: string, ids: string[]) => {
    if (bulkBusy) return;
    setSkipFrom(from);
    onSkipMany(ids);
  };
  const importManyAsGuessed = (ids: string[]) => {
    if (bulkBusy) return;
    onImportManyAsGuessed(ids);
  };
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
      busy={rowPhase(problem.id)}
      onSkip={() => onSkip(problem.id)}
      onApply={(choices) => onApply(problem.id, choices)}
      onPick={(folder) => onPick(problem.id, folder)}
      onImportAs={() => onImportAs(problem.id)}
      onTakeOut={() => onTakeOut(problem.id)}
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

      {run.log.length > 0 && (
        <ActivityLog>
          <Accordion
            label="Activity log"
            count={run.log.length}
            expanded={logOpen}
            onToggle={() => setLogOpen((was) => !was)}
          >
            <LogConsole lines={run.log} height={LOG_HEIGHT} />
          </Accordion>
        </ActivityLog>
      )}

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
                  <BulkButton
                    label="Keep all mine"
                    variant="secondary"
                    size="sm"
                    onClick={() => skipManyFrom(KIND_SKIP, kindIds)}
                    busy={skipBusy(KIND_SKIP)}
                    busyLabel="Skipping…"
                  />
                ) : filter.value !== 'all' ? (
                  <>
                    {filter.value === 'no-row' && (
                      <BulkButton
                        label="Import all as guessed"
                        variant="secondary"
                        size="sm"
                        onClick={() => importManyAsGuessed(kindIds)}
                        busy={importingAll}
                        busyLabel="Importing…"
                      />
                    )}
                    <BulkSkipAllButton
                      label="Skip all"
                      variant="ghost"
                      size="sm"
                      onClick={() => skipManyFrom(KIND_SKIP, kindIds)}
                      busy={skipBusy(KIND_SKIP)}
                      busyLabel="Skipping…"
                    />
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
                      label="Skip all"
                      ariaLabel={`Skip all for ${group.title}`}
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        skipManyFrom(
                          group.title,
                          group.problems.map((problem) => problem.id)
                        )
                      }
                      busy={skipBusy(group.title)}
                      busyLabel="Skipping…"
                    />
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
