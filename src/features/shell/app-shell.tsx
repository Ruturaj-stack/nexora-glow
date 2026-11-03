import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./sidebar";
import { CommandBar } from "./command-bar";
import { StatusBar } from "./status-bar";
import { CommandPalette } from "./command-palette";
import { NotificationCenter } from "./notification-center";
import { useAppStore } from "@/store/app-store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VoiceAssistantPanel } from "@/features/voice/voice-assistant-panel";
import { ToolPermissionDialog } from "@/features/tools/permission-dialog";
import { ToolExecutionPanel } from "@/features/tools/execution-panel";
import { usePermissionSync } from "@/features/tools/use-tools";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { mobileNavOpen, setMobileNavOpen, uiPrefs } = useAppStore();
  usePermissionSync();

  // Glass intensity is a user preference persisted in the app store.
  useEffect(() => {
    document.documentElement.style.setProperty("--glass-intensity", String(uiPrefs.glass / 100));
    return () => {
      document.documentElement.style.removeProperty("--glass-intensity");
    };
  }, [uiPrefs.glass]);



  return (
    <MotionConfig reducedMotion={uiPrefs.reducedMotion ? "always" : "user"}>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-screen w-full overflow-hidden">
          <div className="hidden lg:block">
            <Sidebar />
          </div>

          <AnimatePresence>
            {mobileNavOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
                  onClick={() => setMobileNavOpen(false)}
                />
                <motion.div
                  initial={{ x: -260 }}
                  animate={{ x: 0 }}
                  exit={{ x: -260 }}
                  transition={{ type: "spring", stiffness: 380, damping: 38 }}
                  className="fixed inset-y-0 left-0 z-50 lg:hidden"
                >
                  <Sidebar />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="flex min-w-0 flex-1 flex-col">
            <CommandBar />
            <main className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
            <StatusBar />
          </div>

          <VoiceAssistantPanel />
          <ToolExecutionPanel />
          <ToolPermissionDialog />
          <CommandPalette />
          <NotificationCenter />
        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
