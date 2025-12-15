/**
 * WebSocket client for real-time bulk operation progress updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { BulkProgressEvent } from '@shared/schema';

export interface BulkOperationEvent {
  type: 'bulk-progress' | 'connected' | 'subscribed' | 'unsubscribed' | 'error';
  jobId?: string;
  operationType?: string;
  status?: string;
  totals?: {
    total: number;
    processed: number;
    success: number;
    failed: number;
    skipped: number;
    matched: number;
  };
  current?: {
    id: string;
    name: string;
    companyMatched?: string;
    fieldsFilled?: string[];
    step?: string;
  };
  message?: string;
  errors?: Array<{ itemId: string; itemName: string; error: string }>;
  activity?: Array<{ timestamp: string; type: string; message: string; details?: any }>;
  channel?: string;
  timestamp?: string;
}

export type BulkOperationType = 'bulk-match' | 'bulk-autofill' | 'bulk-delete' | 'bulk-import-companies';

type ProgressCallback = (event: BulkOperationEvent) => void;
type ConnectionCallback = (connected: boolean) => void;

class BulkOperationsWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions = new Map<string, Set<ProgressCallback>>();
  private connectionCallbacks = new Set<ConnectionCallback>();
  private pendingSubscriptions = new Set<string>();
  private isConnecting = false;
  private isIntentionallyClosed = false;

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
        const wsUrl = `${protocol}//${window.location.host}/ws/bulk-operations`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('📡 Bulk Operations WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.notifyConnectionStatus(true);
          
          this.pendingSubscriptions.forEach(jobId => {
            this.sendSubscribe(jobId);
          });
          this.pendingSubscriptions.clear();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: BulkOperationEvent = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse Bulk Operations WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('📡 Bulk Operations WebSocket disconnected');
          this.isConnecting = false;
          this.notifyConnectionStatus(false);
          
          if (!this.isIntentionallyClosed) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('Bulk Operations WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
  }

  subscribe(jobId: string, callback: ProgressCallback): () => void {
    if (!this.subscriptions.has(jobId)) {
      this.subscriptions.set(jobId, new Set());
    }
    this.subscriptions.get(jobId)!.add(callback);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(jobId);
    } else {
      this.pendingSubscriptions.add(jobId);
      this.connect().catch(console.error);
    }

    return () => {
      this.subscriptions.get(jobId)?.delete(callback);
      if (this.subscriptions.get(jobId)?.size === 0) {
        this.subscriptions.delete(jobId);
        this.sendUnsubscribe(jobId);
      }
    };
  }

  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

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

  private handleMessage(data: BulkOperationEvent): void {
    if (data.type === 'connected') {
      console.log('📡 Bulk Operations WebSocket connection confirmed');
      return;
    }

    if (data.type === 'subscribed') {
      console.log(`📡 Subscribed to bulk job ${data.jobId}`);
      return;
    }

    if (data.type === 'bulk-progress' && data.jobId) {
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
      console.log('📡 Max reconnect attempts reached for Bulk Operations WebSocket');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`📡 Attempting Bulk Operations reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isIntentionallyClosed) {
        this.connect().catch(console.error);
      }
    }, delay);
  }
}

export const bulkOperationsWS = new BulkOperationsWebSocket();

export interface UseBulkOperationProgressOptions {
  jobId: string | null;
  onProgress?: (event: BulkOperationEvent) => void;
  onComplete?: (event: BulkOperationEvent) => void;
  onError?: (event: BulkOperationEvent) => void;
  fallbackPollingInterval?: number;
}

export interface BulkOperationProgressState {
  isConnected: boolean;
  operationType: string;
  status: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  matched: number;
  current: {
    id: string;
    name: string;
    companyMatched?: string;
    fieldsFilled?: string[];
    step?: string;
  } | null;
  message: string;
  isComplete: boolean;
  error: string | null;
  errors: Array<{ itemId: string; itemName: string; error: string }>;
  activity: Array<{ timestamp: string; type: string; message: string; details?: any }>;
  percentComplete: number;
}

export function useBulkOperationProgress(options: UseBulkOperationProgressOptions): BulkOperationProgressState {
  const { jobId, onProgress, onComplete, onError, fallbackPollingInterval = 1500 } = options;
  
  const [state, setState] = useState<BulkOperationProgressState>({
    isConnected: false,
    operationType: '',
    status: 'idle',
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    matched: 0,
    current: null,
    message: '',
    isComplete: false,
    error: null,
    errors: [],
    activity: [],
    percentComplete: 0,
  });

  const pollingRef = useRef<number | null>(null);
  const wsActiveRef = useRef(false);
  const lastWsUpdateRef = useRef<number>(0);
  const activityLogRef = useRef<Array<{ timestamp: string; type: string; message: string; details?: any }>>([]);

  const startPolling = useCallback((jobId: string) => {
    if (pollingRef.current) return;

    pollingRef.current = window.setInterval(async () => {
      try {
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`/api/bulk/jobs/${jobId}`, {
          credentials: 'include',
          headers,
        });
        if (response.ok) {
          const data = await response.json();
          const job = data.job;
          
          const percentComplete = job.totalItems > 0 
            ? Math.round((job.processedItems / job.totalItems) * 100) 
            : 0;
          
          setState(prev => ({
            ...prev,
            operationType: job.operationType,
            status: job.status,
            total: job.totalItems ?? prev.total,
            processed: job.processedItems ?? prev.processed,
            success: job.successCount ?? prev.success,
            failed: job.failedCount ?? prev.failed,
            skipped: job.skippedCount ?? prev.skipped,
            matched: job.matchedCount ?? prev.matched,
            message: `Processing... ${job.processedItems}/${job.totalItems}`,
            isComplete: job.status === 'completed' || job.status === 'failed',
            error: job.status === 'failed' ? 'Operation failed' : null,
            errors: job.errors || [],
            percentComplete,
          }));

          if (job.status === 'completed') {
            onComplete?.({
              type: 'bulk-progress',
              jobId,
              operationType: job.operationType,
              status: job.status,
              totals: {
                total: job.totalItems,
                processed: job.processedItems,
                success: job.successCount,
                failed: job.failedCount,
                skipped: job.skippedCount,
                matched: job.matchedCount,
              },
            });
          } else if (job.status === 'failed') {
            onError?.({
              type: 'bulk-progress',
              jobId,
              operationType: job.operationType,
              status: job.status,
              message: 'Operation failed',
            });
          }

          if (job.status === 'completed' || job.status === 'failed') {
            if (pollingRef.current) {
              window.clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch (error) {
        console.error('Bulk operation polling error:', error);
      }
    }, fallbackPollingInterval);
  }, [fallbackPollingInterval, onComplete, onError]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleProgress = useCallback((event: BulkOperationEvent) => {
    wsActiveRef.current = true;
    lastWsUpdateRef.current = Date.now();

    const percentComplete = event.totals && event.totals.total > 0 
      ? Math.round((event.totals.processed / event.totals.total) * 100) 
      : 0;

    if (event.message) {
      const newActivity = {
        timestamp: new Date().toISOString(),
        type: event.current?.step || 'progress',
        message: event.message,
        details: event.current,
      };
      activityLogRef.current = [...activityLogRef.current.slice(-99), newActivity];
    }

    setState(prev => ({
      ...prev,
      isConnected: true,
      operationType: event.operationType || prev.operationType,
      status: event.status || prev.status,
      total: event.totals?.total ?? prev.total,
      processed: event.totals?.processed ?? prev.processed,
      success: event.totals?.success ?? prev.success,
      failed: event.totals?.failed ?? prev.failed,
      skipped: event.totals?.skipped ?? prev.skipped,
      matched: event.totals?.matched ?? prev.matched,
      current: event.current || null,
      message: event.message || prev.message,
      isComplete: event.status === 'completed' || event.status === 'failed',
      error: event.status === 'failed' ? (event.message || 'Operation failed') : null,
      errors: event.errors || prev.errors,
      activity: activityLogRef.current,
      percentComplete,
    }));

    stopPolling();

    if (event.status === 'completed') {
      onComplete?.(event);
    } else if (event.status === 'failed') {
      onError?.(event);
    } else {
      onProgress?.(event);
    }
  }, [onProgress, onComplete, onError, stopPolling]);

  useEffect(() => {
    if (!jobId) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        total: 0,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        matched: 0,
        current: null,
        message: '',
        isComplete: false,
        error: null,
        errors: [],
        activity: [],
        percentComplete: 0,
      }));
      activityLogRef.current = [];
      return;
    }

    wsActiveRef.current = false;
    lastWsUpdateRef.current = 0;
    activityLogRef.current = [];

    setState(prev => ({
      ...prev,
      status: 'running',
      message: 'Starting operation...',
    }));

    startPolling(jobId);

    const unsubscribe = bulkOperationsWS.subscribe(jobId, handleProgress);

    const unsubscribeConnection = bulkOperationsWS.onConnectionChange((connected) => {
      setState(prev => ({ ...prev, isConnected: connected }));
      
      if (connected && wsActiveRef.current) {
        stopPolling();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeConnection();
      stopPolling();
    };
  }, [jobId, handleProgress, startPolling, stopPolling]);

  return state;
}

export function getOperationDisplayName(operationType: BulkOperationType | string): string {
  switch (operationType) {
    case 'bulk-match':
      return 'Match Companies';
    case 'bulk-autofill':
      return 'Auto-fill Details';
    case 'bulk-delete':
      return 'Delete Contacts';
    case 'bulk-import-companies':
      return 'Import Companies';
    default:
      return 'Bulk Operation';
  }
}

export function getOperationIcon(operationType: BulkOperationType | string): string {
  switch (operationType) {
    case 'bulk-match':
      return 'link';
    case 'bulk-autofill':
      return 'magic-wand';
    case 'bulk-delete':
      return 'trash';
    case 'bulk-import-companies':
      return 'upload';
    default:
      return 'cog';
  }
}
