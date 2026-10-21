import { Printer } from 'lucide-react';
import { isApiProblem } from '@/shared/api';
import {
  Button,
  ContentPage,
  ContentSection,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/shared/components';
import { useDocumentMeta } from '@/shared/hooks';
import { placeholderPolicy } from '../components/placeholderPolicy';
import { dateOnly } from '../dates';
import { usePublishedTerms } from '../hooks';

const DESCRIPTION =
  'The terms and conditions for hiring the municipality’s venues, as they stand now, with the version and the date it was published.';

/** The terms currently published, readable without an account, and printable. */
export default function TermsPage() {
  const terms = usePublishedTerms();
  useDocumentMeta('Terms and conditions', DESCRIPTION);

  if (terms.isError) {
    if (isApiProblem(terms.error) && terms.error.status === 404) {
      return (
        <ContentPage title="Terms and conditions">
          <EmptyState
            title="No terms are published yet"
            description="The municipality has not published its terms and conditions of hire yet. Please check again soon."
          />
        </ContentPage>
      );
    }
    return (
      <ErrorState
        title="We could not load the terms"
        problem={terms.error}
        onRetry={() => void terms.refetch()}
      />
    );
  }
  if (!terms.data) return <LoadingState />;

  const { withhold, notice } = placeholderPolicy(
    terms.data.placeholder ? 'placeholder' : 'approved',
  );
  if (withhold) {
    return (
      <ContentPage title="Terms and conditions">
        <EmptyState
          title="This page is being prepared"
          description="The municipality is still writing its terms and conditions. Please check again soon."
        />
      </ContentPage>
    );
  }

  return (
    <ContentPage
      title={terms.data.title}
      notice={notice}
      meta={`Version ${terms.data.version}, published ${dateOnly(terms.data.publishedAt)}`}
      actions={
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer aria-hidden className="size-4" />
          Print these terms
        </Button>
      }
    >
      <ContentSection id="terms" heading="The terms">
        {terms.data.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </ContentSection>
      <ContentSection id="version" heading="Which version this is">
        <p>
          This is version {terms.data.version}. It is the version you accept when you send a
          request, and your booking records the version you accepted. If the terms are changed
          later, a booking you have already made keeps the version it was made under.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
