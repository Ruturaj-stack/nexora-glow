import { createFileRoute } from "@tanstack/react-router";
import { releaseInfo } from "@/config/version";

/**
 * Readiness probe — verifies the process can reach the database before the
 * instance is added to a load balancer pool.
 */
export const Route = createFileRoute("/api/public/ready")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const checks: Record<string, "ok" | "fail" | "skipped"> = { config: url && key ? "ok" : "fail" };

        if (url && key) {
          try {
            const started = Date.now();
            const response = await fetch(`${url}/auth/v1/health`, {
              headers: { apikey: key },
              signal: AbortSignal.timeout(4000),
            });
            checks["database"] = response.ok ? "ok" : "fail";
            checks["latencyMs"] = String(Date.now() - started) as "ok";
          } catch {
            checks["database"] = "fail";
          }
        } else {
          checks["database"] = "skipped";
        }

        const ready = checks["config"] === "ok" && checks["database"] !== "fail";
        return Response.json(
          { status: ready ? "ready" : "unavailable", checks, release: releaseInfo() },
          { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
