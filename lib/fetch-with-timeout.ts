export const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

export class RequestTimeoutError extends Error {
  constructor(public readonly timeoutMs: number, options?: ErrorOptions) {
    super(`External request timed out after ${timeoutMs}ms`, options);
    this.name = "RequestTimeoutError";
  }
}

export class RequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("External request was aborted", options);
    this.name = "RequestAbortedError";
  }
}

export type RequestTimeoutOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function requestWithTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RequestTimeoutOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Request timeout must be a positive finite number");
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    return await operation(signal);
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new RequestTimeoutError(timeoutMs, { cause: error });
    }
    if (options.signal?.aborted) {
      throw new RequestAbortedError({ cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
