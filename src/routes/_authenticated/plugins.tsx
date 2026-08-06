import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Blocks, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { StatCard } from "@/components/common/stat-card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePluginStore } from "@/store/plugin-store";
import { PLUGIN_CATALOGUE } from "@/features/plugins/registry";
import { syncPluginTools } from "@/features/plugins/plugin-manager";
import { PluginCard, PluginSettingsDialog } from "@/features/plugins/ui/plugin-card";
import {
  installPlugin,
  listPlugins,
  setPluginEnabled,
  uninstallPlugin,
  updatePluginSettings,
} from "@/lib/plugins.functions";

export const Route = createFileRoute("/_authenticated/plugins")({
  head: () => ({
    meta: [
      { title: "Plugins — Nexora Extension Store" },
      {
        name: "description",
        content:
          "Install sandboxed Nexora plugins that add new tools through declarative, permission-scoped manifests.",
      },
      { property: "og:title", content: "Plugins — Nexora Extension Store" },
      {
        property: "og:description",
        content: "Sandboxed, permission-scoped extensions for the Nexora agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PluginsPage,
});

function PluginsPage() {
  const queryClient = useQueryClient();
  const plugins = usePluginStore((s) => s.plugins);
  const setPlugins = usePluginStore((s) => s.setPlugins);
  const search = usePluginStore((s) => s.search);
  const setSearch = usePluginStore((s) => s.setSearch);
  const configuringId = usePluginStore((s) => s.configuringId);
  const setConfiguring = usePluginStore((s) => s.setConfiguring);

  const list = useQuery({
    queryKey: ["plugins"],
    queryFn: async () => {
      const response = await listPlugins();
      setPlugins(response.data);
      return response.data;
    },
  });

  useEffect(() => {
    syncPluginTools(plugins);
  }, [plugins]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["plugins"] });

  const install = useMutation({
    mutationFn: (pluginId: string) => installPlugin({ data: { pluginId } }),
    onSuccess: async (response) => {
      toast.success(response.message ?? "Plugin installed");
      await refresh();
    },
    onError: (error: Error) => toast.error("Install failed", { description: error.message }),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) => setPluginEnabled({ data: input }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => uninstallPlugin({ data: { id } }),
    onSuccess: async () => {
      toast.success("Plugin removed");
      await refresh();
    },
  });

  const saveSettings = useMutation({
    mutationFn: (input: { id: string; settings: Record<string, string | number | boolean> }) =>
      updatePluginSettings({ data: input }),
    onSuccess: async () => {
      toast.success("Settings saved");
      setConfiguring(null);
      await refresh();
    },
  });

  const installedById = useMemo(
    () => new Map(plugins.map((plugin) => [plugin.pluginId, plugin])),
    [plugins],
  );

  const catalogue = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return PLUGIN_CATALOGUE;
    return PLUGIN_CATALOGUE.filter(
      (manifest) =>
        manifest.name.toLowerCase().includes(term) ||
        manifest.description.toLowerCase().includes(term) ||
        manifest.category.includes(term),
    );
  }, [search]);

  const configuring = plugins.find((plugin) => plugin.id === configuringId) ?? null;
  const activeTools = plugins
    .filter((plugin) => plugin.enabled)
    .reduce((sum, plugin) => sum + plugin.manifest.tools.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plugins"
        description="Declarative, sandboxed extensions. Plugins add tools — they never run code."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Available" value={String(PLUGIN_CATALOGUE.length)} icon={Blocks} />
        <StatCard label="Installed" value={String(plugins.length)} icon={Blocks} />
        <StatCard label="Tools added" value={String(activeTools)} icon={Blocks} />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plugins"
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="store" className="space-y-4">
        <TabsList>
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="installed">Installed</TabsTrigger>
        </TabsList>

        <TabsContent value="store">
          {list.isLoading ? (
            <GlassPanel className="grid place-items-center p-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </GlassPanel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {catalogue.map((manifest, index) => {
                const installed = installedById.get(manifest.id);
                return (
                  <PluginCard
                    key={manifest.id}
                    manifest={manifest}
                    installed={installed}
                    busy={install.isPending || remove.isPending}
                    delay={index * 0.04}
                    onInstall={() => install.mutate(manifest.id)}
                    onToggle={(enabled) =>
                      installed && toggle.mutate({ id: installed.id, enabled })
                    }
                    onConfigure={() => installed && setConfiguring(installed.id)}
                    onRemove={() => installed && remove.mutate(installed.id)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="installed">
          {plugins.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plugins.map((plugin, index) => (
                <PluginCard
                  key={plugin.id}
                  manifest={plugin.manifest}
                  installed={plugin}
                  busy={remove.isPending}
                  delay={index * 0.04}
                  onInstall={() => install.mutate(plugin.pluginId)}
                  onToggle={(enabled) => toggle.mutate({ id: plugin.id, enabled })}
                  onConfigure={() => setConfiguring(plugin.id)}
                  onRemove={() => remove.mutate(plugin.id)}
                />
              ))}
            </div>
          ) : (
            <GlassPanel className="p-10 text-center text-sm text-muted-foreground">
              Nothing installed yet — pick something from the store.
            </GlassPanel>
          )}
        </TabsContent>
      </Tabs>

      <PluginSettingsDialog
        plugin={configuring}
        saving={saveSettings.isPending}
        onClose={() => setConfiguring(null)}
        onSave={(settings) =>
          configuring && saveSettings.mutate({ id: configuring.id, settings })
        }
      />
    </div>
  );
}
