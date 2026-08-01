import {
  LayoutDashboard,
  MessageSquare,
  Brain,
  MonitorSmartphone,
  FolderOpen,
  Workflow,
  MonitorCog,
  Wrench,
  Settings,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  hint: string;
}

export const primaryNav: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, hint: "System overview" },
  { label: "Chat", to: "/chat", icon: MessageSquare, hint: "Converse with Nexora" },
  { label: "Memory", to: "/memory", icon: Brain, hint: "Long-term knowledge" },
  { label: "Devices", to: "/devices", icon: MonitorSmartphone, hint: "Connected hardware" },
  { label: "Files", to: "/files", icon: FolderOpen, hint: "Indexed documents" },
  { label: "Computer", to: "/computer", icon: MonitorCog, hint: "System control" },
  { label: "Tools", to: "/tools", icon: Wrench, hint: "Registry & permissions" },
  { label: "Automation", to: "/automation", icon: Workflow, hint: "Flows & triggers" },
];

export const secondaryNav: NavItem[] = [
  { label: "Settings", to: "/settings", icon: Settings, hint: "Preferences" },
  { label: "Developer", to: "/developer", icon: TerminalSquare, hint: "Logs & API" },
];

export const allNav = [...primaryNav, ...secondaryNav];
