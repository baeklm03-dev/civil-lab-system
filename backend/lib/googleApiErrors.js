/**
 * Typed error hierarchy for failures raised by googleapis / google-auth-library calls.
 * Every error carries enough context (status code, Google's own message, which API
 * method was being called, and whether retrying could help) for both `googleApiRetry`
 * and the Express route layer to make a decision without re-parsing raw error shapes.
 */

/**
 * @typedef {Object} GoogleApiErrorOptions
 * @property {number} [statusCode] - HTTP status code from the failed request, if any.
 * @property {string} [googleMessage] - The raw message/reason Google returned.
 * @property {string} [apiMethod] - Name of the wrapper method that was calling the API (e.g. "appendRows").
 * @property {boolean} [retryable] - Whether this class of error is safe to retry.
 * @property {string} [reason] - Google's machine-readable error reason (e.g. "rateLimitExceeded"), if present.
 * @property {unknown} [cause] - The original error thrown by googleapis, for debugging.
 */

class GoogleApiError extends Error {
  /**
   * @param {string} message
   * @param {GoogleApiErrorOptions} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode;
    this.googleMessage = options.googleMessage ?? message;
    this.apiMethod = options.apiMethod;
    this.retryable = options.retryable ?? false;
    this.reason = options.reason;
    if (options.cause) this.cause = options.cause;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Invalid/expired/revoked credentials. Not retryable — needs a human to fix the key. */
class GoogleAuthError extends GoogleApiError {
  constructor(message, options = {}) {
    super(message, { ...options, retryable: false });
  }
}

/** 403 permission denied — e.g. the sheet/file isn't shared with the service account. Not retryable. */
class GooglePermissionError extends GoogleApiError {
  constructor(message, options = {}) {
    super(message, { ...options, retryable: false });
  }
}

/** 429, or 403 with a rate-limit reason. Retryable with backoff. */
class GoogleRateLimitError extends GoogleApiError {
  constructor(message, options = {}) {
    super(message, { ...options, retryable: true });
  }
}

/** 5xx responses, network resets/timeouts. Retryable with backoff. */
class GoogleTransientError extends GoogleApiError {
  constructor(message, options = {}) {
    super(message, { ...options, retryable: true });
  }
}

/** 404 — spreadsheet/sheet/file ID doesn't exist. Not retryable. */
class GoogleNotFoundError extends GoogleApiError {
  constructor(message, options = {}) {
    super(message, { ...options, retryable: false });
  }
}

const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'dailyLimitExceeded',
]);

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE',
]);

/**
 * Inspects a raw error thrown by `googleapis` or `google-auth-library` and returns
 * the matching typed `GoogleApiError` subclass. Errors that are already classified
 * are returned unchanged (idempotent — safe to call more than once on the same error).
 *
 * @param {unknown} error - The raw error caught from a googleapis/auth-library call.
 * @param {string} [apiMethod] - Name of the calling wrapper method, attached to the result for logging.
 * @returns {GoogleApiError}
 */
function classifyGoogleApiError(error, apiMethod) {
  if (error instanceof GoogleApiError) return error;

  const err = /** @type {any} */ (error);
  const rawMessage = err?.message || 'Unknown Google API error';

  if (TRANSIENT_NETWORK_CODES.has(err?.code)) {
    return new GoogleTransientError(rawMessage, { apiMethod, reason: err.code, cause: error });
  }

  const statusCode = Number(err?.code ?? err?.response?.status ?? err?.status) || undefined;
  const reason = err?.errors?.[0]?.reason
    ?? err?.response?.data?.error?.errors?.[0]?.reason
    ?? err?.response?.data?.error?.status;
  const googleMessage = err?.errors?.[0]?.message
    ?? err?.response?.data?.error?.message
    ?? rawMessage;

  if (
    /invalid_grant|invalid_rapt|invalid_client|invalid credentials/i.test(rawMessage) ||
    statusCode === 401
  ) {
    return new GoogleAuthError(googleMessage, { statusCode: statusCode ?? 401, apiMethod, reason, cause: error });
  }

  if (statusCode === 429 || RATE_LIMIT_REASONS.has(reason)) {
    return new GoogleRateLimitError(googleMessage, { statusCode: statusCode ?? 429, apiMethod, reason, cause: error });
  }

  if (statusCode === 403) {
    return new GooglePermissionError(googleMessage, { statusCode, apiMethod, reason, cause: error });
  }

  if (statusCode === 404) {
    return new GoogleNotFoundError(googleMessage, { statusCode, apiMethod, reason, cause: error });
  }

  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return new GoogleTransientError(googleMessage, { statusCode, apiMethod, reason, cause: error });
  }

  // Unrecognized shape (e.g. a 400 Bad Request, or a non-Google error) — default to
  // NOT retryable. Retrying blind is more dangerous than surfacing it immediately.
  return new GoogleApiError(googleMessage, { statusCode, apiMethod, retryable: false, reason, cause: error });
}

module.exports = {
  GoogleApiError,
  GoogleAuthError,
  GooglePermissionError,
  GoogleRateLimitError,
  GoogleTransientError,
  GoogleNotFoundError,
  classifyGoogleApiError,
};
