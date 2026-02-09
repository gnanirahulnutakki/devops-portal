import logger from './logger';

/**
 * Parallel Executor with Concurrency Control
 * 
 * Executes tasks in parallel with:
 * - Configurable concurrency limit
 * - Progress tracking
 * - Error handling that doesn't stop other tasks
 * - Retry support
 */

export interface TaskResult<T> {
  id: string;
  status: 'success' | 'failure';
  result?: T;
  error?: string;
  durationMs: number;
  retries: number;
}

export interface ParallelExecutorOptions {
  concurrency?: number;      // Max concurrent tasks (default: 5)
  retries?: number;          // Number of retries on failure (default: 0)
  retryDelayMs?: number;     // Delay between retries (default: 1000)
  onProgress?: (completed: number, total: number, currentTasks: string[]) => void;
  onTaskComplete?: (result: TaskResult<any>) => void;
}

export interface Task<T> {
  id: string;
  execute: () => Promise<T>;
}

/**
 * Execute tasks in parallel with concurrency control
 */
export async function executeParallel<T>(
  tasks: Task<T>[],
  options: ParallelExecutorOptions = {}
): Promise<TaskResult<T>[]> {
  const {
    concurrency = 5,
    retries = 0,
    retryDelayMs = 1000,
    onProgress,
    onTaskComplete,
  } = options;

  const results: TaskResult<T>[] = [];
  const total = tasks.length;
  let completed = 0;
  const currentTasks: Set<string> = new Set();

  // Process tasks with concurrency limit
  const queue = [...tasks];
  const executing: Promise<void>[] = [];

  const executeTask = async (task: Task<T>): Promise<void> => {
    currentTasks.add(task.id);
    const startTime = Date.now();
    let lastError: string | undefined;
    let attemptCount = 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      attemptCount = attempt;
      try {
        const result = await task.execute();
        
        const taskResult: TaskResult<T> = {
          id: task.id,
          status: 'success',
          result,
          durationMs: Date.now() - startTime,
          retries: attempt,
        };
        
        results.push(taskResult);
        await Promise.resolve(onTaskComplete?.(taskResult));
        
        break;
      } catch (error: any) {
        lastError = error.message || String(error);
        
        if (attempt < retries) {
          logger.warn(`Task ${task.id} failed, retrying (${attempt + 1}/${retries})`, {
            error: lastError,
          });
          await delay(retryDelayMs * (attempt + 1)); // Exponential backoff
        } else {
          const taskResult: TaskResult<T> = {
            id: task.id,
            status: 'failure',
            error: lastError,
            durationMs: Date.now() - startTime,
            retries: attemptCount,
          };
          
          results.push(taskResult);
          await Promise.resolve(onTaskComplete?.(taskResult));
        }
      }
    }

    currentTasks.delete(task.id);
    completed++;
    await Promise.resolve(onProgress?.(completed, total, Array.from(currentTasks)));
  };

  // Process queue with concurrency limit
  while (queue.length > 0 || executing.length > 0) {
    // Start new tasks up to concurrency limit
    while (queue.length > 0 && executing.length < concurrency) {
      const task = queue.shift()!;
      const promise = executeTask(task).then(() => {
        // Remove from executing array when done
        const index = executing.indexOf(promise);
        if (index > -1) {
          executing.splice(index, 1);
        }
      });
      executing.push(promise);
    }

    // Wait for at least one task to complete if we're at capacity
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  // Wait for all remaining tasks
  await Promise.all(executing);

  return results;
}

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a batch executor for common patterns
 */
export function createBatchExecutor<TInput, TOutput>(
  processor: (input: TInput, index: number) => Promise<TOutput>,
  options: ParallelExecutorOptions = {}
) {
  return async (items: TInput[]): Promise<TaskResult<TOutput>[]> => {
    const tasks: Task<TOutput>[] = items.map((item, index) => ({
      id: String(index),
      execute: () => processor(item, index),
    }));

    return executeParallel(tasks, options);
  };
}

/**
 * Execute with rate limiting (requests per second)
 */
export async function executeWithRateLimit<T>(
  tasks: Task<T>[],
  requestsPerSecond: number,
  options: Omit<ParallelExecutorOptions, 'concurrency'> = {}
): Promise<TaskResult<T>[]> {
  // Calculate concurrency based on rate limit
  // Assume average task takes 500ms
  const estimatedTaskDurationMs = 500;
  const concurrency = Math.max(1, Math.floor(requestsPerSecond * (estimatedTaskDurationMs / 1000)));
  
  return executeParallel(tasks, {
    ...options,
    concurrency,
  });
}
