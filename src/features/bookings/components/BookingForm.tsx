import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import {
  ApiProblem,
  SLOT_CONFLICT_PROBLEM_TYPE,
  useApiClient,
  type Booking,
  type BookingOptions,
} from '@/shared/api';
import {
  Alert,
  AutosaveIndicator,
  Button,
  buttonStyles,
  ErrorState,
  ErrorSummary,
  FormStepper,
  type ErrorSummaryItem,
  type FormStep,
} from '@/shared/components';
import type { UrlStateUpdater } from '@/shared/hooks';
import { bookingKeys, createDraft, submitBooking, updateDraft } from '../api';
import {
  AUTOSAVE_DEBOUNCE_MS,
  LAST_DRAFT_STORAGE_KEY,
  STEP_IDS,
  STEPS,
  type StepId,
} from '../config';
import { calendarHref as buildCalendarHref } from '../format';
import { useFacilityDetail, useSlotCheck } from '../hooks';
import { bookingConfirmationLink } from '../links';
import {
  bookingSchema,
  fieldId,
  STEP_FIELDS,
  stepOfField,
  type BookingFormValues,
} from '../schema';
import type { BookingUrlState } from '../urlState';
import { resumeStep, toFields, valuesFrom } from '../values';
import { useDocumentUploads } from '../useDocumentUploads';
import { ConflictNotice } from './ConflictNotice';
import { StepDetails } from './StepDetails';
import { StepDocuments } from './StepDocuments';
import { StepResources } from './StepResources';
import { StepReview } from './StepReview';
import { StepWhen } from './StepWhen';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Server field names that differ from the form's. */
const SERVER_FIELD_ALIASES: Record<string, keyof BookingFormValues> = {
  seatingArrangement: 'seatingArrangementId',
  eventType: 'eventTypeId',
};
const FORM_FIELDS = new Set<string>(Object.values(STEP_FIELDS).flat());

interface BookingFormProps {
  options: BookingOptions;
  initialBooking: Booking | null;
  url: BookingUrlState;
  update: UrlStateUpdater<BookingUrlState>;
}

