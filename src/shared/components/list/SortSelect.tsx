import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

export interface SortOption<V extends string> {
  value: V;
  label: string;
}

export interface SortSelectProps<V extends string> {
  value: V;
  options: ReadonlyArray<SortOption<V>>;
  onChange: (value: V) => void;
  label?: string;
}

export function SortSelect<V extends string>({
  value,
  options,
  onChange,
  label = 'Sort by',
}: SortSelectProps<V>) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as V)}
          className="h-10 appearance-none rounded-md border border-line-strong bg-surface pr-9 pl-3 text-sm"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
