import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Brain,
  Cpu,
  Loader2,
  MessageSquare,
  MonitorSmartphone,
  RefreshCcw,
  Workflow,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { GlassPanel } from "@/components/common/glass-panel";
import { AIOrb, orbStateLabel } from "@/features/orb/ai-orb";
import { OrbStatePicker } from "@/features/orb/orb-state-picker";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/features/auth/auth-context";
import { listConversations, createConversation } from "@/lib/conversations.functions";
import { listMemories } from "@/lib/memories.functions";
import { listDevices } from "@/lib/devices.functions";
import { listWorkflows } from "@/lib/workflows.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexora AI Workspace" },
      {
        name: "description",
        content:
          "Live workspace overview for Nexora: assistant state, conversations, memories, devices and automations.",
      },
      { property: "og:title", content: "Dashboard — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Assistant state, device health, memory and automation activity at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function useWorkspaceData() {
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await listConversations()).data,
    staleTime: 30_000,
  });
  const memories = useQuery({
    queryKey: ["memories"],
    queryFn: async () => (await listMemories()).data,
    staleTime: 60_000,
  });
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: async () => (await listDevices()).data,
    staleTime: 30_000,
  });
  const workflows = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await listWorkflows()).data,
    staleTime: 30_000,
  });
  return { conversations, memories, devices, workflows };
}

