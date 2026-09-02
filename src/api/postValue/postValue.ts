/**
 * How a save is sent, over and above the contract itself.
 *
 * One option, for one caller: the player's write on its way out of the screen,
 * which has to outlive the page being torn down around it. Every other save
 * happens while its screen is still there and asks for none of this.
 */
export interface PostOptions {
  /**
   * Whether the browser should finish the request even if the page goes away.
   * Left unset on an ordinary save: the budget `keepalive` draws on is small,
   * and spending it on writes nothing is racing is what would exhaust it.
   */
  keepalive?: boolean;
}

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
 * This lives above `features/` because four saves across three features keep
 * the contract — the shelf's favorite heart, the watched flag both it and the
 * player set, the detail page's rating, and the player's resume position — and
 * no feature should be importing another's wire.
 */
export async function postValue<V>(
  endpoint: string,
  value: V,
  isEcho: (echoed: unknown) => echoed is V,
  { keepalive }: PostOptions = {}
): Promise<V> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
    keepalive,
  });

  if (!response.ok) {
    throw new Error(`POST ${endpoint} failed: ${response.status}`);
  }

  const saved = (await response.json()) as { value?: unknown };
  return isEcho(saved.value) ? saved.value : value;
}
