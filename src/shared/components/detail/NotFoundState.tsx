import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '../feedback/EmptyState';
import { buttonStyles } from '../ui/Button';

export interface NotFoundStateProps {
  title: string;
  description?: string;
  /** The way back, e.g. to the browse screen. */
  action: { label: string; to: string; state?: unknown };
}

/** For a record that does not exist, typically reached from a stale link. Not an error. */
export function NotFoundState({ title, description, action }: NotFoundStateProps) {
  return (
    <EmptyState
      icon={<SearchX aria-hidden className="size-10" strokeWidth={1.5} />}
      title={title}
      description={description}
      action={
        <Link
          to={action.to}
          state={action.state}
          className={buttonStyles({ variant: 'secondary' })}
        >
          {action.label}
        </Link>
      }
    />
  );
}
