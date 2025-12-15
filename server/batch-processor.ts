/**
 * High-performance batch processor with parallel execution and progress tracking
 * Optimized for bulk matching and autofill operations
 */

export interface BatchProgressStats {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  matched: number;
  startTime: number;
  itemsPerSecond: number;
  estimatedTimeRemaining: number;
  currentBatch: number;
  totalBatches: number;
}

export interface BatchItem<T> {
  item: T;
  index: number;
}

export interface BatchResult<T, R> {
  item: T;
  result: R | null;
  error: Error | null;
  status: 'success' | 'failed' | 'skipped';
  matched?: boolean;
}

export type ProgressCallback = (stats: BatchProgressStats, currentItem?: { id: string; name: string; step: string; details?: any }) => void | Promise<void>;

export class BatchProcessor {
  private static calculateETA(processed: number, total: number, elapsedMs: number): { itemsPerSecond: number; estimatedTimeRemaining: number } {
    if (processed === 0 || elapsedMs === 0) {
      return { itemsPerSecond: 0, estimatedTimeRemaining: 0 };
    }
    const itemsPerSecond = (processed / elapsedMs) * 1000;
    const remaining = total - processed;
    const estimatedTimeRemaining = itemsPerSecond > 0 ? remaining / itemsPerSecond : 0;
    return { 
      itemsPerSecond: Number.isFinite(itemsPerSecond) ? itemsPerSecond : 0, 
      estimatedTimeRemaining: Number.isFinite(estimatedTimeRemaining) ? estimatedTimeRemaining : 0 
    };
  }

