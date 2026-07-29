import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings as SettingsIcon, User } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "N";
  return source
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const name = profile?.name ?? user?.user_metadata?.name ?? null;
  const email = profile?.email ?? user?.email ?? null;

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="ml-1 h-9 gap-2 rounded-xl border border-border bg-surface/50 py-1 pl-1 pr-3 hover:bg-surface/80"
        >
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={name ?? "Account avatar"}
              className="size-7 rounded-lg object-cover"
            />
          ) : (
            <span className="grid size-7 place-items-center rounded-lg bg-primary/12 font-mono text-[11px] text-primary">
              {initials(name, email)}
            </span>
          )}
          <span className="hidden max-w-28 truncate text-xs font-medium sm:inline">
            {name ?? email ?? "Account"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="text-sm font-medium">{name ?? "Nexora user"}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: "/settings" })}>
          <User className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/settings" })}>
          <SettingsIcon className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