function Dashboard() {
  const orbState = useAppStore((s) => s.orbState);
  const setDraft = useAppStore; // placeholder removed below
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { conversations, memories, devices, workflows } = useWorkspaceData();

  const onlineDevices = (devices.data ?? []).filter((d) => d.status === "online").length;
  const enabledFlows = (workflows.data ?? []).filter((w) => w.enabled).length;

  const firstName = profile?.name?.split(/\s+/)[0] ?? "there";
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (conversations.data) parts.push(`${conversations.data.length} conversation${conversations.data.length === 1 ? "" : "s"}`);
    if (memories.data) parts.push(`${memories.data.length} memor${memories.data.length === 1 ? "y" : "ies"}`);
    if (devices.data) parts.push(`${devices.data.length} device${devices.data.length === 1 ? "" : "s"} paired`);
    if (workflows.data) parts.push(`${enabledFlows} of ${workflows.data.length} flows active`);
    return parts.length ? `Your workspace holds ${parts.join(", ")}.` : "Loading your workspace…";
  }, [conversations.data, memories.data, devices.data, workflows.data, enabledFlows]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["memories"] });
    void queryClient.invalidateQueries({ queryKey: ["devices"] });
    void queryClient.invalidateQueries({ queryKey: ["workflows"] });
  };

  async function runBriefing() {
    try {
      const created = (await createConversation({ data: { title: "Morning briefing" } })).data;
      const { useChatStore } = await import("@/store/chat-store");
      useChatStore.getState().setDraft(
        created.id,
        "Good morning! Run my briefing: what's on my plate, how my devices are doing, and anything I pinned recently.",
      );
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void navigate({ to: "/chat/$conversationId", params: { conversationId: created.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start a conversation");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Here's the current state of your Nexora workspace."
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void runBriefing()}>
            <Zap className="size-4 text-primary" /> Run briefing
          </Button>
        }
      />

      <GlassPanel className="overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center">
          <AIOrb state={orbState} size={200} className="shrink-0" />
          <div className="min-w-0 flex-1 text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Assistant · {orbStateLabel(orbState)}
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">Nexora</span> is standing by
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground lg:mx-0">
              {summary} Say the word or press{" "}
              <kbd className="rounded border border-border bg-surface/70 px-1.5 py-0.5 font-mono text-[11px]">
                Ctrl K
              </kbd>
              .
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
              <OrbStatePicker />
            </div>
          </div>
        </div>
      </GlassPanel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Conversations"
          value={conversations.isLoading ? "…" : String(conversations.data?.length ?? 0)}
          delta={conversations.error ? "Unavailable" : "Chats with your assistant"}
          icon={MessageSquare}
          delay={0.05}
        />
        <StatCard
          label="Memories"
          value={memories.isLoading ? "…" : String(memories.data?.length ?? 0)}
          delta={memories.error ? "Unavailable" : `${(memories.data ?? []).filter((m) => m.pinned).length} pinned`}
          icon={Brain}
          delay={0.1}
        />
        <StatCard
          label="Response latency"
          value={conversations.isFetching ? "…" : "—"}
          delta="Measured per chat turn"
          icon={Cpu}
          delay={0.15}
        />
        <StatCard
          label="Devices online"
          value={
            devices.isLoading ? "…" : `${onlineDevices}/${devices.data?.length ?? 0}`
          }
          delta={
            devices.error
              ? "Unavailable"
              : onlineDevices < (devices.data?.length ?? 0)
                ? "Some devices unreachable"
                : "All reachable"
          }
          trend={devices.error ? undefined : onlineDevices < (devices.data?.length ?? 0) ? "down" : "up"}
          icon={MonitorSmartphone}
          delay={0.2}
        >
          {devices.data && devices.data.length > 0 && (
            <Progress
              value={(onlineDevices / devices.data.length) * 100}
              className="h-1.5"
            />
          )}
        </StatCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="p-5 lg:col-span-2" delay={0.25}>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Automation activity</h3>
            <div className="flex items-center gap-2">
              {workflows.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              <Button variant="ghost" size="icon" className="size-7" onClick={refreshAll} aria-label="Refresh data">
                <RefreshCcw className="size-3.5" />
              </Button>
              <Badge variant="secondary" className="gap-1.5">
                <Workflow className="size-3" />
                {workflows.data ? `${enabledFlows}/${workflows.data.length} active` : "—"}
              </Badge>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {workflows.error && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <span className="text-destructive">Automations couldn't load: {workflows.error.message}</span>
                <Button variant="outline" size="sm" onClick={() => workflows.refetch()}>
                  Retry
                </Button>
              </div>
            )}
            {workflows.data?.slice(0, 5).map((a, i) => (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                onClick={() => navigate({ to: "/automation" })}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface/40 p-3 text-left transition-colors hover:border-primary/25"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.triggers[0] ? `${a.triggers[0].type} trigger` : "Manual trigger"}
                  </p>
                </div>
                <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                  {a.lastRunAt
                    ? new Date(a.lastRunAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "never run"}
                </span>
                <span
                  className={`size-2 shrink-0 rounded-full ${a.enabled ? "bg-success" : "bg-muted-foreground/50"}`}
                />
              </motion.button>
            ))}
            {workflows.data && workflows.data.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No automations yet.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate({ to: "/automation" })}>
                  Create your first flow
                </Button>
              </div>
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5" delay={0.3}>
          <h3 className="font-display text-base font-semibold">Device mesh</h3>
          <div className="mt-4 space-y-3">
            {devices.data?.slice(0, 5).map((d) => (
              <button
                key={d.id}
                onClick={() => navigate({ to: "/devices" })}
                className="flex w-full items-center gap-3 text-left"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    d.status === "online"
                      ? "bg-success"
                      : d.status === "idle"
                        ? "bg-warning"
                        : "bg-muted-foreground/50"
                  }`}
                />
                <p className="min-w-0 flex-1 truncate text-sm">{d.name}</p>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {d.battery != null ? `${d.battery}%` : d.platform}
                </span>
              </button>
            ))}
            {devices.data && devices.data.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No devices paired yet.{" "}
                <button className="text-primary hover:underline" onClick={() => navigate({ to: "/devices" })}>
                  Pair one
                </button>
              </p>
            )}
            {devices.error && (
              <p className="text-xs text-destructive">Devices couldn't load: {devices.error.message}</p>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

import { Activity } from "lucide-react";
