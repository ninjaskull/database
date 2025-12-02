/**
 * WebSocket Hub for Real-time Import Progress Broadcasting
 * Manages connections and broadcasts import job updates to subscribed clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

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

interface WSMessage {
  action: 'subscribe' | 'unsubscribe';
  jobId: string;
}

class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private jobSubscriptions = new Map<string, Set<WebSocket>>();
  private clientJobs = new Map<WebSocket, Set<string>>();
  private lastBroadcast = new Map<string, number>();
  private throttleMs = 200; // Throttle broadcasts to avoid flooding

  /**
   * Initialize WebSocket server bound to existing HTTP server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/import-progress' 
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('📡 WebSocket client connected');
      
      this.clientJobs.set(ws, new Set());

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('📡 WebSocket client disconnected');
        this.cleanupClient(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.cleanupClient(ws);
      });

      // Send connection confirmation
      ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connection established' }));
    });

    console.log('📡 WebSocket Hub initialized on /ws/import-progress');
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(ws: WebSocket, message: WSMessage): void {
    const { action, jobId } = message;

    if (!jobId) {
      ws.send(JSON.stringify({ type: 'error', message: 'jobId is required' }));
      return;
    }

    switch (action) {
      case 'subscribe':
        this.subscribeClient(ws, jobId);
        ws.send(JSON.stringify({ type: 'subscribed', jobId }));
        break;
      case 'unsubscribe':
        this.unsubscribeClient(ws, jobId);
        ws.send(JSON.stringify({ type: 'unsubscribed', jobId }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown action' }));
    }
  }

  /**
   * Subscribe a client to a specific job's updates
   */
  private subscribeClient(ws: WebSocket, jobId: string): void {
    if (!this.jobSubscriptions.has(jobId)) {
      this.jobSubscriptions.set(jobId, new Set());
    }
    this.jobSubscriptions.get(jobId)!.add(ws);
    this.clientJobs.get(ws)?.add(jobId);
  }

  /**
   * Unsubscribe a client from a specific job
   */
  private unsubscribeClient(ws: WebSocket, jobId: string): void {
    this.jobSubscriptions.get(jobId)?.delete(ws);
    this.clientJobs.get(ws)?.delete(jobId);
    
    // Cleanup empty job subscription sets
    if (this.jobSubscriptions.get(jobId)?.size === 0) {
      this.jobSubscriptions.delete(jobId);
    }
  }

  /**
   * Cleanup all subscriptions for a disconnected client
   */
  private cleanupClient(ws: WebSocket): void {
    const jobs = this.clientJobs.get(ws);
    if (jobs) {
      const jobIds = Array.from(jobs);
      for (const jobId of jobIds) {
        this.jobSubscriptions.get(jobId)?.delete(ws);
        if (this.jobSubscriptions.get(jobId)?.size === 0) {
          this.jobSubscriptions.delete(jobId);
        }
      }
    }
    this.clientJobs.delete(ws);
  }

  /**
   * Broadcast import progress to all subscribed clients with throttling
   */
  broadcast(jobId: string, progress: Partial<ImportProgressEvent>, force: boolean = false): void {
    const now = Date.now();
    const lastTime = this.lastBroadcast.get(jobId) || 0;
    
    // Throttle non-forced broadcasts to avoid flooding
    if (!force && now - lastTime < this.throttleMs) {
      return;
    }
    
    this.lastBroadcast.set(jobId, now);
    
    const subscribers = this.jobSubscriptions.get(jobId);
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
   * Broadcast final completion status (always sends, never throttled)
   */
  broadcastComplete(jobId: string, progress: Partial<ImportProgressEvent>): void {
    this.broadcast(jobId, { ...progress, status: 'completed' }, true);
    
    // Cleanup after broadcasting completion
    setTimeout(() => {
      this.lastBroadcast.delete(jobId);
      this.jobSubscriptions.delete(jobId);
    }, 5000);
  }

  /**
   * Broadcast error status (always sends, never throttled)
   */
  broadcastError(jobId: string, error: string, progress: Partial<ImportProgressEvent>): void {
    this.broadcast(jobId, { 
      ...progress, 
      status: 'failed', 
      message: error 
    }, true);
    
    // Cleanup after broadcasting error
    setTimeout(() => {
      this.lastBroadcast.delete(jobId);
      this.jobSubscriptions.delete(jobId);
    }, 5000);
  }

  /**
   * Get connection stats for monitoring
   */
  getStats(): { totalConnections: number; totalSubscriptions: number } {
    let totalSubscriptions = 0;
    const allSubs = Array.from(this.jobSubscriptions.values());
    for (const subs of allSubs) {
      totalSubscriptions += subs.size;
    }
    return {
      totalConnections: this.clientJobs.size,
      totalSubscriptions
    };
  }

  /**
   * Close all connections and cleanup
   */
  close(): void {
    if (this.wss) {
      this.wss.close();
      this.jobSubscriptions.clear();
      this.clientJobs.clear();
      this.lastBroadcast.clear();
    }
  }
}

// Export singleton instance
export const wsHub = new WebSocketHub();
