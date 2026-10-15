/** A **Kind filter** over a review's rows, and the choice it actually holds. */
export interface KindFilter<K extends string> {
  /** _All N_, then each kind held with its count — empty under two kinds. */
  options: { value: K | 'all'; label: string }[];
  /** The chosen kind while the list still holds it, else `'all'`. */
  value: K | 'all';
}

/**
 * The **Kind filter** both reviews draw — the Import review's over its
 * Problems, the Sync's over its Decisions: _All N_, then one pill per kind
 * held, in `order`, worded by `labels` and followed by its count — none at
 * all under two kinds. A chosen kind the list no longer holds falls back to
 * `'all'`.
 */
export function kindFilter<K extends string>(
  items: readonly { kind: K }[],
  order: readonly K[],
  labels: Readonly<Record<K, string>>,
  chosen: K | 'all'
): KindFilter<K> {
  const held = order
    .map((kind) => ({
      kind,
      count: items.filter((item) => item.kind === kind).length,
    }))
    .filter(({ count }) => count > 0);
  if (held.length < 2) return { options: [], value: 'all' };
  return {
    options: [
      { value: 'all', label: `All ${items.length}` },
      ...held.map(({ kind, count }) => ({
        value: kind,
        label: `${labels[kind]} ${count}`,
      })),
    ],
    value:
      chosen !== 'all' && held.some(({ kind }) => kind === chosen)
        ? chosen
        : 'all',
  };
}
