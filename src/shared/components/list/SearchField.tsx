import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react';
import { cn } from '@/shared/utils/cn';
import { useDensity } from '../backoffice/Density';

export interface SearchFieldProps {
  /** The committed value, typically from the URL. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  debounceMs?: number;
  /** Lets a screen focus the field, for a keyboard shortcut. */
  inputRef?: Ref<HTMLInputElement>;
}

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Controlled by the committed `value`. Typing updates a local draft and commits through
 * `onChange` after a pause, on Enter, or on clear. External changes to `value` (Back
 * button, "clear all") replace the draft.
 */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  inputRef,
}: SearchFieldProps) {
  const id = useId();
  const compact = useDensity() === 'compact';
  const [draft, setDraft] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    setDraft(value);
  }

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChangeRef.current(draft), debounceMs);
    return () => clearTimeout(timer);
  }, [draft, value, debounceMs]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (draft !== value) onChange(draft);
  };

  return (
    <form role="search" onSubmit={handleSubmit}>
      <label
        htmlFor={id}
        className={cn('block font-medium', compact ? 'mb-0.5 text-xs' : 'mb-1 text-sm')}
      >
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle',
            compact ? 'left-2.5 size-4' : 'left-3 size-5',
          )}
        />
        <input
          id={id}
          ref={inputRef}
          type="search"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          className={cn(
            'w-full rounded-md border border-line-strong bg-surface placeholder:text-subtle [&::-webkit-search-cancel-button]:appearance-none',
            compact ? 'h-9 pr-9 pl-8 text-sm' : 'h-11 pr-10 pl-10 text-base',
          )}
        />
        {draft && (
          <button
            type="button"
            aria-label="Clear search text"
            onClick={() => {
              setDraft('');
              onChange('');
            }}
            className={cn(
              'absolute top-1/2 right-1 flex -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink',
              compact ? 'size-7' : 'size-9',
            )}
          >
            <X aria-hidden className={compact ? 'size-4' : 'size-5'} />
          </button>
        )}
      </div>
    </form>
  );
}
