import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

type Severity = 'error' | 'warning' | 'info';

const styles: Record<Severity, string> = {
  error: 'border-danger-line bg-danger-soft text-danger',
  warning: 'border-warning-line bg-warning-soft text-warning',
  info: 'border-primary-line bg-primary-soft text-primary',
};
const icons = { error: AlertCircle, warning: AlertTriangle, info: Info };

interface AlertProps {
  severity: Severity;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ severity, title, children, action, className }: AlertProps) {
  const Icon = icons[severity];
  return (
    <div
      role={severity === 'error' ? 'alert' : undefined}
      className={cn('flex items-start gap-3 rounded-lg border p-4', styles[severity], className)}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
