import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { allNav } from "@/config/navigation";
import { useAppStore, type OrbState } from "@/store/app-store";
import { Activity, Ear, MessageSquarePlus, MoonStar, RefreshCcw } from "lucide-react";

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, togglePalette, setOrbState } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePalette]);

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    setTimeout(fn, 80);
  };

  const orbActions: { label: string; state: OrbState; icon: typeof Ear }[] = [
    { label: "Start listening", state: "listening", icon: Ear },
    { label: "Simulate thinking", state: "thinking", icon: RefreshCcw },
    { label: "Simulate speaking", state: "speaking", icon: Activity },
    { label: "Go offline", state: "offline", icon: MoonStar },
  ];

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {allNav.map((item) => (
            <CommandItem
              key={item.to}
              value={`${item.label} ${item.hint}`}
              onSelect={() => run(() => navigate({ to: item.to }))}
            >
              <item.icon className="size-4 text-primary" />
              <span>{item.label}</span>
              <CommandShortcut>{item.hint}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Assistant">
          <CommandItem
            value="new conversation"
            onSelect={() => run(() => navigate({ to: "/chat" }))}
          >
            <MessageSquarePlus className="size-4 text-primary" />
            <span>New conversation</span>
          </CommandItem>
          {orbActions.map((a) => (
            <CommandItem key={a.state} value={a.label} onSelect={() => run(() => setOrbState(a.state))}>
              <a.icon className="size-4 text-primary" />
              <span>{a.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
