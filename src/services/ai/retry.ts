// Resilience layer: retry + timeout + validation wrapper for OpenAI calls.

export class OpenAITimeoutError extends Error {
  constructor(message = 'The AI took too long to respond.') {
    super(message);
    this.name = 'OpenAITimeoutError';
  }
}

export class OpenAIValidationError extends Error {
  constructor(message = 'The AI returned an unexpected response shape.') {
    super(message);
    this.name = 'OpenAIValidationError';
  }
}

export class OpenAIRateLimitError extends Error {
  constructor(message = 'OpenAI rate limit or quota reached.') {
    super(message);
    this.name = 'OpenAIRateLimitError';
  }
}

export class OpenAIAuthError extends Error {
  constructor(message = 'The OpenAI API key is invalid or lacks permission.') {
    super(message);
    this.name = 'OpenAIAuthError';
  }
}

export class OpenAIServerError extends Error {
  constructor(message = 'OpenAI returned a server error.') {
    super(message);
    this.name = 'OpenAIServerError';
  }
}

export interface ResilienceOptions<T> {
  operation: string;
  schema: (raw: unknown) => T;
  maxAttempts?: number;
  timeoutMs?: number;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      (error as { code?: string }).code === 'ABORT_ERR')
  );
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const s = (error as { status?: number }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new OpenAITimeoutError());
      }, { once: true });
    }
  });
}

export async function withResilience<T>(
  call: (signal: AbortSignal) => Promise<unknown>,
  opts: ResilienceOptions<T>,
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const raw = await call(controller.signal);
      clearTimeout(timeoutId);
      // Validation may throw - treat as retryable.
      return opts.schema(raw);
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const status = statusOf(error);

      // Non-retryable auth failures - surface immediately.
      if (status === 401 || status === 403) {
        throw new OpenAIAuthError(
          status === 401
            ? 'Invalid OpenAI API key.'
            : 'This OpenAI API key lacks access to GPT-4o.',
        );
      }

      const isTimeout = isAbortError(error);
      const isRateLimit = status === 429;
      const isServer = typeof status === 'number' && status >= 500;
      const isValidation = error instanceof OpenAIValidationError;
      const isJsonParse = error instanceof SyntaxError;

      const retryable = isTimeout || isRateLimit || isServer || isValidation || isJsonParse;

      if (!retryable || attempt === maxAttempts - 1) {
        if (isTimeout) throw new OpenAITimeoutError();
        if (isRateLimit) throw new OpenAIRateLimitError();
        if (isServer) throw new OpenAIServerError();
        if (isValidation) throw error;
        if (isJsonParse) throw new OpenAIValidationError('AI response was not valid JSON.');
        throw error;
      }

      // Exponential backoff: 250ms → 500ms → 1000ms (+ up to 100ms jitter).
      const backoff = 250 * 2 ** attempt + Math.floor(Math.random() * 100);
      await wait(backoff);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown error');
}
