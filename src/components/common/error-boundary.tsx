import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/observability/logger";
import { increment } from "@/lib/observability/metrics";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  /** Named so logs point at the failing area, e.g. "chat" or "devices". */
  scope: string;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Feature-level error boundary. A crash inside one panel degrades that panel
 * only — the shell, sidebar and other features keep working.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    increment("ui.error", { scope: this.props.scope });
    logger.error(`${this.props.scope} crashed: ${error.message}`, {
      stack: error.stack?.slice(0, 800),
      componentStack: info.componentStack?.slice(0, 800),
    });
    reportLovableError(error, { boundary: this.props.scope });
  }

  private reset = () => this.setState({ error: null });

  override render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="size-6 text-destructive" />
        <div>
          <p className="text-sm font-medium">This section stopped responding</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred."} The rest of Nexora is
            still running.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" onClick={this.reset}>
          <RotateCcw className="size-3.5" /> Retry
        </Button>
      </div>
    );
  }
}
