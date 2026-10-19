import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchField } from './SearchField';

function Harness({ onCommit, debounceMs }: { onCommit: (v: string) => void; debounceMs?: number }) {
  const [value, setValue] = useState('');
  return (
    <SearchField
      label="Search"
      value={value}
      debounceMs={debounceMs}
      onChange={(next) => {
        setValue(next);
        onCommit(next);
      }}
    />
  );
}

describe('SearchField', () => {
  it('commits once after typing pauses, not per keystroke', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} debounceMs={100} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'civic');
    expect(onCommit).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    expect(onCommit).toHaveBeenCalledWith('civic');
  });

  it('commits immediately on Enter and on clear', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} debounceMs={10_000} />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    await userEvent.type(input, 'pool{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith('pool');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search text' }));
    expect(onCommit).toHaveBeenLastCalledWith('');
    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear search text' })).not.toBeInTheDocument();
  });
});
