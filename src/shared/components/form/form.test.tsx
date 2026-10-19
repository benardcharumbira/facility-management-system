import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorSummary } from './ErrorSummary';
import { FileUpload, type UploadItem } from './FileUpload';
import { FormField } from './FormField';
import { FormStepper } from './FormStepper';
import { QuantityStepper } from './QuantityStepper';

describe('FormField', () => {
  it('ties label, hint and error to the control', () => {
    render(
      <FormField id="f" label="Name" hint="As on your ID" error="Enter a name" required>
        {(control) => <input {...control} />}
      </FormField>,
    );
    const input = screen.getByLabelText(/^Name/);
    expect(input).toHaveAccessibleDescription('As on your ID Enter a name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('(required)')).toHaveClass('sr-only');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
  });
});

describe('QuantityStepper', () => {
  function Harness({ max }: { max?: number }) {
    const [value, setValue] = useState(2);
    return <QuantityStepper name="Chairs" value={value} onChange={setValue} max={max} />;
  }

  it('steps, accepts typed numbers and respects the limits', async () => {
    render(<Harness max={10} />);
    const input = screen.getByRole('textbox', { name: 'Chairs quantity' });
    await userEvent.click(screen.getByRole('button', { name: 'Increase Chairs' }));
    expect(input).toHaveValue('3');
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Chairs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Chairs' }));
    expect(input).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Decrease Chairs' })).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, '99{Enter}');
    expect(input).toHaveValue('10');
    expect(screen.getByText('Only 10 available, so the quantity was set to 10.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Increase Chairs' })).toBeDisabled();
  });

  it('ignores anything that is not a digit', async () => {
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Chairs quantity' });
    await userEvent.clear(input);
    await userEvent.type(input, 'a1b2');
    await userEvent.tab();
    expect(input).toHaveValue('12');
  });
});

describe('FileUpload', () => {
  const props = {
    acceptedTypes: [{ extension: '.pdf', label: 'PDF' }],
    maxFileSizeBytes: 1024,
    maxFiles: 2,
    onRemove: () => {},
    onRetry: () => {},
  };

  it('states the rules, passes on valid files and refuses others with the reason', async () => {
    const onSelect = vi.fn();
    render(<FileUpload {...props} items={[]} onSelect={onSelect} />);
    expect(
      screen.getByText(/Accepted: PDF\. Up to 1 KB each, and at most 2 files\./),
    ).toBeVisible();

    const user = userEvent.setup({ applyAccept: false });
    const input = screen.getByLabelText('Choose files');
    await user.upload(input, [
      new File(['x'], 'ok.pdf'),
      new File(['x'], 'bad.exe'),
      new File([new Uint8Array(2048)], 'big.pdf'),
    ]);
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ name: 'ok.pdf' })]);
    const problems = screen.getByRole('alert');
    expect(within(problems).getByText('bad.exe is not an accepted type.')).toBeVisible();
    expect(within(problems).getByText('big.pdf is larger than 1 KB.')).toBeVisible();
  });

  it('shows progress, and retry and remove for a failure', async () => {
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    const items: UploadItem[] = [
      { id: 'a', name: 'a.pdf', sizeBytes: 10, status: 'uploading', progress: 0.4 },
      { id: 'b', name: 'b.pdf', sizeBytes: 10, status: 'failed', progress: 0, error: 'Too slow' },
    ];
    render(
      <FileUpload
        {...props}
        items={items}
        onSelect={() => {}}
        onRetry={onRetry}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByRole('progressbar', { name: 'Uploading a.pdf' })).toHaveValue(40);
    expect(screen.getByText('Upload failed: Too slow')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove a.pdf' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry b.pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove b.pdf' }));
    expect(onRetry).toHaveBeenCalledWith('b');
    expect(onRemove).toHaveBeenCalledWith('b');
  });

  it('refuses files beyond the limit', async () => {
    const onSelect = vi.fn();
    const items: UploadItem[] = [
      { id: 'a', name: 'a.pdf', sizeBytes: 1, status: 'done', progress: 1 },
      { id: 'b', name: 'b.pdf', sizeBytes: 1, status: 'done', progress: 1 },
    ];
    render(<FileUpload {...props} items={items} onSelect={onSelect} />);
    await userEvent.upload(screen.getByLabelText('Choose files'), new File(['x'], 'c.pdf'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('c.pdf was not added: the limit is 2 files.')).toBeVisible();
  });
});

describe('ErrorSummary', () => {
  it('takes focus when signalled and moves to a field from its link', async () => {
    render(
      <>
        <ErrorSummary errors={[{ fieldId: 'x', message: 'Fix x' }]} focusSignal={1} />
        <input id="x" aria-label="x" />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveFocus();
    await userEvent.click(screen.getByRole('link', { name: 'Fix x' }));
    expect(screen.getByLabelText('x')).toHaveFocus();
  });

  it('renders nothing without errors', () => {
    const { container } = render(<ErrorSummary errors={[]} focusSignal={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FormStepper', () => {
  it('states every step in text and lets visited steps be revisited', async () => {
    const onSelect = vi.fn();
    render(
      <FormStepper
        onSelect={onSelect}
        steps={[
          { id: 'a', label: 'One', status: 'complete', reachable: true },
          { id: 'b', label: 'Two', status: 'current', reachable: true },
          { id: 'c', label: 'Three', status: 'attention', reachable: true },
          { id: 'd', label: 'Four', status: 'upcoming', reachable: false },
        ]}
      />,
    );
    expect(screen.getByText('Step 1: One, completed')).toBeInTheDocument();
    expect(screen.getByText('Step 2: Two, current step')).toBeInTheDocument();
    expect(screen.getByText('Step 3: Three, needs attention')).toBeInTheDocument();
    expect(screen.getByText('Step 4: Four, not started')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Step 4/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Step 1: One/ }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });
});
