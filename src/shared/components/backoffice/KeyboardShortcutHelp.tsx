import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { IconButton } from '../ui/IconButton';

export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-line-strong bg-sunken px-1.5 py-0.5 font-mono text-xs font-semibold text-ink">
      {children}
    </kbd>
  );
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string[]; description: string }>;
}

export interface KeyboardShortcutHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ShortcutGroup[];
}

/** The keyboard reference, opened with `?`. Lists exactly what the screen binds. */
export function KeyboardShortcutHelp({ open, onOpenChange, groups }: KeyboardShortcutHelpProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-overlay"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Close keyboard shortcuts" className="-mr-2">
                <X aria-hidden className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          {groups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="mb-2 text-sm font-semibold text-muted">{group.title}</h3>
              <dl className="m-0 flex flex-col gap-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between gap-4"
                  >
                    <dt className="text-sm">{shortcut.description}</dt>
                    <dd className="m-0 flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <span key={key} className="flex items-center gap-1">
                          {index > 0 && <span className="text-xs text-muted">or</span>}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <p className="text-sm text-muted">
            Shortcuts do not work while you are typing in a field or while a dialog is open.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
