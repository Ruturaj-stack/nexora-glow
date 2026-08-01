import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BridgeStatus } from "@/features/tools/bridge";
import type { SystemSnapshot } from "@/features/tools/services";
import type {
  PermissionDecision,
  PermissionScope,
  ToolExecution,
  ToolStatus,
} from "@/features/tools/types";

export interface PermissionRequest {
  id: string;
  tool: string;
  title: string;
  description: string;
  scopes: PermissionScope[];
  params: Record<string, unknown>;
  danger: boolean;
  source: string;
}

export type PermissionAnswer = "once" | "always" | "deny";

export interface StoredScreenshot {
  id: string;
  filename: string;
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
}

interface ToolState {
  /** Persisted answers per scope; mirrored to the database. */
  permissions: Record<string, PermissionDecision>;
  setPermission: (scope: PermissionScope, decision: PermissionDecision) => void;
  setPermissions: (map: Record<string, PermissionDecision>) => void;
  resetPermissions: () => void;

  /** The prompt currently shown to the user, if any. */
  pending: PermissionRequest | null;
  setPending: (request: PermissionRequest | null) => void;

  /** Live queue + in-flight execution feed. */
  executions: ToolExecution[];
  pushExecution: (execution: ToolExecution) => void;
  patchExecution: (id: string, patch: Partial<ToolExecution>) => void;
  appendLog: (id: string, line: string) => void;
  clearFinished: () => void;

  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;

  bridge: BridgeStatus | null;
  setBridge: (status: BridgeStatus) => void;

  snapshot: SystemSnapshot | null;
  setSnapshot: (snapshot: SystemSnapshot) => void;

  screenshots: StoredScreenshot[];
  addScreenshot: (shot: StoredScreenshot) => void;
  removeScreenshot: (id: string) => void;
}

const ACTIVE: ToolStatus[] = ["queued", "running"];

export const useToolStore = create<ToolState>()(
  persist(
    (set) => ({
      permissions: {},
      setPermission: (scope, decision) =>
        set((s) => ({ permissions: { ...s.permissions, [scope]: decision } })),
      setPermissions: (map) => set((s) => ({ permissions: { ...s.permissions, ...map } })),
      resetPermissions: () => set({ permissions: {} }),

      pending: null,
      setPending: (request) => set({ pending: request }),

      executions: [],
      pushExecution: (execution) =>
        set((s) => ({ executions: [execution, ...s.executions].slice(0, 100), panelOpen: true })),
      patchExecution: (id, patch) =>
        set((s) => ({
          executions: s.executions.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      appendLog: (id, line) =>
        set((s) => ({
          executions: s.executions.map((e) =>
            e.id === id ? { ...e, logs: [...e.logs, line].slice(-40) } : e,
          ),
        })),
      clearFinished: () =>
        set((s) => ({ executions: s.executions.filter((e) => ACTIVE.includes(e.status)) })),

      panelOpen: false,
      setPanelOpen: (open) => set({ panelOpen: open }),

      bridge: null,
      setBridge: (status) => set({ bridge: status }),

      snapshot: null,
      setSnapshot: (snapshot) => set({ snapshot }),

      screenshots: [],
      addScreenshot: (shot) => set((s) => ({ screenshots: [shot, ...s.screenshots].slice(0, 12) })),
      removeScreenshot: (id) =>
        set((s) => ({ screenshots: s.screenshots.filter((x) => x.id !== id) })),
    }),
    {
      name: "nexora-tools",
      partialize: (state) => ({ permissions: state.permissions }),
    },
  ),
);
