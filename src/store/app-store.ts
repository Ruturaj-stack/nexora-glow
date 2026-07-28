import { create } from "zustand";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "offline";

export interface NexoraNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  tone: "info" | "success" | "warning";
  read: boolean;
}

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;

  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  togglePalette: () => void;

  notificationsOpen: boolean;
  setNotificationsOpen: (v: boolean) => void;

  orbState: OrbState;
  setOrbState: (s: OrbState) => void;

  notifications: NexoraNotification[];
  markAllRead: () => void;
  dismiss: (id: string) => void;
}

const seedNotifications: NexoraNotification[] = [
  {
    id: "n1",
    title: "Memory index rebuilt",
    body: "12,480 vectors re-embedded across 6 collections.",
    time: "2m ago",
    tone: "success",
    read: false,
  },
  {
    id: "n2",
    title: "Device offline",
    body: "Studio Display Hub stopped responding to heartbeat.",
    time: "26m ago",
    tone: "warning",
    read: false,
  },
  {
    id: "n3",
    title: "Automation completed",
    body: "“Morning briefing” ran successfully in 1.8s.",
    time: "1h ago",
    tone: "info",
    read: true,
  },
];

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  mobileNavOpen: false,
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),

  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  notificationsOpen: false,
  setNotificationsOpen: (v) => set({ notificationsOpen: v }),

  orbState: "idle",
  setOrbState: (s) => set({ orbState: s }),

  notifications: seedNotifications,
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  dismiss: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}));
