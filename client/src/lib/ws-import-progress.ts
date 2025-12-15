/**
 * WebSocket client for real-time import progress updates
 */

export interface ImportProgressEvent {
  type: 'import-progress' | 'connected' | 'subscribed' | 'unsubscribed' | 'error';
  jobId?: string;
  status?: string;
  totalRows?: number;
  processedRows?: number;
  successfulRows?: number;
  errorRows?: number;
  duplicateRows?: number;
  updatedRows?: number;
  message?: string;
  completedAt?: string;
  errors?: any;
}

type ProgressCallback = (event: ImportProgressEvent) => void;
type ConnectionCallback = (connected: boolean) => void;

class ImportProgressWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions = new Map<string, Set<ProgressCallback>>();
  private connectionCallbacks = new Set<ConnectionCallback>();
  private pendingSubscriptions = new Set<string>();
  private isConnecting = false;
  private isIntentionallyClosed = false;

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
      });
    }

    this.isConnecting = true;
    this.isIntentionallyClosed = false;

    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/import-progress`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('📡 WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.notifyConnectionStatus(true);
          
          // Re-subscribe to pending subscriptions
          this.pendingSubscriptions.forEach(jobId => {
            this.sendSubscribe(jobId);
          });
          this.pendingSubscriptions.clear();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: ImportProgressEvent = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('📡 WebSocket disconnected');
          this.isConnecting = false;
          this.notifyConnectionStatus(false);
          
          if (!this.isIntentionallyClosed) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
  }

  /**
   * Subscribe to progress updates for a specific job
   */
  subscribe(jobId: string, callback: ProgressCallback): () => void {
    if (!this.subscriptions.has(jobId)) {
      this.subscriptions.set(jobId, new Set());
    }
    this.subscriptions.get(jobId)!.add(callback);

    // Connect and subscribe
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(jobId);
    } else {
      this.pendingSubscriptions.add(jobId);
      this.connect().catch(console.error);
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.get(jobId)?.delete(callback);
      if (this.subscriptions.get(jobId)?.size === 0) {
        this.subscriptions.delete(jobId);
        this.sendUnsubscribe(jobId);
      }
    };
  }

  /**
   * Register callback for connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private sendSubscribe(jobId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', jobId }));
    }
  }

  private sendUnsubscribe(jobId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'unsubscribe', jobId }));
    }
  }

  private handleMessage(data: ImportProgressEvent): void {
    if (data.type === 'connected') {
      console.log('📡 WebSocket connection confirmed');
      return;
    }

    if (data.type === 'subscribed') {
      console.log(`📡 Subscribed to job ${data.jobId}`);
      return;
    }

    if (data.type === 'import-progress' && data.jobId) {
      const callbacks = this.subscriptions.get(data.jobId);
      if (callbacks) {
        callbacks.forEach(callback => callback(data));
      }
    }
  }

  private notifyConnectionStatus(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => callback(connected));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('📡 Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`📡 Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isIntentionallyClosed) {
        this.connect().catch(console.error);
      }
    }, delay);
  }
}

// Export singleton instance
export const importProgressWS = new ImportProgressWebSocket();

/**
 * React hook for import progress WebSocket updates with robust fallback
 */
import { useEffect, useState, useCallback, useRef } from 'react';

export interface UseImportProgressOptions {
  jobId: string | null;
  onProgress?: (event: ImportProgressEvent) => void;
  onComplete?: (event: ImportProgressEvent) => void;
  onError?: (event: ImportProgressEvent) => void;
  fallbackPollingInterval?: number;
  startPollingImmediately?: boolean;
}

export interface ImportProgressState {
  isConnected: boolean;
  status: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  errorRows: number;
  duplicateRows: number;
  updatedRows: number;
  message: string;
  isComplete: boolean;
  error: string | null;
}

