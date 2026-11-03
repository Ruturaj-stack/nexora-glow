import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AudioLines, Bell, Palette, Save, Shield, User } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrbStatePicker } from "@/features/orb/orb-state-picker";
import { AIOrb } from "@/features/orb/ai-orb";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/features/auth/auth-context";
import { updateMe, updateMySettings } from "@/lib/users.functions";
import { TelemetryConsent } from "@/features/telemetry/telemetry-consent";
import { VoiceSettings } from "@/features/voice/voice-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nexora AI Workspace" },
      {
        name: "description",
        content: "Tune Nexora's account, appearance, notifications and privacy.",
      },
      { property: "og:title", content: "Settings — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Tune Nexora's account, appearance, notifications and privacy.",
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
  const { profile, settings, refreshProfile } = useAuth();
  const { uiPrefs, setUiPref } = useAppStore();
  const orbState = useAppStore((s) => s.orbState);

  const [name, setName] = useState(profile?.name ?? "");

  // The profile query resolves after mount — keep the field in sync with it.
  useEffect(() => {
    if (profile?.name) setName((current) => (current === "" ? profile.name : current));
  }, [profile?.name]);

  const saveProfile = useMutation({
    mutationFn: async () =>
      (await updateMe({ data: { name, avatar: profile?.avatar ?? null } })).data,
    onSuccess: async () => {
      await refreshProfile();
      toast.success("Profile saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveSettings = useMutation({
    mutationFn: async (notifications: boolean) =>
      (
        await updateMySettings({
          data: {
            theme: settings?.theme ?? "dark",
            accentColor: settings?.accentColor ?? "aurora",
            language: settings?.language ?? "en",
            notifications,
            timezone: settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        })
      ).data,
    onSuccess: async () => {
      await refreshProfile();
      toast.success("Settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Preferences for the Nexora workspace." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={User} title="Account" description="Your profile in the workspace">
          <div className="space-y-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Display name</p>
                <p className="text-xs text-muted-foreground">Shown on your account and greeting</p>
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="h-9 w-40"
                maxLength={60}
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            disabled={!name.trim() || name === profile?.name || saveProfile.isPending}
            onClick={() => saveProfile.mutate()}
          >
            <Save className="size-3.5" />
            {saveProfile.isPending ? "Saving…" : "Save profile"}
          </Button>
          <Row
            label="Email"
            hint="Your sign-in address"
            control={
              <Badge variant="secondary" className="max-w-48 truncate font-mono text-[11px]">
                {profile?.email ?? "—"}
              </Badge>
            }
          />
          <Row
            label="Role"
            hint="Access level in this workspace"
            control={<Badge variant="secondary" className="capitalize">{profile?.role ?? "user"}</Badge>}
          />
          <Row
            label="Member since"
            hint="When your account was created"
            control={
              <span className="text-xs text-muted-foreground">
                {profile ? new Date(profile.createdAt).toLocaleDateString() : "—"}
              </span>
            }
          />
        </Section>

        <Section icon={Palette} title="Appearance" description="Theme and motion — stored on this device" delay={0.05}>
          <Row
            label="Glass intensity"
            hint="Blur strength across panels"
            control={
              <Slider
                value={[uiPrefs.glass]}
                min={0}
                max={100}
                step={5}
                onValueChange={([glass]) => setUiPref({ glass })}
                className="w-40"
                aria-label="Glass intensity"
              />
            }
          />
          <Row
            label="Reduced motion"
            hint="Minimise animations across the app"
            control={
              <Switch
                checked={uiPrefs.reducedMotion}
                onCheckedChange={(reducedMotion) => setUiPref({ reducedMotion })}
                aria-label="Reduced motion"
              />
            }
          />
          <div>
            <p className="text-sm font-medium">Orb preview</p>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              <AIOrb state={orbState} size={96} />
              <OrbStatePicker />
            </div>
          </div>
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

        <Section icon={Bell} title="Notifications" description="Alerts and delivery — saved to your account" delay={0.1}>
          <Row
            label="Device & automation alerts"
            hint="Offline warnings and flow results in the notification centre"
            control={
              <Switch
                checked={settings?.notifications ?? true}
                disabled={saveSettings.isPending}
                onCheckedChange={(next) => saveSettings.mutate(next)}
                aria-label="Device and automation alerts"
              />
            }
          />
          <p className="text-[11px] text-muted-foreground">
            {settings ? "Synced to your account on change." : "First change creates your preferences."}
          </p>
        </Section>

        <Section icon={Shield} title="Privacy" description="Data handling" delay={0.15}>
          <TelemetryConsent />
        </Section>
      </div>
    </div>
  );
}
