import { randomUUID } from 'node:crypto';

import type { Trash, TrashOutcome } from '../../media/createMedia/createMedia';
import type { ShellParentPort } from '../shellHandshake/shellHandshake';

/**
 * The server's half of the **Shell trash**: a `Trash` that posts
 * `{ type: 'trash', id, paths }` to main and resolves on the `trashed`
 * command carrying the same id — `trashed`, or `failed` with the path the
 * Recycle Bin would not take. Answers are matched by id, each request
 * settled once. With no parent port it is inert and answers `unavailable`,
 * `shellHandshake`'s precedent.
 */
export function createShellTrash(
  parentPort: ShellParentPort | undefined
): Trash {
  if (!parentPort) {
    return { trash: () => Promise.resolve({ kind: 'unavailable' }) };
  }

  const pending = new Map<string, (outcome: TrashOutcome) => void>();

  parentPort.on('message', ({ data }) => {
    if (data.type !== 'trashed') return;
    const settle = pending.get(data.id);
    if (!settle) return;
    pending.delete(data.id);
    settle(
      data.failed === null
        ? { kind: 'trashed' }
        : { kind: 'failed', path: data.failed }
    );
  });

  return {
    trash(paths) {
      const id = randomUUID();
      return new Promise<TrashOutcome>((resolve) => {
        pending.set(id, resolve);
        parentPort.postMessage({ type: 'trash', id, paths: [...paths] });
      });
    },
  };
}
