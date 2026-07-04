import 'styled-components';
import type { Theme } from './theme';

/**
 * Teaches styled-components that `props.theme` is our `Theme`, so `.styles.ts`
 * files get full autocomplete and type-checking on tokens with no `any`.
 */
declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends Theme {}
}
