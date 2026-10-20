/**
 * A refused response → the route's own sentence, the `error` of a JSON
 * `{ error: string }`, or `null` for a body that is not one, so the caller can
 * treat it as any other failure. Never rejects. Three features read a
 * refusal this way — the deletes, the settings' reset and Component routes,
 * and the import-export folder add — so it lives here.
 */
export async function refusalSentence(
  response: Response
): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null);
  const error =
    typeof body === 'object' && body !== null
      ? (body as { error?: unknown }).error
      : undefined;
  return typeof error === 'string' ? error : null;
}
