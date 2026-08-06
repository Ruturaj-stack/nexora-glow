import { useState } from "react";
import { motion } from "framer-motion";
import {
  Blocks,
  Check,
  Download,
  Globe,
  Loader2,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SCOPE_LABELS, type PermissionScope } from "@/features/tools/types";
import type { InstalledPlugin, PluginManifest } from "../types";

/** Marketplace card for a catalogue entry, plus the settings dialog. */

export function PluginCard({
  manifest,
  installed,
  busy,
  onInstall,
  onToggle,
  onConfigure,
  onRemove,
  delay = 0,
}: {
  manifest: PluginManifest;
  installed?: InstalledPlugin;
  busy: boolean;
  onInstall: () => void;
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
  onRemove: () => void;
  delay?: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass hover-lift flex flex-col rounded-2xl p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Blocks className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{manifest.name}</h3>
            <Badge variant="secondary" className="text-[10px]">
              v{manifest.version}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {manifest.author} · {manifest.category}
          </p>
        </div>
        {installed && (
          <Switch
            checked={installed.enabled}
            onCheckedChange={onToggle}
            aria-label={`Enable ${manifest.name}`}
          />
        )}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{manifest.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {manifest.permissions.map((scope) => (
          <Badge key={scope} variant="outline" className="gap-1 text-[10px]">
            <ShieldCheck className="size-3" />
            {SCOPE_LABELS[scope as PermissionScope] ?? scope}
          </Badge>
        ))}
        {manifest.allowedHosts.map((host) => (
          <Badge key={host} variant="outline" className="gap-1 text-[10px]">
            <Globe className="size-3" />
            {host}
          </Badge>
        ))}
      </div>

      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {manifest.tools.map((tool) => (
          <li key={tool.name} className="flex items-center gap-1.5">
            <Check className="size-3 text-success" />
            {tool.title}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4">
        {installed ? (
          <>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onConfigure}>
              <Settings2 className="size-3.5" /> Configure
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto gap-1.5 text-destructive"
              onClick={onRemove}
              disabled={busy}
            >
              <Trash2 className="size-3.5" /> Remove
            </Button>
          </>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={onInstall} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Install
          </Button>
        )}
      </div>
    </motion.article>
  );
}

export function PluginSettingsDialog({
  plugin,
  saving,
  onClose,
  onSave,
}: {
  plugin: InstalledPlugin | null;
  saving: boolean;
  onClose: () => void;
  onSave: (settings: Record<string, string | number | boolean>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string | number | boolean>>({});
  const active = plugin?.id ?? "";

  const value = (name: string) =>
    (Object.hasOwn(draft, name) ? draft[name] : plugin?.settings[name]) ?? "";

  return (
    <Dialog
      open={Boolean(plugin)}
      onOpenChange={(next) => {
        if (!next) {
          setDraft({});
          onClose();
        }
      }}
    >
      <DialogContent className="glass max-w-md" key={active}>
        <DialogHeader>
          <DialogTitle className="font-display">{plugin?.name} settings</DialogTitle>
          <DialogDescription>
            Values are stored with your account and injected into the plugin's actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {plugin?.manifest.settings.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={`setting-${field.name}`}>{field.label}</Label>
              {field.type === "boolean" ? (
                <Switch
                  id={`setting-${field.name}`}
                  checked={Boolean(value(field.name))}
                  onCheckedChange={(checked) =>
                    setDraft((d) => ({ ...d, [field.name]: checked }))
                  }
                />
              ) : (
                <Input
                  id={`setting-${field.name}`}
                  type={field.secret ? "password" : field.type === "number" ? "number" : "text"}
                  value={String(value(field.name))}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [field.name]:
                        field.type === "number" ? Number(e.target.value) : e.target.value,
                    }))
                  }
                />
              )}
            </div>
          ))}
          {!plugin?.manifest.settings.length && (
            <p className="text-sm text-muted-foreground">This plugin has no settings.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="gap-2"
            disabled={saving}
            onClick={() => onSave({ ...(plugin?.settings ?? {}), ...draft })}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
