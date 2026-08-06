import { create } from "zustand";
import type { InstalledPlugin } from "@/features/plugins/types";

/** Installed plugins plus the UI state of the plugin store page. */
interface PluginState {
  plugins: InstalledPlugin[];
  setPlugins: (plugins: InstalledPlugin[]) => void;
  upsertPlugin: (plugin: InstalledPlugin) => void;
  removePlugin: (id: string) => void;

  search: string;
  setSearch: (value: string) => void;

  configuringId: string | null;
  setConfiguring: (id: string | null) => void;
}

export const usePluginStore = create<PluginState>()((set) => ({
  plugins: [],
  setPlugins: (plugins) => set({ plugins }),
  upsertPlugin: (plugin) =>
    set((s) => ({
      plugins: s.plugins.some((p) => p.id === plugin.id)
        ? s.plugins.map((p) => (p.id === plugin.id ? plugin : p))
        : [plugin, ...s.plugins],
    })),
  removePlugin: (id) =>
    set((s) => ({
      plugins: s.plugins.filter((p) => p.id !== id),
      configuringId: s.configuringId === id ? null : s.configuringId,
    })),

  search: "",
  setSearch: (value) => set({ search: value }),

  configuringId: null,
  setConfiguring: (id) => set({ configuringId: id }),
}));
