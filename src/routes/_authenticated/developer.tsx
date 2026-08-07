import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Braces, DatabaseBackup, Gauge, ShieldCheck, TerminalSquare } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { PanelSkeleton } from "@/components/common/skeletons";
import { LogViewer } from "@/features/observability/log-viewer";
import { releaseLabel } from "@/config/version";

// Heavy, rarely-opened panels are code-split out of the initial route chunk.
const MetricsPanel = lazy(() =>
  import("@/features/observability/metrics-panel").then((m) => ({ default: m.MetricsPanel })),
);
const BackupPanel = lazy(() =>
  import("@/features/backup/backup-panel").then((m) => ({ default: m.BackupPanel })),
);
const TelemetryConsent = lazy(() =>
  import("@/features/telemetry/telemetry-consent").then((m) => ({ default: m.TelemetryConsent })),
);

export const Route = createFileRoute("/_authenticated/developer")({
  head: () => ({
    meta: [
      { title: "Developer — Nexora AI Workspace" },
      {
        name: "description",
        content:
          "Runtime logs, metrics, backups, telemetry consent and design tokens for Nexora builders.",
      },
      { property: "og:title", content: "Developer — Nexora AI Workspace" },
      {
        property: "og:description",
        content:
          "Runtime logs, metrics, backups, telemetry consent and design tokens for Nexora builders.",
      },
    ],
  }),
  component: DeveloperPage,
});

const tokens = [
  { name: "--primary", value: "oklch(0.79 0.135 195)" },
  { name: "--surface", value: "oklch(0.213 0.023 255)" },
  { name: "--success", value: "oklch(0.75 0.15 160)" },
  { name: "--warning", value: "oklch(0.81 0.14 78)" },
  { name: "--destructive", value: "oklch(0.63 0.19 22)" },
];

function Panel({
  icon: Icon,
  title,
  badge,
  delay,
  children,
}: {
  icon: typeof Braces;
  title: string;
  badge?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel className="p-0" delay={delay}>
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Icon className="size-4 text-primary" />
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {badge && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {badge}
          </Badge>
        )}
      </div>
      <div className="p-4">{children}</div>
    </GlassPanel>
  );
}

function DeveloperPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer"
        description="Runtime observability, backups and the design system powering Nexora."
        actions={
          <Badge variant="outline" className="font-mono text-[10px]">
            {releaseLabel()}
          </Badge>
        }
      />

      <Panel icon={TerminalSquare} title="Runtime log" badge="live">
        <ErrorBoundary scope="developer.logs">
          <LogViewer />
        </ErrorBoundary>
      </Panel>

      <Panel icon={Gauge} title="Metrics" delay={0.05}>
        <ErrorBoundary scope="developer.metrics">
          <Suspense fallback={<PanelSkeleton label="Loading metrics" />}>
            <MetricsPanel />
          </Suspense>
        </ErrorBoundary>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={DatabaseBackup} title="Backup & restore" delay={0.08}>
          <ErrorBoundary scope="developer.backup">
            <Suspense fallback={<PanelSkeleton label="Loading backup tools" />}>
              <BackupPanel />
            </Suspense>
          </ErrorBoundary>
        </Panel>

        <Panel icon={ShieldCheck} title="Privacy & telemetry" delay={0.1}>
          <ErrorBoundary scope="developer.telemetry">
            <Suspense fallback={<PanelSkeleton label="Loading privacy controls" />}>
              <TelemetryConsent />
            </Suspense>
          </ErrorBoundary>
        </Panel>
      </div>

      <Panel icon={Braces} title="Design tokens" delay={0.12}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-3"
            >
              <span
                className="size-8 shrink-0 rounded-lg border border-glass-border"
                style={{ background: t.value }}
              />
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">{t.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{t.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
