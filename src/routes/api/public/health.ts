import { createFileRoute } from "@tanstack/react-router";
import { releaseInfo } from "@/config/version";

/** Liveness probe — answers as long as the worker can serve a request. */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { status: "ok", release: releaseInfo(), time: new Date().toISOString() },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
