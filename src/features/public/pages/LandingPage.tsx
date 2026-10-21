import { Link } from 'react-router';
import { buttonStyles } from '@/shared/components/ui/Button';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { FeaturedVenues } from '../components/FeaturedVenues';
import { StepsList } from '../components/StepsList';

export interface LandingAction {
  label: string;
  to: string;
}

const STEPS = [
  {
    title: 'Find a venue',
    body: 'Look through the halls and meeting rooms the municipality hires out.',
  },
  {
    title: 'Check when it is free',
    body: 'Each venue has a calendar showing the days and times that are open.',
  },
  {
    title: 'Send a request',
    body: 'Say what your event is and what you need. This is a request, not a booking yet.',
  },
  {
    title: 'Wait for the answer',
    body: 'The municipality reviews it and tells you whether it is approved.',
  },
];

const DESCRIPTION =
  'Ask Midvaal Local Municipality for a hall or meeting room. Find a venue, check when it is free and send a request; the municipality tells you if it is approved.';

/** What the service is, how it works, a few venues, and one clear thing to do. */
export default function LandingPage({ action }: { action: LandingAction }) {
  useDocumentMeta('Book a hall or meeting room', DESCRIPTION);
  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="landing-title" className="flex max-w-3xl flex-col gap-5 pt-4">
        <h1
          id="landing-title"
          className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl"
        >
          Book a hall or meeting room in Midvaal
        </h1>
        <p className="text-xl leading-relaxed">
          Ask the municipality for a venue for your meeting, function or event. You send a request
          and the municipality tells you if it is approved.
        </p>
        <p className="rounded-lg border-2 border-primary bg-primary-soft p-4 text-lg font-medium text-ink">
          A booking here is a request, not an instant confirmation. The venue is yours only once the
          municipality has approved it.
        </p>
        <div>
          <Link to={action.to} className={buttonStyles({ className: 'h-14 px-8 text-lg' })}>
            {action.label}
          </Link>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="flex flex-col gap-4">
        <h2 id="how-heading" className="text-2xl font-semibold">
          How it works
        </h2>
        <StepsList label="How it works" steps={STEPS} />
      </section>

      <section aria-labelledby="venues-heading" className="flex flex-col gap-4">
        <h2 id="venues-heading" className="text-2xl font-semibold">
          Some of our venues
        </h2>
        <FeaturedVenues />
      </section>

      <section aria-labelledby="more-heading" className="flex flex-col gap-3">
        <h2 id="more-heading" className="text-2xl font-semibold">
          Need to know more?
        </h2>
        <ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-2 p-0 text-lg">
          <li>
            <Link to="/help" className="underline underline-offset-2">
              How the service works
            </Link>
          </li>
          <li>
            <Link to="/terms" className="underline underline-offset-2">
              Terms and conditions
            </Link>
          </li>
          <li>
            <Link to="/privacy" className="underline underline-offset-2">
              Privacy notice
            </Link>
          </li>
          <li>
            <Link to="/contact" className="underline underline-offset-2">
              Contact us
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