  /**
   * Process items in parallel batches with concurrency control
   * @param items - Array of items to process
   * @param processor - Async function to process each item
   * @param options - Processing options
   */
  static async processInParallelBatches<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<{ result: R | null; status: 'success' | 'failed' | 'skipped'; matched?: boolean; details?: any }>,
    options: {
      batchSize?: number;
      concurrency?: number;
      onProgress?: ProgressCallback;
      onBatchComplete?: (batchIndex: number, results: BatchResult<T, R>[]) => void | Promise<void>;
    } = {}
  ): Promise<{ results: BatchResult<T, R>[]; stats: BatchProgressStats }> {
    const { 
      batchSize = 50, 
      concurrency = 10,
      onProgress,
      onBatchComplete
    } = options;

    const total = items.length;
    const totalBatches = Math.ceil(total / batchSize);
    const startTime = Date.now();
    const allResults: BatchResult<T, R>[] = [];
    
    let processed = 0;
    let success = 0;
    let failed = 0;
    let skipped = 0;
    let matched = 0;
    let lastItemsPerSecond = 0;
    let lastEstimatedTimeRemaining = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, total);
      const batch = items.slice(batchStart, batchEnd);
      const batchResults: BatchResult<T, R>[] = [];

      // Process items in parallel with concurrency limit
      for (let i = 0; i < batch.length; i += concurrency) {
        const chunk = batch.slice(i, i + concurrency);
        const chunkPromises = chunk.map(async (item, chunkIndex) => {
          const globalIndex = batchStart + i + chunkIndex;
          try {
            const { result, status, matched: itemMatched, details } = await processor(item, globalIndex);
            
            processed++;
            if (status === 'success') {
              success++;
            }
            if (status === 'failed') {
              failed++;
            }
            if (status === 'skipped') {
              skipped++;
            }
            if (itemMatched === true) {
              matched++;
            }

            const elapsed = Date.now() - startTime;
            const { itemsPerSecond, estimatedTimeRemaining } = this.calculateETA(processed, total, elapsed);
            lastItemsPerSecond = itemsPerSecond;
            lastEstimatedTimeRemaining = estimatedTimeRemaining;

            if (onProgress) {
              await onProgress({
                total,
                processed,
                success,
                failed,
                skipped,
                matched,
                startTime,
                itemsPerSecond,
                estimatedTimeRemaining,
                currentBatch: batchIndex + 1,
                totalBatches,
              }, details);
            }

            return { item, result, error: null, status } as BatchResult<T, R>;
          } catch (error) {
            processed++;
            failed++;
            
            const elapsed = Date.now() - startTime;
            const { itemsPerSecond, estimatedTimeRemaining } = this.calculateETA(processed, total, elapsed);
            lastItemsPerSecond = itemsPerSecond;
            lastEstimatedTimeRemaining = estimatedTimeRemaining;

            if (onProgress) {
              await onProgress({
                total,
                processed,
                success,
                failed,
                skipped,
                matched,
                startTime,
                itemsPerSecond,
                estimatedTimeRemaining,
                currentBatch: batchIndex + 1,
                totalBatches,
              });
            }

            return { 
              item, 
              result: null, 
              error: error instanceof Error ? error : new Error(String(error)), 
              status: 'failed',
              matched: false
            } as BatchResult<T, R>;
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        batchResults.push(...chunkResults);
      }

      allResults.push(...batchResults);

      if (onBatchComplete) {
        await onBatchComplete(batchIndex, batchResults);
      }
    }

    const elapsed = Date.now() - startTime;
    const rawItemsPerSecond = elapsed > 0 ? (processed / elapsed) * 1000 : 0;
    const finalItemsPerSecond = Number.isFinite(rawItemsPerSecond) ? rawItemsPerSecond : 0;
    const safeETA = Number.isFinite(lastEstimatedTimeRemaining) ? lastEstimatedTimeRemaining : 0;

    return {
      results: allResults,
      stats: {
        total,
        processed,
        success,
        failed,
        skipped,
        matched,
        startTime,
        itemsPerSecond: finalItemsPerSecond,
        estimatedTimeRemaining: safeETA,
        currentBatch: totalBatches,
        totalBatches,
      }
    };
  }

  /**
   * Process items with adaptive batch sizing based on performance
   */
  static async processWithAdaptiveBatching<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<{ result: R | null; status: 'success' | 'failed' | 'skipped'; details?: any }>,
    options: {
      initialBatchSize?: number;
      minBatchSize?: number;
      maxBatchSize?: number;
      targetTimePerBatch?: number;
      concurrency?: number;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<{ results: BatchResult<T, R>[]; stats: BatchProgressStats }> {
    const {
      initialBatchSize = 50,
      minBatchSize = 10,
      maxBatchSize = 200,
      targetTimePerBatch = 2000,
      concurrency = 10,
      onProgress
    } = options;

    let currentBatchSize = initialBatchSize;
    const total = items.length;
    const startTime = Date.now();
    const allResults: BatchResult<T, R>[] = [];
    
    let processed = 0;
    let success = 0;
    let failed = 0;
    let skipped = 0;
    let matched = 0;
    let batchIndex = 0;

    while (processed < total) {
      const batchStart = processed;
      const batchEnd = Math.min(batchStart + currentBatchSize, total);
      const batch = items.slice(batchStart, batchEnd);
      const batchStartTime = Date.now();

      for (let i = 0; i < batch.length; i += concurrency) {
        const chunk = batch.slice(i, i + concurrency);
        const chunkPromises = chunk.map(async (item, chunkIndex) => {
          const globalIndex = batchStart + i + chunkIndex;
          try {
            const { result, status, details } = await processor(item, globalIndex);
            
            if (status === 'success') {
              success++;
              matched++;
            } else if (status === 'failed') {
              failed++;
            } else if (status === 'skipped') {
              skipped++;
            }

            return { item, result, error: null, status } as BatchResult<T, R>;
          } catch (error) {
            failed++;
            return { 
              item, 
              result: null, 
              error: error instanceof Error ? error : new Error(String(error)), 
              status: 'failed' 
            } as BatchResult<T, R>;
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        allResults.push(...chunkResults);
        processed += chunkResults.length;

        const elapsed = Date.now() - startTime;
        const { itemsPerSecond, estimatedTimeRemaining } = this.calculateETA(processed, total, elapsed);

        if (onProgress) {
          await onProgress({
            total,
            processed,
            success,
            failed,
            skipped,
            matched,
            startTime,
            itemsPerSecond,
            estimatedTimeRemaining,
            currentBatch: batchIndex + 1,
            totalBatches: Math.ceil(total / currentBatchSize),
          });
        }
      }

      // Adapt batch size based on performance
      const batchTime = Date.now() - batchStartTime;
      if (batchTime < targetTimePerBatch * 0.5) {
        currentBatchSize = Math.min(maxBatchSize, Math.floor(currentBatchSize * 1.5));
      } else if (batchTime > targetTimePerBatch * 1.5) {
        currentBatchSize = Math.max(minBatchSize, Math.floor(currentBatchSize * 0.7));
      }

      batchIndex++;
    }

    const finalElapsed = Date.now() - startTime;
    const rawSpeed = finalElapsed > 0 ? (processed / finalElapsed) * 1000 : 0;
    const safeSpeed = Number.isFinite(rawSpeed) ? rawSpeed : 0;

    return {
      results: allResults,
      stats: {
        total,
        processed,
        success,
        failed,
        skipped,
        matched,
        startTime,
        itemsPerSecond: safeSpeed,
        estimatedTimeRemaining: 0,
        currentBatch: batchIndex,
        totalBatches: batchIndex,
      }
    };
  }
}

/**
 * Optimized company template cache with LRU eviction
 */
export class CompanyTemplateCache<T> {
  private cache: Map<string, { value: T; lastAccess: number }>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.value;
    }
    return undefined;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    this.cache.set(key, { value, lastAccess: Date.now() });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Utility to format progress for WebSocket messages
 */
export function formatProgressMessage(stats: BatchProgressStats): string {
  const { processed, total, itemsPerSecond, estimatedTimeRemaining } = stats;
  const percent = Math.round((processed / total) * 100);
  const speed = itemsPerSecond.toFixed(1);
  
  if (estimatedTimeRemaining > 0) {
    const eta = formatDuration(estimatedTimeRemaining);
    return `${percent}% complete (${processed}/${total}) • ${speed}/sec • ETA: ${eta}`;
  }
  
  return `${percent}% complete (${processed}/${total}) • ${speed}/sec`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
