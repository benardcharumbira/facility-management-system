export const STEPS = [
  { id: 'when', label: 'When and where' },
  { id: 'details', label: 'Event details' },
  { id: 'resources', label: 'Resources' },
  { id: 'documents', label: 'Documents' },
  { id: 'review', label: 'Review and submit' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export const STEP_IDS = STEPS.map((s) => s.id) as readonly StepId[];

/** Wait this long after the last keystroke before saving the draft. */
export const AUTOSAVE_DEBOUNCE_MS = 1200;

export const MAX_DESCRIPTION_LENGTH = 1000;

export const LAST_DRAFT_STORAGE_KEY = 'booking.lastDraft';
