import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/features/auth/auth-layout";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema } from "@/lib/validators/auth";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — Nexora" },
      {
        name: "description",
        content: "Request a secure password reset link for your Nexora workspace account.",
      },
      { property: "og:title", content: "Reset your password — Nexora" },
      { property: "og:description", content: "Request a secure Nexora password reset link." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setError(null);
    setPending(true);
    const result = await requestPasswordReset(parsed.data.email);
    setPending(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll email you a secure link to set a new one."
      footer={
        <Link to="/auth" className="text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-8 text-center">
          <MailCheck className="size-6 text-primary" />
          <p className="text-sm text-foreground">Check your inbox</p>
          <p className="text-xs text-muted-foreground">
            If an account exists for {email}, a reset link is on its way.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
