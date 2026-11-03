import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/features/auth/auth-layout";
import { useAuth } from "@/features/auth/auth-context";
import { GoogleButton } from "@/features/auth/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema } from "@/lib/validators/auth";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create account — Nexora Workspace" },
      {
        name: "description",
        content: "Create a Nexora account to set up your private AI workspace in minutes.",
      },
      { property: "og:title", content: "Create account — Nexora Workspace" },
      { property: "og:description", content: "Set up your private Nexora AI workspace." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  function set(key: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setPending(true);
    const result = await signUp(parsed.data.name, parsed.data.email, parsed.data.password);
    setPending(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    if (result.needsConfirmation) {
      setConfirmationEmail(parsed.data.email);
      return;
    }
    toast.success("Account created — you're in.");
    void navigate({ to: "/", replace: true });
  }

  if (confirmationEmail) {
    return (
      <AuthLayout
        title="Confirm your email"
        subtitle={`We sent a confirmation link to ${confirmationEmail}. Click it to activate your workspace, then sign in.`}
        footer={
          <>
            Didn't get it?{" "}
            <button
              type="button"
              onClick={() => setConfirmationEmail(null)}
              className="text-primary hover:underline"
            >
              Try again
            </button>{" "}
            or{" "}
            <Link to="/auth" className="text-primary hover:underline">
              sign in
            </Link>
          </>
        }
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12">
            <MailCheck className="size-7 text-primary" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your account exists but stays inactive until the link is clicked. The email can take a
            minute or two to arrive — check your spam folder if nothing shows up.
          </p>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/auth">Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="A few details and Nexora is ready."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/auth" className="text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={values.name}
            onChange={set("name")}
            placeholder="Ada Lovelace"
          />
          {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={set("email")}
            placeholder="you@company.com"
          />
          {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={set("password")}
            placeholder="At least 8 characters"
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              8+ characters with upper, lower and a number.
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create account
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton label="Sign up with Google" redirectTo="/" />
    </AuthLayout>
  );
}
