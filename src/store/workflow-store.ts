import { create } from "zustand";
import type { Workflow, WorkflowExecution } from "@/features/agent/types";

/**
 * Workflow state — persisted workflows, run history and the live feed of
 * executions currently in flight.
 */

interface WorkflowState {
  workflows: Workflow[];
  setWorkflows: (workflows: Workflow[]) => void;
  upsertWorkflow: (workflow: Workflow) => void;
  removeWorkflow: (id: string) => void;

  executions: WorkflowExecution[];
  setExecutions: (executions: WorkflowExecution[]) => void;
  startRun: (execution: WorkflowExecution) => void;
  patchRun: (id: string, patch: Partial<WorkflowExecution>) => void;
  clearExecutions: () => void;

  /** Ids of runs currently executing, in start order. */
  activeRunIds: string[];

  selectedWorkflowId: string | null;
  setSelectedWorkflow: (id: string | null) => void;

  builderOpen: boolean;
  setBuilderOpen: (open: boolean) => void;

  search: string;
  setSearch: (value: string) => void;
}

export const useWorkflowStore = create<WorkflowState>()((set) => ({
  workflows: [],
  setWorkflows: (workflows) => set({ workflows }),
  upsertWorkflow: (workflow) =>
    set((s) => ({
      workflows: s.workflows.some((w) => w.id === workflow.id)
        ? s.workflows.map((w) => (w.id === workflow.id ? workflow : w))
        : [workflow, ...s.workflows],
    })),
  removeWorkflow: (id) =>
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      selectedWorkflowId: s.selectedWorkflowId === id ? null : s.selectedWorkflowId,
    })),

  executions: [],
  setExecutions: (executions) => set({ executions }),
  startRun: (execution) =>
    set((s) => ({
      executions: [execution, ...s.executions].slice(0, 120),
      activeRunIds: [...s.activeRunIds, execution.id],
    })),
  patchRun: (id, patch) =>
    set((s) => {
      const executions = s.executions.map((e) => (e.id === id ? { ...e, ...patch } : e));
      const finished = patch.status && patch.status !== "running";
      return {
        executions,
        activeRunIds: finished ? s.activeRunIds.filter((x) => x !== id) : s.activeRunIds,
      };
    }),
  clearExecutions: () => set({ executions: [], activeRunIds: [] }),

  activeRunIds: [],

  selectedWorkflowId: null,
  setSelectedWorkflow: (id) => set({ selectedWorkflowId: id }),

  builderOpen: false,
  setBuilderOpen: (open) => set({ builderOpen: open }),

  search: "",
  setSearch: (value) => set({ search: value }),
}));
