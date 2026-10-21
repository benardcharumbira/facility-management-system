import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Pagination, ResultsGrid, SearchField } from '@/shared/components';
import { DensityProvider } from './Density';
import { DecisionDialog, type DecisionDialogProps } from './DecisionDialog';
import { QueueItem } from './QueueItem';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

function Shortcuts({ onKey }: { onKey: (key: string) => void }) {
  useKeyboardShortcuts([
    { keys: ['j'], handler: () => onKey('j') },
    {
      keys: ['ArrowDown'],
      handler: () => onKey('down'),
      when: (e) => e.target instanceof HTMLButtonElement,
    },
  ]);
  return (
    <>
      <input aria-label="Name" />
      <textarea aria-label="Notes" />
      <select aria-label="Pick">
        <option>One</option>
      </select>
      <button>Press</button>
    </>
  );
}

describe('useKeyboardShortcuts', () => {
  it('fires on a bare key press', async () => {
    const onKey = vi.fn();
    render(<Shortcuts onKey={onKey} />);
    await userEvent.keyboard('j');
    expect(onKey).toHaveBeenCalledWith('j');
  });

  it.each(['Name', 'Notes', 'Pick'])('never fires from within a field (%s)', async (label) => {
    const onKey = vi.fn();
    render(<Shortcuts onKey={onKey} />);
    await userEvent.click(screen.getByLabelText(label));
    await userEvent.keyboard('j');
    expect(onKey).not.toHaveBeenCalled();
  });

  it('ignores a key held with Ctrl, Cmd or Alt, which belong to the browser', async () => {
    const onKey = vi.fn();
    render(<Shortcuts onKey={onKey} />);
    await userEvent.keyboard('{Control>}j{/Control}{Meta>}j{/Meta}{Alt>}j{/Alt}');
    expect(onKey).not.toHaveBeenCalled();
  });

  it('does not fire while a dialog is open', async () => {
    const onKey = vi.fn();
    render(
      <>
        <Shortcuts onKey={onKey} />
        <div role="alertdialog" aria-label="Open" />
      </>,
    );
    await userEvent.keyboard('j');
    expect(onKey).not.toHaveBeenCalled();
  });

  it('honours a binding’s own condition', async () => {
    const onKey = vi.fn();
    render(<Shortcuts onKey={onKey} />);
    await userEvent.keyboard('{ArrowDown}');
    expect(onKey).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Press' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(onKey).toHaveBeenCalledWith('down');
  });
});

function Harness(props: Partial<DecisionDialogProps> & { required?: boolean }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(true);
  return (
    <DecisionDialog
      open={open}
      onOpenChange={setOpen}
      title="Decide"
      description="What follows."
      confirmLabel="Confirm"
      initialFocus="field"
      field={{
        label: 'Reason',
        value,
        onChange: setValue,
        required: props.required ?? true,
        requiredMessage: 'A reason is needed.',
      }}
      onConfirm={async () => {}}
      {...props}
    />
  );
}

describe('DecisionDialog', () => {
  it('blocks a required field left blank, names the problem, and does not call out', async () => {
    const onConfirm = vi.fn(async () => {});
    render(<Harness onConfirm={onConfirm} />);
    const dialog = await screen.findByRole('alertdialog', { name: 'Decide' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByText('A reason is needed.')).toBeVisible();
    expect(within(dialog).getByLabelText(/^Reason/)).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps the text and offers only a way on after a final failure', async () => {
    const onContinue = vi.fn();
    render(
      <Harness
        onConfirm={async () => {
          throw new Error('taken');
        }}
        describeFailure={() => ({ title: 'Taken', message: 'Someone else did it.', final: true })}
        onContinue={onContinue}
      />,
    );
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'my words');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    expect(await within(dialog).findByText('Someone else did it.')).toBeVisible();
    expect(within(dialog).getByLabelText(/^Reason/)).toHaveValue('my words');
    expect(within(dialog).queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('lets a failure that can be retried be retried', async () => {
    let attempts = 0;
    render(
      <Harness
        required={false}
        initialFocus="confirm"
        onConfirm={async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('flaky');
        }}
      />,
    );
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByText('flaky')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(attempts).toBe(2);
  });
});

describe('QueueItem', () => {
  const item = (selected: boolean) => (
    <MemoryRouter>
      <QueueItem
        itemId="a"
        to="/x/a"
        selected={selected}
        label="MVL-1, New request"
        title="MVL-1"
        lines={['Hall', 'Today']}
        flags={<span>Flag</span>}
      />
    </MemoryRouter>
  );

  it('is one link, announced as current when selected', () => {
    const { unmount } = render(item(true));
    const link = screen.getByRole('link', { name: 'MVL-1, New request' });
    expect(link).toHaveAttribute('aria-current', 'true');
    expect(link).toHaveAttribute('href', '/x/a');
    unmount();
    render(item(false));
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
  });
});

describe('the density variant', () => {
  it('tightens the shared list primitives without forking them', () => {
    const { rerender } = render(
      <DensityProvider density="comfortable">
        <SearchField label="Search" value="" onChange={() => {}} />
        <Pagination envelope={{ page: 1, totalPages: 3 }} onChange={() => {}} />
        <ResultsGrid layout="rows" label="Rows">
          <span>one</span>
        </ResultsGrid>
      </DensityProvider>,
    );
    const roomy = {
      input: screen.getByRole('searchbox').className,
      page: screen.getByRole('button', { name: 'Go to page 2' }).className,
      grid: screen.getByRole('list', { name: 'Rows' }).className,
    };
    expect(roomy.input).toContain('h-11');
    expect(roomy.page).toContain('h-10');
    expect(roomy.grid).toContain('gap-4');

    rerender(
      <DensityProvider density="compact">
        <SearchField label="Search" value="" onChange={() => {}} />
        <Pagination envelope={{ page: 1, totalPages: 3 }} onChange={() => {}} />
        <ResultsGrid layout="rows" label="Rows">
          <span>one</span>
        </ResultsGrid>
      </DensityProvider>,
    );
    expect(screen.getByRole('searchbox').className).toContain('h-9');
    expect(screen.getByRole('button', { name: 'Go to page 2' }).className).toContain('h-8');
    expect(screen.getByRole('list', { name: 'Rows' }).className).toContain('gap-1');
  });

  it('is comfortable unless a screen asks otherwise', () => {
    render(<SearchField label="Search" value="" onChange={() => {}} />);
    expect(screen.getByRole('searchbox').className).toContain('h-11');
  });
});
