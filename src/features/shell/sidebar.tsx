import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles } from "lucide-react";
import { primaryNav, secondaryNav, type NavItem } from "@/config/navigation";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function NavLinkRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

  const link = (
    <Link
      to={item.to}
      onClick={() => useAppStore.getState().setMobileNavOpen(false)}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <item.icon
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          active ? "text-primary" : "group-hover:text-foreground",
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar/70 backdrop-blur-xl transition-[width] duration-300 ease-out",
        sidebarCollapsed ? "w-[72px]" : "w-[248px]",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2.5 px-4",
          sidebarCollapsed && "justify-center px-0",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary glow-ring">
          <Sparkles className="size-[18px]" />
        </span>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold tracking-tight">Nexora</p>
            <p className="truncate text-[11px] text-muted-foreground">Assistant OS</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {!sidebarCollapsed && (
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Workspace
          </p>
        )}
        {primaryNav.map((item) => (
          <NavLinkRow key={item.to} item={item} collapsed={sidebarCollapsed} />
        ))}

        {!sidebarCollapsed && (
          <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            System
          </p>
        )}
        <div className={cn(sidebarCollapsed && "pt-4")}>
          {secondaryNav.map((item) => (
            <NavLinkRow key={item.to} item={item} collapsed={sidebarCollapsed} />
          ))}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground",
            sidebarCollapsed && "justify-center px-0",
          )}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn("size-4 transition-transform", sidebarCollapsed && "rotate-180")}
          />
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
