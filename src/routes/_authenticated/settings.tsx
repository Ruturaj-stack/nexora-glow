import { createFileRoute } from "@tanstack/react-router";
import { AudioLines, Bell, Palette, Shield, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrbStatePicker } from "@/features/orb/orb-state-picker";
import { AIOrb } from "@/features/orb/ai-orb";
import { useAppStore } from "@/store/app-store";
import { VoiceSettings } from "@/features/voice/voice-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nexora AI Workspace" },
      {
        name: "description",
        content: "Tune Nexora's appearance, assistant behaviour, notifications and privacy.",
      },
      { property: "og:title", content: "Settings — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Tune Nexora's appearance, assistant behaviour, notifications and privacy.",
      },
    ],
  }),
  component: SettingsPage,
});

function Section({
  icon: Icon,
  title,
  description,
  children,
  delay,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <GlassPanel className="p-5" delay={delay}>
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold">{title}</h3>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </GlassPanel>
  );
}

function Row({ label, hint, control }: { label: string; hint: string; control: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SettingsPage() {
  const orbState = useAppStore((s) => s.orbState);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Preferences for the Nexora workspace." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={Sparkles} title="Assistant" description="Persona and orb behaviour">
          <Row
            label="Assistant name"
            hint="Shown throughout the workspace"
            control={<Input defaultValue="Nexora" className="h-9 w-40" />}
          />
          <Row
            label="Wake phrase"
            hint="Voice activation keyword"
            control={<Input defaultValue="Hey Nexora" className="h-9 w-40" />}
          />
          <div>
            <p className="text-sm font-medium">Orb preview</p>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              <AIOrb state={orbState} size={96} />
              <OrbStatePicker />
            </div>
          </div>
        </Section>

        <Section icon={Palette} title="Appearance" description="Theme and motion" delay={0.05}>
          <Row
            label="Glass intensity"
            hint="Blur strength across panels"
            control={<Slider defaultValue={[70]} className="w-40" />}
          />
          <Row
            label="Reduced motion"
            hint="Minimise animations"
            control={<Switch />}
          />
          <Row label="Compact density" hint="Tighter spacing" control={<Switch />} />
        </Section>

        <Section
          icon={AudioLines}
          title="Voice"
          description="Speech input, synthesis and devices"
          delay={0.08}
        >
          <div id="voice">
            <VoiceSettings />
          </div>
        </Section>

        <Section icon={Bell} title="Notifications" description="Alerts and delivery" delay={0.1}>
          <Row label="Device alerts" hint="Offline and health warnings" control={<Switch defaultChecked />} />
          <Row label="Automation results" hint="Notify on flow completion" control={<Switch defaultChecked />} />
          <Row label="Quiet hours" hint="Mute 22:00 – 07:00" control={<Switch />} />
        </Section>

        <Section icon={Shield} title="Privacy" description="Data handling" delay={0.15}>
          <Row label="Local-only memory" hint="Never sync memories off-device" control={<Switch defaultChecked />} />
          <Row label="Anonymous telemetry" hint="Share crash diagnostics" control={<Switch />} />
          <Row
            label="Retention"
            hint="Days before memories expire"
            control={<Input defaultValue="365" className="h-9 w-24 text-right" />}
          />
          <Label className="block pt-1 text-[11px] font-normal text-muted-foreground">
            Settings are local-state only in Phase 1.
          </Label>
        </Section>
      </div>
    </div>
  );
}
