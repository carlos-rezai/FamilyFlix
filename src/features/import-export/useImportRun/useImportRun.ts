import { useCallback, useEffect, useRef, useState } from 'react';

import { dismissProblem } from '@/api/dismissProblem/dismissProblem';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import { useDelayedBusyByKey } from '@/hooks/useDelayedBusyByKey/useDelayedBusyByKey';
import type {
  BusyPhase,
  ImportMode,
  ImportProblem,
  ImportRun,
  SheetChoices,
} from '@/types';
import {
  applySheetChoices,
  cancelImport,
  dismissProblems,
  fetchCurrentImport,
  ImportBusyError,
  importGuessed,
  importManyGuessed,
  pickCandidateFolder,
  startImport,
  takeOutMissing,
} from '../api/api';

/** How often the **Current run** is read while it is still going. */
const POLL_INTERVAL_MS = 500;

/** Whether a run at this phase is still going, and so still worth polling. */
const isLive = (run: ImportRun | null): boolean =>
  run !== null && run.phase !== 'review';

export interface ImportRunState {
  /** The **Current run** as last read — `null` when there is none. */
  run: ImportRun | null;
  /**
   * Whether the read made on mount has yet to answer. Until it has, the hook
   * does not know whether a run exists, and a screen that offered the setup
   * fields on a guess would be offering them while a run exists.
   */
  attaching: boolean;
  /**
   * Start a run over the two paths and hold the snapshot the start answered.
   * A `409` — a run already exists — is answered by reading that run and
   * holding it instead, so the start settles on exactly what the screen
   * should be showing. Rejects as `startImport` does otherwise — an
   * `ImportRefusedError` names the field — so the caller can draw the reason
   * where it belongs. `enrich` travels on the run as `ImportRun.enrich`.
   */
  start: (
    sheetPath: string,
    enrich: boolean,
    mode: ImportMode
  ) => Promise<void>;
  /**
   * The start's phase on the **Loader timing**, the whole of `start`: the
   * post and, after a `409`, the read that follows it.
   */
  starting: BusyPhase;
  /** _Cancel import_: discard the run, and let it go from the screen. */
  cancel: () => Promise<void>;
  /**
   * _Skip_ on a **Problem**: dismiss it, and take its row off the snapshot
   * once the route has answered — on a `404` as on the `204`, because both
   * mean the problem is not there. Rejects as `dismissProblem` does when the
   * dismiss could not be made, and the row stays for another press.
   */
  skip: (id: string) => Promise<void>;
  /**
   * _Skip all_ and _Keep all mine_: dismiss every id at once, and hold the
   * route's echo — the whole snapshot — as the run. Rejects when the dismiss
   * could not be made; the run stays as it was.
   */
  skipMany: (ids: string[]) => Promise<void>;
  /** _Skip all_'s and _Keep all mine_'s phase on the **Loader timing**. */
  skippingAll: BusyPhase;
  /**
   * _Import all as guessed_: import every `no-row` id at once under the run's
   * **Import mode**, and hold the route's echo — the whole snapshot, a row
   * that could not settle redrawn in it — as the run. Rejects when the post
   * could not be made; the run stays as it was.
   */
  importManyAsGuessed: (ids: string[]) => Promise<void>;
  /** _Import all as guessed_'s phase on the **Loader timing**. */
  importingAll: BusyPhase;
  /**
   * _Apply choices_ on a `differs` **Problem**: post the choices, and take its
   * row off once the route has answered — on a `404` as on the `204`, as
   * `skip` does. Rejects when the apply could not be made; the row stays.
   */
  apply: (id: string, choices: SheetChoices) => Promise<void>;
  /**
   * A press on an `ambiguous` **Problem**'s **Folder picker**: post the
   * folder, and take the row off on a `204` or a `404`, or redraw it in
   * place from a `200`'s Problem. Rejects otherwise; the row stays.
   */
  pick: (id: string, folder: string) => Promise<void>;
  /**
   * _Import as_ on a `no-row` **Problem**: post it, and settle the row as
   * `pick` does — off on a `204` or a `404`, redrawn in place from a `200`.
   * Rejects otherwise; the row stays.
   */
  importAsGuessed: (id: string) => Promise<void>;
  /**
   * _Take out of library_ on a `missing` **Problem**: post it, and take the
   * row off on the `204`. A `404` does nothing. Rejects otherwise; the row
   * stays.
   */
  takeOut: (id: string) => Promise<void>;
  /**
   * **Problem** row `id`'s phase on the **Loader timing** while its press
   * (_Import as_, a picked folder, _Take out_, _Apply choices_, _Skip_) is
   * sent; `waiting` for a row a running bulk press covers; `idle` for a row
   * with nothing sent. The row settles only once the hold is out.
   */
  rowPhase: (id: string) => BusyPhase;
}

/**
 * The **Run hook** — what holds the **Current run** on the screen.
 *
 * Transport is polling: `GET /api/import/current` every 500 ms while the
 * phase is scanning or importing, and not once more once the run is in the
 * **Review step** — a hook that kept polling in review would be a request
 * every half second for as long as the maintainer reads the list. The same
 * endpoint is read once on mount, which is the re-attach: leaving the screen
 * and returning, reloading, or arriving with a run already going all show
 * the running step, and a `404` shows setup.
 *
 * Every read applies only if nothing has moved the run on since it was sent:
 * a poll that lands after a cancel, or after the screen was left, must not
 * put a snapshot back.
 *
 * A skip in review edits the snapshot in place rather than reading it again:
 * the run is not polled in review, and the route's answer already says the
 * problem is gone.
 *
 * Every write runs on the **Loader timing** (log 69). A **Problem** row's
 * press runs under its id on `useDelayedBusyByKey`, answered as
 * `rowPhase(id)`; the row leaves only once the hold is out, and a refusal
 * settles it back to `idle` with the run unchanged. _Start import_, _Skip
 * all_ (and _Keep all mine_) and _Import all as guessed_ each sit on their
 * own `useDelayedBusy`, answered as `starting`, `skippingAll` and
 * `importingAll`.
 */
