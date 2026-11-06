/**
 * Web Intelligence Engine — search provider layer (server only).
 *
 * Providers are pluggable; credentials never leave the server runtime.
 * The active provider is the gateway-backed Firecrawl connection. Adding a
 * provider means implementing `SearchProvider` and adding it to the registry.
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  content?: string;
}

export interface SearchOptions {
  limit?: number;
  /** Fetch and attach page content for the top results (costs extra credits). */
  scrapeTop?: number;
}

export interface SearchOutcome {
  provider: string;
  results: WebSearchResult[];
  error?: string;
}

export interface SearchProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  search(query: string, options: SearchOptions): Promise<WebSearchResult[]>;
}

/* ── Firecrawl (gateway-backed) ────────────────────────────────────────── */

const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

interface FirecrawlSearchDocument {
  title?: string;
  description?: string;
  url?: string;
  markdown?: string;
  metadata?: { publishedTime?: string; sourceURL?: string; statusCode?: number };
}

function firecrawlEnv(): { key: string; connection: string } | null {
  const key = process.env["LOVABLE_API_KEY"];
  const connection = process.env["FIRECRAWL_API_KEY"];
  if (!key || !connection) return null;
  return { key, connection };
}

const firecrawlProvider: SearchProvider = {
  id: "firecrawl",
  label: "Firecrawl",
  isConfigured: () => Boolean(firecrawlEnv()),
  async search(query, options) {
    const env = firecrawlEnv();
    if (!env) throw new Error("Web search is not connected. Link the Firecrawl connector first.");
    const limit = Math.min(Math.max(options.limit ?? 6, 1), 20);
    const scrapeTop = Math.min(Math.max(options.scrapeTop ?? 0, 0), 3);

    const response = await fetch(`${FIRECRAWL_GATEWAY}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.key}`,
        "X-Connection-Api-Key": env.connection,
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: scrapeTop > 0 ? { formats: ["markdown"] } : undefined,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; error?: string; data?: FirecrawlSearchDocument[] }
      | null;
    if (!response.ok) {
      throw new Error(
        body?.error ?? `Search provider failed (status ${response.status}). Try again shortly.`,
      );
    }
    const docs = body?.data ?? [];
    return docs.map((doc) => {
      const content = doc.markdown && scrapeTop > 0 ? doc.markdown.slice(0, 4000) : undefined;
      return {
        title: doc.title ?? doc.metadata?.sourceURL ?? "Untitled result",
        url: doc.url ?? doc.metadata?.sourceURL ?? "",
        snippet: doc.description ?? (content ? content.slice(0, 300) : ""),
        publishedDate: doc.metadata?.publishedTime,
        content,
      };
    });
  },
};

/* ── Registry ──────────────────────────────────────────────────────────── */

const PROVIDERS: SearchProvider[] = [firecrawlProvider];

export function listSearchProviders(): { id: string; label: string; configured: boolean }[] {
  return PROVIDERS.map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured() }));
}

export function activeSearchProvider(): SearchProvider | null {
  return PROVIDERS.find((p) => p.isConfigured()) ?? null;
}

export async function runWebSearch(query: string, options: SearchOptions = {}): Promise<SearchOutcome> {
  const provider = activeSearchProvider();
  if (!provider) {
    return {
      provider: "none",
      results: [],
      error: "No search provider is connected. Link a search provider in the Services page.",
    };
  }
  try {
    const results = await provider.search(query, options);
    return { provider: provider.id, results };
  } catch (error) {
    return {
      provider: provider.id,
      results: [],
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}
