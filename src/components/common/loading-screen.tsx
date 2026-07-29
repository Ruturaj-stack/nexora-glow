import { motion } from "framer-motion";

export function LoadingScreen({ label = "Initialising Nexora" }: { label?: string }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background">
      <div className="relative grid size-24 place-items-center">
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/20 blur-2xl"
          animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.9, 1.06, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute inset-2 rounded-full border border-primary/40"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="size-10 rounded-full bg-gradient-to-br from-primary to-accent"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-muted-foreground">{label}</p>
    </div>
  );
}
