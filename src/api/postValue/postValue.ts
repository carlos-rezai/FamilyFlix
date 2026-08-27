/**
 * The contract every single-signal save on the wire keeps: POST the value as
 * `{ value }`, reject anything but a 2xx, and answer with the value the route
 * echoed — falling back to what was sent only when the route says nothing
 * usable. The echo is the truth, because the route is what actually stored it.
 *
 * `isEcho` is the one part that differs between callers, and it is an argument
 * rather than a type check inside for a reason: whether a `null` echo is a
 * value or an absence is a **per-route** fact. The rating route can genuinely
 * store `null` — that is a cleared rating, and reading it as "no answer" would
 * let a failed clear look like a successful one — while a watched flag echoed
 * as `null` is a route answering with nonsense. Deciding that here, by
 * inspecting the value, would make one route's rule everybody's.
 *
 * A *missing* `value` key is the fallback case in both readings, and stays so:
 * `undefined` satisfies no caller's guard.
 *
 * This lives above `features/` because three saves across two features keep the
 * contract — the detail page's watched flag and rating, and the shelf's
 * favorite heart — and neither feature should be importing the other's wire.
 */
export async function postValue<V>(
  endpoint: string,
  value: V,
  isEcho: (echoed: unknown) => echoed is V
): Promise<V> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    throw new Error(`POST ${endpoint} failed: ${response.status}`);
  }

  const saved = (await response.json()) as { value?: unknown };
  return isEcho(saved.value) ? saved.value : value;
}
