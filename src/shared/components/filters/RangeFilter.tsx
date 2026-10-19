import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState } from 'react';

export interface Range {
  min: number | undefined;
  max: number | undefined;
}

export interface RangeFilterProps {
  /** Programmatic label, e.g. "Capacity". */
  label: string;
  /** Bounds of the whole range, from the data. */
  bounds: { min: number; max: number };
  /** Applied range. An undefined end means "no limit". */
  value: Range;
  /** Committed on slider release, on blur and on Enter. Ends at the bounds are sent as undefined. */
  onChange: (value: Range) => void;
}

/** A slider paired with numeric inputs, since a slider alone is hard to set precisely. */
export function RangeFilter({ label, bounds, value, onChange }: RangeFilterProps) {
  const applied: [number, number] = [value.min ?? bounds.min, value.max ?? bounds.max];
  const [dragging, setDragging] = useState<[number, number] | null>(null);
  const [drafts, setDrafts] = useState<{ min?: string; max?: string }>({});

  const clamp = (n: number) => Math.min(bounds.max, Math.max(bounds.min, n));
  const commit = ([low, high]: [number, number]) =>
    onChange({
      min: low <= bounds.min ? undefined : low,
      max: high >= bounds.max ? undefined : high,
    });

  const commitInput = (end: 'min' | 'max') => {
    const raw = drafts[end];
    setDrafts((previous) => ({ ...previous, [end]: undefined }));
    if (raw === undefined) return;
    const parsed = raw.trim() === '' ? undefined : Number(raw);
    if (parsed !== undefined && !Number.isFinite(parsed)) return;
    const next: [number, number] = [...applied];
    if (end === 'min') next[0] = parsed === undefined ? bounds.min : clamp(parsed);
    else next[1] = parsed === undefined ? bounds.max : clamp(parsed);
    if (next[0] > next[1]) {
      if (end === 'min') next[1] = next[0];
      else next[0] = next[1];
    }
    commit(next);
  };

  const shown = dragging ?? applied;
  const input = (end: 'min' | 'max', text: string) => (
    <TextField
      size="small"
      label={text}
      value={drafts[end] ?? String(end === 'min' ? shown[0] : shown[1])}
      onChange={(event) => setDrafts((previous) => ({ ...previous, [end]: event.target.value }))}
      onBlur={() => commitInput(end)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commitInput(end);
      }}
      slotProps={{
        htmlInput: { inputMode: 'numeric', 'aria-label': `${text} ${label.toLowerCase()}` },
      }}
    />
  );

  return (
    <Stack spacing={1} role="group" aria-label={label} sx={{ px: 1 }}>
      <Slider
        value={shown}
        min={bounds.min}
        max={bounds.max}
        onChange={(_, next) => setDragging(next as [number, number])}
        onChangeCommitted={(_, next) => {
          setDragging(null);
          commit(next as [number, number]);
        }}
        getAriaLabel={(index) => `${index === 0 ? 'Minimum' : 'Maximum'} ${label.toLowerCase()}`}
        valueLabelDisplay="auto"
        disableSwap
      />
      <Stack direction="row" spacing={1}>
        {input('min', 'Min')}
        {input('max', 'Max')}
      </Stack>
    </Stack>
  );
}
