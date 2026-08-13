import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { LoadMessage, type LoadMessageProps } from '@/components';
import { Button } from '@/primitives';
import { theme } from '@/styles/theme';

function renderLoadMessage(props: Partial<LoadMessageProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LoadMessage
        title={props.title ?? 'Your library is empty'}
        body={props.body ?? 'Add a movie to start filling your shelves.'}
        action={props.action}
      />
    </ThemeProvider>
  );
}

describe('LoadMessage', () => {
  it('shows its title and its body', () => {
    renderLoadMessage({
      title: 'Couldn’t load your library',
      body: 'Something went wrong reading your movies.',
    });

    expect(screen.getByText('Couldn’t load your library')).toBeTruthy();
    expect(
      screen.getByText('Something went wrong reading your movies.')
    ).toBeTruthy();
  });
});

describe('LoadMessage — the action', () => {
  it('offers nothing when there is nothing to do', () => {
    // An empty library has no failure to retry — a control here would be one
    // that can never work.
    renderLoadMessage();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders the action it is given, still working', () => {
    const onClick = vi.fn();
    renderLoadMessage({
      title: 'Couldn’t load your library',
      body: 'Something went wrong reading your movies.',
      action: <Button label="Retry" variant="secondary" onClick={onClick} />,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
