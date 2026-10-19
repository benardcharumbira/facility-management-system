export interface CheckboxOption {
  value: string;
  label: string;
  /** Number of results with this value, shown beside the label. */
  count?: number;
}

export interface CheckboxGroupFilterProps {
  /** Programmatic label for the group. */
  label: string;
  options: CheckboxOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}

/** Multi select as a labelled checkbox group. */
export function CheckboxGroupFilter({
  label,
  options,
  selected,
  onChange,
}: CheckboxGroupFilterProps) {
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));

  return (
    <div role="group" aria-label={label} className="flex flex-col">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-sunken"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={(event) => toggle(option.value, event.target.checked)}
            className="size-4 shrink-0 accent-primary"
          />
          <span className="min-w-0 flex-1">{option.label}</span>
          {option.count !== undefined && (
            <span className="text-subtle tabular-nums">{option.count}</span>
          )}
        </label>
      ))}
    </div>
  );
}
