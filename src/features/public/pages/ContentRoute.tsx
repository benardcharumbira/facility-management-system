import type { ContentSlug } from '@/shared/api';
import {
  ContentPage,
  ContentSection,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/shared/components';
import { useDocumentMeta } from '@/shared/hooks';
import { dateOnly } from '../dates';
import { placeholderPolicy } from '../components/placeholderPolicy';
import { useContentPage } from '../hooks';

const FALLBACK: Record<ContentSlug, string> = {
  privacy: 'Privacy notice',
  accessibility: 'Accessibility statement',
  help: 'How the service works',
  contact: 'Contact us',
};

/** One of the served pages: privacy, accessibility, help or contact. */
export default function ContentRoute({ slug }: { slug: ContentSlug }) {
  const page = useContentPage(slug);
  const data = page.data;
  useDocumentMeta(data?.title ?? FALLBACK[slug], data?.description);

  if (page.isError) {
    return (
      <ErrorState
        title="We could not load this page"
        problem={page.error}
        onRetry={() => void page.refetch()}
      />
    );
  }
  if (!data) return <LoadingState />;

  const { withhold, notice } = placeholderPolicy(data.status);
  if (withhold) {
    return (
      <ContentPage title={data.title}>
        <EmptyState
          title="This page is being prepared"
          description="The municipality is still writing it. Please check again soon."
        />
      </ContentPage>
    );
  }

  return (
    <ContentPage
      title={data.title}
      notice={notice}
      meta={data.reviewedAt ? `Last reviewed ${dateOnly(data.reviewedAt)}` : undefined}
    >
      {data.sections.map((section) => (
        <ContentSection key={section.id} id={section.id} heading={section.heading}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items && (
            <ul className="m-0 list-disc pl-6">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </ContentSection>
      ))}
    </ContentPage>
  );
}

export const PrivacyPage = () => <ContentRoute slug="privacy" />;
export const AccessibilityPage = () => <ContentRoute slug="accessibility" />;
export const HelpPage = () => <ContentRoute slug="help" />;
export const ContactPage = () => <ContentRoute slug="contact" />;
