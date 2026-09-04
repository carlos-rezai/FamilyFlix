/**
 * The three `Response` fakes the suite hands to a stubbed `fetch`.
 *
 * A wire test needs an object with `ok`, `status` and `json()` on it and
 * nothing else — the real `Response` is a hundred members wide, so every call
 * site built the three fields it uses and cast. Twenty-three files had written
 * the same `okResponse` and fourteen the same `serverErrorResponse`, all of
 * them byte-identical; the 404 varied in one thing only, which is the sentence
 * the server sent.
 *
 * The cast is what these exist to hold. It is a lie to the type system —
 * deliberate, and correct for a double — and it belongs in one place where the
 * next reader can see the whole of what is being promised, rather than in
 * twenty-four places where it is invisible until one of them is wrong.
 */

/** A 200 carrying `body` — what a route answers when it worked. */
export function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/**
 * A 500 with the suite's agreed body. A caller that reaches this is asserting
 * what it does when the server fell over, and never what the server said.
 */
export function serverErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
  } as unknown as Response;
}

/**
 * A 404 carrying the server's own sentence.
 *
 * The message is the one axis that genuinely varied across the seven copies,
 * and it varies for a reason: a call site asserting that the screen tells a
 * missing film from a broken request wants the sentence its own route sends.
 * The default is the API's most common one, so a test with nothing to say about
 * the body says nothing.
 */
export function notFoundResponse(error = 'Movie not found'): Response {
  return {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}
