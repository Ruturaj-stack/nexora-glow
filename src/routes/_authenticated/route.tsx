import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/features/shell/app-shell";
import { useAuth } from "@/features/auth/auth-context";
import { LoadingScreen } from "@/components/common/loading-screen";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { initializing, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (initializing || isAuthenticated) return;
    void navigate({
      to: "/auth",
      search: { redirect: window.location.pathname + window.location.search },
      replace: true,
    });
  }, [initializing, isAuthenticated, navigate]);

  if (initializing) return <LoadingScreen />;
  if (!isAuthenticated) return <LoadingScreen label="Redirecting to sign in" />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
