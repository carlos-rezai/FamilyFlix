/**
 * The **Snackbar stack**'s node, reached by what the prototype draws.
 *
 * The stack has no role and no semantics on purpose — the roles are on the
 * cards — so when it is empty there is nothing to hear it by. What makes it
 * the stack is its geometry: the one fixed, reversed column in the document,
 * as `FamilyFlix.dc.html` draws the container's host and design log 18 Q20
 * rules it. Found by that, on the molecule test's `accentBar()` precedent,
 * rather than by an attribute the app would carry for its tests alone.
 * Throws, naming itself, when there is none.
 */
export function snackbarStack(): HTMLElement {
  const stack = Array.from(document.body.querySelectorAll('div')).find(
    (node) => {
      const style = getComputedStyle(node);
      return (
        style.position === 'fixed' && style.flexDirection === 'column-reverse'
      );
    }
  );
  if (stack === undefined) {
    throw new Error('snackbarStack: no fixed, reversed column in the document');
  }
  return stack;
}
