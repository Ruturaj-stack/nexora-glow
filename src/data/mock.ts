export const cpuSeries = [22, 28, 24, 35, 30, 42, 38, 31, 46, 40, 34, 29];
export const memorySeries = [61, 63, 60, 66, 70, 68, 72, 69, 74, 71, 73, 70];
export const latencySeries = [120, 96, 88, 104, 76, 82, 70, 68, 74, 66, 62, 58];

export const devices = [
  { id: "d1", name: "Aurora Workstation", type: "Desktop", status: "online", battery: null, load: 34, os: "macOS 15.2" },
  { id: "d2", name: "Nexora Handheld", type: "Mobile", status: "online", battery: 78, load: 12, os: "Android 15" },
  { id: "d3", name: "Studio Display Hub", type: "Display", status: "offline", battery: null, load: 0, os: "NexOS 1.4" },
  { id: "d4", name: "Field Tablet", type: "Tablet", status: "idle", battery: 41, load: 6, os: "iPadOS 18" },
  { id: "d5", name: "Edge Node · Lab", type: "Server", status: "online", battery: null, load: 62, os: "Ubuntu 24.04" },
  { id: "d6", name: "Voice Puck", type: "Sensor", status: "online", battery: 92, load: 3, os: "NexOS Lite" },
] as const;

export const memories = [
  { id: "m1", title: "Product roadmap Q3", type: "Document", tokens: 4820, updated: "2 hours ago", tags: ["work", "planning"] },
  { id: "m2", title: "Preferred coffee order", type: "Fact", tokens: 24, updated: "yesterday", tags: ["personal"] },
  { id: "m3", title: "Home network topology", type: "Graph", tokens: 1290, updated: "3 days ago", tags: ["devices"] },
  { id: "m4", title: "Client call — Vantage Labs", type: "Transcript", tokens: 9640, updated: "5 days ago", tags: ["work", "calls"] },
  { id: "m5", title: "Reading list", type: "Collection", tokens: 780, updated: "1 week ago", tags: ["personal"] },
  { id: "m6", title: "Deploy runbook", type: "Document", tokens: 3310, updated: "2 weeks ago", tags: ["ops"] },
];

export const files = [
  { id: "f1", name: "nexora-architecture.pdf", size: "4.2 MB", kind: "PDF", indexed: true, modified: "Today, 09:41" },
  { id: "f2", name: "design-tokens.json", size: "38 KB", kind: "JSON", indexed: true, modified: "Today, 08:02" },
  { id: "f3", name: "quarterly-review.docx", size: "1.1 MB", kind: "Doc", indexed: true, modified: "Yesterday" },
  { id: "f4", name: "voice-samples.zip", size: "182 MB", kind: "Archive", indexed: false, modified: "3 days ago" },
  { id: "f5", name: "telemetry-2026-07.csv", size: "26 MB", kind: "CSV", indexed: true, modified: "5 days ago" },
  { id: "f6", name: "brand-orb.mp4", size: "94 MB", kind: "Video", indexed: false, modified: "1 week ago" },
];

export const automations = [
  { id: "a1", name: "Morning briefing", trigger: "Every day · 07:30", runs: 128, enabled: true, lastRun: "1.8s · success" },
  { id: "a2", name: "Meeting summariser", trigger: "On calendar event end", runs: 42, enabled: true, lastRun: "3.4s · success" },
  { id: "a3", name: "Inbox triage", trigger: "New mail received", runs: 916, enabled: false, lastRun: "0.9s · skipped" },
  { id: "a4", name: "Device health sweep", trigger: "Every 15 minutes", runs: 2450, enabled: true, lastRun: "0.4s · success" },
];

export const conversations = [
  { id: "c1", title: "Refactor design tokens", preview: "Let's unify the surface layers…", time: "09:12" },
  { id: "c2", title: "Trip planning — Kyoto", preview: "Shortlist of ryokans in Gion…", time: "Yesterday" },
  { id: "c3", title: "Weekly metrics recap", preview: "Latency dropped 18% after…", time: "Mon" },
];

export const chatThread = [
  { id: "t1", role: "assistant" as const, text: "Good morning. Six devices are online and your memory index finished rebuilding overnight. Want the briefing?" },
  { id: "t2", role: "user" as const, text: "Give me the short version, then show what changed in the design tokens." },
  { id: "t3", role: "assistant" as const, text: "Short version: 3 automations ran, 1 device dropped offline, and latency is down 18% week over week. The token diff touches surface elevation and the accent ramp — I've highlighted both below." },
];

export const logs = [
  { id: "l1", level: "info", time: "09:41:02.118", scope: "core", message: "Session bootstrapped in 412ms" },
  { id: "l2", level: "debug", time: "09:41:02.502", scope: "memory", message: "Loaded 6 collections (12,480 vectors)" },
  { id: "l3", level: "warn", time: "09:44:19.006", scope: "devices", message: "Heartbeat timeout: studio-display-hub" },
  { id: "l4", level: "info", time: "09:45:00.000", scope: "automation", message: "Flow 'device-health-sweep' completed in 0.4s" },
  { id: "l5", level: "error", time: "09:47:33.771", scope: "sync", message: "Retry 2/5 — transport closed unexpectedly" },
];
