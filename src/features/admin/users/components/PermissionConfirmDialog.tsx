import { ShieldCheck } from 'lucide-react';
import { ROLE_LABELS, ROLES, type Role } from '@/shared/auth';
import { Alert, ConfirmDialog } from '@/shared/components';
import { ROLE_PERMISSIONS, withArticle } from '../labels';

export interface PermissionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  from: Role;
  to: Role;
  onConfirm: () => Promise<void>;
}

/**
 * Granting is quiet: nothing on the person's screen announces it and nothing on anyone else's
 * does either. So it is never a dropdown that saves on change. This says, in words, what the
 * role permits, that it takes effect at once, and names the person and the role on the button.
 */
export function PermissionConfirmDialog({
  open,
  onOpenChange,
  name,
  from,
  to,
  onConfirm,
}: PermissionConfirmDialogProps) {
  const label = ROLE_LABELS[to];
  const target = withArticle(label);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Make ${name} ${target}?`}
      description={
        <div className="flex flex-col gap-2">
          <p>
            {name} is {withArticle(ROLE_LABELS[from])} now. As {target} they will be able to:
          </p>
        </div>
      }
      confirmLabel={`Make ${name} ${target}`}
      cancelLabel="Do not change the role"
      onConfirm={onConfirm}
    >
      <ul
        aria-label={`What ${target} can do`}
        className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-ink"
      >
        {ROLE_PERMISSIONS[to].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {to === ROLES.facilityAdmin && (
        <p className="text-sm text-muted">
          They will approve nothing until you designate them for facilities.
        </p>
      )}
      <Alert severity="warning" title="This takes effect at once and is not announced">
        <span className="flex items-start gap-2">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            {name} is not told, and nobody else is. The change is recorded in the audit trail.
          </span>
        </span>
      </Alert>
    </ConfirmDialog>
  );
}
