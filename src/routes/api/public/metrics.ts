import { createFileRoute } from "@tanstack/react-router";
import { releaseInfo } from "@/config/version";
import { snapshot } from "@/lib/observability/metrics";

/**
 * Process metrics for scrapers/dashboards. Deliberately contains no user data:
 * counters and duration histograms only.
 */
export const Route = createFileRoute("/api/public/metrics")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { release: releaseInfo(), metrics: snapshot() },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
