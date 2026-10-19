import { Slider } from 'radix-ui';
import { useId, useState } from 'react';

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
  const id = useId();
  const applied: [number, number] = [value.min ?? bounds.min, value.max ?? bounds.max];
  const [dragging, setDragging] = useState<number[] | null>(null);
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
    <div className="flex-1">
      <label htmlFor={`${id}-${end}`} className="mb-1 block text-xs text-muted">
        {text}
      </label>
      <input
        id={`${id}-${end}`}
        inputMode="numeric"
        aria-label={`${text} ${label.toLowerCase()}`}
        value={drafts[end] ?? String(end === 'min' ? shown[0] : shown[1])}
        onChange={(event) => setDrafts((previous) => ({ ...previous, [end]: event.target.value }))}
        onBlur={() => commitInput(end)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitInput(end);
        }}
        className="h-9 w-full rounded-md border border-line-strong bg-surface px-2 tabular-nums"
      />
    </div>
  );

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <Slider.Root
        value={shown}
        min={bounds.min}
        max={bounds.max}
        minStepsBetweenThumbs={0}
        onValueChange={setDragging}
        onValueCommit={(next) => {
          setDragging(null);
          const [low = bounds.min, high = bounds.max] = next;
          commit([low, high]);
        }}
        className="relative flex h-5 w-full touch-none items-center select-none"
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-line-strong">
          <Slider.Range className="absolute h-full rounded-full bg-primary" />
        </Slider.Track>
        {['Minimum', 'Maximum'].map((which) => (
          <Slider.Thumb
            key={which}
            aria-label={`${which} ${label.toLowerCase()}`}
            className="block size-5 rounded-full border-2 border-primary bg-surface shadow-sm"
          />
        ))}
      </Slider.Root>
      <div className="flex gap-2">
        {input('min', 'Min')}
        {input('max', 'Max')}
      </div>
    </div>
  );
}