export function useImportRun(): ImportRunState {
  const [run, setRun] = useState<ImportRun | null>(null);
  const [attaching, setAttaching] = useState(true);
  /** Bumped by every start and cancel, so a read from before either is stale. */
  const generation = useRef(0);

  useEffect(() => {
    let left = false;
    const at = generation.current;
    void fetchCurrentImport()
      .then((current) => {
        if (!left && at === generation.current) {
          setRun(current);
        }
      })
      .catch(() => {
        // Nothing could be read: the screen has no run to show, and the
        // maintainer can still start one.
      })
      .finally(() => {
        if (!left) {
          setAttaching(false);
        }
      });
    return () => {
      left = true;
    };
  }, []);

  const starts = useDelayedBusy();
  const timeStart = starts.run;
  const start = useCallback(
    async (sheetPath: string, enrich: boolean, mode: ImportMode) => {
      generation.current += 1;
      const held = await timeStart(async () => {
        try {
          return await startImport(sheetPath, enrich, mode);
        } catch (error) {
          if (!(error instanceof ImportBusyError)) {
            throw error;
          }
          return fetchCurrentImport();
        }
      });
      setRun(held);
    },
    [timeStart]
  );

  const cancel = useCallback(async () => {
    generation.current += 1;
    await cancelImport();
    setRun(null);
  }, []);

  /** One **Problem** taken off the snapshot, the rest of it as it was. */
  const takeOff = useCallback((id: string) => {
    setRun((current) =>
      current === null
        ? current
        : {
            ...current,
            problems: current.problems.filter((problem) => problem.id !== id),
          }
    );
  }, []);

  const rows = useDelayedBusyByKey();
  const timeRow = rows.run;
  const rowsPhaseOf = rows.phaseOf;
  const skipsAll = useDelayedBusy();
  const timeSkipAll = skipsAll.run;
  const importsAll = useDelayedBusy();
  const timeImportAll = importsAll.run;
  /** The ids a running bulk press covers; empty while none runs. */
  const [covered, setCovered] = useState<ReadonlySet<string>>(() => new Set());
  const rowPhase = useCallback(
    (id: string): BusyPhase => {
      const own = rowsPhaseOf(id);
      return own === 'idle' && covered.has(id) ? 'waiting' : own;
    },
    [rowsPhaseOf, covered]
  );

  /** A bulk press over `ids`, every row it covers locked until it settles. */
  const coverWhile = useCallback(
    async (ids: string[], send: () => Promise<ImportRun>) => {
      setCovered(new Set(ids));
      try {
        setRun(await send());
      } finally {
        setCovered(new Set());
      }
    },
    []
  );

  const skip = useCallback(
    async (id: string) => {
      await timeRow(id, () => dismissProblem(id));
      takeOff(id);
    },
    [timeRow, takeOff]
  );

  const skipMany = useCallback(
    (ids: string[]) =>
      coverWhile(ids, () => timeSkipAll(() => dismissProblems(ids))),
    [coverWhile, timeSkipAll]
  );

  const importManyAsGuessed = useCallback(
    (ids: string[]) =>
      coverWhile(ids, () => timeImportAll(() => importManyGuessed(ids))),
    [coverWhile, timeImportAll]
  );

  const apply = useCallback(
    async (id: string, choices: SheetChoices) => {
      await timeRow(id, () => applySheetChoices(id, choices));
      takeOff(id);
    },
    [timeRow, takeOff]
  );

  /**
   * A review press's answer on the snapshot — {@link takeOff}'s twin: the row
   * redrawn in its own place as the route answered it, or taken off for
   * `null`.
   */
  const settle = useCallback(
    (id: string, redrawn: ImportProblem | null) => {
      if (redrawn === null) {
        takeOff(id);
        return;
      }
      setRun((current) =>
        current === null
          ? current
          : {
              ...current,
              problems: current.problems.map((problem) =>
                problem.id === id ? redrawn : problem
              ),
            }
      );
    },
    [takeOff]
  );

  const pick = useCallback(
    async (id: string, folder: string) => {
      settle(id, await timeRow(id, () => pickCandidateFolder(id, folder)));
    },
    [timeRow, settle]
  );

  const importAsGuessed = useCallback(
    async (id: string) => {
      settle(id, await timeRow(id, () => importGuessed(id)));
    },
    [timeRow, settle]
  );

  const takeOut = useCallback(
    async (id: string) => {
      if ((await timeRow(id, () => takeOutMissing(id))) !== null) {
        takeOff(id);
      }
    },
    [timeRow, takeOff]
  );

  const live = isLive(run);
  useEffect(() => {
    if (!live) {
      return undefined;
    }

    let stopped = false;
    const timer = setInterval(async () => {
      const at = generation.current;
      try {
        const next = await fetchCurrentImport();
        // A poll that lands after the screen was left, after a cancel, or
        // after a later poll already moved the run on, must not put a stale
        // snapshot back.
        if (!stopped && at === generation.current) {
          setRun(next);
        }
      } catch {
        // One missed poll is nothing: the next one is half a second away, and
        // the snapshot on screen is still the last one that was read.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [live]);

  return {
    run,
    attaching,
    start,
    starting: starts.phase,
    cancel,
    skip,
    skipMany,
    skippingAll: skipsAll.phase,
    importManyAsGuessed,
    importingAll: importsAll.phase,
    apply,
    pick,
    importAsGuessed,
    takeOut,
    rowPhase,
  };
}
