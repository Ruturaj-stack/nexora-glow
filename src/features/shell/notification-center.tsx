import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Info, TriangleAlert, X, CircleCheck } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const toneIcon = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
} as const;

const toneClass = {
  info: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
} as const;

export function NotificationCenter() {
  const { notificationsOpen, setNotificationsOpen, notifications, markAllRead, dismiss } =
    useAppStore();

  return (
    <AnimatePresence>
      {notificationsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setNotificationsOpen(false)}
          />
          <motion.aside
            initial={{ x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.4 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="glass-strong fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col"
          >
            <div className="flex h-16 items-center gap-2 border-b border-border px-5">
              <Bell className="size-4 text-primary" />
              <h2 className="font-display text-base font-semibold">Notifications</h2>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => setNotificationsOpen(false)}
                aria-label="Close notifications"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {notifications.length === 0 && (
                <p className="pt-16 text-center text-sm text-muted-foreground">You're all caught up.</p>
              )}
              {notifications.map((n) => {
                const Icon = toneIcon[n.tone];
                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    className={cn(
                      "group relative rounded-xl border border-border bg-surface/50 p-3.5 transition-colors hover:border-primary/25",
                      !n.read && "bg-surface/80",
                    )}
                  >
                    <div className="flex gap-3">
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg",
                          toneClass[n.tone],
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{n.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground/70">{n.time}</p>
                      </div>
                      <button
                        onClick={() => dismiss(n.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Dismiss notification"
                      >
                        <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    {!n.read && (
                      <span className="absolute right-3 top-3 size-1.5 rounded-full bg-primary" />
                    )}
                  </motion.div>
                );
              })}
            </div>

            <div className="border-t border-border p-3">
              <Button variant="ghost" className="w-full justify-center gap-2" onClick={markAllRead}>
                <CheckCheck className="size-4" />
                Mark all as read
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
