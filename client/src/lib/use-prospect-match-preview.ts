import { useState, useCallback, useRef, useEffect } from 'react';

export interface MatchedCompany {
  id: string;
  name: string;
  industry: string | null;
  employees: number | null;
  employeeSizeBracket: string | null;
  website: string | null;
  linkedinUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  technologies: string | null;
  annualRevenue: string | null;
}

export interface MatchPreviewEvent {
  step: string;
  message: string;
  progress: number;
  domain?: string;
  matchType?: 'domain' | 'name' | null;
  confidence?: number;
  matched?: boolean;
  company?: MatchedCompany | null;
  error?: string;
}

export interface MatchPreviewState {
  isLoading: boolean;
  progress: number;
  currentStep: string;
  message: string;
  matched: boolean;
  matchType: 'domain' | 'name' | null;
  confidence: number;
  company: MatchedCompany | null;
  error: string | null;
  steps: MatchPreviewEvent[];
}

const initialState: MatchPreviewState = {
  isLoading: false,
  progress: 0,
  currentStep: '',
  message: '',
  matched: false,
  matchType: null,
  confidence: 0,
  company: null,
  error: null,
  steps: [],
};

export function useProspectMatchPreview() {
  const [state, setState] = useState<MatchPreviewState>(initialState);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(initialState);
  }, []);

  const startPreview = useCallback((email: string, companyName: string) => {
    reset();
    
    if (!email && !companyName) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, steps: [] }));

    const params = new URLSearchParams();
    if (email) params.append('email', email);
    if (companyName) params.append('company', companyName);

    const token = localStorage.getItem('authToken');
    
    abortControllerRef.current = new AbortController();
    
    fetch(`/api/prospects/match-preview?${params.toString()}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      credentials: 'include',
      signal: abortControllerRef.current.signal,
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error('Failed to start match preview');
        }
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: MatchPreviewEvent = JSON.parse(line.slice(6));
                
                setState(prev => ({
                  ...prev,
                  progress: event.progress,
                  currentStep: event.step,
                  message: event.message,
                  steps: [...prev.steps, event],
                  ...(event.step === 'complete' && {
                    isLoading: false,
                    matched: event.matched || false,
                    matchType: event.matchType || null,
                    confidence: event.confidence || 0,
                    company: event.company || null,
                  }),
                  ...(event.step === 'error' && {
                    isLoading: false,
                    error: event.error || 'Unknown error',
                  }),
                }));
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
        
        setState(prev => ({ ...prev, isLoading: false }));
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Match preview error:', error);
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
        }
      });
  }, [reset]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    startPreview,
    reset,
  };
}