export function useImportProgress(options: UseImportProgressOptions): ImportProgressState {
  const { jobId, onProgress, onComplete, onError, fallbackPollingInterval = 1500, startPollingImmediately = false } = options;
  
  const [state, setState] = useState<ImportProgressState>({
    isConnected: false,
    status: 'pending',
    totalRows: 0,
    processedRows: 0,
    successfulRows: 0,
    errorRows: 0,
    duplicateRows: 0,
    updatedRows: 0,
    message: '',
    isComplete: false,
    error: null
  });

  const pollingRef = useRef<number | null>(null);
  const wsActiveRef = useRef(false);
  const lastWsUpdateRef = useRef<number>(0);
  const completionTimeoutRef = useRef<number | null>(null);

  // Start polling function
  const startPolling = useCallback((jobId: string) => {
    if (pollingRef.current) return;

    pollingRef.current = window.setInterval(async () => {
      try {
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`/api/import/${jobId}`, {
          credentials: 'include',
          headers,
        });
        if (response.ok) {
          const job = await response.json();
          
          setState(prev => ({
            ...prev,
            status: job.status,
            totalRows: job.totalRows ?? prev.totalRows,
            processedRows: job.processedRows ?? prev.processedRows,
            successfulRows: job.successfulRows ?? prev.successfulRows,
            errorRows: job.errorRows ?? prev.errorRows,
            duplicateRows: job.duplicateRows ?? prev.duplicateRows,
            message: `Processing... ${job.processedRows}/${job.totalRows}`,
            isComplete: job.status === 'completed' || job.status === 'failed',
            error: job.status === 'failed' ? 'Import failed' : null
          }));

          // Handle completion via polling
          if (job.status === 'completed') {
            onComplete?.({
              type: 'import-progress',
              jobId,
              status: job.status,
              totalRows: job.totalRows,
              processedRows: job.processedRows,
              successfulRows: job.successfulRows,
              errorRows: job.errorRows,
              duplicateRows: job.duplicateRows
            });
          } else if (job.status === 'failed') {
            onError?.({
              type: 'import-progress',
              jobId,
              status: job.status,
              message: 'Import failed'
            });
          }

          // Stop polling if complete
          if (job.status === 'completed' || job.status === 'failed') {
            if (pollingRef.current) {
              window.clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, fallbackPollingInterval);
  }, [fallbackPollingInterval, onComplete, onError]);

  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Handle progress events from WebSocket
  const handleProgress = useCallback((event: ImportProgressEvent) => {
    wsActiveRef.current = true;
    lastWsUpdateRef.current = Date.now();

    setState(prev => ({
      ...prev,
      isConnected: true,
      status: event.status || prev.status,
      totalRows: event.totalRows ?? prev.totalRows,
      processedRows: event.processedRows ?? prev.processedRows,
      successfulRows: event.successfulRows ?? prev.successfulRows,
      errorRows: event.errorRows ?? prev.errorRows,
      duplicateRows: event.duplicateRows ?? prev.duplicateRows,
      updatedRows: event.updatedRows ?? prev.updatedRows,
      message: event.message || prev.message,
      isComplete: event.status === 'completed' || event.status === 'failed',
      error: event.status === 'failed' ? (event.message || 'Import failed') : null
    }));

    // Only stop polling if job is complete - otherwise keep both WS and polling active
    // This ensures we always have a fallback if WS stalls
    if (event.status === 'completed' || event.status === 'failed') {
      stopPolling();
    }

    if (event.status === 'completed') {
      onComplete?.(event);
    } else if (event.status === 'failed') {
      onError?.(event);
    } else {
      onProgress?.(event);
    }
  }, [onProgress, onComplete, onError, stopPolling]);

  // Subscribe to WebSocket updates and manage fallback polling
  useEffect(() => {
    if (!jobId) return;

    wsActiveRef.current = false;
    lastWsUpdateRef.current = 0;

    // Subscribe to WebSocket
    const unsubscribe = importProgressWS.subscribe(jobId, handleProgress);

    // Track connection status and resume polling on disconnect
    const unsubscribeConnection = importProgressWS.onConnectionChange((connected) => {
      setState(prev => ({ ...prev, isConnected: connected }));
      
      if (!connected && !state.isComplete) {
        // Resume polling when WebSocket disconnects
        console.log('📡 WebSocket disconnected, resuming polling');
        startPolling(jobId);
      }
    });

    // Start polling immediately if requested, or after a delay as fallback
    if (startPollingImmediately) {
      // Start polling right away - don't wait for WebSocket
      console.log('📡 Starting polling immediately (parallel with WebSocket)');
      startPolling(jobId);
    }

    // Start polling as fallback after initial delay if no WS updates received
    const pollingTimeout = setTimeout(() => {
      if (!wsActiveRef.current && !state.isComplete && !pollingRef.current) {
        console.log('📡 No WebSocket updates, starting polling fallback');
        startPolling(jobId);
      }
    }, startPollingImmediately ? 500 : 1500); // Shorter timeout if already polling

    // Safety timeout: if no WS updates for 3 seconds during processing, start polling
    const safetyInterval = window.setInterval(() => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastWsUpdateRef.current;
      
      if (timeSinceLastUpdate > 3000 && !state.isComplete && !pollingRef.current) {
        console.log('📡 No WS updates for 3s, starting safety polling');
        startPolling(jobId);
      }
    }, 1500);

    return () => {
      unsubscribe();
      unsubscribeConnection();
      clearTimeout(pollingTimeout);
      window.clearInterval(safetyInterval);
      stopPolling();
      if (completionTimeoutRef.current) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, [jobId, handleProgress, startPolling, stopPolling, state.isComplete, startPollingImmediately]);

  return state;
}
