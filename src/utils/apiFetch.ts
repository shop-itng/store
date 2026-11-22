import { captureAppError } from './sentry';

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

export interface ApiResponse<T = any> {
  status: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: any;
}

export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = 15000, retries = 1, ...fetchOpts } = options;
  const isGet = !fetchOpts.method || fetchOpts.method.toUpperCase() === 'GET';
  const url = endpoint.startsWith('http') ? endpoint : endpoint;

  let attempt = 0;
  const maxAttempts = isGet ? retries + 1 : 1;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOpts,
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(fetchOpts.headers || {}),
        },
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        const errObj = {
          status: false,
          error: 'NON_JSON_RESPONSE',
          message: response.ok ? 'Invalid response format from server' : `Server error (${response.status})`,
          statusCode: response.status,
          rawText: text.substring(0, 200),
        };
        if (!response.ok && attempt < maxAttempts && isGet) {
          continue;
        }
        captureAppError(new Error(`API non-JSON response from ${url}: status ${response.status}`), { route: url, status: response.status });
        return errObj as any;
      }

      const json = await response.json();
      if (!response.ok) {
        const errObj = {
          status: false,
          error: json.error || 'SERVER_ERROR',
          message: json.message || json.error || `Request failed with status ${response.status}`,
          statusCode: response.status,
          ...json,
        };
        if (response.status >= 500 && attempt < maxAttempts && isGet) {
          continue;
        }
        captureAppError(new Error(`API error from ${url}: status ${response.status}`), { route: url, status: response.status, error: errObj.message });
        return errObj as any;
      }

      return json;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      const errorMessage = isAbort ? 'Request timed out. Please check your network connection.' : (err.message || 'Failed to fetch / Network error');

      if (attempt < maxAttempts && isGet && !isAbort) {
        continue;
      }

      captureAppError(err, { route: url, timeout: isAbort });
      return {
        status: false,
        error: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: errorMessage,
        statusCode: 0,
      } as any;
    }
  }

  return {
    status: false,
    error: 'MAX_RETRIES_EXCEEDED',
    message: 'Failed to complete request after retries.',
    statusCode: 0,
  } as any;
}
