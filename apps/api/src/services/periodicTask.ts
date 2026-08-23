export interface PeriodicTaskOptions {
  intervalMs: number;
  name: string;
  task: () => Promise<void>;
}

export function startPeriodicTask(options: PeriodicTaskOptions): () => void {
  let isRunning = false;

  async function runOnce(): Promise<void> {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      await options.task();
    } catch (error) {
      console.error(
        `${options.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      isRunning = false;
    }
  }

  void runOnce();
  const timer = setInterval(() => void runOnce(), options.intervalMs);

  return () => clearInterval(timer);
}
