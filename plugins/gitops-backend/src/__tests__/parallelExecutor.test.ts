import { executeParallel, Task, createBatchExecutor } from '../utils/parallelExecutor';

describe('Parallel Executor', () => {
  describe('executeParallel', () => {
    it('should execute tasks in parallel', async () => {
      const executionOrder: string[] = [];
      
      const tasks: Task<string>[] = [
        { id: 'task1', execute: async () => { executionOrder.push('task1'); return 'result1'; } },
        { id: 'task2', execute: async () => { executionOrder.push('task2'); return 'result2'; } },
        { id: 'task3', execute: async () => { executionOrder.push('task3'); return 'result3'; } },
      ];

      const results = await executeParallel(tasks, { concurrency: 3 });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'success')).toBe(true);
    });

    it('should respect concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const createTask = (id: string): Task<string> => ({
        id,
        execute: async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 50));
          concurrent--;
          return id;
        },
      });

      const tasks = Array.from({ length: 10 }, (_, i) => createTask(`task${i}`));

      await executeParallel(tasks, { concurrency: 3 });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should handle task failures without stopping other tasks', async () => {
      const tasks: Task<string>[] = [
        { id: 'success1', execute: async () => 'ok' },
        { id: 'fail', execute: async () => { throw new Error('Task failed'); } },
        { id: 'success2', execute: async () => 'ok' },
      ];

      const results = await executeParallel(tasks, { concurrency: 3 });

      expect(results).toHaveLength(3);
      expect(results.find(r => r.id === 'success1')?.status).toBe('success');
      expect(results.find(r => r.id === 'fail')?.status).toBe('failure');
      expect(results.find(r => r.id === 'success2')?.status).toBe('success');
    });

    it('should retry failed tasks', async () => {
      let attempts = 0;

      const tasks: Task<string>[] = [
        {
          id: 'retry-task',
          execute: async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error('Temporary failure');
            }
            return 'success';
          },
        },
      ];

      const results = await executeParallel(tasks, { 
        concurrency: 1, 
        retries: 2,
        retryDelayMs: 10,
      });

      expect(attempts).toBe(3);
      expect(results[0].status).toBe('success');
      expect(results[0].retries).toBe(2);
    });

    it('should call progress callback', async () => {
      const progressCalls: number[] = [];

      const tasks: Task<string>[] = [
        { id: 'task1', execute: async () => 'result1' },
        { id: 'task2', execute: async () => 'result2' },
      ];

      await executeParallel(tasks, {
        concurrency: 1,
        onProgress: (completed, total) => {
          progressCalls.push(completed);
        },
      });

      expect(progressCalls).toEqual([1, 2]);
    });

    it('should call onTaskComplete callback for each task', async () => {
      const completedTasks: string[] = [];

      const tasks: Task<string>[] = [
        { id: 'task1', execute: async () => 'result1' },
        { id: 'task2', execute: async () => 'result2' },
      ];

      await executeParallel(tasks, {
        concurrency: 2,
        onTaskComplete: (result) => {
          completedTasks.push(result.id);
        },
      });

      expect(completedTasks).toContain('task1');
      expect(completedTasks).toContain('task2');
    });

    it('should measure task duration', async () => {
      const tasks: Task<string>[] = [
        {
          id: 'slow-task',
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return 'done';
          },
        },
      ];

      const results = await executeParallel(tasks, { concurrency: 1 });

      expect(results[0].durationMs).toBeGreaterThanOrEqual(100);
    });
  });

  describe('createBatchExecutor', () => {
    it('should create a reusable executor', async () => {
      const executor = createBatchExecutor<number, number>(
        async (n) => n * 2,
        { concurrency: 2 }
      );

      const results = await executor([1, 2, 3, 4, 5]);

      expect(results).toHaveLength(5);
      expect(results.filter(r => r.status === 'success').map(r => r.result)).toEqual([2, 4, 6, 8, 10]);
    });
  });
});
