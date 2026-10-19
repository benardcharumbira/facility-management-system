import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

export interface SearchFieldProps {
  /** The committed value, typically from the URL. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  debounceMs?: number;
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
}: SearchFieldProps) {
  const id = useId();
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
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-subtle"
        />
        <input
          id={id}
          type="search"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          className="h-11 w-full rounded-md border border-line-strong bg-surface pr-10 pl-10 text-base placeholder:text-subtle [&::-webkit-search-cancel-button]:appearance-none"
        />
        {draft && (
          <button
            type="button"
            aria-label="Clear search text"
            onClick={() => {
              setDraft('');
              onChange('');
            }}
            className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
      </div>
    </form>
  );
}
