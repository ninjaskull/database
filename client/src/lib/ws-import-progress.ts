/**
 * WebSocket client for real-time import progress updates
 * Robust implementation with proper connection management
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface ImportProgressEvent {
  type: 'import-progress' | 'connected' | 'subscribed' | 'unsubscribed' | 'error' | 'pong';
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
  private reconnectDelay = 2000;
  
  private activeCallbacks = new Map<string, Set<ProgressCallback>>();
  private subscribedJobs = new Set<string>();
  private connectionCallbacks = new Set<ConnectionCallback>();
  
  private isConnecting = false;
  private isIntentionallyClosed = false;
  private reconnectTimeoutId: number | null = null;
  private connectionPromise: Promise<void> | null = null;
  private pingIntervalId: number | null = null;

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            resolve();
          } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });
    }

    this.isConnecting = true;
    this.isIntentionallyClosed = false;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        if (this.ws) {
          try {
            this.ws.close();
          } catch (e) {}
          this.ws = null;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/import-progress`;
        
        console.log('📡 Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            console.warn('📡 WebSocket connection timeout');
            try {
              this.ws?.close();
            } catch (e) {}
            this.isConnecting = false;
            this.connectionPromise = null;
            reject(new Error('Connection timeout'));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('📡 WebSocket connected successfully');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.notifyConnectionStatus(true);
          
          this.resubscribeAll();
          this.startPingInterval();
          
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

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log('📡 WebSocket disconnected, code:', event.code);
          this.isConnecting = false;
          this.connectionPromise = null;
          this.subscribedJobs.clear();
          this.stopPingInterval();
          this.notifyConnectionStatus(false);
          
          if (!this.isIntentionallyClosed && this.activeCallbacks.size > 0) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('📡 WebSocket error');
          this.isConnecting = false;
          this.connectionPromise = null;
        };

      } catch (error) {
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private resubscribeAll(): void {
    const jobIds = Array.from(this.activeCallbacks.keys());
    for (let i = 0; i < jobIds.length; i++) {
      const jobId = jobIds[i];
      if (!this.subscribedJobs.has(jobId)) {
        this.sendSubscribe(jobId);
      }
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingIntervalId = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ action: 'ping' }));
        } catch (e) {
          console.warn('Ping failed');
        }
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('📡 Max reconnect attempts reached');
      return;
    }

    if (this.activeCallbacks.size === 0) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`📡 Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeoutId = window.setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (!this.isIntentionallyClosed && this.activeCallbacks.size > 0) {
        this.connect().catch(console.error);
      }
    }, delay);
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopPingInterval();
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    if (this.ws) {
      try {
        this.ws.close(1000, 'Intentional disconnect');
      } catch (e) {}
      this.ws = null;
    }
    
    this.subscribedJobs.clear();
    this.connectionPromise = null;
    this.isConnecting = false;
  }

  subscribe(jobId: string, callback: ProgressCallback): () => void {
    if (!this.activeCallbacks.has(jobId)) {
      this.activeCallbacks.set(jobId, new Set());
    }
    
    const callbacks = this.activeCallbacks.get(jobId)!;
    if (callbacks.has(callback)) {
      return () => this.unsubscribe(jobId, callback);
    }
    
    callbacks.add(callback);

    if (this.ws?.readyState === WebSocket.OPEN) {
      if (!this.subscribedJobs.has(jobId)) {
        this.sendSubscribe(jobId);
      }
    } else {
      this.isIntentionallyClosed = false;
      this.connect().catch(console.error);
    }

    return () => this.unsubscribe(jobId, callback);
  }

  private unsubscribe(jobId: string, callback: ProgressCallback): void {
    const callbacks = this.activeCallbacks.get(jobId);
    if (!callbacks) return;
    
    callbacks.delete(callback);
    
    if (callbacks.size === 0) {
      this.activeCallbacks.delete(jobId);
      this.sendUnsubscribe(jobId);
      this.subscribedJobs.delete(jobId);
      
      if (this.activeCallbacks.size === 0) {
        this.disconnect();
      }
    }
  }

  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    callback(this.ws?.readyState === WebSocket.OPEN);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private sendSubscribe(jobId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN && !this.subscribedJobs.has(jobId)) {
      console.log('📡 Subscribing to job:', jobId);
      this.ws.send(JSON.stringify({ action: 'subscribe', jobId }));
      this.subscribedJobs.add(jobId);
    }
  }

  private sendUnsubscribe(jobId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.subscribedJobs.has(jobId)) {
      this.ws.send(JSON.stringify({ action: 'unsubscribe', jobId }));
      this.subscribedJobs.delete(jobId);
    }
  }

  private handleMessage(data: ImportProgressEvent): void {
    if (data.type === 'connected' || data.type === 'pong') {
      return;
    }

    if (data.type === 'subscribed' && data.jobId) {
      console.log(`📡 Confirmed subscription to job ${data.jobId}`);
      return;
    }

    if (data.type === 'import-progress' && data.jobId) {
      const callbacks = this.activeCallbacks.get(data.jobId);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (e) {
            console.error('Callback error:', e);
          }
        });
      }
    }
  }

  private notifyConnectionStatus(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (e) {}
    });
  }
}

export const importProgressWS = new ImportProgressWebSocket();

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
  const { jobId, onProgress, onComplete, onError, fallbackPollingInterval = 2000, startPollingImmediately = false } = options;
  
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
  const isCompleteRef = useRef(false);
  const callbacksRef = useRef({ onComplete, onError, onProgress });

  useEffect(() => {
    callbacksRef.current = { onComplete, onError, onProgress };
  }, [onComplete, onError, onProgress]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollForProgress = useCallback(async (jobId: string) => {
    if (isCompleteRef.current) return;
    
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
        const isComplete = job.status === 'completed' || job.status === 'failed';
        
        setState(prev => {
          if (isCompleteRef.current) return prev;
          return {
            ...prev,
            status: job.status || prev.status,
            totalRows: job.totalRows ?? prev.totalRows,
            processedRows: job.processedRows ?? prev.processedRows,
            successfulRows: job.successfulRows ?? prev.successfulRows,
            errorRows: job.errorRows ?? prev.errorRows,
            duplicateRows: job.duplicateRows ?? prev.duplicateRows,
            message: job.message || `Processing ${job.processedRows || 0} of ${job.totalRows || 0}...`,
            isComplete,
            error: job.status === 'failed' ? (job.message || 'Import failed') : null
          };
        });

        if (isComplete && !isCompleteRef.current) {
          isCompleteRef.current = true;
          stopPolling();
          
          const event: ImportProgressEvent = {
            type: 'import-progress',
            jobId,
            status: job.status,
            totalRows: job.totalRows,
            processedRows: job.processedRows,
            successfulRows: job.successfulRows,
            errorRows: job.errorRows,
            duplicateRows: job.duplicateRows
          };
          
          if (job.status === 'completed') {
            callbacksRef.current.onComplete?.(event);
          } else if (job.status === 'failed') {
            callbacksRef.current.onError?.(event);
          }
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, [stopPolling]);

  const startPolling = useCallback((jobId: string) => {
    if (pollingRef.current || isCompleteRef.current) return;

    console.log('📡 Starting polling for job:', jobId);
    pollForProgress(jobId);
    
    pollingRef.current = window.setInterval(() => {
      pollForProgress(jobId);
    }, fallbackPollingInterval);
  }, [fallbackPollingInterval, pollForProgress]);

  const handleProgress = useCallback((event: ImportProgressEvent) => {
    if (isCompleteRef.current) return;
    
    const isComplete = event.status === 'completed' || event.status === 'failed';
    
    setState(prev => {
      if (isCompleteRef.current) return prev;
      return {
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
        isComplete,
        error: event.status === 'failed' ? (event.message || 'Import failed') : null
      };
    });

    if (isComplete && !isCompleteRef.current) {
      isCompleteRef.current = true;
      stopPolling();
      
      if (event.status === 'completed') {
        callbacksRef.current.onComplete?.(event);
      } else if (event.status === 'failed') {
        callbacksRef.current.onError?.(event);
      }
    } else if (!isComplete) {
      callbacksRef.current.onProgress?.(event);
    }
  }, [stopPolling]);

  useEffect(() => {
    if (!jobId) return;

    isCompleteRef.current = false;
    setState({
      isConnected: false,
      status: 'pending',
      totalRows: 0,
      processedRows: 0,
      successfulRows: 0,
      errorRows: 0,
      duplicateRows: 0,
      updatedRows: 0,
      message: 'Starting import...',
      isComplete: false,
      error: null
    });

    const unsubscribe = importProgressWS.subscribe(jobId, handleProgress);

    const unsubscribeConnection = importProgressWS.onConnectionChange((connected) => {
      setState(prev => ({ ...prev, isConnected: connected }));
      
      if (!connected && !isCompleteRef.current && !pollingRef.current) {
        console.log('📡 WebSocket disconnected, starting polling fallback');
        startPolling(jobId);
      }
    });

    if (startPollingImmediately) {
      startPolling(jobId);
    }

    const fallbackTimeout = window.setTimeout(() => {
      if (!importProgressWS.isConnected() && !isCompleteRef.current && !pollingRef.current) {
        console.log('📡 No WebSocket connection after timeout, starting polling');
        startPolling(jobId);
      }
    }, 3000);

    return () => {
      clearTimeout(fallbackTimeout);
      unsubscribe();
      unsubscribeConnection();
      stopPolling();
    };
  }, [jobId, handleProgress, startPolling, stopPolling, startPollingImmediately]);

  return state;
}
