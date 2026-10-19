import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Typography from '@mui/material/Typography';

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
    <FormGroup role="group" aria-label={label}>
      {options.map((option) => (
        <FormControlLabel
          key={option.value}
          control={
            <Checkbox
              size="small"
              checked={selected.includes(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
          }
          label={
            <>
              {option.label}
              {option.count !== undefined && (
                <Typography component="span" variant="body2" color="text.secondary">
                  {` (${option.count})`}
                </Typography>
              )}
            </>
          }
        />
      ))}
    </FormGroup>
  );
}
