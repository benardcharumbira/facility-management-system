import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { useEffect, useRef, useState, type FormEvent } from 'react';

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
  const commit = (next: string) => onChangeRef.current(next);

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChangeRef.current(draft), debounceMs);
    return () => clearTimeout(timer);
  }, [draft, value, debounceMs]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (draft !== value) commit(draft);
  };

  return (
    <Box component="form" role="search" onSubmit={handleSubmit}>
      <TextField
        fullWidth
        type="search"
        label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        sx={{ '& input::-webkit-search-cancel-button': { display: 'none' } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon aria-hidden />
              </InputAdornment>
            ),
            endAdornment: draft ? (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  aria-label="Clear search text"
                  onClick={() => {
                    setDraft('');
                    commit('');
                  }}
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />
    </Box>
  );
}
