import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { RowSection } from './RowSection';
import { theme } from '@/styles/theme';

function renderSection(
  props: Partial<React.ComponentProps<typeof RowSection>> = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <RowSection
        title={props.title ?? 'Action'}
        titleSize={props.titleSize ?? 22}
        action={props.action}
      >
        {props.children ?? <div>row body</div>}
      </RowSection>
    </ThemeProvider>
  );
}

describe('RowSection — the shared chrome of a home row', () => {
  it('exposes a region named by its heading, so a screen reader can jump to it', () => {
    renderSection({ title: 'Continue Watching' });

    expect(
      screen.getByRole('region', { name: 'Continue Watching' })
    ).toBeDefined();
  });

  it('titles the row with a level-2 heading', () => {
    renderSection({ title: 'Action' });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Action' })
    ).toBeDefined();
  });

  it('renders whatever body it is handed', () => {
    renderSection({ children: <div>a carousel would go here</div> });

    expect(screen.getByText('a carousel would go here')).toBeDefined();
  });

  it('names two rows on one screen independently', () => {
    render(
      <ThemeProvider theme={theme}>
        <RowSection title="Continue Watching" titleSize={24}>
          <div>resume tiles</div>
        </RowSection>
        <RowSection title="Action" titleSize={22}>
          <div>poster cards</div>
        </RowSection>
      </ThemeProvider>
    );

    // Each section labels itself from its own heading; two on a page must not
    // collide on one id and end up sharing a name.
    expect(
      screen.getByRole('region', { name: 'Continue Watching' })
    ).toBeDefined();
    expect(screen.getByRole('region', { name: 'Action' })).toBeDefined();
  });
});

describe('RowSection — the heading size the caller asks for', () => {
  it('renders the heading at the given size', () => {
    // The prototype means the difference: Continue Watching is 24px and a genre
    // row is 22px. The extraction parameterises the size, it does not harmonise
    // it, so the size a caller passes has to reach the rendered heading.
    renderSection({ title: 'Continue Watching', titleSize: 24 });

    const heading = screen.getByRole('heading', { name: 'Continue Watching' });
    expect(getComputedStyle(heading).fontSize).toBe('24px');
  });

  it('renders a different caller’s heading at its own size', () => {
    renderSection({ title: 'Action', titleSize: 22 });

    const heading = screen.getByRole('heading', { name: 'Action' });
    expect(getComputedStyle(heading).fontSize).toBe('22px');
  });
});

describe('RowSection — the optional trailing action', () => {
  it('renders the action beside the heading when given one', () => {
    renderSection({
      title: 'Action',
      action: <button type="button">View all 214</button>,
    });

    const heading = screen.getByRole('heading', { name: 'Action' });
    const header = heading.parentElement as HTMLElement;
    expect(
      within(header).getByRole('button', { name: 'View all 214' })
    ).toBeDefined();
  });

  it('renders no action at all when not given one', () => {
    renderSection({ title: 'Continue Watching' });

    expect(screen.queryByRole('button')).toBeNull();
  });
});
