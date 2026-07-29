import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

export function GoogleButton({ label, redirectTo }: { label: string; redirectTo: string }) {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const result = await signInWithGoogle();
    setPending(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    void navigate({ to: redirectTo, replace: true });
  }

  return (
    <Button type="button" variant="outline" className="w-full gap-2" disabled={pending} onClick={onClick}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2.1H12z"
          />
          <path
            fill="#34A853"
            d="M6.6 14.3 5.9 14.9 3.4 16.8A9 9 0 0 0 12 21c2.4 0 4.5-.8 6-2.2l-3.2-2.5c-.8.6-1.9.9-2.8.9-2.3 0-4.3-1.5-5-3.6z"
          />
          <path fill="#FBBC05" d="M3.4 7.2A9 9 0 0 0 3.4 16.8L6.6 14.3a5.4 5.4 0 0 1 0-4.6z" />
          <path
            fill="#4285F4"
            d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 3.4 7.2l3.2 2.5c.7-2.1 2.7-3.1 5.4-3.1z"
          />
        </svg>
      )}
      {label}
    </Button>
  );
}
