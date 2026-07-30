/**
 * Client-safe model catalogue.
 * The UI only ever references these ids — it never knows which provider
 * ultimately serves the request.
 */
export type ProviderId = "openai" | "google" | "anthropic" | "ollama";

export interface ModelDescriptor {
  /** Stable id sent to the API. */
  id: string;
  label: string;
  provider: ProviderId;
  /** Approximate context window in tokens, used for the context meter. */
  contextWindow: number;
  supportsImages: boolean;
  description: string;
}

export const MODELS: ModelDescriptor[] = [
  {
    id: "google/gemini-3.6-flash",
    label: "Nexora Flash",
    provider: "google",
    contextWindow: 1_000_000,
    supportsImages: true,
    description: "Fast, multimodal default for everyday conversation.",
  },
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Nexora Pro",
    provider: "google",
    contextWindow: 1_000_000,
    supportsImages: true,
    description: "Deeper reasoning for complex, multi-step problems.",
  },
  {
    id: "openai/gpt-5.4",
    label: "Nexora Precision",
    provider: "openai",
    contextWindow: 400_000,
    supportsImages: true,
    description: "Strong analytical writing, code review and refactoring.",
  },
  {
    id: "openai/gpt-5.4-mini",
    label: "Nexora Precision Mini",
    provider: "openai",
    contextWindow: 400_000,
    supportsImages: true,
    description: "Lower-latency variant for high-volume chat.",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

export function getModel(id: string): ModelDescriptor {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

/** Rough token estimate (~4 characters per token) used for UI meters only. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
