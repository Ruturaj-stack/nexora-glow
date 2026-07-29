import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [seed] = useState(() => Math.random());

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[140px]"
          style={{ opacity: 0.7 + seed * 0.2 }}
        />
        <div className="absolute -bottom-52 right-[-8rem] size-[32rem] rounded-full bg-accent/10 blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-primary/25 bg-primary/12 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="font-display text-base font-semibold tracking-tight">Nexora</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Secure workspace
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </motion.div>
    </div>
  );
}
