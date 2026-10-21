import { LogOut, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Link } from 'react-router';
import { ROLE_LABELS, type CurrentUser } from '@/shared/auth';

interface UserMenuProps {
  user: CurrentUser;
  onSignOut: () => void;
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Account menu for ${user.name}`}
        className="flex size-10 items-center justify-center rounded-full outline-offset-2 hover:bg-white/10 focus-visible:outline-on-primary"
      >
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface py-1 shadow-overlay"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="font-semibold [overflow-wrap:anywhere]">{user.name}</p>
            <p className="[overflow-wrap:anywhere] text-muted">{user.email}</p>
            <p className="mt-1 text-xs text-subtle">{ROLE_LABELS[user.role]}</p>
          </div>
          <DropdownMenu.Item
            asChild
            className="m-1 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-sunken"
          >
            <Link to="/account">
              <UserRound aria-hidden className="size-4 text-muted" />
              Your account
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onSignOut}
            className="m-1 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-sunken"
          >
            <LogOut aria-hidden className="size-4 text-muted" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
