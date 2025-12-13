import { PostgrestBuilder } from '@supabase/postgrest-js';

export interface QueryOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  timedOut: boolean;
}

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY = 500;

export async function executeWithTimeout<T>(
  queryBuilder: PostgrestBuilder<T>,
  options: QueryOptions = {}
): Promise<QueryResult<T>> {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const maxRetries = options.retries || DEFAULT_RETRIES;
  const retryDelay = options.retryDelay || DEFAULT_RETRY_DELAY;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        queryBuilder,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        ),
      ]);

      if ('error' in result && result.error) {
        const error = result.error as any;

        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          return {
            data: null,
            error: new Error('Session expired. Please log in again.'),
            timedOut: false,
          };
        }

        if (error.code === '42501' || error.message?.includes('permission')) {
          return {
            data: null,
            error: new Error('You do not have permission to access this data.'),
            timedOut: false,
          };
        }

        lastError = new Error(error.message || 'Database query failed');

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }

        return {
          data: null,
          error: lastError,
          timedOut: false,
        };
      }

      return {
        data: (result as any).data || null,
        error: null,
        timedOut: false,
      };
    } catch (error: any) {
      if (error.message === 'Query timeout') {
        return {
          data: null,
          error: new Error('Request timed out. Please check your connection and try again.'),
          timedOut: true,
        };
      }

      lastError = error;

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
    }
  }

  return {
    data: null,
    error: lastError || new Error('Query failed after retries'),
    timedOut: false,
  };
}

export function createAbortController(timeoutMs: number = DEFAULT_TIMEOUT): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (!controller.signal.aborted) {
        controller.abort();
      }
    },
  };
}

export function isNetworkError(error: any): boolean {
  return (
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.message?.includes('timeout') ||
    error?.code === 'ECONNABORTED'
  );
}

export function isAuthError(error: any): boolean {
  return (
    error?.code === 'PGRST301' ||
    error?.message?.includes('JWT') ||
    error?.message?.includes('expired') ||
    error?.message?.includes('unauthorized')
  );
}

export function isPermissionError(error: any): boolean {
  return (
    error?.code === '42501' ||
    error?.message?.includes('permission') ||
    error?.message?.includes('policy')
  );
}

export function getUserFriendlyErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred';

  if (isAuthError(error)) {
    return 'Your session has expired. Please log in again.';
  }

  if (isPermissionError(error)) {
    return 'You do not have permission to access this data.';
  }

  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }

  if (error.message === 'Query timeout') {
    return 'The request is taking too long. Please try again.';
  }

  return error.message || 'An unexpected error occurred. Please try again.';
}
