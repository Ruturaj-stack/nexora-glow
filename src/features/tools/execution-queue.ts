import { ToolError } from "./types";

/**
 * Serial execution queue. Tools touch shared machine state, so exactly one runs
 * at a time; every task is cancellable and time-boxed.
 */

interface Task<T> {
  id: string;
  run: (signal: AbortSignal) => Promise<T>;
  timeoutMs: number;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  controller: AbortController;
}

class ExecutionQueue {
  private queue: Task<unknown>[] = [];
  private active: Task<unknown> | null = null;

  enqueue<T>(id: string, run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        run,
        timeoutMs,
        resolve,
        reject,
        controller: new AbortController(),
      } as unknown as Task<unknown>);
      void this.drain();
    });
  }

  cancel(id: string) {
    if (this.active?.id === id) {
      this.active.controller.abort();
      return true;
    }
    const index = this.queue.findIndex((t) => t.id === id);
    if (index === -1) return false;
    const [task] = this.queue.splice(index, 1);
    task.reject(new ToolError("CANCELLED", "Execution cancelled before it started."));
    return true;
  }

  cancelAll() {
    this.active?.controller.abort();
    const pending = this.queue.splice(0);
    pending.forEach((t) => t.reject(new ToolError("CANCELLED", "Queue cleared.")));
  }

  get size() {
    return this.queue.length + (this.active ? 1 : 0);
  }

  private async drain() {
    if (this.active) return;
    const task = this.queue.shift();
    if (!task) return;
    this.active = task;

    const timer = setTimeout(() => task.controller.abort(), task.timeoutMs);
    try {
      task.resolve(await task.run(task.controller.signal));
    } catch (error) {
      if (task.controller.signal.aborted) {
        task.reject(new ToolError("CANCELLED", "Execution was cancelled or timed out."));
      } else {
        task.reject(error);
      }
    } finally {
      clearTimeout(timer);
      this.active = null;
      void this.drain();
    }
  }
}

export const executionQueue = new ExecutionQueue();
