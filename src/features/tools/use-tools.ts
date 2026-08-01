import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { probeBridge } from "./bridge";
import { listToolPermissions } from "@/lib/tools.functions";
import { useToolStore } from "@/store/tool-store";
import type { PermissionDecision } from "./types";

/** Syncs stored permissions from the database into the local store once. */
export function usePermissionSync() {
  const setPermissions = useToolStore((s) => s.setPermissions);
  const query = useQuery({
    queryKey: ["tool-permissions"],
    queryFn: () => listToolPermissions(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!query.data?.data) return;
    const map: Record<string, PermissionDecision> = {};
    query.data.data.forEach((row) => {
      map[row.scope] = row.decision;
    });
    setPermissions(map);
  }, [query.data, setPermissions]);

  return query;
}

/** Polls the optional local desktop bridge. */
export function useBridgeStatus(intervalMs = 20000) {
  const setBridge = useToolStore((s) => s.setBridge);
  const status = useToolStore((s) => s.bridge);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const result = await probeBridge();
      if (!cancelled) setBridge(result);
    };
    void check();
    const timer = setInterval(() => void check(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs, setBridge]);

  return status;
}
