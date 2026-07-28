import { Bell, Menu, PanelsTopLeft, Search, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { OrbStatePicker } from "@/features/orb/orb-state-picker";

export function CommandBar() {
  const { setPaletteOpen, setMobileNavOpen, notifications, setNotificationsOpen, toggleSidebar } =
    useAppStore();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/60 px-3 backdrop-blur-xl sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <PanelsTopLeft className="size-[18px]" />
      </Button>

      <button
        onClick={() => setPaletteOpen(true)}
        className="group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface/50 px-3 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/35 hover:bg-surface/80 sm:max-w-md"
      >
        <Search className="size-4 shrink-0 transition-colors group-hover:text-primary" />
        <span className="truncate">Search or run a command…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-md border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <div className="hidden md:block">
          <OrbStatePicker />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setNotificationsOpen(true)}
          aria-label="Open notifications"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>

        <div className="ml-1 flex items-center gap-2 rounded-xl border border-border bg-surface/50 py-1 pl-1 pr-3">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/12 text-primary">
            <Sparkles className="size-3.5" />
          </span>
          <span className="hidden text-xs font-medium sm:inline">Ari</span>
        </div>
      </div>
    </header>
  );
}
