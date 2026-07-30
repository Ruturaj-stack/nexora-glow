/**
 * Provider abstraction layer.
 *
 * Every provider implements {@link ChatProvider}. Callers pass a model id and
 * receive a token stream — they never branch on the concrete vendor. Adding a
 * provider means registering one more object in `PROVIDERS`.
 */

export interface ChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamParams {
  model: string;
  messages: ChatMessageInput[];
  signal?: AbortSignal;
  temperature?: number;
}

export interface ChatProvider {
  id: string;
  /** Returns true when the runtime has the credentials this provider needs. */
  isConfigured(): boolean;
  /** True when this provider can serve the given model id. */
  handles(model: string): boolean;
  /** Streams plain text deltas. */
  stream(params: StreamParams): Promise<ReadableStream<string>>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Parses an OpenAI-compatible SSE body into a stream of text deltas. */
function sseToTextStream(response: Response): ReadableStream<string> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<string>({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(delta);
            } catch {
              // Ignore malformed keep-alive fragments.
            }
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      } finally {
        reader.releaseLock();
      }
      controller.close();
    },
  });
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? text.slice(0, 300);
  } catch {
    return text.slice(0, 300) || response.statusText;
  }
}

/**
 * Lovable AI Gateway — serves both `openai/*` and `google/*` model ids over an
 * OpenAI-compatible surface. No user-supplied key required.
 */
const gatewayProvider: ChatProvider = {
  id: "lovable-gateway",
  isConfigured: () => Boolean(process.env.LOVABLE_API_KEY),
  handles: (model) => model.startsWith("openai/") || model.startsWith("google/"),
  async stream({ model, messages, signal, temperature }) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": process.env.LOVABLE_API_KEY!,
      },
      signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...(temperature != null ? { temperature } : {}),
      }),
    });

    if (!response.ok) {
      throw new ProviderError(await readError(response), response.status);
    }
    return sseToTextStream(response);
  },
};

/** Anthropic direct — enabled when an ANTHROPIC_API_KEY secret is present. */
const anthropicProvider: ChatProvider = {
  id: "anthropic",
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  handles: (model) => model.startsWith("anthropic/"),
  async stream({ model, messages, signal, temperature }) {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      signal,
      body: JSON.stringify({
        model: model.replace("anthropic/", ""),
        max_tokens: 4096,
        stream: true,
        ...(system ? { system } : {}),
        ...(temperature != null ? { temperature } : {}),
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      throw new ProviderError(await readError(response), response.status);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    return new ReadableStream<string>({
      async start(controller) {
        const reader = response.body!.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let index: number;
            while ((index = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, index).trim();
              buffer = buffer.slice(index + 1);
              if (!line.startsWith("data:")) continue;
              try {
                const parsed = JSON.parse(line.slice(5).trim()) as {
                  type?: string;
                  delta?: { text?: string };
                };
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  controller.enqueue(parsed.delta.text);
                }
              } catch {
                /* keep-alive */
              }
            }
          }
        } catch (error) {
          controller.error(error);
          return;
        } finally {
          reader.releaseLock();
        }
        controller.close();
      },
    });
  },
};

/** Self-hosted Ollama — enabled when OLLAMA_BASE_URL points at a reachable host. */
const ollamaProvider: ChatProvider = {
  id: "ollama",
  isConfigured: () => Boolean(process.env.OLLAMA_BASE_URL),
  handles: (model) => model.startsWith("ollama/"),
  async stream({ model, messages, signal, temperature }) {
    const base = process.env.OLLAMA_BASE_URL!.replace(/\/$/, "");
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        model: model.replace("ollama/", ""),
        messages,
        stream: true,
        ...(temperature != null ? { temperature } : {}),
      }),
    });
    if (!response.ok) {
      throw new ProviderError(await readError(response), response.status);
    }
    return sseToTextStream(response);
  },
};

const PROVIDERS: ChatProvider[] = [gatewayProvider, anthropicProvider, ollamaProvider];

export function resolveProvider(model: string): ChatProvider {
  const provider = PROVIDERS.find((p) => p.handles(model));
  if (!provider) throw new ProviderError(`No provider registered for model "${model}"`, 400);
  if (!provider.isConfigured()) {
    throw new ProviderError(`Provider "${provider.id}" is not configured on this server`, 503);
  }
  return provider;
}

export function streamChat(params: StreamParams): Promise<ReadableStream<string>> {
  return resolveProvider(params.model).stream(params);
}
