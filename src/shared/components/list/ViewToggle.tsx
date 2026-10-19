import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { ReactNode } from 'react';

export interface ViewOption<V extends string> {
  value: V;
  label: string;
  icon: ReactNode;
}

export interface ViewToggleProps<V extends string> {
  value: V;
  options: ReadonlyArray<ViewOption<V>>;
  onChange: (value: V) => void;
  label?: string;
}

/** Exclusive toggle between presentations of the same results (grid, list). */
export function ViewToggle<V extends string>({
  value,
  options,
  onChange,
  label = 'View',
}: ViewToggleProps<V>) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      aria-label={label}
      onChange={(_, next: V | null) => {
        if (next !== null) onChange(next);
      }}
    >
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value} aria-label={option.label}>
          {option.icon}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
