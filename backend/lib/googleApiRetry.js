const { classifyGoogleApiError } = require('./googleApiErrors');

/**
 * @typedef {Object} RetryOptions
 * @property {number} [maxRetries=5] - Max retry attempts after the initial call.
 * @property {number} [baseDelayMs=500] - Base delay for exponential backoff.
 * @property {number} [maxDelayMs=15000] - Delay is capped at this value before jitter is added.
 * @property {string} [apiMethod] - Name attached to the classified error for logging (optional).
 * @property {(attempt: number, error: import('./googleApiErrors').GoogleApiError, delayMs: number) => void} [onRetry]
 *   Called right before each retry sleep, so the caller can log it.
 */

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying on Google API errors classified as retryable (rate limits,
 * transient 5xx/network errors) using exponential backoff with jitter. Errors that
 * are NOT retryable (auth, permission, not-found) are thrown immediately on the
 * first failure — there's no point burning retries on something that can't succeed.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {RetryOptions} [options]
 * @returns {Promise<T>}
 * @throws {import('./googleApiErrors').GoogleApiError} the classified error, once retries are exhausted or it's non-retryable.
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 5,
    baseDelayMs = 500,
    maxDelayMs = 15000,
    apiMethod,
    onRetry,
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (rawError) {
      const error = classifyGoogleApiError(rawError, apiMethod);
      lastError = error;

      if (!error.retryable || attempt === maxRetries) throw error;

      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = exponential * Math.random() * 0.3;
      const delayMs = Math.round(exponential + jitter);

      onRetry?.(attempt + 1, error, delayMs);
      await sleep(delayMs);
    }
  }
  // Unreachable — the loop always returns or throws — but keeps TS/JSDoc control-flow analysis happy.
  throw lastError;
}

module.exports = { withRetry, sleep };
