import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { RowSection } from './RowSection';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { theme } from '@/styles/theme';

function renderSection(
  props: Partial<React.ComponentProps<typeof RowSection>> = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <RowSection
        title={props.title ?? 'Action'}
        titleSize={props.titleSize ?? 22}
        icon={props.icon}
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

describe('RowSection — the optional leading icon', () => {
  it('renders the icon inside the heading, before the title text', () => {
    renderSection({
      title: 'Favorites',
      icon: <span data-testid="mark">✳</span>,
    });

    const heading = screen.getByRole('heading', { name: 'Favorites' });
    const mark = screen.getByTestId('mark');

    // Inside the heading, not beside it: the prototype's h2 is the flex
    // container, so the mark and the word share one baseline box.
    expect(heading.contains(mark)).toBe(true);
    expect(heading.firstElementChild).toBe(mark);
    expect(comesBefore(mark, screen.getByText('row body'))).toBe(true);
  });

  it('renders an icon only when given one', () => {
    const withIcon = renderSection({
      title: 'Favorites',
      icon: <span data-testid="mark">✳</span>,
    });
    expect(
      screen.getByRole('heading', { name: 'Favorites' }).firstElementChild
    ).not.toBeNull();
    withIcon.unmount();

    renderSection({ title: 'Action' });
    expect(
      screen.getByRole('heading', { name: 'Action' }).firstElementChild
    ).toBeNull();
    expect(screen.queryByTestId('mark')).toBeNull();
  });

  it('names the region by its title alone, undisturbed by a decorative icon', () => {
    // The icon is passed with no `title`, so it is aria-hidden and contributes
    // nothing to the name. A row called "❤ Favorites" is not what a screen
    // reader user should hear when jumping between shelves.
    renderSection({
      title: 'Favorites',
      icon: (
        <svg aria-hidden="true" data-testid="mark">
          <path d="" />
        </svg>
      ),
    });

    // The icon is on screen — the clean name below is despite it, not for want
    // of it.
    expect(screen.getByTestId('mark')).toBeDefined();
    expect(screen.getByRole('region', { name: 'Favorites' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Favorites' })
    ).toBeDefined();
  });

  it('lets a leading icon and a trailing action coexist, in reading order', () => {
    renderSection({
      title: 'Favorites',
      icon: <span data-testid="mark">✳</span>,
      action: <button type="button">View all 214</button>,
    });

    const mark = screen.getByTestId('mark');
    const action = screen.getByRole('button', { name: 'View all 214' });
    const heading = screen.getByRole('heading', { name: 'Favorites' });

    expect(comesBefore(mark, action)).toBe(true);
    expect(heading.contains(action)).toBe(false);
  });

  it('keeps the trailing action baseline-aligned to the heading', () => {
    // Inline-level is load-bearing. `Header` aligns on the baseline so a 14px
    // action sits on the same line as a 22px serif heading; a block-level
    // `flex` title would establish its own box and drop the action off it.
    renderSection({
      title: 'Favorites',
      icon: <span data-testid="mark">✳</span>,
      action: <button type="button">View all 214</button>,
    });

    const heading = screen.getByRole('heading', { name: 'Favorites' });
    const header = heading.parentElement as HTMLElement;

    expect(getComputedStyle(header).alignItems).toBe('baseline');
    expect(getComputedStyle(heading).display).toBe('inline-flex');
  });

  it('sets the icon 10px from the title text, vertically centred', () => {
    renderSection({
      title: 'Favorites',
      icon: <span data-testid="mark">✳</span>,
    });

    const heading = getComputedStyle(
      screen.getByRole('heading', { name: 'Favorites' })
    );
    expect(heading.gap).toBe('10px');
    expect(heading.alignItems).toBe('center');
  });

  it('drops the icon into the heading bare, colouring nothing', () => {
    // Domain-blindness, asserted. An accent heart is `FavoritesRow`'s knowledge,
    // not this section's. The mark the caller passes is the heading's own child
    // — no wrapper of `RowSection`'s in between that could paint it — and the
    // heading itself carries the ordinary text colour, not the accent.
    renderSection({
      title: 'Favorites',
      icon: <span data-testid="mark">✳</span>,
    });

    const heading = screen.getByRole('heading', { name: 'Favorites' });
    const mark = screen.getByTestId('mark');

    expect(mark.parentElement).toBe(heading);
    expect(getComputedStyle(heading).color).toBe('rgb(243, 236, 224)');
  });
});
