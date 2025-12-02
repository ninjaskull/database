/**
 * WebSocket Hub for Real-time Progress Broadcasting
 * Manages connections and broadcasts updates for imports and bulk operations
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { BulkProgressEvent } from '@shared/schema';

interface ImportProgressEvent {
  type: 'import-progress';
  jobId: string;
  status: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  errorRows: number;
  duplicateRows: number;
  updatedRows?: number;
  message?: string;
  completedAt?: string;
  errors?: any;
}

interface BulkOperationProgressEvent extends BulkProgressEvent {
  timestamp?: string;
}

interface WSMessage {
  action: 'subscribe' | 'unsubscribe';
  jobId: string;
  channel?: 'import' | 'bulk'; // Default to 'import' for backwards compatibility
}

type ProgressEvent = ImportProgressEvent | BulkOperationProgressEvent;

class WebSocketHub {
  private importWss: WebSocketServer | null = null;
  private bulkWss: WebSocketServer | null = null;
  
  // Import progress tracking
  private importSubscriptions = new Map<string, Set<WebSocket>>();
  private importClientJobs = new Map<WebSocket, Set<string>>();
  private importLastBroadcast = new Map<string, number>();
  
  // Bulk operations tracking
  private bulkSubscriptions = new Map<string, Set<WebSocket>>();
  private bulkClientJobs = new Map<WebSocket, Set<string>>();
  private bulkLastBroadcast = new Map<string, number>();
  
  private throttleMs = 150; // Throttle broadcasts to avoid flooding (reduced for snappier updates)

  /**
   * Initialize WebSocket servers bound to existing HTTP server
   */
  initialize(server: Server): void {
    // Initialize import progress WebSocket
    this.importWss = new WebSocketServer({ 
      server, 
      path: '/ws/import-progress' 
    });

    this.importWss.on('connection', (ws: WebSocket) => {
      console.log('📡 Import WebSocket client connected');
      this.importClientJobs.set(ws, new Set());
      this.setupClientHandlers(ws, 'import');
      ws.send(JSON.stringify({ type: 'connected', channel: 'import', message: 'WebSocket connection established' }));
    });

    // Initialize bulk operations WebSocket
    this.bulkWss = new WebSocketServer({ 
      server, 
      path: '/ws/bulk-operations' 
    });

    this.bulkWss.on('connection', (ws: WebSocket) => {
      console.log('📡 Bulk Operations WebSocket client connected');
      this.bulkClientJobs.set(ws, new Set());
      this.setupClientHandlers(ws, 'bulk');
      ws.send(JSON.stringify({ type: 'connected', channel: 'bulk', message: 'WebSocket connection established' }));
    });

    console.log('📡 WebSocket Hub initialized on /ws/import-progress and /ws/bulk-operations');
  }

  /**
   * Setup message and event handlers for a client
   */
  private setupClientHandlers(ws: WebSocket, channel: 'import' | 'bulk'): void {
    ws.on('message', (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message, channel);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`📡 ${channel === 'import' ? 'Import' : 'Bulk Operations'} WebSocket client disconnected`);
      this.cleanupClient(ws, channel);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.cleanupClient(ws, channel);
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(ws: WebSocket, message: WSMessage, channel: 'import' | 'bulk'): void {
    const { action, jobId } = message;

    if (!jobId) {
      ws.send(JSON.stringify({ type: 'error', message: 'jobId is required' }));
      return;
    }

    const subscriptions = channel === 'import' ? this.importSubscriptions : this.bulkSubscriptions;
    const clientJobs = channel === 'import' ? this.importClientJobs : this.bulkClientJobs;

    switch (action) {
      case 'subscribe':
        if (!subscriptions.has(jobId)) {
          subscriptions.set(jobId, new Set());
        }
        subscriptions.get(jobId)!.add(ws);
        clientJobs.get(ws)?.add(jobId);
        ws.send(JSON.stringify({ type: 'subscribed', jobId, channel }));
        break;
      case 'unsubscribe':
        subscriptions.get(jobId)?.delete(ws);
        clientJobs.get(ws)?.delete(jobId);
        if (subscriptions.get(jobId)?.size === 0) {
          subscriptions.delete(jobId);
        }
        ws.send(JSON.stringify({ type: 'unsubscribed', jobId, channel }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown action' }));
    }
  }

  /**
   * Cleanup all subscriptions for a disconnected client
   */
  private cleanupClient(ws: WebSocket, channel: 'import' | 'bulk'): void {
    const subscriptions = channel === 'import' ? this.importSubscriptions : this.bulkSubscriptions;
    const clientJobs = channel === 'import' ? this.importClientJobs : this.bulkClientJobs;

    const jobs = clientJobs.get(ws);
    if (jobs) {
      const jobIds = Array.from(jobs);
      for (const jobId of jobIds) {
        subscriptions.get(jobId)?.delete(ws);
        if (subscriptions.get(jobId)?.size === 0) {
          subscriptions.delete(jobId);
        }
      }
    }
    clientJobs.delete(ws);
  }

  /**
   * Broadcast import progress to all subscribed clients with throttling
   */
  broadcast(jobId: string, progress: Partial<ImportProgressEvent>, force: boolean = false): void {
    const now = Date.now();
    const lastTime = this.importLastBroadcast.get(jobId) || 0;
    
    if (!force && now - lastTime < this.throttleMs) {
      return;
    }
    
    this.importLastBroadcast.set(jobId, now);
    
    const subscribers = this.importSubscriptions.get(jobId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const event: ImportProgressEvent = {
      type: 'import-progress',
      jobId,
      status: progress.status || 'processing',
      totalRows: progress.totalRows || 0,
      processedRows: progress.processedRows || 0,
      successfulRows: progress.successfulRows || 0,
      errorRows: progress.errorRows || 0,
      duplicateRows: progress.duplicateRows || 0,
      updatedRows: progress.updatedRows,
      message: progress.message,
      completedAt: progress.completedAt,
      errors: progress.errors,
    };

    this.sendToSubscribers(subscribers, event);
  }

  /**
   * Broadcast bulk operation progress to all subscribed clients
   */
  broadcastBulkProgress(jobId: string, progress: Partial<BulkProgressEvent>, force: boolean = false): void {
    const now = Date.now();
    const lastTime = this.bulkLastBroadcast.get(jobId) || 0;
    
    if (!force && now - lastTime < this.throttleMs) {
      return;
    }
    
    this.bulkLastBroadcast.set(jobId, now);
    
    const subscribers = this.bulkSubscriptions.get(jobId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const event: BulkOperationProgressEvent = {
      type: 'bulk-progress',
      jobId,
      operationType: progress.operationType || '',
      status: progress.status || 'running',
      totals: progress.totals || { total: 0, processed: 0, success: 0, failed: 0, skipped: 0, matched: 0 },
      current: progress.current,
      message: progress.message,
      errors: progress.errors,
      activity: progress.activity,
      timestamp: new Date().toISOString(),
    };

    this.sendToSubscribers(subscribers, event);
  }

  /**
   * Send message to all subscribers
   */
  private sendToSubscribers(subscribers: Set<WebSocket>, event: ProgressEvent): void {
    const messageStr = JSON.stringify(event);
    const subscriberList = Array.from(subscribers);

    for (const ws of subscriberList) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error('Failed to send WebSocket message:', error);
        }
      }
    }
  }

  /**
   * Broadcast final completion status for imports (always sends, never throttled)
   */
  broadcastComplete(jobId: string, progress: Partial<ImportProgressEvent>): void {
    this.broadcast(jobId, { ...progress, status: 'completed' }, true);
    
    setTimeout(() => {
      this.importLastBroadcast.delete(jobId);
      this.importSubscriptions.delete(jobId);
    }, 5000);
  }

  /**
   * Broadcast error status for imports (always sends, never throttled)
   */
  broadcastError(jobId: string, error: string, progress: Partial<ImportProgressEvent>): void {
    this.broadcast(jobId, { 
      ...progress, 
      status: 'failed', 
      message: error 
    }, true);
    
    setTimeout(() => {
      this.importLastBroadcast.delete(jobId);
      this.importSubscriptions.delete(jobId);
    }, 5000);
  }

  /**
   * Broadcast final completion status for bulk operations
   */
  broadcastBulkComplete(jobId: string, progress: Partial<BulkProgressEvent>): void {
    this.broadcastBulkProgress(jobId, { 
      ...progress, 
      status: 'completed',
      message: progress.message || 'Operation completed successfully'
    }, true);
    
    setTimeout(() => {
      this.bulkLastBroadcast.delete(jobId);
      this.bulkSubscriptions.delete(jobId);
    }, 10000); // Longer timeout to allow users to see final results
  }

  /**
   * Broadcast error status for bulk operations
   */
  broadcastBulkError(jobId: string, errorMsg: string, progress: Partial<BulkProgressEvent>): void {
    this.broadcastBulkProgress(jobId, { 
      ...progress, 
      status: 'failed',
      message: errorMsg
    }, true);
    
    setTimeout(() => {
      this.bulkLastBroadcast.delete(jobId);
      this.bulkSubscriptions.delete(jobId);
    }, 10000);
  }

  /**
   * Get connection stats for monitoring
   */
  getStats(): { 
    import: { totalConnections: number; totalSubscriptions: number };
    bulk: { totalConnections: number; totalSubscriptions: number };
  } {
    let importSubscriptions = 0;
    const importSubs = Array.from(this.importSubscriptions.values());
    for (const subs of importSubs) {
      importSubscriptions += subs.size;
    }

    let bulkSubscriptions = 0;
    const bulkSubs = Array.from(this.bulkSubscriptions.values());
    for (const subs of bulkSubs) {
      bulkSubscriptions += subs.size;
    }

    return {
      import: {
        totalConnections: this.importClientJobs.size,
        totalSubscriptions: importSubscriptions
      },
      bulk: {
        totalConnections: this.bulkClientJobs.size,
        totalSubscriptions: bulkSubscriptions
      }
    };
  }

  /**
   * Close all connections and cleanup
   */
  close(): void {
    if (this.importWss) {
      this.importWss.close();
      this.importSubscriptions.clear();
      this.importClientJobs.clear();
      this.importLastBroadcast.clear();
    }
    if (this.bulkWss) {
      this.bulkWss.close();
      this.bulkSubscriptions.clear();
      this.bulkClientJobs.clear();
      this.bulkLastBroadcast.clear();
    }
  }
}

// Export singleton instance
export const wsHub = new WebSocketHub();