export function BookingForm({ options, initialBooking, url, update }: BookingFormProps) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const termsVersion = options.terms.version;

  const [initialValues] = useState(() => valuesFrom(initialBooking, url, termsVersion));
  const [defaultStep] = useState<StepId>(
    () => url.step ?? (initialBooking && !url.startsAt ? resumeStep(initialBooking) : 'when'),
  );
  const step = url.step ?? defaultStep;
  const stepIndex = STEP_IDS.indexOf(step);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: initialValues,
  });
  const values = useWatch({ control: form.control }) as BookingFormValues;
  const { errors } = form.formState;

  const facility = useFacilityDetail(values.facilityId || undefined);
  const slot = useSlotCheck(values.facilityId, values.startsAt, values.endsAt);
  const zone = slot.data?.zone ?? initialBooking?.facility.timeZone;

  // --- saving -----------------------------------------------------------------------------
  const draftIdRef = useRef<string | null>(initialBooking?.id ?? null);
  // The same id for rendering: refs cannot be read while rendering.
  const [draftId, setDraftId] = useState<string | null>(initialBooking?.id ?? null);
  const lastSaved = useRef<string | null>(
    initialBooking
      ? JSON.stringify(
          toFields(
            valuesFrom(
              initialBooking,
              { facilityId: undefined, startsAt: undefined, endsAt: undefined },
              termsVersion,
            ),
            termsVersion,
          ),
        )
      : null,
  );
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(initialBooking?.updatedAt ?? null);

  // Mutations present their own failures here, so the global toast stays out of the way.
  const create = useMutation({
    mutationFn: (body: Parameters<typeof createDraft>[1]) => createDraft(api, body),
    meta: { silent: true },
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateDraft>[2] }) =>
      updateDraft(api, id, body),
    meta: { silent: true },
  });
  const submit = useMutation({
    mutationFn: (id: string) => submitBooking(api, id),
    meta: { silent: true },
  });

  const persist = useCallback(async (): Promise<string | null> => {
    const current = form.getValues();
    if (!current.facilityId || !current.startsAt || !current.endsAt) return draftIdRef.current;
    const fields = toFields(current, termsVersion);
    const signature = JSON.stringify(fields);
    if (draftIdRef.current && signature === lastSaved.current) return draftIdRef.current;

    setSaveStatus('saving');
    try {
      if (!draftIdRef.current) {
        const created = await create.mutateAsync({
          facilityId: fields.facilityId,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
        });
        draftIdRef.current = created.id;
        setDraftId(created.id);
        queryClient.setQueryData(bookingKeys.detail(created.id), created);
        update({ draft: created.id }, { replace: true });
      }
      const saved = await patch.mutateAsync({ id: draftIdRef.current, body: fields });
      lastSaved.current = signature;
      queryClient.setQueryData(bookingKeys.detail(saved.id), saved);
      setSavedAt(saved.updatedAt);
      setSaveStatus('saved');
      try {
        window.localStorage.setItem(LAST_DRAFT_STORAGE_KEY, JSON.stringify({ id: saved.id }));
      } catch {
        // Storage may be blocked; resuming by link still works.
      }
      return saved.id;
    } catch {
      setSaveStatus('error');
      return draftIdRef.current;
    }
  }, [create, form, patch, queryClient, termsVersion, update]);

  const save = useCallback(() => {
    const run = queue.current.then(persist);
    queue.current = run.catch(() => undefined);
    return run;
  }, [persist]);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  // Autosave on a pause in typing, and once more when leaving.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ name }) => {
        // A field that has errored is checked again as it changes, so the error clears the
        // moment it is fixed (the form library only does this after a submit).
        if (name && form.formState.errors[name as keyof BookingFormValues]) {
          void form.trigger(name as keyof BookingFormValues);
        }
        clearTimeout(timer);
        timer = setTimeout(() => void saveRef.current(), AUTOSAVE_DEBOUNCE_MS);
      },
    });
    // A window chosen on the calendar differs from what the draft holds: bring the draft up to date.
    if (draftIdRef.current) void saveRef.current();
    return () => {
      unsubscribe();
      clearTimeout(timer);
      void saveRef.current();
    };
  }, [form]);

  // Fields without an input of their own (the venue, the window, the resources and the terms
  // checkbox are set programmatically) must still be registered, or the schema resolver drops
  // their errors.
  useEffect(() => {
    for (const name of [
      'facilityId',
      'startsAt',
      'endsAt',
      'resources',
      'termsAccepted',
    ] as const) {
      form.register(name);
    }
  }, [form]);

  // The step is always in the URL.
  useEffect(() => {
    if (!url.step) update({ step: defaultStep }, { replace: true });
  }, [defaultStep, update, url.step]);

  // --- documents --------------------------------------------------------------------------
  const documents = useDocumentUploads(initialBooking?.documents ?? [], async () => {
    // Uploads attach to a draft, so make one if none exists yet.
    return draftIdRef.current ?? (await save());
  });

  // --- steps, focus and errors -------------------------------------------------------------
  const [maxVisited, setMaxVisited] = useState(() => STEP_IDS.indexOf(step));
  const [summary, setSummary] = useState<ErrorSummaryItem[]>([]);
  const [summarySignal, setSummarySignal] = useState(0);
  const [conflict, setConflict] = useState<ApiProblem | null>(null);
  const [submitError, setSubmitError] = useState<ApiProblem | null>(null);
  const [savedForLater, setSavedForLater] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const target = pendingFocus.current ? document.getElementById(pendingFocus.current) : null;
    pendingFocus.current = null;
    (target ?? headingRef.current)?.focus();
  }, [step]);

  const goTo = useCallback(
    (next: StepId, field?: keyof BookingFormValues) => {
      void saveRef.current();
      pendingFocus.current = field ? fieldId(field) : null;
      setMaxVisited((m) => Math.max(m, STEP_IDS.indexOf(next)));
      setSummary([]);
      setSavedForLater(false);
      update({ step: next });
    },
    [update],
  );

  /**
   * The problems on a step, straight from the schema. Read from the schema rather than from the
   * form library's error state, which lags a render behind a validation and ignores fields that
   * have no input of their own.
   */
  const stepErrors = (id: StepId): ErrorSummaryItem[] => {
    const result = bookingSchema.safeParse(form.getValues());
    if (result.success) return [];
    const seen = new Set<string>();
    const items: ErrorSummaryItem[] = [];
    for (const issue of result.error.issues) {
      const name = String(issue.path[0] ?? '');
      if (!STEP_FIELDS[id].some((field) => field === name) || seen.has(name)) continue;
      seen.add(name);
      items.push({ fieldId: fieldId(name), message: issue.message });
    }
    return items;
  };

  const showSummary = (items: ErrorSummaryItem[]) => {
    setSummary(items);
    setSummarySignal((n) => n + 1);
  };

  const goNext = async () => {
    const fields = STEP_FIELDS[step];
    const valid = fields.length === 0 ? true : await form.trigger(fields);
    if (!valid) return showSummary(stepErrors(step));
    if (step === 'when' && (!slot.data || slot.data.problem)) {
      return showSummary([
        {
          fieldId: 'booking-slot',
          message: slot.data?.problem?.message ?? 'Wait for the availability check to finish.',
        },
      ]);
    }
    const next = STEP_IDS[stepIndex + 1];
    if (next) goTo(next);
  };

  const applyServerErrors = (problem: ApiProblem) => {
    const items: ErrorSummaryItem[] = [];
    let earliest = Number.POSITIVE_INFINITY;
    for (const [key, messages] of Object.entries(problem.errors)) {
      const name = SERVER_FIELD_ALIASES[key] ?? key;
      const message = messages[0];
      if (!message) continue;
      items.push({ fieldId: fieldId(name), message });
      if (FORM_FIELDS.has(name)) {
        form.setError(name as keyof BookingFormValues, { type: 'server', message });
        const target = stepOfField(name);
        if (target) earliest = Math.min(earliest, STEP_IDS.indexOf(target));
      }
    }
    const first = STEP_IDS[earliest];
    if (first) goTo(first);
    showSummary(items);
  };

  const submitRequest = async () => {
    if (submittingRef.current) return; // a second press while in flight does nothing
    submittingRef.current = true;
    setSubmitError(null);
    setConflict(null);

    const valid = await form.trigger();
    if (!valid) {
      submittingRef.current = false;
      const failing = STEP_IDS.find((id) => stepErrors(id).length > 0);
      if (failing && failing !== step) goTo(failing);
      return showSummary(failing ? stepErrors(failing) : []);
    }

    setSubmitting(true);
    let succeeded = false;
    try {
      const id = await saveRef.current();
      if (!id)
        throw new ApiProblem({
          kind: 'unexpected',
          status: 0,
          title: 'Your request could not be saved.',
        });
      const booking = await submit.mutateAsync(id);
      queryClient.setQueryData(bookingKeys.detail(id), booking);
      // The request now holds the slot, so any availability already fetched is out of date.
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      try {
        window.localStorage.removeItem(LAST_DRAFT_STORAGE_KEY);
      } catch {
        // Nothing to clean up.
      }
      // Stay locked once submitted: the page is on its way out, and a late press must do nothing.
      succeeded = true;
      void navigate(bookingConfirmationLink(id), { replace: true });
    } catch (error) {
      const problem = ApiProblem.from(error);
      if (problem.status === 409 && problem.type === SLOT_CONFLICT_PROBLEM_TYPE) {
        setConflict(problem);
      } else if (problem.status === 422 && Object.keys(problem.errors).length > 0) {
        applyServerErrors(problem);
      } else {
        setSubmitError(problem);
      }
    } finally {
      if (!succeeded) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const finishLater = async () => {
    await save();
    setSavedForLater(true);
  };

  // --- render ------------------------------------------------------------------------------
  const stepperSteps: FormStep[] = STEPS.map((s, i) => {
    const hasErrors = i < maxVisited && STEP_FIELDS[s.id].some((name) => errors[name]);
    return {
      id: s.id,
      label: s.label,
      reachable: i <= maxVisited,
      status:
        s.id === step
          ? 'current'
          : hasErrors
            ? 'attention'
            : i < maxVisited
              ? 'complete'
              : 'upcoming',
    };
  });

  const savedAtLabel = useMemo(() => {
    if (!savedAt || !zone) return undefined;
    return DateTime.fromISO(savedAt, { zone: 'utc' }).setZone(zone).toFormat('HH:mm');
  }, [savedAt, zone]);

  const calendarHref = values.facilityId
    ? buildCalendarHref({
        facilityId: values.facilityId,
        startsAt: values.startsAt || undefined,
        endsAt: values.endsAt || undefined,
        zone,
        draft: draftId ?? undefined,
      })
    : null;
  const currentLabel = STEPS[stepIndex]?.label ?? '';
  const isLast = stepIndex === STEPS.length - 1;
  const slotChecking =
    step === 'when' && values.facilityId !== '' && values.startsAt !== '' && slot.isPending;

  if (savedForLater) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Alert severity="info" title="Your request is saved as a draft">
          <p>
            Come back to it any time with this link. Once the My bookings page lists drafts, you
            will also find it there.
          </p>
          <p className="mt-2 font-medium break-all">
            {`${window.location.origin}/bookings/new?draft=${draftId ?? ''}&step=${step}`}
          </p>
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setSavedForLater(false)}>Continue editing</Button>
          <Link to="/facilities" className={buttonStyles({ variant: 'secondary' })}>
            Browse venues
          </Link>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <FormStepper steps={stepperSteps} onSelect={(id) => goTo(id as StepId)} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <AutosaveIndicator
            status={saveStatus}
            savedAtLabel={savedAtLabel}
            onRetry={() => void save()}
          />
          <Button variant="ghost" size="sm" onClick={() => void finishLater()}>
            Save and finish later
          </Button>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {`Step ${stepIndex + 1} of ${STEPS.length}: ${currentLabel}`}
        </p>

        <ErrorSummary
          errors={summary}
          focusSignal={summarySignal}
          title="There is a problem with your request"
        />

        {conflict && zone && calendarHref && (
          <ConflictNotice problem={conflict} zone={zone} calendarHref={calendarHref} />
        )}
        {submitError && (
          <ErrorState
            title="We could not submit your request"
            problem={submitError}
            onRetry={() => void submitRequest()}
          />
        )}

        <form
          noValidate
          onSubmit={(event) => event.preventDefault()}
          aria-labelledby="booking-step-heading"
          className="flex flex-col gap-5"
        >
          <h2
            id="booking-step-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            {currentLabel}
          </h2>

          <p className="text-sm text-muted">
            Fields marked <span aria-hidden>*</span>
            <span className="sr-only">with an asterisk</span> are required.
          </p>

          {step === 'when' && (
            <div id={fieldId('facilityId')} tabIndex={-1} className="outline-none">
              <div id={fieldId('startsAt')} tabIndex={-1} className="outline-none">
                <div id="booking-slot" tabIndex={-1} className="outline-none">
                  <StepWhen
                    facilityId={values.facilityId}
                    startsAt={values.startsAt}
                    endsAt={values.endsAt}
                    facility={facility.data}
                    slot={slot}
                    zone={zone}
                    draft={draftId ?? undefined}
                    changeHref={calendarHref}
                  />
                </div>
              </div>
            </div>
          )}
          {step === 'details' && <StepDetails options={options} facility={facility.data} />}
          {step === 'resources' && <StepResources options={options} facility={facility.data} />}
          {step === 'documents' && (
            <StepDocuments
              options={options}
              items={documents.items}
              onSelect={documents.select}
              onRemove={documents.remove}
              onRetry={documents.retry}
            />
          )}
          {step === 'review' && (
            <StepReview
              options={options}
              facility={facility.data}
              zone={zone}
              documents={documents.items}
              goTo={goTo}
            />
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-between">
            {stepIndex > 0 ? (
              <Button
                variant="secondary"
                onClick={() => goTo(STEP_IDS[stepIndex - 1] ?? 'when')}
                className="h-11"
              >
                Back
              </Button>
            ) : (
              <span />
            )}
            {isLast ? (
              <Button onClick={() => void submitRequest()} disabled={submitting} className="h-11">
                {submitting ? 'Submitting…' : 'Submit request'}
              </Button>
            ) : (
              <Button onClick={() => void goNext()} disabled={slotChecking} className="h-11">
                {slotChecking ? 'Checking availability…' : 'Continue'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
