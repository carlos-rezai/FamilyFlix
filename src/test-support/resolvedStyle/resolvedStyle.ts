/**
 * The states jsdom cannot put an element in. It computes no `:hover`,
 * `:active` or `:focus-visible`, so a suite that has to know what a press or a
 * hover *paints* names the state here instead.
 *
 * Focus comes in the two kinds a browser tells apart: `focus` is a click's —
 * `:focus` matches and `:focus-visible` does not — and `focusVisible` is the
 * keyboard's, which matches both, as a browser's does.
 */
export interface StyleState {
  hover?: boolean;
  active?: boolean;
  focus?: boolean;
  focusVisible?: boolean;
}

/**
 * One CSS value as the cascade tests compare it: whitespace collapsed, and a
 * leading `0.` written `.`, so `scale(0.94)` and `scale(.94)` are one number.
 */
export function normCss(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .replace(/(^|[(, :])0\./g, '$1.')
    .trim();
}

interface Declaration {
  value: string;
  important: boolean;
  specificity: number;
  order: number;
}

/** Every style tag's text, with comments and every at-rule block removed. */
function stylesheetText(): string {
  let css = Array.from(document.querySelectorAll('style'))
    .map((tag) => tag.textContent ?? '')
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  // An at-rule (`@media`, `@keyframes`) holds rules of its own; none of them
  // applies unconditionally, so none is read. Innermost blocks go first.
  const atRule = /@[^{};]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g;
  while (atRule.test(css)) {
    css = css.replace(atRule, '');
  }
  return css;
}

function pseudoMatches(
  pseudo: string,
  element: Element,
  state: StyleState
): boolean {
  const disabled = element.matches(':disabled');
  switch (pseudo) {
    case 'hover':
      return state.hover === true;
    case 'active':
      return state.active === true;
    case 'focus-visible':
      return state.focusVisible === true;
    case 'focus':
      return state.focus === true || state.focusVisible === true;
    case 'enabled':
      return !disabled;
    case 'disabled':
      return disabled;
    default:
      // Anything else — a pseudo-element, `:first-child`, `:checked` — is not
      // a state this helper models, so the rule is left out rather than
      // guessed at.
      return false;
  }
}

const COMPOUND =
  /\.(-?[_a-zA-Z][\w-]*)|:not\(:([\w-]+)\)|:([\w-]+)|(\[[^\]]*\])|^([a-zA-Z][\w-]*)|(\*)/g;

/** The states `StyleState` names, which the DOM's own `matches` cannot see. */
const STATE_PSEUDO =
  /:(hover|active|focus|focus-visible|focus-within)(?![\w-])/;

/**
 * The specificity of one compound selector if it applies to `element` in
 * `state`, or `null` if it does not — or if it holds anything the tokens
 * below do not read.
 */
function compoundSpecificity(
  compound: string,
  element: Element,
  state: StyleState
): number | null {
  if (compound === '') {
    return null;
  }
  let consumed = 0;
  let classes = 0;
  let types = 0;
  for (const match of compound.matchAll(COMPOUND)) {
    if (match.index !== consumed) {
      return null;
    }
    consumed += match[0].length;
    const [, className, notPseudo, pseudo, attribute, type] = match;
    if (className !== undefined) {
      if (!element.classList.contains(className)) return null;
      classes += 1;
    } else if (notPseudo !== undefined) {
      if (pseudoMatches(notPseudo, element, state)) return null;
      classes += 1;
    } else if (pseudo !== undefined) {
      if (!pseudoMatches(pseudo, element, state)) return null;
      classes += 1;
    } else if (attribute !== undefined) {
      if (!element.matches(attribute)) return null;
      classes += 1;
    } else if (type !== undefined) {
      if (element.tagName.toLowerCase() !== type.toLowerCase()) return null;
      types += 1;
    }
  }
  if (consumed !== compound.length) {
    return null;
  }
  return classes * 1000 + types;
}

/**
 * The specificity of the part of a selector before its last compound, counted
 * without matching — whether it matches is the DOM's question, not this one.
 */
function contextSpecificity(context: string): number {
  let classes = 0;
  let types = 0;
  for (const compound of context.split(/[\s>+~]+/)) {
    for (const match of compound.matchAll(COMPOUND)) {
      if (match[5] !== undefined) {
        types += 1;
      } else if (match[6] === undefined) {
        classes += 1;
      }
    }
  }
  return classes * 1000 + types;
}

/**
 * The specificity of one selector if it applies to `element` in `state`, or
 * `null` if it does not.
 *
 * A selector with a combinator applies when its last compound matches the
 * element in `state` and the part before it matches the element's ancestors or
 * siblings — asked of the DOM's own `matches`, since those carry no state; the
 * specificity is the two parts summed. A state on that part
 * (`.row:hover .overlay`) is not modelled, and such a rule is left out rather
 * than guessed at.
 */
function specificityIfMatching(
  selector: string,
  element: Element,
  state: StyleState
): number | null {
  if (selector.includes('::')) {
    return null;
  }
  const tidy = selector.replace(/\s*([>+~])\s*/g, '$1').trim();
  const split = /^(.*[\s>+~])([^\s>+~]+)$/.exec(tidy);
  if (split === null) {
    return compoundSpecificity(tidy, element, state);
  }
  const [, context, subject] = split;
  const own = compoundSpecificity(subject, element, state);
  if (own === null || STATE_PSEUDO.test(context)) {
    return null;
  }
  try {
    if (!element.matches(`${context}*`)) return null;
  } catch {
    return null;
  }
  return own + contextSpecificity(context);
}

/**
 * What the injected stylesheets resolve to for `element` in `state` — the
 * cascade run by hand, since jsdom will not run it for a state it cannot enter:
 * every rule whose selector applies, `!important` first, then specificity,
 * then stylesheet order. Only longhand-as-written property names come back; a
 * shorthand is not expanded.
 */
export function resolvedStyle(
  element: Element,
  state: StyleState = {}
): Record<string, string> {
  const winners = new Map<string, Declaration>();
  let order = 0;
  for (const rule of stylesheetText().matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const specificity = rule[1]
      .split(',')
      .map((selector) => specificityIfMatching(selector.trim(), element, state))
      .reduce<number | null>(
        (best, next) =>
          next !== null && (best === null || next > best) ? next : best,
        null
      );
    if (specificity === null) continue;
    for (const raw of rule[2].split(';')) {
      const colon = raw.indexOf(':');
      if (colon <= 0) continue;
      order += 1;
      const property = raw.slice(0, colon).trim();
      let value = raw.slice(colon + 1).trim();
      const important = /!important$/.test(value);
      value = value.replace(/\s*!important$/, '');
      const candidate = { value, important, specificity, order };
      const current = winners.get(property);
      if (
        current === undefined ||
        Number(candidate.important) > Number(current.important) ||
        (candidate.important === current.important &&
          candidate.specificity >= current.specificity)
      ) {
        winners.set(property, candidate);
      }
    }
  }
  return Object.fromEntries(
    [...winners].map(([property, declaration]) => [
      property,
      normCss(declaration.value),
    ])
  );
}
