/** The route of one **Problem**, its id encoded into the path. */
const problemEndpoint = (id: string): string =>
  `/api/import/current/problems/${encodeURIComponent(id)}`;

/**
 * **Dismiss** — _Skip_ on a **Problem**: `DELETE` to the problem's own route.
 * The `204` and the `404` both resolve, because both mean the same thing to
 * the screen — the problem is not there any more, and the row goes. Anything
 * else rejects, and so does a request that could not be made; the row stays.
 *
 * It lives here rather than with the import feature because two features send
 * it: the **Review step**'s _Skip_ on a row, and the **Movie form**'s _Skip
 * this one_ in **Import context**. The one import call with callers on both
 * sides of a feature boundary, which is the rule this rung was built for.
 */
export async function dismissProblem(id: string): Promise<void> {
  const endpoint = problemEndpoint(id);
  const response = await fetch(endpoint, { method: 'DELETE' });

  if (!response.ok && response.status !== 404) {
    throw new Error(`DELETE ${endpoint} failed: ${response.status}`);
  }
}
