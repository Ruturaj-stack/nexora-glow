import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import { listSearchProviders, runWebSearch, type WebSearchResult } from "@/lib/search.server";

/**
 * Web Intelligence Engine API:
 *   POST /api/v1/search — live web search with sources
 *   GET  /api/v1/search/providers — provider availability for the Services page
 */

export interface WebSearchResponse {
  provider: string;
  results: WebSearchResult[];
  error?: string;
}

export const webSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().trim().min(2).max(400),
        limit: z.number().int().min(1).max(20).default(6),
        scrapeTop: z.number().int().min(0).max(3).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<WebSearchResponse>> => {
    const outcome = await runWebSearch(data.query, {
      limit: data.limit,
      scrapeTop: data.scrapeTop,
    });

    if (!outcome.error) {
      await context.supabase.from("web_searches").insert({
        user_id: context.userId,
        query: data.query,
        provider: outcome.provider,
        result_count: outcome.results.length,
      });
    }

    return ok(
      { provider: outcome.provider, results: outcome.results, error: outcome.error },
      outcome.error ? "Search failed" : `${outcome.results.length} results`,
    );
  });

export const searchProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ApiResponse<ReturnType<typeof listSearchProviders>>> => {
    return ok(listSearchProviders(), "Providers");
  });
