import { Link } from 'react-router';

export interface RelatedItem {
  id: string;
  label: string;
  /** Secondary line, e.g. type and capacity. */
  description?: string;
  to: string;
  /** Router state to carry along the link. */
  state?: unknown;
}

export interface RelatedItemsProps {
  /** Accessible name for the list. */
  label: string;
  items: RelatedItem[];
}

/** A compact list of links to related records. */
export function RelatedItems({ label, items }: RelatedItemsProps) {
  return (
    <ul
      aria-label={label}
      className="m-0 list-none divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface p-0"
    >
      {items.map((item) => (
        <li key={item.id}>
          <Link to={item.to} state={item.state} className="block px-4 py-3 hover:bg-primary-soft">
            <span className="block font-medium text-primary">{item.label}</span>
            {item.description && <span className="block text-muted">{item.description}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
