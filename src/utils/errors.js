/**
 * @fileoverview Standardized error classes and utilities for JSON-RPC 2.0.
 * Includes custom AppError subclasses for validation, config, provider, and rate limits.
 * Also includes JSON-RPC error translation function.
 */

/**
 * Standard JSON-RPC 2.0 error codes.
 * Reference: https://www.jsonrpc.org/specification#error_object
 */
export const JSON_RPC_ERRORS = {
  PARSE_ERROR:        { code: -32700, message: 'Parse error' },
  INVALID_REQUEST:    { code: -32600, message: 'Invalid request' },
  METHOD_NOT_FOUND:   { code: -32601, message: 'Method not found' },
  INVALID_PARAMS:     { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR:     { code: -32603, message: 'Internal error' },
  SERVER_ERROR:       { code: -32000, message: 'Server error' },
};

/**
 * Base class for application-level errors.
 * All custom errors extend from this.
 */
export class AppError extends Error {

  /**
   * @param {string} message - Error message
   * @param {Object} [options]
   * @param {string} [options.code='APP_ERROR'] - Custom app-level code
   * @param {number} [options.httpStatus=400] - Associated HTTP status
   * @param {Error} [options.cause] - Root cause, if available
   * @param {any} [options.extra] - Any extra data to attach
   */
  constructor(message, { code = 'APP_ERROR', httpStatus = 400, cause, extra } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    if (cause) this.cause = cause;
    if (extra) this.extra = extra;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown for invalid parameters or user input.
 */
export class ValidationError extends AppError {
  constructor(message, extra) {
    super(message, { code: 'VALIDATION_ERROR', httpStatus: 400, extra });
  }
}

/**
 * Error thrown when a misconfiguration is detected (e.g., missing API key).
 */
export class ConfigError extends AppError {
  constructor(message, extra) {
    super(message, { code: 'CONFIG_ERROR', httpStatus: 500, extra });
  }
}

/**
 * Error representing failures from upstream providers (e.g., Google APIs).
 */
export class ProviderError extends AppError {
  constructor(message, extra) {
    super(message, { code: 'PROVIDER_ERROR', httpStatus: 502, extra });
  }
}

/**
 * Error representing a rate limit / quota exhaustion situation.
 */
export class RateLimitError extends AppError {
  constructor(message, extra) {
    super(message, { code: 'RATE_LIMIT', httpStatus: 429, extra });
  }
}

/**
 * Converts an AppError to a standard JSON-RPC 2.0 error response.
 *
 * @param {string|number|null} id - ID of the request
 * @param {AppError} err - Instance of AppError or subclass
 * @returns {Object} JSON-RPC 2.0 error object
 */
export function toJsonRpcError(id, err) {
  const base = { ...JSON_RPC_ERRORS.SERVER_ERROR };
  const data = {
    appCode: err.code || 'APP_ERROR',
    message: err.message,
  };

  if (err.extra) data.extra = err.extra;

  if (err instanceof ValidationError) {
    return { jsonrpc: '2.0', id, error: { ...JSON_RPC_ERRORS.INVALID_PARAMS, data } };
  }
  if (err instanceof ConfigError) {
    return { jsonrpc: '2.0', id, error: { ...JSON_RPC_ERRORS.INTERNAL_ERROR, data } };
  }
  if (err instanceof RateLimitError) {
    return { jsonrpc: '2.0', id, error: { code: -32001, message: 'Rate limit', data } };
  }
  if (err instanceof ProviderError) {
    return { jsonrpc: '2.0', id, error: { code: -32002, message: 'Upstream provider error', data } };
  }

  return { jsonrpc: '2.0', id, error: { ...base, data } };
}