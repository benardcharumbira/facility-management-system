import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

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
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as V)}
      sx={{ minWidth: (theme) => theme.spacing(24) }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
