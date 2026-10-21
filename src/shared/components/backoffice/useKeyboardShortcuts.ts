import { useEffect, useRef } from 'react';

export interface ShortcutBinding {
  /** `KeyboardEvent.key` values, e.g. `j`, `ArrowDown`, `?`. */
  keys: readonly string[];
  handler: (event: KeyboardEvent) => void;
  /** Further condition, e.g. that focus is inside the queue. Arrow keys need one, or they would stop scrolling. */
  when?: (event: KeyboardEvent) => boolean;
}

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const OPEN_DIALOG = '[role="dialog"], [role="alertdialog"]';

/** True where a key press is text being typed (or a choice being made), not a command. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING) !== null;
}

/**
 * Single key shortcuts for a screen worked all day. They never fire while focus is in a field,
 * while a dialog is open (the dialog owns the keyboard), or with Ctrl, Cmd or Alt held, so they
 * cannot clash with the browser or with typing.
 */
export function useKeyboardShortcuts(bindings: readonly ShortcutBinding[], enabled = true) {
  const latest = useRef(bindings);
  useEffect(() => {
    latest.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector(OPEN_DIALOG)) return;
      const match = latest.current.find(
        (binding) => binding.keys.includes(event.key) && (binding.when?.(event) ?? true),
      );
      if (!match) return;
      event.preventDefault();
      match.handler(event);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
