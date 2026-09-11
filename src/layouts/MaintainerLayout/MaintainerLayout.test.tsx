import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import {
  MaintainerLayout,
  type MaintainerLayoutProps,
} from './MaintainerLayout';
import { theme } from '@/styles/theme';

function renderLayout(
  children: React.ReactNode,
  props: Omit<Partial<MaintainerLayoutProps>, 'children'> = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <MaintainerLayout {...props}>{children}</MaintainerLayout>
    </ThemeProvider>
  );
}

/** The column the screen lands in — the element directly around the content. */
const column = () =>
  screen.getByText('the form goes here').parentElement as HTMLElement;

/**
 * The **Maintainer surface** — the sheet the **Movie form**, Settings and bulk
 * import share. Structure only: it renders what it is given and takes the
 * width it is asked for, and that is the whole of it. The header row is each
 * screen's own until the prototype is amended to one sheet.
 */
describe('MaintainerLayout', () => {
  it('renders the screen it is handed', () => {
    renderLayout(<p>the form goes here</p>);

    expect(screen.getByText('the form goes here')).toBeDefined();
  });

  it('draws the column at the form’s measure unless told otherwise', () => {
    renderLayout(<p>the form goes here</p>);

    // 760 is what two of the three maintainer prototypes draw; on
    // `FilterDropdown`'s precedent, a geometry value the caller chooses is
    // the one kind of style worth reading back.
    expect(getComputedStyle(column()).maxWidth).toBe('760px');
  });

  it('draws the column at the measure it is asked for', () => {
    renderLayout(<p>the form goes here</p>, { width: 780 });

    expect(getComputedStyle(column()).maxWidth).toBe('780px');
  });
});
